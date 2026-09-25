import { getSessionContext } from './accountApi.js';
import { jsonResponse } from './licenseShared.js';

const PREFIX = 'content-model:';
const MAX_BYTES = 1_500_000;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.trim());
}

async function tokensMatch(supplied, expected) {
  const encode = (value) => new TextEncoder().encode(value);
  const [a, b] = await Promise.all([supplied, expected].map((value) => crypto.subtle.digest('SHA-256', encode(value))));
  // Workers provides a constant-time comparison; hashes have equal byte length.
  return crypto.subtle.timingSafeEqual(a, b);
}

async function readBoundedJson(request) {
  if (!request.body) return { error: 'INVALID_CONTENT_MODEL', status: 400 };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return { error: 'PLAN_TOO_LARGE', status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: 'INVALID_CONTENT_MODEL', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function bearerToken(request) {
  const header = String(request.headers.get('Authorization') ?? '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function configuredToken(env) {
  return String(env.CONTENT_MODEL_API_TOKEN ?? '').trim();
}

function configuredWorkspace(env) {
  return String(env.CONTENT_MODEL_WORKSPACE_ID ?? '').trim();
}

async function authorize(request, env) {
  const token = configuredToken(env);
  const workspaceId = configuredWorkspace(env);
  if (!token || !workspaceId) {
    return { response: jsonResponse({ error: 'CONTENT_MODEL_API_DISABLED' }, 404) };
  }

  const supplied = bearerToken(request);
  if (!supplied || !(await tokensMatch(supplied, token))) {
    return { response: jsonResponse({ error: 'UNAUTHORIZED' }, 401) };
  }

  const session = await getSessionContext(request, env);
  if (session && String(session.workspace_id) !== workspaceId) {
    return {
      response: jsonResponse(
        {
          error: 'CONTENT_MODEL_WORKSPACE_MISMATCH',
          message: '別のアカウントの作業領域には投入できません。',
        },
        403,
      ),
    };
  }
  const workspace = await env.DB.prepare('SELECT id FROM account_workspaces WHERE id = ?').bind(workspaceId).first();
  if (!workspace) return { response: jsonResponse({ error: 'CONTENT_MODEL_WORKSPACE_NOT_FOUND' }, 409) };
  return { workspaceId };
}

function planId(modelCaseId) {
  return `${PREFIX}${String(modelCaseId ?? '').trim()}`;
}

async function readExisting(env, workspaceId, id) {
  return env.DB
    .prepare(
      `SELECT document_json, revision, created_at
       FROM account_plans
       WHERE workspace_id = ? AND plan_id = ?`,
    )
    .bind(workspaceId, id)
    .first();
}

async function handleUpsert(request, env) {
  if (!sameOrigin(request)) {
    return jsonResponse({ error: 'ORIGIN_MISMATCH' }, 403);
  }
  const auth = await authorize(request, env);
  if (auth.response) return auth.response;

  const parsed = await readBoundedJson(request);
  if (parsed.error) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const modelCaseId = body?.modelCaseId;
  const articleId = body?.articleId;
  const plan = body?.plan;
  if (
    !isId(modelCaseId) || !isId(articleId) || !isObject(plan) ||
    typeof plan.customerName !== 'string' || !plan.customerName.startsWith('記事モデル｜') ||
    plan.phone !== '' || plan.email !== '' ||
    !Number.isInteger(plan.schemaVersion) || plan.schemaVersion < 1 ||
    !isObject(plan.payload) || !Array.isArray(plan.payload.familyMembers) ||
    plan.payload.familyMembers.length === 0 || typeof plan.payload.referenceDate !== 'string'
  ) {
    return jsonResponse({ error: 'INVALID_CONTENT_MODEL' }, 400);
  }

  const id = planId(modelCaseId);
  const metadata = typeof plan.note === 'string' ? plan.note.split('\n') : [];
  if (plan.id !== id || metadata[0] !== '[CONTENT_MODEL_CASE]' ||
      !metadata.includes(`articleId=${articleId.trim()}`) ||
      !metadata.includes(`modelCaseId=${modelCaseId.trim()}`)) {
    return jsonResponse({ error: 'CONTENT_MODEL_METADATA_MISMATCH' }, 400);
  }

  const existing = await readExisting(env, auth.workspaceId, id);
  const now = new Date().toISOString();
  const createdAt =
    existing?.created_at ??
    (typeof plan.createdAt === 'string' ? plan.createdAt : now);
  const nextRevision = Number(existing?.revision ?? 0) + 1;
  const documentJson = JSON.stringify({ ...plan, createdAt, updatedAt: now });

  const result = await env.DB
    .prepare(
      `INSERT INTO account_plans
         (workspace_id, plan_id, document_json, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, plan_id) DO UPDATE SET
         document_json = excluded.document_json,
         revision = excluded.revision,
         updated_at = excluded.updated_at
       WHERE account_plans.revision = ?`,
    )
    .bind(
      auth.workspaceId,
      id,
      documentJson,
      nextRevision,
      createdAt,
      now,
      Number(existing?.revision ?? 0),
    )
    .run();

  if (Number(result.meta?.changes) !== 1) return jsonResponse({ error: 'CONTENT_MODEL_CONFLICT' }, 409);

  const saved = await readExisting(env, auth.workspaceId, id);
  if (!saved) return jsonResponse({ error: 'CONTENT_MODEL_READBACK_FAILED' }, 500);
  const readback = JSON.parse(saved.document_json);
  if (saved.document_json !== documentJson || Number(saved.revision) !== nextRevision) {
    return jsonResponse({ error: 'CONTENT_MODEL_READBACK_MISMATCH' }, 500);
  }

  return jsonResponse({
    ok: true,
    created: !existing,
    plan: readback,
    revision: Number(saved.revision),
  });
}

export async function handleContentModelApi(request, env) {
  const path = new URL(request.url).pathname;
  if (path !== '/api/internal/content-models') return null;
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }
  return handleUpsert(request, env);
}
