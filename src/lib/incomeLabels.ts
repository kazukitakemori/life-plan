import type {
  DependentStatus,
  FilingType,
  IncomeCategory,
  IncomeEntry,
  IncomeStreamType,
} from '../types/income';
import type {
  PeriodSocialInsuranceDependentStatus,
  PeriodTaxDependentStatus,
} from './periodDependentResolution';
import {
  getApproximateEmployeeGrossLimitManForSpouseSpecialDeduction,
  getApproximateEmployeeGrossLimitManForTaxDependent,
  getTaxDependentTotalIncomeLimitMan,
} from './dependentValidation';

export const DEPENDENT_STATUS_LABELS: Record<DependentStatus, string> = {
  none: 'なし',
  dependent: '扶養に入る',
};

/** 収入条件を満たさないのに「扶養に入る」を選んだときのアラート */
export const DEPENDENT_INELIGIBLE_ALERT =
  '現在の収入では税制上・社会保険のいずれの扶養にも該当しないため、「扶養に入る」は選択できません。';

/** @deprecated getTaxDependentLabelSpouse(calendarYear) を使用 */
export const TAX_DEPENDENT_LABEL =
  'この期間、世帯主の申告で配偶者控除の対象とする';

export const SOCIAL_INSURANCE_DEPENDENT_LABEL =
  'この期間、世帯主の社会保険の扶養に入る';

/** @deprecated getTaxDependentLabelChildOther(calendarYear) を使用 */
export const TAX_DEPENDENT_LABEL_CHILD_OTHER =
  'この期間、税法上の扶養に入れる（合計所得58万円以下の年のみ適用・令和7年分以降）';

export function getTaxDependentLabelSpouse(calendarYear: number): string {
  const limitMan = getTaxDependentTotalIncomeLimitMan(calendarYear);
  const grossHintMan = Math.round(
    getApproximateEmployeeGrossLimitManForTaxDependent(calendarYear),
  );
  return `この期間、世帯主の申告で配偶者控除の対象とする（合計所得${limitMan}万円以下・給与のみの目安：年収約${grossHintMan}万円）`;
}

export function getTaxDependentLabelChildOther(calendarYear: number): string {
  const limitMan = getTaxDependentTotalIncomeLimitMan(calendarYear);
  return `この期間、税法上の扶養に入れる（合計所得${limitMan}万円以下の年のみ適用）`;
}

export function getSpouseTaxDependentGuide(calendarYear: number): string {
  const grossHintMan = Math.round(
    getApproximateEmployeeGrossLimitManForTaxDependent(calendarYear),
  );
  const specialDeductionEndMan = Math.round(
    getApproximateEmployeeGrossLimitManForSpouseSpecialDeduction(calendarYear),
  );
  return `給与のみの目安：配偶者控除は年収約${grossHintMan}万円まで、配偶者特別控除は約${specialDeductionEndMan}万円未満`;
}

export function formatPeriodTaxDependentStatus(
  status: PeriodTaxDependentStatus,
): string {
  switch (status) {
    case 'within_spouse_deduction':
      return '扶養内（配偶者控除）';
    case 'within_spouse_special_deduction':
      return '一部扶養内（配偶者特別控除）';
    case 'within_tax_dependent':
      return '扶養内';
    default:
      return 'なし';
  }
}

export function formatPeriodSocialInsuranceDependentStatus(
  status: PeriodSocialInsuranceDependentStatus,
): string {
  return status === 'within' ? '扶養内' : 'なし';
}

export function periodTaxDependentStatusClass(
  status: PeriodTaxDependentStatus,
): string {
  return status === 'none'
    ? 'income-period-dependent-auto-status--none'
    : 'income-period-dependent-auto-status--active';
}

export function periodSocialInsuranceDependentStatusClass(
  status: PeriodSocialInsuranceDependentStatus,
): string {
  return status === 'none'
    ? 'income-period-dependent-auto-status--none'
    : 'income-period-dependent-auto-status--active';
}

export const SOCIAL_INSURANCE_DEPENDENT_LABEL_CHILD_OTHER =
  'この期間、社会保険の扶養に入れる（収入130万円未満の年のみ適用）';

export const DEPENDENT_STATUS_OPTIONS: DependentStatus[] = ['none', 'dependent'];

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  employee: '会社員',
  civil_servant: '公務員',
  part_time: 'パート・アルバイト',
  self_employed: '自営業',
  benefit: '給付金',
  other: 'その他',
};

/** 収入ブロックの表示名（副業カード由来など） */
export function getIncomeEntryDisplayLabel(entry: IncomeEntry): string {
  if (entry.incomePurpose === 'side_business') {
    return '副業・事業収入';
  }
  return INCOME_CATEGORY_LABELS[entry.category];
}

/** 副業カード由来の収入ブロックか */
export function isSideBusinessIncomeEntry(entry: IncomeEntry): boolean {
  return entry.incomePurpose === 'side_business';
}

/** 副業ブロックの収入形態表示（国保加入を連想させない文言） */
export const SIDE_BUSINESS_STREAM_LABEL = '事業所得（税金のみ加算）';

