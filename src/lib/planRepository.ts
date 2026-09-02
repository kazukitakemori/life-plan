import type { PlanRecord, PlanSummary } from '../types/plan';

/** 保存・読込の抽象。ローカル IndexedDB / 将来クラウドで差し替え */
export interface PlanRepository {
  listSummaries(): Promise<PlanSummary[]>;
  /** バックアップ用。migrate 済みの全件 */
  listAll(): Promise<PlanRecord[]>;
  get(id: string): Promise<PlanRecord | null>;
  save(record: PlanRecord): Promise<PlanRecord>;
  delete(id: string): Promise<void>;
}
