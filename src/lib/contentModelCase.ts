import { createPlanRecord, migratePlanRecord } from './planDocument';
import type { PlanPayload, PlanRecord } from '../types/plan';

export const CONTENT_MODEL_CASE_VERSION = 1 as const;
export const CONTENT_MODEL_PLAN_ID_PREFIX = 'content-model:';

export type ContentModelTargetView =
  | 'cash-flow-table'
  | 'asset-balance-chart'
  | 'lifetime-balance'
  | 'required-coverage';

export interface ContentModelCaptureSpec {
  view: ContentModelTargetView;
  /** 撮影時に再現したい補足条件。UI selector には依存させない。 */
  note?: string;
}

export interface ContentModelCase {
  version: typeof CONTENT_MODEL_CASE_VERSION;
  articleId: string;
  modelCaseId: string;
  title: string;
  /** 記事内でこのモデルを使う理由・説明。 */
  editorialPurpose: string;
  /** 人間が読める前提条件。正確な入力値は payload を正本とする。 */
  assumptions: string[];
  captureSpecs: ContentModelCaptureSpec[];
  payload: PlanPayload;
}

export interface ContentModelCaseValidation {
  valid: boolean;
  errors: string[];
}

function clean(value: string): string {
  return value.trim();
}

export function getContentModelPlanId(modelCaseId: string): string {
  return `${CONTENT_MODEL_PLAN_ID_PREFIX}${clean(modelCaseId)}`;
}

export function isContentModelPlan(record: Pick<PlanRecord, 'id'>): boolean {
  return record.id.startsWith(CONTENT_MODEL_PLAN_ID_PREFIX);
}

export function validateContentModelCase(
  model: ContentModelCase,
): ContentModelCaseValidation {
  const errors: string[] = [];

  if (model.version !== CONTENT_MODEL_CASE_VERSION) {
    errors.push(`Unsupported content model version: ${model.version}`);
  }
  if (!clean(model.articleId)) errors.push('articleId is required.');
  if (!clean(model.modelCaseId)) errors.push('modelCaseId is required.');
  if (!clean(model.title)) errors.push('title is required.');
  if (!clean(model.editorialPurpose)) {
    errors.push('editorialPurpose is required.');
  }
  if (!Array.isArray(model.assumptions)) {
    errors.push('assumptions must be an array.');
  }
  if (!Array.isArray(model.captureSpecs) || model.captureSpecs.length === 0) {
    errors.push('At least one captureSpec is required.');
  }
  if (!model.payload || typeof model.payload !== 'object') {
    errors.push('payload is required.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 記事用モデルケースを通常の PlanRecord に変換する。
 *
 * 同じ modelCaseId は常に同じ PlanRecord.id になるため、
 * Repository.save() へ再投入しても新規レコードを増殖させず更新できる。
 * 計算・保存の正本は通常プランと同じ PlanPayload を使う。
 */
export function toContentModelPlanRecord(
  model: ContentModelCase,
  existing?: PlanRecord | null,
  now = new Date(),
): PlanRecord {
  const validation = validateContentModelCase(model);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const id = getContentModelPlanId(model.modelCaseId);
  if (existing && existing.id !== id) {
    throw new Error('Existing plan id does not match modelCaseId.');
  }

  const note = [
    '[CONTENT_MODEL_CASE]',
    `articleId=${clean(model.articleId)}`,
    `modelCaseId=${clean(model.modelCaseId)}`,
    `purpose=${clean(model.editorialPurpose)}`,
  ].join('\n');

  return migratePlanRecord(
    createPlanRecord({
      id,
      customerName: `記事モデル｜${clean(model.title)}`,
      note,
      purposes: ['life_plan'],
      status: 'simulated',
      payload: model.payload,
      createdAt: existing?.createdAt,
      now,
    }),
  );
}
