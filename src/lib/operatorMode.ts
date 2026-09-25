import type { PlanRecord, PlanSummary } from '../types/plan';

export interface OperatorMode {
  enabled: boolean;
  hidePersonalInfo: boolean;
}

export const DEFAULT_OPERATOR_MODE: OperatorMode = {
  enabled: false,
  hidePersonalInfo: false,
};

export const OPERATOR_MODE_MASK = '非表示';

export function maskPersonalInfo(
  value: string | null | undefined,
  mode: OperatorMode,
): string {
  if (!mode.enabled || !mode.hidePersonalInfo) return value ?? '';
  return value?.trim() ? OPERATOR_MODE_MASK : '';
}

/**
 * 表示専用のコピーを返す。保存データそのものは変更しない。
 * 編集ボタン等の通常UIはこのモードでは隠さない。
 */
export function toOperatorSafePlanRecord(
  plan: PlanRecord,
  mode: OperatorMode,
): PlanRecord {
  if (!mode.enabled || !mode.hidePersonalInfo) return plan;
  return {
    ...plan,
    customerName: maskPersonalInfo(plan.customerName, mode),
    phone: maskPersonalInfo(plan.phone, mode),
    email: maskPersonalInfo(plan.email, mode),
  };
}

export function toOperatorSafePlanSummary(
  plan: PlanSummary,
  mode: OperatorMode,
): PlanSummary {
  if (!mode.enabled || !mode.hidePersonalInfo) return plan;
  return {
    ...plan,
    customerName: maskPersonalInfo(plan.customerName, mode),
    phone: maskPersonalInfo(plan.phone, mode),
    email: maskPersonalInfo(plan.email, mode),
  };
}
