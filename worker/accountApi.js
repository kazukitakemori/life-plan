import { createId, jsonResponse, readJson } from './licenseShared.js';

const SESSION_COOKIE = 'lp_session';
const OAUTH_STATE_COOKIE = 'lp_oauth_state';
const OAUTH_RETURN_COOKIE = 'lp_oauth_return';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const MAX_PLAN_DOCUMENT_BYTES = 1_500_000;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

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

function redirectWithCookies(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function getAppOrigin(request, env) {
  const configured = String(env.AUTH_ORIGIN ?? '').trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

function getRedirectUri(request, env) {
  return `${getAppOrigin(request, env)}/api/auth/google/callback`;
}

function normalizeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
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

async function findGoogleUser(db, subject) {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.picture_url
       FROM account_identities i
       JOIN account_users u ON u.id = i.user_id
       WHERE i.provider = 'google' AND i.provider_subject = ?
       LIMIT 1`,
    )
    .bind(subject)
    .first();
}

async function ensureWorkspace(db, userId, now) {
  const existing = await db
    .prepare(
      `SELECT w.id, w.name
       FROM account_workspace_members m
       JOIN account_workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ?
       ORDER BY m.created_at ASC
       LIMIT 1`,
    )
    .bind(userId)
    .first();
  if (existing) return existing;

  const workspaceId = createId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO account_workspaces (id, name, kind, created_at, updated_at)
         VALUES (?, 'マイライフプラン', 'personal', ?, ?)`,
      )
      .bind(workspaceId, now, now),
    db
      .prepare(
        `INSERT INTO account_workspace_members (workspace_id, user_id, role, created_at)
         VALUES (?, ?, 'owner', ?)`,
      )
      .bind(workspaceId, userId, now),
    db
      .prepare(
        `INSERT INTO account_entitlements
           (workspace_id, edition, status, trial_analysis_used, expires_at, created_at, updated_at)
         VALUES (?, 'personal', 'trial', 0, NULL, ?, ?)`,
      )
      .bind(workspaceId, now, now),
  ]);
  return { id: workspaceId, name: 'マイライフプラン' };
}

async function upsertGoogleUser(db, profile, now) {
  const existing = await findGoogleUser(db, profile.sub);
  if (existing) {
    await db.batch([
      db
        .prepare(
          `UPDATE account_users
           SET email = ?, name = ?, picture_url = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(profile.email, profile.name ?? null, profile.picture ?? null, now, existing.id),
      db
        .prepare(
          `UPDATE account_identities
           SET email = ?, updated_at = ?
           WHERE provider = 'google' AND provider_subject = ?`,
        )
        .bind(profile.email, now, profile.sub),
    ]);
    await ensureWorkspace(db, existing.id, now);
    return existing.id;
  }

  const userId = createId();
  const identityId = createId();
  const workspaceId = createId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO account_users
           (id, email, name, picture_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(userId, profile.email, profile.name ?? null, profile.picture ?? null, now, now),
    db
      .prepare(
        `INSERT INTO account_identities
           (id, user_id, provider, provider_subject, email, created_at, updated_at)
         VALUES (?, ?, 'google', ?, ?, ?, ?)`,
      )
      .bind(identityId, userId, profile.sub, profile.email, now, now),
    db
      .prepare(
        `INSERT INTO account_workspaces (id, name, kind, created_at, updated_at)
         VALUES (?, 'マイライフプラン', 'personal', ?, ?)`,
      )
      .bind(workspaceId, now, now),
    db
      .prepare(
        `INSERT INTO account_workspace_members (workspace_id, user_id, role, created_at)
         VALUES (?, ?, 'owner', ?)`,
      )
      .bind(workspaceId, userId, now),
    db
      .prepare(
        `INSERT INTO account_entitlements
           (workspace_id, edition, status, trial_analysis_used, expires_at, created_at, updated_at)
         VALUES (?, 'personal', 'trial', 0, NULL, ?, ?)`,
      )
      .bind(workspaceId, now, now),
  ]);
  return userId;
}

async function createSession(db, userId, now) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.parse(now) + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.batch([
    db
      .prepare(`DELETE FROM account_sessions WHERE expires_at <= ?`)
      .bind(now),
    db
      .prepare(
        `INSERT INTO account_sessions
           (id, user_id, token_hash, expires_at, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(createId(), userId, tokenHash, expiresAt, now, now),
  ]);
  return { token, expiresAt };
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

  await env.DB
    .prepare(`UPDATE account_sessions SET last_seen_at = ? WHERE id = ?`)
    .bind(now, row.session_id)
    .run();
  return row;
}

async function requireSession(request, env) {
  const context = await getSessionContext(request, env);
  if (!context) {
    return {
      response: jsonResponse(
        { error: 'AUTH_REQUIRED', message: 'Googleアカウントでログインしてください。' },
        401,
      ),
    };
  }
  return { context };
}

async function handleGoogleStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    const origin = getAppOrigin(request, env);
    return Response.redirect(`${origin}/?auth=not-configured`, 302);
  }

  const url = new URL(request.url);
  const state = randomToken();
  const returnTo = normalizeReturnTo(url.searchParams.get('returnTo'));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(request, env),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });

  return redirectWithCookies(`${GOOGLE_AUTH_URL}?${params.toString()}`, [
    serializeCookie(request, OAUTH_STATE_COOKIE, state, {
      maxAge: OAUTH_STATE_TTL_SECONDS,
      path: '/api/auth/google',
    }),
    serializeCookie(request, OAUTH_RETURN_COOKIE, encodeURIComponent(returnTo), {
      maxAge: OAUTH_STATE_TTL_SECONDS,
      path: '/api/auth/google',
    }),
  ]);
}

