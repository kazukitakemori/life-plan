/**
 * PlanRepository 契約（メモリ実装）の CRUD を検証
 * npx tsx scripts/verify-plan-repository.mjs
 */
import {
  createEmptyPlanPayload,
  createPlanRecord,
  toPlanSummary,
} from '../src/lib/planDocument.ts';

class MemoryPlanRepository {
  constructor() {
    this.store = new Map();
  }

  async listSummaries() {
    return [...this.store.values()]
      .map((r) => toPlanSummary(r))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listAll() {
    return [...this.store.values()];
  }

  async get(id) {
    return this.store.get(id) ?? null;
  }

  async save(record) {
    this.store.set(record.id, record);
    return record;
  }

  async delete(id) {
    this.store.delete(id);
  }
}

const repo = new MemoryPlanRepository();
const payload = createEmptyPlanPayload(new Date(2026, 7, 1));

const a = createPlanRecord({
  customerName: '顧客A',
  phone: '090-0000-0001',
  email: 'a@example.com',
  note: 'メモA',
  status: 'in_progress',
  payload,
  now: new Date('2026-08-01T10:00:00.000Z'),
});
const b = createPlanRecord({
  customerName: '顧客B',
  phone: '090-0000-0002',
  email: 'b@example.com',
  note: 'メモB',
  status: 'simulated',
  payload,
  now: new Date('2026-08-02T10:00:00.000Z'),
});

await repo.save(a);
await repo.save(b);

const list = await repo.listSummaries();
if (list.length !== 2) throw new Error('expected 2 summaries');
if (list[0].customerName !== '顧客B') {
  throw new Error('expected newest first');
}
if (list[0].status !== 'simulated' || list[0].note !== 'メモB') {
  throw new Error('summary missing status/note');
}
if (list[0].purposes?.[0] !== 'life_plan') {
  throw new Error('summary missing purposes');
}
if (list[0].phone !== '090-0000-0002') {
  throw new Error('summary missing phone');
}
if ('payload' in list[0]) {
  throw new Error('summary must not include payload');
}

const loaded = await repo.get(a.id);
if (!loaded || loaded.customerName !== '顧客A') {
  throw new Error('get failed');
}

await repo.delete(a.id);
if ((await repo.get(a.id)) != null) throw new Error('delete failed');
if ((await repo.listSummaries()).length !== 1) {
  throw new Error('list after delete failed');
}

console.log('verify-plan-repository: ok');
