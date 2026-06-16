import { calcBirthYear, calcYearAtAge } from './birthDate';
import { calcPeriodGrossRevenueMan } from './incomeTaxDeductions';
import {
  calcCombinedIncomeFromPairs,
  type EntryPeriodPair,
} from './memberCombinedIncome';
import {
  isTaxFreeIncome,
  resolveBonusStreamKey,
  resolveOtherIncomeKey,
  resolveSalaryStreamKey,
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';
import {
  clampPeriodDependentToMember,
  getMemberDependentDefaults,
  usesQ1DependentDefaults,
} from './memberDependentDefaults';
import type { FamilyMember } from '../types/family';
import type {
  DependentStatus,
  FilingType,
  IncomeCategory,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
} from '../types/income';

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isInAgeMonthRange(
  age: number,
  month: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): boolean {
  const current = ageMonthIndex(age, month);
  const start = ageMonthIndex(startAge, startMonth);
  const end = ageMonthIndex(endAge, endMonth);
  return current >= start && current <= end;
}

function getMemberAgeMonth(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } | null {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let age = calendarYear - birthYear;
  if (calendarMonth < member.birthMonth) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return { age, month: calendarMonth };
}

function yearsElapsedSince(
  birthYear: number,
  birthMonth: number,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  const fromCalYear = calcYearAtAge(birthYear, birthMonth, fromAge, fromMonth);
  const months = (toYear - fromCalYear) * 12 + (toMonth - fromMonth);
  return Math.max(0, Math.floor(months / 12));
}

function getPeriodIncomeFactor(
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  if (
    !isInAgeMonthRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
    )
  ) {
    return 0;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    period.startAge,
    period.startMonth,
    calendarYear,
    calendarMonth,
  );

  const increaseRate = period.annualIncreaseRate ?? 0;
  return Math.pow(1 + increaseRate / 100, yearsElapsed);
}

function calcPeriodGrossIncomeManForMonth(
  entry: IncomeEntry,
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const factor = getPeriodIncomeFactor(
    period,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (factor === 0) return 0;

  if (isTaxFreeIncome(entry.category, period.streamType)) {
    return 0;
  }

  let monthlyMan = 0;

  if (treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
    const salaryKey = resolveSalaryStreamKey(period.streamType);
    if (salaryKey) {
      monthlyMan += Math.max(0, period.monthlyAmountMan * factor);
    }
    const bonusKey = resolveBonusStreamKey(period.streamType);
    if (bonusKey) {
      for (const bonus of period.bonuses) {
        if (bonus.paymentMonth === calendarMonth) {
          monthlyMan += bonus.amountMan * factor;
        }
      }
    }
    return monthlyMan;
  }

  const otherKey = resolveOtherIncomeKey(entry.category, period.streamType);
  if (!otherKey) return 0;

  let grossMan = period.monthlyAmountMan * factor;
  if (
    treatsPeriodAsBusinessIncome(entry.category, period.streamType) &&
    entry.expenseManPerMonth != null
  ) {
    grossMan -= entry.expenseManPerMonth * factor;
  }
  return Math.max(0, grossMan);
}

export interface ActiveIncomeSlice {
  entry: IncomeEntry;
  period: IncomePeriod;
  grossIncomeMan: number;
}

export interface MemberYearIncomeProfile {
  grossIncomeMan: number;
  /** 額面収入（経費控除前・万円） */
  grossRevenueMan: number;
  /** 年間経費（万円） */
  annualExpenseMan: number;
  /** 税務上の合計所得金額（万円） */
  totalIncomeMan: number;
  /** 課税計算用の合計所得金額（万円・雑所得20万円以下特例反映） */
  taxableIncomeMan: number;
  dependentStatus: DependentStatus;
  taxDependent: boolean;
  socialInsuranceDependent: boolean;
  category: IncomeCategory | null;
  streamType: IncomeStreamType | null;
  filingType: FilingType | null;
  hasActiveIncomeBlock: boolean;
}

export function resolveMemberYearIncomeProfile(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  monthStart = 1,
  monthEnd = 12,
): MemberYearIncomeProfile {
  const activeSlices: ActiveIncomeSlice[] = [];

  for (let month = monthStart; month <= monthEnd; month++) {
    for (const entry of entries) {
      if (entry.spouseContingencyOnly) continue;
      for (const period of entry.periods) {
        const grossIncomeMan = calcPeriodGrossIncomeManForMonth(
          entry,
          period,
          member,
          referenceDate,
          calendarYear,
          month,
        );
        if (grossIncomeMan > 0) {
          activeSlices.push({ entry, period, grossIncomeMan });
        }
      }
    }
  }

  if (activeSlices.length === 0) {
    return {
      grossIncomeMan: 0,
      grossRevenueMan: 0,
      annualExpenseMan: 0,
      totalIncomeMan: 0,
      taxableIncomeMan: 0,
      ...getMemberDependentDefaults(member),
      category: null,
      streamType: null,
      filingType: null,
      hasActiveIncomeBlock: false,
    };
  }

  const grossIncomeMan = activeSlices.reduce(
    (sum, slice) => sum + slice.grossIncomeMan,
    0,
  );

  const dominantSlice = activeSlices.reduce((best, slice) =>
    slice.grossIncomeMan > best.grossIncomeMan ? slice : best,
  );

  const seenPairs = new Set<string>();
  const uniquePairs: EntryPeriodPair[] = [];
  for (const slice of activeSlices) {
    const key = `${slice.entry.id}:${slice.period.id}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    uniquePairs.push({ entry: slice.entry, period: slice.period });
  }

  const { totalIncomeMan, taxableIncomeMan } =
    calcCombinedIncomeFromPairs(uniquePairs);

  let dependentStatus: DependentStatus = 'none';
  let taxDependent = false;
  let socialInsuranceDependent = false;
  for (const { period } of uniquePairs) {
    const resolved = usesQ1DependentDefaults(member)
      ? clampPeriodDependentToMember(period, member)
      : period;
    if (resolved.dependentStatus !== 'dependent') continue;
    dependentStatus = 'dependent';
    if (resolved.taxDependent) taxDependent = true;
    if (resolved.socialInsuranceDependent) socialInsuranceDependent = true;
  }

  const grossRevenueMan = calcPeriodGrossRevenueMan(dominantSlice.period);
  const isBusiness = treatsPeriodAsBusinessIncome(
    dominantSlice.entry.category,
    dominantSlice.period.streamType,
  );
  const annualExpenseMan = isBusiness
    ? (dominantSlice.entry.expenseManPerMonth ?? 0) * 12
    : 0;

  return {
    grossIncomeMan,
    grossRevenueMan,
    annualExpenseMan,
    totalIncomeMan,
    taxableIncomeMan,
    dependentStatus,
    taxDependent:
      dependentStatus === 'dependent' ? taxDependent : false,
    socialInsuranceDependent:
      dependentStatus === 'dependent' ? socialInsuranceDependent : false,
    category: dominantSlice.entry.category,
    streamType: dominantSlice.period.streamType,
    filingType: dominantSlice.entry.filingType,
    hasActiveIncomeBlock: true,
  };
}

export function getMemberAgeAtYearEnd(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
): number | null {
  return getMemberAgeMonth(member, referenceDate, calendarYear, 12)?.age ?? null;
}
