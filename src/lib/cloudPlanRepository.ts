import { migratePlanRecord, toPlanSummary } from './planDocument';
import type { PlanRepository } from './planRepository';
import type { PlanRecord, PlanSummary } from '../types/plan';

interface CloudPlanEnvelope {
  plan: PlanRecord;
  revision: number;
}

interface CloudPlansResponse {
  plans?: CloudPlanEnvelope[];
  plan?: PlanRecord;
  revision?: number;
  error?: string;
  message?: string;
}

async function readResponse(response: Response): Promise<CloudPlansResponse> {
  const body = (await response.json().catch(() => null)) as CloudPlansResponse | null;
  if (!response.ok) {
    if (response.status === 409 && body?.error === 'PLAN_CONFLICT') {
      throw new Error(
        body.message ??
          '別のブラウザまたはPCでこのプランが更新されています。再読み込みして最新データを確認してください。',
      );
    }
    throw new Error(
      body?.message ??
        (response.status === 401
          ? 'アカウントへログインしてください。'
          : 'クラウド保存に失敗しました。'),
    );
  }
  return body ?? {};
}

function isPositiveRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

export class CloudPlanRepository implements PlanRepository {
  private readonly revisions = new Map<string, number>();

  async listSummaries(): Promise<PlanSummary[]> {
    const records = await this.listAll();
    return records
      .map((record) => toPlanSummary(record))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listAll(): Promise<PlanRecord[]> {
    const response = await fetch('/api/cloud/plans', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const body = await readResponse(response);
    this.revisions.clear();
    return (body.plans ?? []).map(({ plan, revision }) => {
      const migrated = migratePlanRecord(plan);
      if (isPositiveRevision(revision)) {
        this.revisions.set(migrated.id, revision);
      }
      return migrated;
    });
  }

  async get(id: string): Promise<PlanRecord | null> {
    const response = await fetch(`/api/cloud/plans/${encodeURIComponent(id)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 404) {
      this.revisions.delete(id);
      return null;
    }
    const body = await readResponse(response);
    if (!body.plan) return null;
    const migrated = migratePlanRecord(body.plan);
    if (isPositiveRevision(body.revision)) {
      this.revisions.set(id, body.revision);
    }
    return migrated;
  }

  async save(record: PlanRecord): Promise<PlanRecord> {
    const toSave = migratePlanRecord(record);
    const expectedRevision = this.revisions.get(toSave.id) ?? null;
    const response = await fetch(
      `/api/cloud/plans/${encodeURIComponent(toSave.id)}`,
      {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: toSave, expectedRevision }),
      },
    );
    const body = await readResponse(response);
    if (isPositiveRevision(body.revision)) {
      this.revisions.set(toSave.id, body.revision);
    }
    return body.plan ? migratePlanRecord(body.plan) : toSave;
  }

  async delete(id: string): Promise<void> {
    let expectedRevision = this.revisions.get(id) ?? null;
    if (expectedRevision == null) {
      const existing = await this.get(id);
      if (!existing) return;
      expectedRevision = this.revisions.get(id) ?? null;
    }
    if (expectedRevision == null) {
      throw new Error('削除前にプランの最新状態を確認できませんでした。');
    }

    const params = new URLSearchParams({ revision: String(expectedRevision) });
    const response = await fetch(
      `/api/cloud/plans/${encodeURIComponent(id)}?${params.toString()}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
      },
    );
    await readResponse(response);
    this.revisions.delete(id);
  }
}
