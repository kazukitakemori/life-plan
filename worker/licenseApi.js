import {
  createId,
  formatLicenseKeyForDisplay,
  generateLicenseKey,
  getLicenseKeyHint,
  hashLicenseKey,
  isAdminAuthorized,
  isLicenseKeyFormatValid,
  jsonResponse,
  normalizeLicenseKey,
  readJson,
} from './licenseShared.js';

const MAX_DEVICES_DEFAULT = 2;

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} keyHash
 */
async function findLicenseByHash(db, keyHash) {
  return db
    .prepare(
      `SELECT id, key_hash, key_hint, status, max_devices, note, created_at
       FROM license_keys
       WHERE key_hash = ?`,
    )
    .bind(keyHash)
    .first();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} licenseId
 */
async function listDevices(db, licenseId) {
  const { results } = await db
    .prepare(
      `SELECT device_id, device_label, activated_at, last_seen_at
       FROM license_devices
       WHERE license_id = ?
       ORDER BY activated_at ASC`,
    )
    .bind(licenseId)
    .all();
  return results ?? [];
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} licenseId
 * @param {string} deviceId
 * @param {string} now
 */
async function touchDevice(db, licenseId, deviceId, now) {
  await db
    .prepare(
      `UPDATE license_devices
       SET last_seen_at = ?
       WHERE license_id = ? AND device_id = ?`,
    )
    .bind(now, licenseId, deviceId)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} licenseId
 * @param {string} deviceId
 */
async function removeDevice(db, licenseId, deviceId) {
  await db
    .prepare(
      `DELETE FROM license_devices
       WHERE license_id = ? AND device_id = ?`,
    )
    .bind(licenseId, deviceId)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} licenseId
 * @param {string} deviceId
 * @param {string | null} deviceLabel
 * @param {string} now
 */
