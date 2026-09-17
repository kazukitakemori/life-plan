import { createId, jsonResponse, readJson } from './licenseShared.js';
import { sendLoginCodeEmail } from './sesMailer.js';

const SESSION_COOKIE = 'lp_session';
const OAUTH_STATE_COOKIE = 'lp_oauth_state';
const OAUTH_RETURN_COOKIE = 'lp_oauth_return';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_SEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_SEND_MAX_PER_ADDRESS = 5;
const EMAIL_SEND_MAX_PER_IP = 20;
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

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

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isEmailFormatValid(email) {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSameOriginMutation(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomEmailCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(6, '0');
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

function authPepper(env) {
  return String(env.EMAIL_AUTH_PEPPER ?? env.LICENSE_PEPPER ?? '').trim();
}

async function hashEmailCode(env, normalizedEmail, code) {
  const pepper = authPepper(env);
  if (!pepper) throw new Error('EMAIL_AUTH_PEPPER is not configured');
  return sha256Hex(`${pepper}:${normalizedEmail}:${code}`);
}

async function hashRequestIp(env, request) {
  const ip = String(request.headers.get('CF-Connecting-IP') ?? '').trim();
  if (!ip) return null;
  const pepper = authPepper(env);
  if (!pepper) throw new Error('EMAIL_AUTH_PEPPER is not configured');
  return sha256Hex(`${pepper}:ip:${ip}`);
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

async function findUserByProvider(db, provider, subject) {
  return db
    .prepare(
      `SELECT u.id, u.email, u.email_normalized, u.name, u.picture_url
       FROM account_identities i
       JOIN account_users u ON u.id = i.user_id
       WHERE i.provider = ? AND i.provider_subject = ?
       LIMIT 1`,
    )
    .bind(provider, subject)
    .first();
}

async function findUserByEmail(db, normalizedEmail) {
  return db
    .prepare(
      `SELECT id, email, email_normalized, name, picture_url
       FROM account_users
       WHERE email_normalized = ?
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first();
}

async function attachIdentity(db, userId, provider, subject, email, now) {
  await db
    .prepare(
      `INSERT INTO account_identities
         (id, user_id, provider, provider_subject, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_subject) DO UPDATE SET
         user_id = excluded.user_id,
         email = excluded.email,
         updated_at = excluded.updated_at`,
    )
    .bind(createId(), userId, provider, subject, email, now, now)
    .run();
}

async function upsertGoogleUser(db, profile, now) {
  const normalizedEmail = normalizeEmail(profile.email);
  let user = await findUserByProvider(db, 'google', profile.sub);
  if (!user) user = await findUserByEmail(db, normalizedEmail);

  if (user) {
    await db
      .prepare(
        `UPDATE account_users
         SET email = ?, email_normalized = ?,
             name = COALESCE(?, name), picture_url = COALESCE(?, picture_url),
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        profile.email,
        normalizedEmail,
        profile.name ?? null,
        profile.picture ?? null,
        now,
        user.id,
      )
      .run();
    await attachIdentity(db, user.id, 'google', profile.sub, profile.email, now);
    await ensureWorkspace(db, user.id, now);
    return user.id;
  }

  const userId = createId();
  await db
    .prepare(
      `INSERT INTO account_users
         (id, email, email_normalized, name, picture_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      profile.email,
      normalizedEmail,
      profile.name ?? null,
      profile.picture ?? null,
      now,
      now,
    )
    .run();
  await attachIdentity(db, userId, 'google', profile.sub, profile.email, now);
  await ensureWorkspace(db, userId, now);
  return userId;
}

async function upsertEmailUser(db, email, normalizedEmail, now) {
  let user = await findUserByProvider(db, 'email', normalizedEmail);
  if (!user) user = await findUserByEmail(db, normalizedEmail);

  if (user) {
    await db
      .prepare(
        `UPDATE account_users
         SET email = ?, email_normalized = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(email, normalizedEmail, now, user.id)
      .run();
    await attachIdentity(db, user.id, 'email', normalizedEmail, email, now);
    await ensureWorkspace(db, user.id, now);
    return user.id;
  }

  const userId = createId();
  await db
    .prepare(
      `INSERT INTO account_users
         (id, email, email_normalized, name, picture_url, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .bind(userId, email, normalizedEmail, now, now)
    .run();
  await attachIdentity(db, userId, 'email', normalizedEmail, email, now);
  await ensureWorkspace(db, userId, now);
  return userId;
}

async function createSession(db, userId, now) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.parse(now) + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.batch([
    db.prepare(`DELETE FROM account_sessions WHERE expires_at <= ?`).bind(now),
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

async function handleEmailRequest(request, env) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim();
  const normalizedEmail = normalizeEmail(email);
  if (!isEmailFormatValid(normalizedEmail)) {
    return jsonResponse(
      { ok: false, error: 'INVALID_EMAIL', message: 'メールアドレスを確認してください。' },
      400,
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - EMAIL_SEND_WINDOW_MS).toISOString();
  const requestIpHash = await hashRequestIp(env, request);

  const latest = await env.DB
    .prepare(
      `SELECT created_at
       FROM account_email_challenges
       WHERE email_normalized = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first();
  if (
    latest?.created_at &&
    now.getTime() - Date.parse(latest.created_at) < EMAIL_SEND_COOLDOWN_MS
  ) {
    return jsonResponse(
      { ok: false, error: 'TOO_SOON', message: '少し待ってから再送してください。' },
      429,
    );
  }

  const emailCountRow = await env.DB
    .prepare(
      `SELECT COUNT(*) AS count
       FROM account_email_challenges
       WHERE email_normalized = ? AND created_at >= ?`,
    )
    .bind(normalizedEmail, windowStart)
    .first();
  if (Number(emailCountRow?.count ?? 0) >= EMAIL_SEND_MAX_PER_ADDRESS) {
    return jsonResponse(
      { ok: false, error: 'RATE_LIMITED', message: '送信回数が上限に達しました。時間をおいてお試しください。' },
      429,
    );
  }

  if (requestIpHash) {
    const ipCountRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS count
         FROM account_email_challenges
         WHERE request_ip_hash = ? AND created_at >= ?`,
      )
      .bind(requestIpHash, windowStart)
      .first();
    if (Number(ipCountRow?.count ?? 0) >= EMAIL_SEND_MAX_PER_IP) {
      return jsonResponse(
        { ok: false, error: 'RATE_LIMITED', message: '送信回数が上限に達しました。時間をおいてお試しください。' },
        429,
      );
    }
  }

  const code = randomEmailCode();
  const codeHash = await hashEmailCode(env, normalizedEmail, code);
  const challengeId = createId();
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString();

  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE account_email_challenges
         SET used_at = ?
         WHERE email_normalized = ? AND used_at IS NULL`,
      )
      .bind(nowIso, normalizedEmail),
    env.DB
      .prepare(
        `INSERT INTO account_email_challenges
           (id, email, email_normalized, code_hash, request_ip_hash,
            expires_at, attempt_count, used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      )
      .bind(
        challengeId,
        email,
        normalizedEmail,
        codeHash,
        requestIpHash,
        expiresAt,
        nowIso,
      ),
  ]);

  try {
    await sendLoginCodeEmail(env, email, code);
  } catch (error) {
    await env.DB
      .prepare(`DELETE FROM account_email_challenges WHERE id = ?`)
      .bind(challengeId)
      .run();
    console.error(error);
    return jsonResponse(
      { ok: false, error: 'SEND_FAILED', message: '認証コードを送信できませんでした。時間をおいてお試しください。' },
      503,
    );
  }

  return jsonResponse({ ok: true, expiresInSeconds: EMAIL_CODE_TTL_MS / 1000 });
}

async function handleEmailVerify(request, env) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const body = await readJson(request);
  const email = String(body?.email ?? '').trim();
  const normalizedEmail = normalizeEmail(email);
  const code = String(body?.code ?? '').replace(/\D/g, '');
  if (!isEmailFormatValid(normalizedEmail) || !/^\d{6}$/.test(code)) {
    return jsonResponse(
      { ok: false, error: 'INVALID_CODE', message: 'メールアドレスまたは認証コードを確認してください。' },
      400,
    );
  }

  const now = new Date().toISOString();
  const challenge = await env.DB
    .prepare(
      `SELECT id, code_hash, attempt_count, expires_at
       FROM account_email_challenges
       WHERE email_normalized = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first();

  if (!challenge || challenge.expires_at <= now) {
    return jsonResponse(
      { ok: false, error: 'CODE_EXPIRED', message: '認証コードの有効期限が切れています。もう一度送信してください。' },
      400,
    );
  }
  if (Number(challenge.attempt_count ?? 0) >= EMAIL_VERIFY_MAX_ATTEMPTS) {
    return jsonResponse(
      { ok: false, error: 'TOO_MANY_ATTEMPTS', message: '入力回数の上限に達しました。新しいコードを送信してください。' },
      429,
    );
  }

  const actualHash = await hashEmailCode(env, normalizedEmail, code);
  if (actualHash !== challenge.code_hash) {
    const attempts = Number(challenge.attempt_count ?? 0) + 1;
    await env.DB
      .prepare(
        `UPDATE account_email_challenges
         SET attempt_count = ?, used_at = CASE WHEN ? >= ? THEN ? ELSE used_at END
         WHERE id = ?`,
      )
      .bind(attempts, attempts, EMAIL_VERIFY_MAX_ATTEMPTS, now, challenge.id)
      .run();
    return jsonResponse(
      { ok: false, error: 'INVALID_CODE', message: '認証コードが一致しません。' },
      400,
    );
  }

  await env.DB
    .prepare(`UPDATE account_email_challenges SET used_at = ? WHERE id = ?`)
    .bind(now, challenge.id)
    .run();

  const userId = await upsertEmailUser(env.DB, email, normalizedEmail, now);
  const session = await createSession(env.DB, userId, now);
  const response = jsonResponse({ ok: true, authenticated: true });
  response.headers.append(
    'Set-Cookie',
    serializeCookie(request, SESSION_COOKIE, session.token, {
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    }),
  );
  return response;
}

/**
 * Authentication APIs shared by Google and email sign-in.
 * Returns null when the path belongs to another API.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function handleAuthApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/auth/google/start' && request.method === 'GET') {
    return handleGoogleStart(request, env);
  }
  if (path === '/api/auth/google/callback' && request.method === 'GET') {
    return handleGoogleCallback(request, env);
  }
  if (path === '/api/auth/email/request' && request.method === 'POST') {
    return handleEmailRequest(request, env);
  }
  if (path === '/api/auth/email/verify' && request.method === 'POST') {
    return handleEmailVerify(request, env);
  }
  return null;
}