/** 収入形態の表示ラベル（副業など文脈に応じて差し替え） */
export function getIncomeStreamDisplayLabel(
  entry: IncomeEntry,
  streamType: IncomeStreamType,
): string {
  if (
    isSideBusinessIncomeEntry(entry) &&
    streamType === 'business_national_insurance'
  ) {
    return SIDE_BUSINESS_STREAM_LABEL;
  }
  return INCOME_STREAM_LABELS[streamType];
}

export const INCOME_STREAM_LABELS: Record<IncomeStreamType, string> = {
  salary_social_insurance: '給与収入（厚生年金、被用者保険）',
  salary_national_insurance: '給与収入（国民年金、国民健康保険）',
  salary_civil_mutual: '給与収入（公務員厚生、私学共済、共済組合）',
  business_national_insurance: '事業収入（国民年金、国民健康保険）',
  benefit_tax_free: '非課税収入',
  miscellaneous_income: '雑所得',
  temporary_income: '一時所得',
  tax_free_income: '非課税収入',
};

export const FILING_TYPE_LABELS: Record<FilingType, string> = {
  white: '白色',
  blue_65: '青色（65万円）',
  blue_55: '青色（55万円）',
  blue_10: '青色（10万円）',
};

export const FILING_TYPE_OPTIONS: FilingType[] = [
  'white',
  'blue_65',
  'blue_55',
  'blue_10',
];

export const CATEGORY_TO_STREAM: Record<IncomeCategory, IncomeStreamType> = {
  employee: 'salary_social_insurance',
  civil_servant: 'salary_civil_mutual',
  part_time: 'salary_social_insurance',
  self_employed: 'business_national_insurance',
  benefit: 'benefit_tax_free',
  other: 'miscellaneous_income',
};

const STREAM_TYPES_BY_CATEGORY: Record<IncomeCategory, IncomeStreamType[]> = {
  employee: ['salary_social_insurance', 'salary_national_insurance'],
  civil_servant: ['salary_civil_mutual', 'salary_national_insurance'],
  part_time: ['salary_social_insurance', 'salary_national_insurance'],
  self_employed: [
    'business_national_insurance',
    'salary_national_insurance',
  ],
  benefit: ['benefit_tax_free'],
  other: ['miscellaneous_income', 'temporary_income', 'tax_free_income'],
};

export function getStreamTypeOptions(
  category: IncomeCategory,
): IncomeStreamType[] {
  return STREAM_TYPES_BY_CATEGORY[category];
}

export function isStreamTypeFixed(category: IncomeCategory): boolean {
  return category === 'benefit';
}

/** 給付金・その他は月額のみ（賞与欄なし） */
export function incomeCategoryShowsBonus(category: IncomeCategory): boolean {
  return category !== 'benefit' && category !== 'other';
}

/** 給付金・その他は期間を単月（一時金）に切り替えるボタンを表示 */
export function incomeCategoryShowsLumpSum(category: IncomeCategory): boolean {
  return category === 'benefit' || category === 'other';
}

/** 給付金・その他の収入ブロックでは扶養設定UIを出さない */
export function incomeCategoryShowsDependentSettings(
  category: IncomeCategory,
): boolean {
  return category !== 'benefit' && category !== 'other';
}

/**
 * 会社等の退職金入力は雇用系のみ。
 * 自営業・副業・事業収入は退職金制度がなく、iDeCo／小規模企業共済等で積み立てる想定。
 */
export function incomeCategoryShowsRetirementAllowance(
  category: IncomeCategory,
): boolean {
  return (
    category === 'employee' ||
    category === 'civil_servant' ||
    category === 'part_time'
  );
}

export interface AddIncomeOption {
  category: IncomeCategory;
  icon: string;
  /** 省略時は INCOME_CATEGORY_LABELS[category] */
  label?: string;
  description: string;
  /** 副業カードなど、同じ category でも追加方法が異なる場合 */
  variant?: 'side_business';
}

export const ADD_INCOME_OPTIONS: AddIncomeOption[] = [
  {
    category: 'employee',
    icon: '👔',
    description: '給与収入（厚生年金、被用者保険）',
  },
  {
    category: 'civil_servant',
    icon: '🏛️',
    description: '給与収入（公務員厚生、私学共済、共済組合）',
  },
  {
    category: 'part_time',
    icon: '⏰',
    description: '給与収入（厚生年金、被用者保険）',
  },
  {
    category: 'self_employed',
    icon: '📊',
    label: '副業・事業収入',
    description: '本業の給与がある人向け。社保は本業のまま、税金だけ事業所得を加算',
    variant: 'side_business',
  },
  {
    category: 'self_employed',
    icon: '🏪',
    description: '本業が事業（国保・国民年金に加入する想定）',
  },
  {
    category: 'benefit',
    icon: '💴',
    description: '非課税収入',
  },
  {
    category: 'other',
    icon: '📋',
    description: '雑所得・一時所得など',
  },
];
