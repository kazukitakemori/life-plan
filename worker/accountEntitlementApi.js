import {
  hashLicenseKey,
  isLicenseKeyFormatValid,
  jsonResponse,
  readJson,
} from './licenseShared.js';

const SESSION_COOKIE = 'lp_session';

function parseCookies(request) {
  const header = request.headers.get('Cookie') ?? '';
  const cookies = new Map();
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isSameOriginMutation(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function changedRows(result) {
  return Number(result?.meta?.changes ?? 0);
}

async function getWorkspaceContext(request, env) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  return env.DB
    .prepare(
      `SELECT
         u.id AS user_id,
         w.id AS workspace_id,
         e.edition,
         e.status AS entitlement_status,
         e.trial_analysis_used
       FROM account_sessions s
       JOIN account_users u ON u.id = s.user_id
       JOIN account_workspace_members m ON m.user_id = u.id
       JOIN account_workspaces w ON w.id = m.workspace_id
       LEFT JOIN account_entitlements e ON e.workspace_id = w.id
       WHERE s.token_hash = ? AND s.expires_at > ?
       ORDER BY m.created_at ASC
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first();
}

async function requireWorkspace(request, env) {
  const context = await getWorkspaceContext(request, env);
  if (!context) {
    return {
      response: jsonResponse(
        { error: 'AUTH_REQUIRED', message: 'アカウントへログインしてください。' },
        401,
      ),
    };
  }
  return { context };
}

async function handleRedeemLicense(request, env) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const auth = await requireWorkspace(request, env);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const key = String(body?.key ?? '');
  if (!key || !isLicenseKeyFormatValid(key)) {
    return jsonResponse(
      { ok: false, error: 'INVALID_KEY', message: '利用コードの形式が正しくありません。' },
      400,
    );
  }
  if (!env.LICENSE_PEPPER) {
    return jsonResponse(
      { ok: false, error: 'LICENSE_NOT_CONFIGURED', message: '利用コード認証が設定されていません。' },
      503,
    );
  }

  const keyHash = await hashLicenseKey(key, env.LICENSE_PEPPER);
  const license = await env.DB
    .prepare(
      `SELECT id, status, edition, redeemed_workspace_id
       FROM license_keys
       WHERE key_hash = ?
       LIMIT 1`,
    )
    .bind(keyHash)
    .first();

  if (!license || license.status !== 'active') {
    return jsonResponse(
      { ok: false, error: 'INVALID_KEY', message: 'この利用コードは使用できません。' },
      400,
    );
  }
  if (
    license.redeemed_workspace_id &&
    license.redeemed_workspace_id !== auth.context.workspace_id
  ) {
    return jsonResponse(
      {
        ok: false,
        error: 'ALREADY_REDEEMED',
        message: 'この利用コードは別のアカウントに登録済みです。',
      },
      409,
    );
  }

  const existingWorkspaceLicense = await env.DB
    .prepare(
      `SELECT id
       FROM license_keys
       WHERE redeemed_workspace_id = ?
       LIMIT 1`,
    )
    .bind(auth.context.workspace_id)
    .first();

  if (existingWorkspaceLicense && existingWorkspaceLicense.id !== license.id) {
    return jsonResponse(
      {
        ok: false,
        error: 'WORKSPACE_ALREADY_LICENSED',
        message: 'このアカウントにはすでに別の利用コードが登録されています。',
      },
      409,
    );
  }

  const now = new Date().toISOString();
  const edition = license.edition === 'advisor' ? 'advisor' : 'personal';

  // Claim the code first with an atomic conditional update. If two different
  // workspaces redeem at the same time, only the first claim can succeed.
  const claimed = await env.DB
    .prepare(
      `UPDATE license_keys
       SET redeemed_workspace_id = ?, redeemed_at = COALESCE(redeemed_at, ?)
       WHERE id = ? AND status = 'active'
         AND (redeemed_workspace_id IS NULL OR redeemed_workspace_id = ?)
         AND NOT EXISTS (
           SELECT 1
           FROM license_keys existing
           WHERE existing.redeemed_workspace_id = ?
             AND existing.id <> ?
         )`,
    )
    .bind(
      auth.context.workspace_id,
      now,
      license.id,
      auth.context.workspace_id,
      auth.context.workspace_id,
      license.id,
    )
    .run();

  if (changedRows(claimed) !== 1) {
    const workspaceLicense = await env.DB
      .prepare(
        `SELECT id
         FROM license_keys
         WHERE redeemed_workspace_id = ? AND id <> ?
         LIMIT 1`,
      )
      .bind(auth.context.workspace_id, license.id)
      .first();
    if (workspaceLicense) {
      return jsonResponse(
        {
          ok: false,
          error: 'WORKSPACE_ALREADY_LICENSED',
          message: 'このアカウントにはすでに別の利用コードが登録されています。',
        },
        409,
      );
    }

    const current = await env.DB
      .prepare(
        `SELECT status, redeemed_workspace_id
         FROM license_keys
         WHERE id = ?`,
      )
      .bind(license.id)
      .first();
    if (
      current?.redeemed_workspace_id &&
      current.redeemed_workspace_id !== auth.context.workspace_id
    ) {
      return jsonResponse(
        {
          ok: false,
          error: 'ALREADY_REDEEMED',
          message: 'この利用コードは別のアカウントに登録済みです。',
        },
        409,
      );
    }
    return jsonResponse(
      { ok: false, error: 'INVALID_KEY', message: 'この利用コードは使用できません。' },
      400,
    );
  }

  // A retry by the same workspace is safe and repairs a partially completed
  // prior request if the entitlement write failed after the code was claimed.
  await env.DB
    .prepare(
      `INSERT INTO account_entitlements
         (workspace_id, edition, status, trial_analysis_used, expires_at, created_at, updated_at)
       VALUES (?, ?, 'active', 0, NULL, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET
         edition = excluded.edition,
         status = 'active',
         expires_at = NULL,
         updated_at = excluded.updated_at`,
    )
    .bind(auth.context.workspace_id, edition, now, now)
    .run();

  return jsonResponse({ ok: true, edition, status: 'active' });
}

async function handleUseTrialAnalysis(request, env) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const auth = await requireWorkspace(request, env);
  if (auth.response) return auth.response;

  const now = new Date().toISOString();
  const claimed = await env.DB
    .prepare(
      `UPDATE account_entitlements
       SET trial_analysis_used = 1, updated_at = ?
       WHERE workspace_id = ? AND status = 'trial' AND trial_analysis_used = 0`,
    )
    .bind(now, auth.context.workspace_id)
    .run();

  if (changedRows(claimed) === 1) {
    return jsonResponse({ ok: true, trialAnalysisUsed: true });
  }

  const current = await env.DB
    .prepare(
      `SELECT status, trial_analysis_used
       FROM account_entitlements
       WHERE workspace_id = ?`,
    )
    .bind(auth.context.workspace_id)
    .first();

  if (current?.status === 'trial' && Number(current.trial_analysis_used) === 1) {
    return jsonResponse(
      {
        ok: false,
        error: 'TRIAL_ALREADY_USED',
        message: '無料体験のライフプラン分析はすでに利用済みです。',
        trialAnalysisUsed: true,
      },
      409,
    );
  }
  if (current?.status === 'active') {
    return jsonResponse({ ok: true, trialAnalysisUsed: true });
  }
  return jsonResponse(
    {
      ok: false,
      error: 'ENTITLEMENT_INACTIVE',
      message: 'このアカウントでは現在ライフプラン分析を利用できません。',
    },
    403,
  );
}

/**
 * Account entitlement APIs. Returns null when the path belongs elsewhere.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function handleAccountEntitlementApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/account/redeem-license' && request.method === 'POST') {
    return handleRedeemLicense(request, env);
  }
  if (url.pathname === '/api/account/trial-analysis/use' && request.method === 'POST') {
    return handleUseTrialAnalysis(request, env);
  }
  return null;
}
