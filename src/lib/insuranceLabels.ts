import type {
  InsuranceBenefitPayoutMode,
  InsuranceCategory,
  InsuranceEntry,
  InsurancePremiumPaymentMode,
  InsuranceSector,
  LifeInsuranceDeductionKind,
  PersonalPensionAnnuityKind,
} from '../types/insurance';

export const INSURANCE_SECTOR_LABELS: Record<InsuranceSector, string> = {
  nonlife: '損害保険',
  life: '生命保険',
};

export const INSURANCE_SECTOR_DESCRIPTIONS: Record<InsuranceSector, string> = {
  nonlife: '火災・自動車など、物や賠償をカバーする保険',
  life: '死亡・医療・がんなど、人に関わる保障',
};

export const INSURANCE_CATEGORY_SECTOR: Record<InsuranceCategory, InsuranceSector> =
  {
    fire: 'nonlife',
    auto: 'nonlife',
    nonlife_other: 'nonlife',
    life: 'life',
    medical: 'life',
    cancer: 'life',
    education: 'life',
    personal_pension: 'life',
    life_other: 'life',
  };

export const INSURANCE_CATEGORY_LABELS: Record<InsuranceCategory, string> = {
  fire: '火災保険',
  auto: '自動車保険',
  nonlife_other: 'その他損害保険',
  life: '死亡保険',
  medical: '医療保険',
  cancer: 'がん保険',
  education: '学資保険',
  personal_pension: '個人年金保険',
  life_other: 'その他生命保険',
};

export const INSURANCE_CATEGORY_DEFAULT_NAMES: Record<InsuranceCategory, string> =
  {
    fire: '火災保険',
    auto: '任意保険',
    nonlife_other: '損害保険',
    life: '死亡保険',
    medical: '医療保険',
    cancer: 'がん保険',
    education: '学資保険',
    personal_pension: '個人年金保険',
    life_other: '生命保険',
  };

export const INSURANCE_CATEGORY_ICONS: Record<InsuranceCategory, string> = {
  fire: '🔥',
  auto: '🚗',
  nonlife_other: '☂️',
  life: '🛡️',
  medical: '🏥',
  cancer: '🎗️',
  education: '📚',
  personal_pension: '🏦',
  life_other: '💚',
};

export const INSURANCE_CATEGORY_DESCRIPTIONS: Record<InsuranceCategory, string> =
  {
    fire: '建物・家財の保障',
    auto: '車の保障',
    nonlife_other: '傷害・旅行など',
    life: '死亡保障・収入保障など',
    medical: '入院・手術などの医療保障',
    cancer: 'がん診断・治療の保障',
    education: '教育資金の積み立てなど',
    personal_pension: '老後の年金受取など',
    life_other: '更新型保険など',
  };

/** 追加カード：損害保険グループ */
export const INSURANCE_NONLIFE_ADD_CATEGORIES: InsuranceCategory[] = [
  'fire',
  'auto',
  'nonlife_other',
];

/** 追加カード：生命保険グループ */
export const INSURANCE_LIFE_ADD_CATEGORIES: InsuranceCategory[] = [
  'life',
  'medical',
  'cancer',
  'education',
  'personal_pension',
  'life_other',
];

export const INSURANCE_PREMIUM_PAYMENT_MODE_LABELS: Record<
  InsurancePremiumPaymentMode,
  string
> = {
  monthly: '月払い',
  annual: '年払い',
  lump_sum: '一時払い',
};

export const INSURANCE_PREMIUM_PAYMENT_MODE_UNITS: Record<
  InsurancePremiumPaymentMode,
  string
> = {
  monthly: '万円',
  annual: '万円',
  lump_sum: '万円',
};

export const INSURANCE_PREMIUM_PAYMENT_MODES: InsurancePremiumPaymentMode[] = [
  'monthly',
  'annual',
  'lump_sum',
];

export function resolveInsurancePremiumPaymentMode(
  mode: InsurancePremiumPaymentMode | undefined,
): InsurancePremiumPaymentMode {
  return mode ?? 'annual';
}

