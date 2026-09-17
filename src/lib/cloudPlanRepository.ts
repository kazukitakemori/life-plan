import { migratePlanRecord, toPlanSummary } from './planDocument';
import type { PlanRepository } from './planRepository';
import type { PlanRecord, PlanSummary } from '../types/plan';

interface CloudPlansResponse {
  plans?: PlanRecord[];
  plan?: PlanRecord;
  error?: string;
  message?: string;
}

async function readResponse(response: Response): Promise<CloudPlansResponse> {
  const body = (await response.json().catch(() => null)) as CloudPlansResponse | null;
  if (!response.ok) {
    throw new Error(
      body?.message ??
        (response.status === 401
          ? 'Googleアカウントでログインしてください。'
          : 'クラウド保存に失敗しました。'),
    );
  }
  return body ?? {};
}

export class CloudPlanRepository implements PlanRepository {
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
    return (body.plans ?? []).map((plan) => migratePlanRecord(plan));
  }

  async get(id: string): Promise<PlanRecord | null> {
    const response = await fetch(`/api/cloud/plans/${encodeURIComponent(id)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    const body = await readResponse(response);
    if (!body.plan) return null;
    return migratePlanRecord(body.plan);
  }

  async save(record: PlanRecord): Promise<PlanRecord> {
    const toSave = migratePlanRecord(record);
    const response = await fetch(
      `/api/cloud/plans/${encodeURIComponent(toSave.id)}`,
      {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: toSave }),
      },
    );
    const body = await readResponse(response);
    return body.plan ? migratePlanRecord(body.plan) : toSave;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/cloud/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    await readResponse(response);
  }
}