async function addDevice(db, licenseId, deviceId, deviceLabel, now) {
  await db
    .prepare(
      `INSERT INTO license_devices (id, license_id, device_id, device_label, activated_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(createId(), licenseId, deviceId, deviceLabel, now, now)
    .run();
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} key
 * @param {string} pepper
 */
async function resolveLicense(db, key, pepper) {
  if (!isLicenseKeyFormatValid(key)) {
    return { error: 'INVALID_KEY', message: 'ライセンスキーの形式が正しくありません。' };
  }
  const keyHash = await hashLicenseKey(key, pepper);
  const license = await findLicenseByHash(db, keyHash);
  if (!license) {
    return { error: 'INVALID_KEY', message: 'ライセンスキーが見つかりません。' };
  }
  if (license.status !== 'active') {
    return { error: 'REVOKED', message: 'このライセンスキーは無効化されています。' };
  }
  return { license, keyHash };
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 */
export async function handleLicenseApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/license/status' && request.method === 'GET') {
    return handleStatus(url, env);
  }

  if (path === '/api/license/activate' && request.method === 'POST') {
    return handleActivate(request, env);
  }

  if (path === '/api/license/deactivate' && request.method === 'POST') {
    return handleDeactivate(request, env);
  }

  if (path.startsWith('/api/admin/')) {
    return handleAdminApi(request, env, path);
  }

  return jsonResponse({ error: 'NOT_FOUND' }, 404);
}

/**
 * @param {URL} url
 * @param {Record<string, string>} env
 */
async function handleStatus(url, env) {
  const key = url.searchParams.get('key') ?? '';
  const deviceId = url.searchParams.get('deviceId') ?? '';
  if (!key || !deviceId) {
    return jsonResponse({ valid: false, error: 'MISSING_PARAMS' }, 400);
  }

  const resolved = await resolveLicense(env.DB, key, env.LICENSE_PEPPER);
  if ('error' in resolved) {
    return jsonResponse({
      valid: false,
      error: resolved.error,
      message: resolved.message,
    });
  }

  const devices = await listDevices(env.DB, resolved.license.id);
  const current = devices.find((device) => device.device_id === deviceId);
  if (!current) {
    return jsonResponse({
      valid: false,
      error: 'NOT_ACTIVATED',
      message: 'このブラウザはまだライセンス登録されていません。',
      devices: serializeDevices(devices),
      maxDevices: resolved.license.max_devices,
    });
  }

  const now = new Date().toISOString();
  await touchDevice(env.DB, resolved.license.id, deviceId, now);

  return jsonResponse({
    valid: true,
    keyHint: resolved.license.key_hint,
    devices: serializeDevices(devices),
    maxDevices: resolved.license.max_devices,
  });
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 */
async function handleActivate(request, env) {
  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: 'INVALID_BODY' }, 400);

  const key = String(body.key ?? '');
  const deviceId = String(body.deviceId ?? '');
  const deviceLabel = body.deviceLabel ? String(body.deviceLabel) : null;
  const replaceDeviceId = body.replaceDeviceId
    ? String(body.replaceDeviceId)
    : null;

  if (!key || !deviceId) {
    return jsonResponse({ ok: false, error: 'MISSING_PARAMS' }, 400);
  }

  const resolved = await resolveLicense(env.DB, key, env.LICENSE_PEPPER);
  if ('error' in resolved) {
    return jsonResponse({ ok: false, error: resolved.error, message: resolved.message }, 400);
  }

  const licenseId = resolved.license.id;
  const maxDevices = resolved.license.max_devices ?? MAX_DEVICES_DEFAULT;
  const devices = await listDevices(env.DB, licenseId);
  const now = new Date().toISOString();
  const existing = devices.find((device) => device.device_id === deviceId);

  if (existing) {
    await touchDevice(env.DB, licenseId, deviceId, now);
    const refreshed = await listDevices(env.DB, licenseId);
    return jsonResponse({
      ok: true,
      keyHint: resolved.license.key_hint,
      devices: serializeDevices(refreshed),
      maxDevices,
    });
  }

  if (devices.length >= maxDevices) {
    if (!replaceDeviceId) {
      return jsonResponse(
        {
          ok: false,
          error: 'DEVICE_LIMIT',
          message: `このライセンスキーは最大${maxDevices}つのブラウザ（利用環境）までです。古い登録を解除してから再度お試しください。`,
          devices: serializeDevices(devices),
          maxDevices,
        },
        409,
      );
    }

    const replaceTarget = devices.find(
      (device) => device.device_id === replaceDeviceId,
    );
    if (!replaceTarget) {
      return jsonResponse(
        {
          ok: false,
          error: 'REPLACE_TARGET_NOT_FOUND',
          message: '解除対象の利用環境が見つかりません。',
          devices: serializeDevices(devices),
          maxDevices,
        },
        400,
      );
    }

    await removeDevice(env.DB, licenseId, replaceDeviceId);
  }

  await addDevice(env.DB, licenseId, deviceId, deviceLabel, now);
  const refreshed = await listDevices(env.DB, licenseId);

  return jsonResponse({
    ok: true,
    keyHint: resolved.license.key_hint,
    devices: serializeDevices(refreshed),
    maxDevices,
  });
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 */
async function handleDeactivate(request, env) {
  const body = await readJson(request);
  if (!body) return jsonResponse({ ok: false, error: 'INVALID_BODY' }, 400);

  const key = String(body.key ?? '');
  const deviceId = String(body.deviceId ?? '');
  const targetDeviceId = String(body.targetDeviceId ?? '');

  if (!key || !deviceId || !targetDeviceId) {
    return jsonResponse({ ok: false, error: 'MISSING_PARAMS' }, 400);
  }

  const resolved = await resolveLicense(env.DB, key, env.LICENSE_PEPPER);
  if ('error' in resolved) {
    return jsonResponse({ ok: false, error: resolved.error, message: resolved.message }, 400);
  }

  const devices = await listDevices(env.DB, resolved.license.id);
  const requester = devices.find((device) => device.device_id === deviceId);
  const target = devices.find((device) => device.device_id === targetDeviceId);

  if (!target) {
    return jsonResponse(
      { ok: false, error: 'TARGET_NOT_FOUND', message: '解除対象の利用環境が見つかりません。' },
      404,
    );
  }

  if (!requester && devices.length >= (resolved.license.max_devices ?? MAX_DEVICES_DEFAULT)) {
    return jsonResponse(
      {
        ok: false,
        error: 'UNAUTHORIZED_DEVICE',
        message: 'このブラウザからは解除できません。登録済みのブラウザで操作するか、新規登録時に置き換えてください。',
      },
      403,
    );
  }

  await removeDevice(env.DB, resolved.license.id, targetDeviceId);
  const refreshed = await listDevices(env.DB, resolved.license.id);

  return jsonResponse({
    ok: true,
    devices: serializeDevices(refreshed),
    maxDevices: resolved.license.max_devices ?? MAX_DEVICES_DEFAULT,
  });
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 * @param {string} path
 */
async function handleAdminApi(request, env, path) {
  if (!isAdminAuthorized(request, env.ADMIN_SECRET)) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  if (path === '/api/admin/keys/generate' && request.method === 'POST') {
    const body = (await readJson(request)) ?? {};
    const count = Math.min(Math.max(Number(body.count ?? 1), 1), 50);
    const note = body.note ? String(body.note) : null;
    const now = new Date().toISOString();
    const keys = [];

    for (let i = 0; i < count; i += 1) {
      const plainKey = generateLicenseKey();
      const keyHash = await hashLicenseKey(plainKey, env.LICENSE_PEPPER);
      const id = createId();
      await env.DB.prepare(
        `INSERT INTO license_keys (id, key_hash, key_hint, key_display, status, max_devices, note, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
        .bind(
          id,
          keyHash,
          getLicenseKeyHint(plainKey),
          formatLicenseKeyForDisplay(plainKey),
          MAX_DEVICES_DEFAULT,
          note,
          now,
        )
        .run();
      keys.push({
        key: formatLicenseKeyForDisplay(plainKey),
        hint: getLicenseKeyHint(plainKey),
        note,
      });
    }

    return jsonResponse({ ok: true, keys });
  }

  if (path === '/api/admin/keys' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT lk.id, lk.key_hint, lk.key_display, lk.status, lk.max_devices, lk.note, lk.created_at,
              COUNT(ld.id) AS device_count
       FROM license_keys lk
       LEFT JOIN license_devices ld ON ld.license_id = lk.id
       GROUP BY lk.id
       ORDER BY lk.created_at DESC
       LIMIT 200`,
    ).all();

    return jsonResponse({ ok: true, keys: results ?? [] });
  }

  if (path.startsWith('/api/admin/keys/') && path.endsWith('/revoke') && request.method === 'POST') {
    const licenseId = path.split('/')[4];
    await env.DB.prepare(`UPDATE license_keys SET status = 'revoked' WHERE id = ?`)
      .bind(licenseId)
      .run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'NOT_FOUND' }, 404);
}

/**
 * @param {Array<Record<string, unknown>>} devices
 */
function serializeDevices(devices) {
  return devices.map((device) => ({
    deviceId: device.device_id,
    deviceLabel: device.device_label ?? 'ブラウザ',
    activatedAt: device.activated_at,
    lastSeenAt: device.last_seen_at,
  }));
}