export const INSURANCE_BENEFIT_PAYOUT_MODE_LABELS: Record<
  InsuranceBenefitPayoutMode,
  string
> = {
  lump_sum: '一括受取',
  annuity: '年金形式',
};

export const INSURANCE_BENEFIT_PAYOUT_MODES: InsuranceBenefitPayoutMode[] = [
  'lump_sum',
  'annuity',
];

export function resolveInsuranceBenefitPayoutMode(
  mode: InsuranceBenefitPayoutMode | undefined,
): InsuranceBenefitPayoutMode {
  return mode ?? 'lump_sum';
}

export const PERSONAL_PENSION_ANNUITY_KIND_LABELS: Record<
  PersonalPensionAnnuityKind,
  string
> = {
  certain: '確定年金',
  term: '有期年金',
  lifetime: '終身年金',
};

export const PERSONAL_PENSION_ANNUITY_KIND_DESCRIPTIONS: Record<
  PersonalPensionAnnuityKind,
  string
> = {
  certain: '決められた期間は、生死にかかわらず年金を受け取れます。',
  term: '決められた期間内で、生きている間だけ年金を受け取れます。',
  lifetime: '生きている限り、一生涯にわたって年金を受け取れます。',
};

export const PERSONAL_PENSION_ANNUITY_KINDS: PersonalPensionAnnuityKind[] = [
  'certain',
  'term',
  'lifetime',
];

export function resolvePersonalPensionAnnuityKind(
  kind: PersonalPensionAnnuityKind | undefined,
): PersonalPensionAnnuityKind {
  return kind ?? 'certain';
}

/** 確定年金・有期年金は受取期間の入力が必要 */
export function needsPersonalPensionAnnuityPeriod(
  kind: PersonalPensionAnnuityKind,
): boolean {
  return kind === 'certain' || kind === 'term';
}

/** 確定・有期年金の受取期間の選択肢（年） */
export const PERSONAL_PENSION_ANNUITY_YEAR_OPTIONS = [5, 10, 15, 20] as const;

/** 確定・有期年金の受取期間の既定（年） */
export const DEFAULT_PERSONAL_PENSION_ANNUITY_YEARS = 10;

export function resolvePersonalPensionAnnuityYears(
  years: number | undefined,
): number {
  if (
    years != null &&
    (PERSONAL_PENSION_ANNUITY_YEAR_OPTIONS as readonly number[]).includes(years)
  ) {
    return years;
  }
  return DEFAULT_PERSONAL_PENSION_ANNUITY_YEARS;
}

/** 受取形式・受取時期・受取額を入力できるカテゴリ（学資・個人年金） */
export function hasBenefitPayoutInput(category: InsuranceCategory): boolean {
  return category === 'education' || category === 'personal_pension';
}

/** 学資・個人年金の受取額入力（一括・年金とも） */
export function hasBenefitAmountInput(category: InsuranceCategory): boolean {
  return category === 'education' || category === 'personal_pension';
}

/** 学資の年金受取期間の選択肢（年） */
export const EDUCATION_ANNUITY_YEAR_OPTIONS = [2, 3, 4, 5, 6] as const;

/** 学資の年金受取期間の既定（年）＝大学在学の目安 */
export const DEFAULT_EDUCATION_ANNUITY_YEARS = 4;

export function resolveEducationAnnuityYears(
  years: number | undefined,
): number {
  if (
    years != null &&
    (EDUCATION_ANNUITY_YEAR_OPTIONS as readonly number[]).includes(years)
  ) {
    return years;
  }
  return DEFAULT_EDUCATION_ANNUITY_YEARS;
}

/** 受取開始年齢と期間から終了年齢（開始年を含む）を返す */
export function calcEducationAnnuityEndAge(
  startAge: number,
  years: number,
): number {
  return startAge + Math.max(1, years) - 1;
}

