import type {
  DependentStatus,
  FilingType,
  IncomeCategory,
  IncomeStreamType,
} from '../types/income';

export const DEPENDENT_STATUS_LABELS: Record<DependentStatus, string> = {
  none: 'なし（自身の社会保険に加入・独立して納税）',
  dependent: '扶養に入る',
};

export const TAX_DEPENDENT_LABEL =
  'この期間、世帯主の税法上の扶養に入る';

export const SOCIAL_INSURANCE_DEPENDENT_LABEL =
  'この期間、世帯主の社会保険の扶養に入る';

export const TAX_DEPENDENT_LABEL_CHILD_OTHER =
  'この期間、税法上の扶養に入れる（合計所得48万円以下の年のみ適用）';

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

export interface AddIncomeOption {
  category: IncomeCategory;
  icon: string;
  description: string;
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
    icon: '🏪',
    description: '事業収入（国民年金、国民健康保険）',
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
