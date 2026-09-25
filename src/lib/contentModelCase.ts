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
  id: string;
  view: ContentModelTargetView;
  /** 撮影時の表示状態。UI selector ではなく意味的な状態を記述する。 */
  displayState?: Record<string, string | number | boolean>;
  /** 画面全体か、意味的な撮影領域ID。 */
  captureRegion?: 'viewport' | string;
  viewport?: { width: number; height: number };
  /** 事業者モードで個人情報を非表示にして撮影する。通常UIは維持する。 */
  operatorMode?: {
    hidePersonalInfo: boolean;
  };
  purpose: string;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isId(value: unknown): value is string {
  return isText(value) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.trim());
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameJson(value, b[index]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a).filter((key) => a[key] !== undefined);
    return keys.length === Object.keys(b).filter((key) => b[key] !== undefined).length &&
      keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
  }
  return false;
}

export function getContentModelPlanId(modelCaseId: string): string {
  return `${CONTENT_MODEL_PLAN_ID_PREFIX}${clean(modelCaseId)}`;
}

export function isContentModelPlan(record: Pick<PlanRecord, 'id'>): boolean {
  return record.id.startsWith(CONTENT_MODEL_PLAN_ID_PREFIX);
}

export function validateContentModelCase(
  model: unknown,
): ContentModelCaseValidation {
  const errors: string[] = [];

  if (!isObject(model)) return { valid: false, errors: ['Content model must be an object.'] };

  if (model.version !== CONTENT_MODEL_CASE_VERSION) {
    errors.push(`Unsupported content model version: ${model.version}`);
  }
  if (!isId(model.articleId)) errors.push('articleId must be a stable identifier.');
  if (!isId(model.modelCaseId)) errors.push('modelCaseId must be a stable identifier.');
  if (!isText(model.title)) errors.push('title is required.');
  if (!isText(model.editorialPurpose)) {
    errors.push('editorialPurpose is required.');
  }
  if (!Array.isArray(model.assumptions) || !model.assumptions.every(isText)) {
    errors.push('assumptions must be an array of non-empty strings.');
  }
  if (!Array.isArray(model.captureSpecs) || model.captureSpecs.length === 0) {
    errors.push('At least one captureSpec is required.');
  } else {
    const ids = new Set<string>();
    for (const spec of model.captureSpecs) {
      if (!isObject(spec)) { errors.push('captureSpec must be an object.'); continue; }
      if (!isId(spec.id) || ids.has(spec.id.trim())) errors.push('captureSpec.id must be unique and valid.');
      else ids.add(spec.id.trim());
      if (!isText(spec.purpose)) errors.push('captureSpec.purpose is required.');
      if (!['cash-flow-table', 'asset-balance-chart', 'lifetime-balance', 'required-coverage'].includes(String(spec.view))) {
        errors.push('captureSpec.view is unsupported.');
      }
      if (spec.viewport !== undefined && (!isObject(spec.viewport) ||
        ![spec.viewport.width, spec.viewport.height].every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 320 && value <= 7680))) {
        errors.push('captureSpec.viewport must contain valid pixel dimensions.');
      }
      if (spec.operatorMode !== undefined && (!isObject(spec.operatorMode) || typeof spec.operatorMode.hidePersonalInfo !== 'boolean')) {
        errors.push('captureSpec.operatorMode is invalid.');
      }
      if (spec.captureRegion !== undefined && !isText(spec.captureRegion)) errors.push('captureSpec.captureRegion is invalid.');
      if (spec.note !== undefined && typeof spec.note !== 'string') errors.push('captureSpec.note is invalid.');
      if (spec.displayState !== undefined && (!isObject(spec.displayState) || !Object.values(spec.displayState).every((value) =>
        typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))))) {
        errors.push('captureSpec.displayState is invalid.');
      }
    }
  }
  if (!isObject(model.payload)) {
    errors.push('payload is required.');
  } else {
    const payload = model.payload;
    if (!Array.isArray(payload.familyMembers) || payload.familyMembers.length === 0 ||
      !payload.familyMembers.every((member) => isObject(member) && isText(member.id))) {
      errors.push('payload.familyMembers is required.');
    }
    if (!isText(payload.referenceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.referenceDate) ||
      !Number.isFinite(Date.parse(payload.referenceDate)) || new Date(payload.referenceDate).toISOString().slice(0, 10) !== payload.referenceDate) {
      errors.push('payload.referenceDate must be an explicit valid date.');
    }
    for (const key of ['incomeByMember', 'priorYearIncomeByMember', 'livingState', 'housingState', 'vehicleState', 'loanState', 'insuranceState', 'savingsState', 'educationByMember', 'lifeEventState', 'pensionByMember', 'taxSocialState']) {
      if (!isObject(payload[key])) errors.push(`payload.${key} is required.`);
    }
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
    `definition=${JSON.stringify({ ...model, payload: undefined })}`,
  ].join('\n');

  return migratePlanRecord(
    createPlanRecord({
      id,
      customerName: `記事モデル｜${clean(model.title)}`,
      note,
      purposes: ['life_plan'],
      status: 'in_progress',
      payload: model.payload,
      createdAt: existing?.createdAt,
      now,
    }),
  );
}


export interface SaveContentModelCaseResult {
  plan: PlanRecord;
  created: boolean;
}

/**
 * 記事用モデルケースを任意の PlanRepository へ保存し、直後に読み戻して
 * 同じID・記事ID・モデルケースIDで再現できることを確認する。
 *
 * Repository は通常プランと同じ抽象を使うため、Preview の IndexedDB と
 * cloud-storage entitlement のある専用アカウントの D1 の双方で利用できる。
 */
export async function saveContentModelCase(
  repository: import('./planRepository').PlanRepository,
  model: ContentModelCase,
  now = new Date(),
): Promise<SaveContentModelCaseResult> {
  const validation = validateContentModelCase(model);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const id = getContentModelPlanId(model.modelCaseId);
  const existing = await repository.get(id);
  const record = toContentModelPlanRecord(model, existing, now);
  await repository.save(record);

  const reloaded = await repository.get(id);
  if (!reloaded) {
    throw new Error('Saved content model case could not be read back.');
  }
  if (!isContentModelPlan(reloaded) || reloaded.id !== id) {
    throw new Error('Reloaded content model case has an unexpected id.');
  }

  if (
    reloaded.note !== record.note || reloaded.schemaVersion !== record.schemaVersion ||
    !sameJson(reloaded.payload, record.payload)
  ) {
    throw new Error('Reloaded content model case metadata, schema or payload does not match.');
  }

  return { plan: reloaded, created: existing == null };
}