/** 受取時期の既定年齢（学資=18歳、個人年金=65歳） */
export function getDefaultBenefitReceiveAge(
  category: InsuranceCategory,
): number {
  if (category === 'education') return 18;
  if (category === 'personal_pension') return 65;
  return 0;
}

export const LIFE_INSURANCE_DEDUCTION_KIND_LABELS: Record<
  LifeInsuranceDeductionKind,
  string
> = {
  general: '一般生命保険料',
  nursing: '介護医療保険料',
  pension: '個人年金保険料',
  none: '控除対象外',
};

export const LIFE_INSURANCE_DEDUCTION_KIND_OPTIONS: LifeInsuranceDeductionKind[] =
  ['general', 'nursing', 'pension', 'none'];

/**
 * カテゴリごとの生命保険料控除の既定区分。
 * 死亡・学資＝一般、医療・がん＝介護医療、個人年金＝個人年金に固定。
 * その他生命のみ選択可。
 */
export function getDefaultLifeDeductionKind(
  category: InsuranceCategory,
): LifeInsuranceDeductionKind {
  switch (category) {
    case 'life':
    case 'education':
      return 'general';
    case 'medical':
    case 'cancer':
      return 'nursing';
    case 'personal_pension':
      return 'pension';
    case 'life_other':
      return 'general';
    default:
      return 'none';
  }
}

/** 死亡・医療・がん・学資・個人年金は控除区分をカテゴリで固定する */
export function isFixedLifeDeductionCategory(
  category: InsuranceCategory,
): boolean {
  return (
    category === 'life' ||
    category === 'medical' ||
    category === 'cancer' ||
    category === 'education' ||
    category === 'personal_pension'
  );
}

/** 表示・税計算用に実効控除区分を返す（固定カテゴリは常に既定値） */
export function resolveLifeDeductionKind(
  category: InsuranceCategory,
  stored?: LifeInsuranceDeductionKind,
): LifeInsuranceDeductionKind {
  if (isFixedLifeDeductionCategory(category)) {
    return getDefaultLifeDeductionKind(category);
  }
  if (category === 'life_other') {
    return stored ?? 'general';
  }
  return 'none';
}

export function isLifeInsuranceCategory(category: InsuranceCategory): boolean {
  return INSURANCE_CATEGORY_SECTOR[category] === 'life';
}

/** 受取人を入力できるカテゴリ（学資・個人年金の受取人） */
export function hasBeneficiaryInput(category: InsuranceCategory): boolean {
  return hasBenefitPayoutInput(category);
}

/** 返戻金の有無を入力できるカテゴリ（死亡・医療・がん・その他生命） */
export function hasReturnValueInput(category: InsuranceCategory): boolean {
  return (
    category === 'life' ||
    category === 'medical' ||
    category === 'cancer' ||
    category === 'life_other'
  );
}

/** 返戻金の受取人を入力できるか（死亡・医療・がんで返戻金ありのとき） */
export function showsReturnValueBeneficiary(
  category: InsuranceCategory,
  hasReturnValue: boolean,
): boolean {
  return hasReturnValueInput(category) && hasReturnValue;
}

export function formatFireInsuranceName(propertyName: string): string {
  const trimmed = propertyName.trim();
  return trimmed ? `${trimmed}の火災保険` : INSURANCE_CATEGORY_DEFAULT_NAMES.fire;
}

export function formatAutoInsuranceName(vehicleName: string): string {
  const trimmed = vehicleName.trim();
  return trimmed
    ? `${trimmed}の任意保険`
    : INSURANCE_CATEGORY_DEFAULT_NAMES.auto;
}

export function formatInsurancePremiumSummary(entry: InsuranceEntry): string {
  if (!entry.premiumMan || entry.premiumMan <= 0) {
    return '保険料 未設定';
  }
  const mode = resolveInsurancePremiumPaymentMode(entry.premiumPaymentMode);
  return `${INSURANCE_PREMIUM_PAYMENT_MODE_LABELS[mode]}${entry.premiumMan}万円`;
}
