import type { LoanStructureType } from '../types/loan';

/** 個人向け団信プラン（ペアローン各本・収入合算の主債務者・単独） */
export type IndividualGroupCreditLifePlan =
  | 'general'
  | 'cancer_50'
  | 'cancer_100_major_3';

/** 連帯債務向け団信プラン */
export type JointDebtGroupCreditLifePlan =
  | 'primary_general'
  | 'primary_cancer_100'
  | 'couple_joint';

export type GroupCreditLifePlan =
  | IndividualGroupCreditLifePlan
  | JointDebtGroupCreditLifePlan;

export const DEFAULT_GROUP_CREDIT_LIFE_PLAN: GroupCreditLifePlan = 'general';

export interface GroupCreditLifePlanOption {
  value: GroupCreditLifePlan;
  label: string;
  defaultSurchargeRatePct: number;
  /** 上乗せ金利の目安（下限 %）。未設定時は表示なし */
  surchargeRangeMinPct?: number;
  /** 上乗せ金利の目安（上限 %）。未設定時は下限と同値扱い */
  surchargeRangeMaxPct?: number;
}

function formatSurchargePctLabel(value: number): string {
  return `${Number(value.toFixed(3))}%`;
}

export function formatGroupCreditLifeSurchargeRangeHint(
  option: GroupCreditLifePlanOption | undefined,
): string | null {
  if (!option) return null;

  const min = option.surchargeRangeMinPct;
  const max = option.surchargeRangeMaxPct ?? min;
  if (min == null) return null;
  if (min === 0 && (max ?? 0) === 0) return null;

  const upper = max ?? min;
  if (min === upper) {
    return `（目安：${formatSurchargePctLabel(min)}）`;
  }
  return `（目安：${formatSurchargePctLabel(min)}～${formatSurchargePctLabel(upper)}）`;
}

export const INDIVIDUAL_GROUP_CREDIT_LIFE_PLAN_OPTIONS: GroupCreditLifePlanOption[] =
  [
    {
      value: 'general',
      label: '一般団信',
      defaultSurchargeRatePct: 0,
    },
    {
      value: 'cancer_50',
      label: 'がん50%保障特約',
      defaultSurchargeRatePct: 0.075,
      surchargeRangeMinPct: 0.05,
      surchargeRangeMaxPct: 0.1,
    },
    {
      value: 'cancer_100_major_3',
      label: 'がん100%・三大疾病保障',
      defaultSurchargeRatePct: 0.2,
      surchargeRangeMinPct: 0.2,
      surchargeRangeMaxPct: 0.2,
    },
  ];

export const JOINT_DEBT_GROUP_CREDIT_LIFE_PLAN_OPTIONS: GroupCreditLifePlanOption[] =
  [
    {
      value: 'primary_general',
      label: '主債務者のみ：一般団信',
      defaultSurchargeRatePct: 0,
    },
    {
      value: 'primary_cancer_100',
      label: '主債務者のみ：がん100%・三大疾病',
      defaultSurchargeRatePct: 0.2,
      surchargeRangeMinPct: 0.2,
      surchargeRangeMaxPct: 0.2,
    },
    {
      value: 'couple_joint',
      label: '夫婦連生団信',
      defaultSurchargeRatePct: 0.24,
      surchargeRangeMinPct: 0.18,
      surchargeRangeMaxPct: 0.3,
    },
  ];

const ALL_GROUP_CREDIT_LIFE_PLAN_OPTIONS = [
  ...INDIVIDUAL_GROUP_CREDIT_LIFE_PLAN_OPTIONS,
  ...JOINT_DEBT_GROUP_CREDIT_LIFE_PLAN_OPTIONS,
];

export function getGroupCreditLifePlanOption(
  plan: GroupCreditLifePlan | undefined,
): GroupCreditLifePlanOption | undefined {
  return ALL_GROUP_CREDIT_LIFE_PLAN_OPTIONS.find(
    (option) => option.value === (plan ?? DEFAULT_GROUP_CREDIT_LIFE_PLAN),
  );
}

/** プラン選択時の初期上乗せ金利（%） */
export function getDefaultGroupCreditLifeSurchargeRatePct(
  plan: GroupCreditLifePlan | undefined,
): number {
  return (
    getGroupCreditLifePlanOption(plan)?.defaultSurchargeRatePct ?? 0
  );
}

export function resolveGroupCreditLifeSurchargeRatePct(settings: {
  groupCreditLifePlan?: GroupCreditLifePlan;
  groupCreditLifeSurchargeRatePct?: number;
}): number {
  if (settings.groupCreditLifeSurchargeRatePct != null) {
    return Math.max(0, settings.groupCreditLifeSurchargeRatePct);
  }
  return getDefaultGroupCreditLifeSurchargeRatePct(settings.groupCreditLifePlan);
}

export function normalizeGroupCreditLifePlan(
  plan: GroupCreditLifePlan | undefined,
  structureType: LoanStructureType | undefined,
): GroupCreditLifePlan {
  if (!plan) {
    return DEFAULT_GROUP_CREDIT_LIFE_PLAN;
  }

  if (structureType === 'joint_debt') {
    if (
      plan === 'primary_general' ||
      plan === 'primary_cancer_100' ||
      plan === 'couple_joint'
    ) {
      return plan;
    }
    if (plan === 'cancer_100_major_3') return 'primary_cancer_100';
    if (plan === 'cancer_50') return 'primary_general';
    return 'primary_general';
  }

  if (
    plan === 'general' ||
    plan === 'cancer_50' ||
    plan === 'cancer_100_major_3'
  ) {
    return plan;
  }

  if (plan === 'primary_general') return 'general';
  if (plan === 'primary_cancer_100') return 'cancer_100_major_3';
  return 'general';
}

export function getPairSideLabel(role: 'head' | 'spouse' | string): string {
  if (role === 'head') return '夫側のローン';
  if (role === 'spouse') return '妻側のローン';
  return '借入者のローン';
}
