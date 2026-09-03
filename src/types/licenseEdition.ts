/** ライセンスエディション（一般向け / 事業者向け） */
export type LicenseEdition = 'personal' | 'advisor';

export const LICENSE_EDITION_LABELS: Record<LicenseEdition, string> = {
  personal: '一般向け',
  advisor: '事業者向け',
};

/** エディションごとの機能制限・UI 方針 */
export interface LicenseEntitlements {
  edition: LicenseEdition;
  editionLabel: string;
  /** null = 無制限 */
  maxPlans: number | null;
  /** 電話・メールなど CRM 向け項目 */
  showCrmFields: boolean;
  /** 管理画面のステータス絞り込み */
  showPlanStatusFilter: boolean;
  /** ヘッダー等で「様」を付ける */
  showHonorific: boolean;
  /** 複数プランの一覧・新規作成 UI */
  allowMultiPlanAdmin: boolean;
}

const PERSONAL_ENTITLEMENTS: LicenseEntitlements = {
  edition: 'personal',
  editionLabel: LICENSE_EDITION_LABELS.personal,
  maxPlans: 1,
  showCrmFields: false,
  showPlanStatusFilter: false,
  showHonorific: false,
  allowMultiPlanAdmin: false,
};

const ADVISOR_ENTITLEMENTS: LicenseEntitlements = {
  edition: 'advisor',
  editionLabel: LICENSE_EDITION_LABELS.advisor,
  maxPlans: null,
  showCrmFields: true,
  showPlanStatusFilter: true,
  showHonorific: true,
  allowMultiPlanAdmin: true,
};

export function isLicenseEdition(value: unknown): value is LicenseEdition {
  return value === 'personal' || value === 'advisor';
}

/** 未登録・オフライン時は一般向け UI を既定とする */
export function getLicenseEntitlements(edition?: LicenseEdition | null): LicenseEntitlements {
  if (edition === 'advisor') return ADVISOR_ENTITLEMENTS;
  return PERSONAL_ENTITLEMENTS;
}

export function canCreatePlan(
  entitlements: LicenseEntitlements,
  currentPlanCount: number,
): boolean {
  if (entitlements.maxPlans == null) return true;
  return currentPlanCount < entitlements.maxPlans;
}
