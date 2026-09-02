import { isIdecoCategory } from './idecoContributionLimit';
import {
  resolveLevyIncomeReferenceYear,
  resolveResidentTaxLevyMonthRange,
} from './priorYearIncomeResolution';
import {
  calcDcEmployeeContributionManForMonthInPeriod,
  calcSavingsContributionManForMonth,
} from './savingsCashFlow';
import { getMemberSavingsEntries } from './savingsDefaults';
import { isDcCategory } from './dcContribution';
import type { FamilyMember } from '../types/family';
import type { SavingsState } from '../types/savings';

const MAN_TO_YEN = 10_000;

/**
 * メンバーの iDeCo 口座について、指定暦年・月範囲の掛金合計（万円）を返す。
 */
export function calcMemberAnnualIdecoContributionMan(input: {
  member: FamilyMember;
  savingsState: SavingsState;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): number {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const entries = getMemberSavingsEntries(
    input.savingsState,
    input.member.id,
  );
  let totalMan = 0;
  for (const entry of entries) {
    if (!isIdecoCategory(entry.category)) continue;
    for (let month = monthStart; month <= monthEnd; month += 1) {
      totalMan += calcSavingsContributionManForMonth(
        entry,
        input.member,
        input.referenceDate,
        input.calendarYear,
        month,
      );
    }
  }
  return totalMan;
}

/**
 * メンバーの企業型DC・加入者掛金（選択型）の指定暦年・月範囲合計（万円）。
 * 事業主掛金は含めない。
 */
export function calcMemberAnnualSelectiveDcContributionMan(input: {
  member: FamilyMember;
  savingsState: SavingsState;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): number {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const entries = getMemberSavingsEntries(
    input.savingsState,
    input.member.id,
  );
  let totalMan = 0;
  for (const entry of entries) {
    if (!isDcCategory(entry.category)) continue;
    for (let month = monthStart; month <= monthEnd; month += 1) {
      totalMan += calcDcEmployeeContributionManForMonthInPeriod(
        entry,
        input.member,
        input.referenceDate,
        input.calendarYear,
        month,
      );
    }
  }
  return totalMan;
}

/**
 * 小規模企業共済等掛金控除の対象掛金合計（万円）。
 * iDeCo + 企業型DC加入者掛金（選択型）。事業主掛金は含まない。
 */
export function calcMemberAnnualSmallScaleMutualAidContributionMan(input: {
  member: FamilyMember;
  savingsState: SavingsState;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): number {
  return (
    calcMemberAnnualIdecoContributionMan(input) +
    calcMemberAnnualSelectiveDcContributionMan(input)
  );
}

export interface IdecoContributionDeductionYen {
  /** 所得税の小規模企業共済等掛金控除（円・assessment 年） */
  incomeTaxYen: number;
  /** 住民税の同控除（円・levy 年） */
  residentTaxYen: number;
  /** 所得税側の掛金合計（万円） */
  contributionMan: number;
  /** 住民税側（levy 年）の掛金合計（万円） */
  levyContributionMan: number;
}

/**
 * 小規模企業共済等掛金控除（全額）を算出する。
 * 対象: iDeCo 掛金 + 企業型DC加入者掛金（選択型）。
 * 所得税は assessment 年、住民税は levy 年の掛金を用いる。
 */
export function calcMemberIdecoContributionDeductionYen(input: {
  member: FamilyMember;
  savingsState: SavingsState;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
  simulationStartYear?: number;
}): IdecoContributionDeductionYen {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const simulationStartYear =
    input.simulationStartYear ?? input.referenceDate.getFullYear();

  const contributionMan = calcMemberAnnualSmallScaleMutualAidContributionMan({
    member: input.member,
    savingsState: input.savingsState,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart,
    monthEnd,
  });

  const levyCalendarYear = resolveLevyIncomeReferenceYear(input.calendarYear);
  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear,
    assessmentMonthStart: monthStart,
    assessmentMonthEnd: monthEnd,
  });
  const levyContributionMan = calcMemberAnnualSmallScaleMutualAidContributionMan({
    member: input.member,
    savingsState: input.savingsState,
    referenceDate: input.referenceDate,
    calendarYear: levyCalendarYear,
    monthStart: levyMonths.monthStart,
    monthEnd: levyMonths.monthEnd,
  });

  return {
    incomeTaxYen: Math.round(contributionMan * MAN_TO_YEN),
    residentTaxYen: Math.round(levyContributionMan * MAN_TO_YEN),
    contributionMan,
    levyContributionMan,
  };
}