async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const origin = getAppOrigin(request, env);
  const cookies = parseCookies(request);
  const clearOauthCookies = [
    serializeCookie(request, OAUTH_STATE_COOKIE, '', { maxAge: 0, path: '/api/auth/google' }),
    serializeCookie(request, OAUTH_RETURN_COOKIE, '', { maxAge: 0, path: '/api/auth/google' }),
  ];
  const returnTo = normalizeReturnTo(
    decodeURIComponent(cookies.get(OAUTH_RETURN_COOKIE) ?? '%2F'),
  );

  if (url.searchParams.get('error')) {
    return redirectWithCookies(`${origin}${returnTo}?auth=cancelled`, clearOauthCookies);
  }

  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const expectedState = cookies.get(OAUTH_STATE_COOKIE) ?? '';
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithCookies(`${origin}/?auth=invalid-state`, clearOauthCookies);
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(request, env),
    }),
  });
  if (!tokenResponse.ok) {
    console.error('Google token exchange failed', tokenResponse.status);
    return redirectWithCookies(`${origin}/?auth=token-error`, clearOauthCookies);
  }
  const tokens = await tokenResponse.json();
  const accessToken = String(tokens.access_token ?? '');
  if (!accessToken) {
    return redirectWithCookies(`${origin}/?auth=token-error`, clearOauthCookies);
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) {
    console.error('Google userinfo failed', profileResponse.status);
    return redirectWithCookies(`${origin}/?auth=profile-error`, clearOauthCookies);
  }
  const profile = await profileResponse.json();
  if (
    !profile ||
    typeof profile.sub !== 'string' ||
    !profile.sub ||
    typeof profile.email !== 'string' ||
    !profile.email ||
    profile.email_verified !== true
  ) {
    return redirectWithCookies(`${origin}/?auth=profile-invalid`, clearOauthCookies);
  }

  const now = new Date().toISOString();
  const userId = await upsertGoogleUser(env.DB, profile, now);
  const session = await createSession(env.DB, userId, now);
  const sessionCookie = serializeCookie(request, SESSION_COOKIE, session.token, {
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
  return redirectWithCookies(`${origin}${returnTo}`, [
    ...clearOauthCookies,
    sessionCookie,
  ]);
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
 * Account/auth/cloud APIs. Returns null when the path belongs to another API.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function handleAccountApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/google/start' && request.method === 'GET') {
    return handleGoogleStart(request, env);
  }
  if (path === '/api/auth/google/callback' && request.method === 'GET') {
    return handleGoogleCallback(request, env);
  }
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
