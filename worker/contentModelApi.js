import { getSessionContext } from './accountApi.js';
import { jsonResponse, readJson } from './licenseShared.js';

const PREFIX = 'content-model:';
const MAX_BYTES = 1_500_000;

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
  if (!supplied || supplied !== token) {
    return { response: jsonResponse({ error: 'UNAUTHORIZED' }, 401) };
  }

  const session = await getSessionContext(request, env);
  if (!session || String(session.workspace_id) !== workspaceId) {
    return {
      response: jsonResponse(
        {
          error: 'CONTENT_MODEL_WORKSPACE_REQUIRED',
          message: 'コンテンツ制作専用アカウントでログインしてください。',
        },
        403,
      ),
    };
  }
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

  const body = await readJson(request);
  const modelCaseId = String(body?.modelCaseId ?? '').trim();
  const articleId = String(body?.articleId ?? '').trim();
  const plan = body?.plan;
  if (
    !modelCaseId ||
    !articleId ||
    !plan ||
    typeof plan !== 'object' ||
    Array.isArray(plan)
  ) {
    return jsonResponse({ error: 'INVALID_CONTENT_MODEL' }, 400);
  }

  const id = planId(modelCaseId);
  if (plan.id !== id || !String(plan.note ?? '').includes(`articleId=${articleId}`)) {
    return jsonResponse({ error: 'CONTENT_MODEL_METADATA_MISMATCH' }, 400);
  }

  const documentJson = JSON.stringify(plan);
  if (new TextEncoder().encode(documentJson).byteLength > MAX_BYTES) {
    return jsonResponse({ error: 'PLAN_TOO_LARGE' }, 413);
  }

  const existing = await readExisting(env, auth.workspaceId, id);
  const now = new Date().toISOString();
  const createdAt =
    existing?.created_at ??
    (typeof plan.createdAt === 'string' ? plan.createdAt : now);
  const nextRevision = Number(existing?.revision ?? 0) + 1;

  await env.DB
    .prepare(
      `INSERT INTO account_plans
         (workspace_id, plan_id, document_json, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, plan_id) DO UPDATE SET
         document_json = excluded.document_json,
         revision = excluded.revision,
         updated_at = excluded.updated_at`,
    )
    .bind(
      auth.workspaceId,
      id,
      documentJson,
      nextRevision,
      createdAt,
      now,
    )
    .run();

  const saved = await readExisting(env, auth.workspaceId, id);
  if (!saved) return jsonResponse({ error: 'CONTENT_MODEL_READBACK_FAILED' }, 500);
  const readback = JSON.parse(saved.document_json);
  if (readback.id !== id) {
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
