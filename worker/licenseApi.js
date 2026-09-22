import {
  createId,
  formatLicenseKeyForDisplay,
  generateLicenseKey,
  getLicenseKeyHint,
  hashLicenseKey,
  isAdminAuthorized,
  jsonResponse,
  readJson,
} from './licenseShared.js';

// max_devices is retained only because it is a NOT NULL column in the historical
// license_keys schema. Account-based access no longer uses browser/device limits.
const LEGACY_MAX_DEVICES_DEFAULT = 2;

/**
 * Admin-only API for issuing and managing account redemption codes.
 * End-user browser activation/status/deactivation endpoints were retired when
 * access moved to account sessions and workspace entitlements.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function handleLicenseApi(request, env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/admin/')) {
    return jsonResponse({ error: 'NOT_FOUND' }, 404);
  }
  return handleAdminApi(request, env, path);
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env
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
    const edition = body.edition === 'advisor' ? 'advisor' : 'personal';
    const cloudStorageEnabled =
      edition === 'advisor' ? true : Boolean(body.cloudStorageEnabled);
    const now = new Date().toISOString();
    const keys = [];

    for (let i = 0; i < count; i += 1) {
      const plainKey = generateLicenseKey();
      const keyHash = await hashLicenseKey(plainKey, env.LICENSE_PEPPER);
      const id = createId();
      await env.DB.prepare(
        `INSERT INTO license_keys
           (id, key_hash, key_hint, key_display, status, edition, cloud_storage_enabled, max_devices, note, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          keyHash,
          getLicenseKeyHint(plainKey),
          formatLicenseKeyForDisplay(plainKey),
          edition,
          cloudStorageEnabled ? 1 : 0,
          LEGACY_MAX_DEVICES_DEFAULT,
          note,
          now,
        )
        .run();
      keys.push({
        key: formatLicenseKeyForDisplay(plainKey),
        hint: getLicenseKeyHint(plainKey),
        note,
        cloudStorageEnabled,
      });
    }

    return jsonResponse({ ok: true, keys });
  }

  if (path === '/api/admin/keys' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT
         lk.id,
         lk.key_hint,
         lk.key_display,
         lk.status,
         lk.edition,
         lk.cloud_storage_enabled,
         lk.note,
         lk.created_at,
         lk.redeemed_workspace_id,
         lk.redeemed_at,
         CASE WHEN lk.redeemed_workspace_id IS NULL THEN 0 ELSE 1 END AS redeemed
       FROM license_keys lk
       ORDER BY lk.created_at DESC
       LIMIT 200`,
    ).all();

    return jsonResponse({ ok: true, keys: results ?? [] });
  }

  if (
    path.startsWith('/api/admin/keys/') &&
    path.endsWith('/revoke') &&
    request.method === 'POST'
  ) {
    const licenseId = path.split('/')[4];
    await env.DB.prepare(`UPDATE license_keys SET status = 'revoked' WHERE id = ?`)
      .bind(licenseId)
      .run();
    return jsonResponse({ ok: true });
  }

  if (
    path.startsWith('/api/admin/keys/') &&
    path.endsWith('/activate') &&
    request.method === 'POST'
  ) {
    const licenseId = path.split('/')[4];
    await env.DB.prepare(`UPDATE license_keys SET status = 'active' WHERE id = ?`)
      .bind(licenseId)
      .run();
    return jsonResponse({ ok: true });
  }

  if (path.startsWith('/api/admin/keys/') && request.method === 'DELETE') {
    const licenseId = path.split('/')[4];
    if (!licenseId || licenseId === 'generate') {
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    }
    const existing = await env.DB.prepare(
      `SELECT id, status, redeemed_workspace_id FROM license_keys WHERE id = ?`,
    )
      .bind(licenseId)
      .first();
    if (!existing) {
      return jsonResponse(
        { ok: false, error: 'NOT_FOUND', message: '利用コードが見つかりません。' },
        404,
      );
    }
    if (existing.status !== 'revoked') {
      return jsonResponse(
        {
          ok: false,
          error: 'NOT_REVOKED',
          message: '有効な利用コードは削除できません。先に無効化してください。',
        },
        409,
      );
    }
    if (existing.redeemed_workspace_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'REDEEMED_CODE',
          message: 'アカウントへ登録済みの利用コードは履歴保持のため削除できません。',
        },
        409,
      );
    }

    await env.DB.prepare(`DELETE FROM license_keys WHERE id = ?`)
      .bind(licenseId)
      .run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'NOT_FOUND' }, 404);
}
