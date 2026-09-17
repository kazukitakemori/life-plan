import { jsonResponse, readJson } from './licenseShared.js';

const SESSION_COOKIE = 'lp_session';
const MAX_PLAN_DOCUMENT_BYTES = 1_500_000;
const SESSION_TOUCH_INTERVAL_MS = 15 * 60 * 1000;

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

function serializeCookie(request, name, value, options = {}) {
  const url = new URL(request.url);
  const parts = [`${name}=${value}`, `Path=${options.path ?? '/'}`];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, options.maxAge)}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (url.protocol === 'https:') parts.push('Secure');
  return parts.join('; ');
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

async function getSessionContext(request, env) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const row = await env.DB
    .prepare(
      `SELECT
         s.id AS session_id,
         s.last_seen_at AS session_last_seen_at,
         u.id AS user_id,
         u.email,
         u.name,
         u.picture_url,
         w.id AS workspace_id,
         w.name AS workspace_name,
         w.kind AS workspace_kind,
         e.edition,
         e.status AS entitlement_status,
         e.trial_analysis_used,
         e.expires_at AS entitlement_expires_at
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
  if (!row) return null;

  const lastSeenMs = Date.parse(String(row.session_last_seen_at ?? ''));
  const shouldTouch =
    !Number.isFinite(lastSeenMs) || Date.now() - lastSeenMs >= SESSION_TOUCH_INTERVAL_MS;
  if (shouldTouch) {
    await env.DB
      .prepare(`UPDATE account_sessions SET last_seen_at = ? WHERE id = ?`)
      .bind(now, row.session_id)
      .run();
  }
  return row;
}

async function requireSession(request, env) {
  const context = await getSessionContext(request, env);
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

async function handleMe(request, env) {
  const context = await getSessionContext(request, env);
  if (!context) return jsonResponse({ authenticated: false });
  return jsonResponse({
    authenticated: true,
    user: {
      id: context.user_id,
      email: context.email,
      name: context.name,
      pictureUrl: context.picture_url,
    },
    workspace: {
      id: context.workspace_id,
      name: context.workspace_name,
      kind: context.workspace_kind,
    },
    entitlement: {
      edition: context.edition ?? 'personal',
      status: context.entitlement_status ?? 'trial',
      trialAnalysisUsed: Boolean(context.trial_analysis_used),
      expiresAt: context.entitlement_expires_at ?? null,
    },
  });
}

async function handleLogout(request, env) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB
      .prepare(`DELETE FROM account_sessions WHERE token_hash = ?`)
      .bind(tokenHash)
      .run();
  }
  const response = jsonResponse({ ok: true });
  response.headers.append(
    'Set-Cookie',
    serializeCookie(request, SESSION_COOKIE, '', { maxAge: 0, path: '/' }),
  );
  return response;
}

function parsePlanId(path) {
  const prefix = '/api/cloud/plans/';
  if (!path.startsWith(prefix)) return null;
  const raw = path.slice(prefix.length);
  if (!raw || raw.includes('/')) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

async function handleListPlans(request, env) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  const { results } = await env.DB
    .prepare(
      `SELECT document_json
       FROM account_plans
       WHERE workspace_id = ?
       ORDER BY updated_at DESC`,
    )
    .bind(auth.context.workspace_id)
    .all();
  const plans = [];
  for (const row of results ?? []) {
    try {
      plans.push(JSON.parse(row.document_json));
    } catch (error) {
      console.error('Invalid cloud plan JSON', error);
    }
  }
  return jsonResponse({ plans });
}

async function handleGetPlan(request, env, planId) {
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  const row = await env.DB
    .prepare(
      `SELECT document_json
       FROM account_plans
       WHERE workspace_id = ? AND plan_id = ?`,
    )
    .bind(auth.context.workspace_id, planId)
    .first();
  if (!row) return jsonResponse({ error: 'PLAN_NOT_FOUND' }, 404);
  try {
    return jsonResponse({ plan: JSON.parse(row.document_json) });
  } catch {
    return jsonResponse({ error: 'PLAN_DATA_INVALID' }, 500);
  }
}

async function handleSavePlan(request, env, planId) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  const plan = body?.plan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.id !== planId) {
    return jsonResponse({ error: 'INVALID_PLAN' }, 400);
  }
  const documentJson = JSON.stringify(plan);
  if (new TextEncoder().encode(documentJson).byteLength > MAX_PLAN_DOCUMENT_BYTES) {
    return jsonResponse(
      { error: 'PLAN_TOO_LARGE', message: 'プランデータが保存上限を超えています。' },
      413,
    );
  }
  const now = new Date().toISOString();
  const createdAt = typeof plan.createdAt === 'string' ? plan.createdAt : now;
  const updatedAt = typeof plan.updatedAt === 'string' ? plan.updatedAt : now;
  await env.DB
    .prepare(
      `INSERT INTO account_plans
         (workspace_id, plan_id, document_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, plan_id) DO UPDATE SET
         document_json = excluded.document_json,
         updated_at = excluded.updated_at`,
    )
    .bind(auth.context.workspace_id, planId, documentJson, createdAt, updatedAt)
    .run();
  return jsonResponse({ ok: true, plan });
}

async function handleDeletePlan(request, env, planId) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const auth = await requireSession(request, env);
  if (auth.response) return auth.response;
  await env.DB
    .prepare(
      `DELETE FROM account_plans WHERE workspace_id = ? AND plan_id = ?`,
    )
    .bind(auth.context.workspace_id, planId)
    .run();
  return jsonResponse({ ok: true });
}

/**
 * Account/session/cloud APIs. Returns null when the path belongs elsewhere.
 * Authentication itself lives in authApi.js.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function handleAccountApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/logout' && request.method === 'POST') {
    return handleLogout(request, env);
  }
  if (path === '/api/account/me' && request.method === 'GET') {
    return handleMe(request, env);
  }
  if (path === '/api/cloud/plans' && request.method === 'GET') {
    return handleListPlans(request, env);
  }

  const planId = parsePlanId(path);
  if (planId) {
    if (request.method === 'GET') return handleGetPlan(request, env, planId);
    if (request.method === 'PUT') return handleSavePlan(request, env, planId);
    if (request.method === 'DELETE') return handleDeletePlan(request, env, planId);
  }

  return null;
}
