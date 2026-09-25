import assert from 'node:assert/strict';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyPlanPayload } from '../src/lib/planDocument.ts';
import { saveContentModelCase, toContentModelPlanRecord, validateContentModelCase } from '../src/lib/contentModelCase.ts';
import { PlanMetaModal } from '../src/components/plan/PlanMetaModal.tsx';
import { handleContentModelApi } from '../worker/contentModelApi.js';

// Node test equivalent of the Workers WebCrypto extension.
crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
const model = {
  version: 1, articleId: 'SIM-001', modelCaseId: 'SIM-001-BASE',
  title: '架空の検証モデル', editorialPurpose: '保存と再現の検証', assumptions: ['架空モデル'],
  captureSpecs: [{ id: 'SIM-001-CF', view: 'cash-flow-table', purpose: '検証', viewport: { width: 1440, height: 1000 } }],
  payload: createEmptyPlanPayload(new Date('2026-09-01T00:00:00Z')),
};
assert.equal(validateContentModelCase(model).valid, true);
for (const invalid of [null, {}, { ...model, articleId: 1 }, { ...model, modelCaseId: 'A\nB' },
  { ...model, captureSpecs: [null] }, { ...model, captureSpecs: [model.captureSpecs[0], model.captureSpecs[0]] },
  { ...model, captureSpecs: [{ ...model.captureSpecs[0], view: 'unknown' }] },
  { ...model, payload: [] }, { ...model, payload: { ...model.payload, referenceDate: '2026-02-30' } }]) {
  assert.equal(validateContentModelCase(invalid).valid, false);
}
const rows = new Map();
const repository = {
  get: async (id) => structuredClone(rows.get(id) ?? null),
  save: async (record) => { rows.set(record.id, structuredClone(record)); return record; },
};
const first = await saveContentModelCase(repository, model, new Date('2026-09-01'));
assert.equal(first.created, true);
const second = await saveContentModelCase(repository, { ...model, title: '更新' }, new Date('2026-09-02'));
assert.equal(second.created, false);
assert.equal(rows.size, 1);
assert.equal(second.plan.createdAt, first.plan.createdAt);
assert.equal(second.plan.schemaVersion, 8);
assert.equal(second.plan.status, 'in_progress');
assert.match(second.plan.note, /definition=.*captureSpecs/);
let reads = 0;
await assert.rejects(saveContentModelCase({ ...repository, get: async (id) => {
  const record = await repository.get(id);
  if (++reads > 1) record.payload.referenceDate = '2000-01-01';
  return record;
}}, model), /does not match/);

const initial = { customerName: 'PRIVATE-NAME', phone: 'PRIVATE-PHONE', email: 'private@example.invalid', note: 'PRIVATE-NOTE', status: 'in_progress', purposes: ['life_plan'] };
const html = renderToStaticMarkup(React.createElement(PlanMetaModal, {
  open: true, title: '編集', initial, showCrmFields: true, hidePersonalInfo: true,
  onClose() {}, onConfirm() {},
}));
for (const value of [initial.customerName, initial.phone, initial.email, initial.note]) assert.ok(!html.includes(value));
assert.equal(initial.customerName, 'PRIVATE-NAME');

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE account_workspaces(id TEXT PRIMARY KEY);
INSERT INTO account_workspaces VALUES('content');
CREATE TABLE account_plans(workspace_id TEXT, plan_id TEXT, document_json TEXT, revision INTEGER, created_at TEXT, updated_at TEXT, PRIMARY KEY(workspace_id,plan_id));`);
const env = { CONTENT_MODEL_API_TOKEN: 'test-only-token', CONTENT_MODEL_WORKSPACE_ID: 'content', DB: {
  prepare(sql) { return { bind(...args) { return {
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { const result = db.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
  }; } }; },
}};
const plan = toContentModelPlanRecord(model);
const body = { articleId: model.articleId, modelCaseId: model.modelCaseId, plan };
const request = (value = body, headers = {}) => new Request('https://test.invalid/api/internal/content-models', {
  method: 'PUT', headers: { Authorization: 'Bearer test-only-token', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value),
});
assert.equal((await handleContentModelApi(request(), {})).status, 404);
assert.equal((await handleContentModelApi(request(body, { Authorization: 'Bearer wrong' }), env)).status, 401);
assert.equal((await handleContentModelApi(request(body, { Origin: 'https://other.invalid' }), env)).status, 403);
assert.equal((await handleContentModelApi(request('{broken'), env)).status, 400);
assert.equal((await handleContentModelApi(request({ ...body, articleId: 'SIM-00' }), env)).status, 400);
assert.equal((await handleContentModelApi(request('x'.repeat(1_500_001)), env)).status, 413);
for (let revision = 1; revision <= 2; revision++) {
  const response = await handleContentModelApi(request(), env);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.revision, revision);
  assert.equal(saved.created, revision === 1);
  assert.deepEqual(saved.plan.payload, JSON.parse(JSON.stringify(plan.payload)));
}
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_plans').get().n, 1);
db.close();
console.log('verify-content-model: PASS (validation, idempotency, readback, privacy, API authorization and SQLite persistence)');
