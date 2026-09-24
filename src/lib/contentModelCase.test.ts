import { describe, expect, it } from 'vitest';
import {
  getContentModelPlanId,
  saveContentModelCase,
  type ContentModelCase,
} from './contentModelCase';
import { createEmptyPlanPayload } from './planDocument';
import type { PlanRepository } from './planRepository';
import type { PlanRecord, PlanSummary } from '../types/plan';

class MemoryRepository implements PlanRepository {
  private readonly records = new Map<string, PlanRecord>();

  async listSummaries(): Promise<PlanSummary[]> {
    return [];
  }
  async listAll(): Promise<PlanRecord[]> {
    return [...this.records.values()];
  }
  async get(id: string): Promise<PlanRecord | null> {
    return this.records.get(id) ?? null;
  }
  async save(record: PlanRecord): Promise<PlanRecord> {
    this.records.set(record.id, structuredClone(record));
    return record;
  }
  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

function model(): ContentModelCase {
  return {
    version: 1,
    articleId: 'SIM-001',
    modelCaseId: 'SIM-001-M01',
    title: '標準ケース',
    editorialPurpose: '記事内のキャッシュフロー例を再現する',
    assumptions: ['記事で明示した前提だけを使用する'],
    captureSpecs: [{ view: 'cash-flow-table' }],
    payload: createEmptyPlanPayload(new Date('2026-09-01T00:00:00+09:00')),
  };
}

describe('saveContentModelCase', () => {
  it('creates once and then updates the same deterministic plan id', async () => {
    const repository = new MemoryRepository();
    const first = await saveContentModelCase(
      repository,
      model(),
      new Date('2026-09-24T00:00:00Z'),
    );
    const secondModel = { ...model(), title: '更新後ケース' };
    const second = await saveContentModelCase(
      repository,
      secondModel,
      new Date('2026-09-25T00:00:00Z'),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.plan.id).toBe(getContentModelPlanId('SIM-001-M01'));
    expect(second.plan.customerName).toBe('記事モデル｜更新後ケース');
    expect((await repository.listAll())).toHaveLength(1);
  });
});
