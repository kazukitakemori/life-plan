import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import { calcMemberAnnualPensionManByMember } from './pensionIncome';
import {
  buildQ4LivingBreakdown,
  scaleLivingBreakdown,
  sumConfiguredLivingMonthlyMan,
  sumEnteredLivingMonthlyMan,
} from './secondLifeLivingTotal';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember } from '../types/income';
import type { LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';
import type {
  SecondLifeHousingScenario,
  SecondLifeHometownOption,
  SecondLifeLivingBreakdownItem,
  SecondLifeLivingLevel,
  SecondLifeNewAreaOption,
  SecondLifeNursingScenario,
  SecondLifeState,
  SecondLifeStayOption,
} from '../types/secondLife';
import { getMemberAgeAtYearEnd } from './memberYearIncome';

const MOVING_COST_MAN = 50;
const POST_PURCHASE_RENOVATION_MAN = 300;
const RENOVATE_CURRENT_HOME_MAN = 500;
const PURCHASE_REBUILD_MAN = 2_500;
const RENOVATE_PARENTS_HOME_MAN = 400;

const PENSION_LIVING_CATEGORY_WEIGHTS: {
  label: string;
  weight: number;
}[] = [
  { label: '食費', weight: 6 },
  { label: '光熱費・水道', weight: 2 },
  { label: '家具・家電', weight: 0.8 },
  { label: '被服・靴', weight: 0.5 },
  { label: '保健・医療', weight: 1.2 },
  { label: '交通・通信', weight: 2.4 },
  { label: 'その他', weight: 0 },
];

const NURSING_DEFAULT_ANNUAL_MAN: Record<SecondLifeNursingScenario, number> = {
  home: 30,
  day_service: 50,
  facility: 120,
};

export function getCalendarYearAtHeadAge(
  head: FamilyMember,
  referenceDate: Date,
  age: number,
): number {
  return calcBirthYear(head.age, head.birthMonth, referenceDate) + age;
}

/** 世帯主が指定年齢に達する暦年・月時点でのメンバー年齢 */
export function getMemberAgeWhenHeadReachesAge(
  head: FamilyMember,
  member: FamilyMember,
  referenceDate: Date,
  headAge: number,
  calendarMonth = 1,
): number | null {
  const calendarYear = getCalendarYearAtHeadAge(head, referenceDate, headAge);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  return ageMonth?.age ?? null;
}

/** 指定した世帯主年齢の暦年・月における世帯生活費（月額・万円） */
export function getHouseholdMonthlyLivingManAtHeadAgeMonth(
  livingState: LivingExpenseState,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  headAge: number,
  calendarMonth = 1,
): number {
  const head = familyMembers.find((member) => member.role === 'head');
  if (!head) return 0;
  const calendarYear = getCalendarYearAtHeadAge(head, referenceDate, headAge);
  return sumConfiguredLivingMonthlyMan({
    familyMembers,
    livingState,
    referenceDate,
    calendarYear,
    calendarMonth,
  });
}

/** Q4 に入力済みのセカンドライフ期間（開始年齢〜）の生活費（月額・万円） */
export function getSecondLifePeriodMonthlyLivingMan(input: {
  livingState: LivingExpenseState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  startAge: number;
}): number {
  return getHouseholdMonthlyLivingManAtHeadAgeMonth(
    input.livingState,
    input.familyMembers,
    input.referenceDate,
    input.startAge,
    1,
  );
}

/**
 * 「現在と同水準」「7割」の基準となる生活費（月額・万円）。
 * Q4 のご家族＋各メンバー入力を合算（詳細内訳を含む）。
 */
export function getPreSecondLifeMonthlyLivingMan(input: {
  livingState: LivingExpenseState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  startAge: number;
}): number {
  const referenceYear = input.referenceDate.getFullYear();
  const referenceMonth = input.referenceDate.getMonth() + 1;
  const atReference = sumConfiguredLivingMonthlyMan({
    familyMembers: input.familyMembers,
    livingState: input.livingState,
    referenceDate: input.referenceDate,
    calendarYear: referenceYear,
    calendarMonth: referenceMonth,
  });
  const enteredTotal = sumEnteredLivingMonthlyMan({
    familyMembers: input.familyMembers,
    livingState: input.livingState,
  });
  const baseline = Math.max(atReference, enteredTotal);
  if (baseline > 0) {
    return baseline;
  }

  const head = input.familyMembers.find((member) => member.role === 'head');
  if (!head) return 0;

  return sumConfiguredLivingMonthlyMan({
    familyMembers: input.familyMembers,
    livingState: input.livingState,
    referenceDate: input.referenceDate,
    calendarYear: getCalendarYearAtHeadAge(
      head,
      input.referenceDate,
      input.startAge,
    ),
    calendarMonth: 1,
  });
}

/** @deprecated 互換用。getPreSecondLifeMonthlyLivingMan を使用してください。 */
export function getCurrentHouseholdMonthlyLivingMan(
  livingState: LivingExpenseState,
  head: FamilyMember,
  referenceDate: Date,
): number {
  return getHouseholdMonthlyLivingManAtHeadAgeMonth(
    livingState,
    [head],
    referenceDate,
    getMemberAgeAtYearEnd(head, referenceDate, referenceDate.getFullYear()) ??
      head.age ??
      0,
    referenceDate.getMonth() + 1,
  );
}

export function sumHouseholdAnnualPensionMan(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear: number;
}): number {
  const byMember = calcMemberAnnualPensionManByMember(input);
  return Object.values(byMember).reduce((sum, value) => sum + value, 0);
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildPensionLivingBreakdown(
  monthlyMan: number,
): SecondLifeLivingBreakdownItem[] {
  const weightSum = PENSION_LIVING_CATEGORY_WEIGHTS.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  if (weightSum <= 0) {
    return [{ label: '生活費', amountMan: roundMan(monthlyMan) }];
  }
  return PENSION_LIVING_CATEGORY_WEIGHTS.map((item) => ({
    label: item.label,
    amountMan: roundMan((monthlyMan * item.weight) / weightSum),
  }));
}

export interface SecondLifeLivingOption {
  level: SecondLifeLivingLevel;
  label: string;
  monthlyMan: number;
  breakdown: SecondLifeLivingBreakdownItem[];
  breakdownNote?: string;
  pensionAnnualMan?: number;
}

export function buildSecondLifeLivingOptions(input: {
  livingState: LivingExpenseState;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  startAge: number;
}): SecondLifeLivingOption[] {
  const head = input.familyMembers.find((m) => m.role === 'head');
  if (!head) return [];

  const currentMonthly = getPreSecondLifeMonthlyLivingMan({
    livingState: input.livingState,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    startAge: input.startAge,
  });
  const seventyMonthly = roundMan(currentMonthly * 0.7);
  const calendarYear = getCalendarYearAtHeadAge(
    head,
    input.referenceDate,
    input.startAge,
  );
  const pensionAnnual = sumHouseholdAnnualPensionMan({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
    calendarYear,
  });
  const pensionMonthly = roundMan(pensionAnnual / 12);
  const referenceYear = input.referenceDate.getFullYear();
  const referenceMonth = input.referenceDate.getMonth() + 1;
  const q4Breakdown = buildQ4LivingBreakdown({
    familyMembers: input.familyMembers,
    livingState: input.livingState,
    referenceDate: input.referenceDate,
    calendarYear: referenceYear,
    calendarMonth: referenceMonth,
  });

  return [
    {
      level: 'same',
      label: '現在と同水準の生活費',
      monthlyMan: roundMan(currentMonthly),
      breakdown: q4Breakdown,
      breakdownNote:
        q4Breakdown.length > 0 ? 'Q4 生活費の内訳' : undefined,
    },
    {
      level: 'seventy_percent',
      label: '現在の7割の生活費',
      monthlyMan: seventyMonthly,
      breakdown: scaleLivingBreakdown(q4Breakdown, 0.7),
      breakdownNote:
        q4Breakdown.length > 0 ? 'Q4 生活費の内訳（7割）' : undefined,
    },
    {
      level: 'pension_based',
      label: '年金収入に応じた生活費',
      monthlyMan: pensionMonthly,
      breakdown: buildPensionLivingBreakdown(pensionMonthly),
      breakdownNote: '年金からの目安配分',
      pensionAnnualMan: roundMan(pensionAnnual),
    },
  ];
}

function estimateBaseHousingCostMan(
  scenario: SecondLifeHousingScenario,
  stayOption: SecondLifeStayOption,
  hometownOption: SecondLifeHometownOption,
  newAreaOption: SecondLifeNewAreaOption,
): number {
  if (scenario === 'stay') {
    return stayOption === 'renovate'
      ? RENOVATE_CURRENT_HOME_MAN
      : PURCHASE_REBUILD_MAN;
  }
  if (scenario === 'hometown') {
    return hometownOption === 'renovate_parents'
      ? RENOVATE_PARENTS_HOME_MAN
      : PURCHASE_REBUILD_MAN;
  }
  return newAreaOption === 'rent' ? 0 : PURCHASE_REBUILD_MAN;
}

export function estimateSecondLifeHousingTotalMan(
  state: Pick<
    SecondLifeState,
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
    | 'includeMovingCost'
    | 'includePostPurchaseRenovation'
  >,
): number | null {
  let total = estimateBaseHousingCostMan(
    state.housingScenario,
    state.stayOption,
    state.hometownOption,
    state.newAreaOption,
  );

  const needsMoving =
    state.housingScenario === 'hometown' ||
    state.housingScenario === 'new_area' ||
    state.includeMovingCost;
  if (needsMoving) {
    total += MOVING_COST_MAN;
  }

  const purchaseSelected =
    (state.housingScenario === 'stay' &&
      state.stayOption === 'purchase_rebuild') ||
    (state.housingScenario === 'hometown' &&
      state.hometownOption === 'purchase_rebuild') ||
    (state.housingScenario === 'new_area' &&
      state.newAreaOption === 'purchase');

  if (purchaseSelected && state.includePostPurchaseRenovation) {
    total += POST_PURCHASE_RENOVATION_MAN;
  }

  return total > 0 ? total : null;
}

export function getDefaultNursingAnnualCostMan(
  scenario: SecondLifeNursingScenario,
): number {
  return NURSING_DEFAULT_ANNUAL_MAN[scenario];
}

export function formatSecondLifeMan(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value)
    ? value.toLocaleString('ja-JP')
    : value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      });
}
