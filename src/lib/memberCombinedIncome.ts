import {
  calcPeriodGrossRevenueMan,
  calcPeriodTaxableIncomeMan,
  calcPeriodTotalIncomeMan,
} from './incomeTaxDeductions';
import {
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';
import type { IncomeEntry, IncomePeriod } from '../types/income';

export interface EntryPeriodPair {
  entry: IncomeEntry;
  period: IncomePeriod;
}

export interface CombinedIncomeSnapshot {
  totalIncomeMan: number;
  /** 課税計算用（雑所得20万円以下特例を反映） */
  taxableIncomeMan: number;
  socialInsuranceIncomeMan: number;
}

function pairHasSalaryIncome(pairs: EntryPeriodPair[]): boolean {
  return pairs.some(({ entry, period }) =>
    treatsPeriodAsSalaryIncome(entry.category, period.streamType),
  );
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

export function periodsOverlap(a: IncomePeriod, b: IncomePeriod): boolean {
  const aStart = ageMonthIndex(a.startAge, a.startMonth);
  const aEnd = ageMonthIndex(a.endAge, a.endMonth);
  const bStart = ageMonthIndex(b.startAge, b.startMonth);
  const bEnd = ageMonthIndex(b.endAge, b.endMonth);
  return aStart <= bEnd && bStart <= aEnd;
}

function calcSocialInsuranceIncomeMan(
  entry: IncomeEntry,
  period: IncomePeriod,
  grossRevenueMan: number,
): number {
  if (!treatsPeriodAsBusinessIncome(entry.category, period.streamType)) {
    return grossRevenueMan;
  }
  const annualExpenseMan = (entry.expenseManPerMonth ?? 0) * 12;
  return Math.max(0, grossRevenueMan - annualExpenseMan);
}

/** 対象期間と重なる全収入ブロックの合計所得・社保収入を合算 */
export function calcCombinedIncomeForOverlappingPeriods(
  entries: IncomeEntry[],
  targetPeriod: IncomePeriod,
): CombinedIncomeSnapshot {
  const pairs: EntryPeriodPair[] = [];
  for (const entry of entries) {
    if (entry.spouseContingencyOnly) continue;
    for (const period of entry.periods) {
      if (!periodsOverlap(period, targetPeriod)) continue;
      pairs.push({ entry, period });
    }
  }
  return calcCombinedIncomeFromPairs(pairs);
}

export function calcCombinedIncomeFromPairs(
  pairs: EntryPeriodPair[],
): CombinedIncomeSnapshot {
  let totalIncomeMan = 0;
  let taxableIncomeMan = 0;
  let socialInsuranceIncomeMan = 0;
  const hasSalaryIncome = pairHasSalaryIncome(pairs);

  for (const { entry, period } of pairs) {
    totalIncomeMan += calcPeriodTotalIncomeMan(entry, period);
    taxableIncomeMan += calcPeriodTaxableIncomeMan(
      entry,
      period,
      hasSalaryIncome,
    );
    const grossRevenueMan = calcPeriodGrossRevenueMan(period);
    socialInsuranceIncomeMan += calcSocialInsuranceIncomeMan(
      entry,
      period,
      grossRevenueMan,
    );
  }

  return { totalIncomeMan, taxableIncomeMan, socialInsuranceIncomeMan };
}

/** 対象期間と重なる収入ブロック（entry）の数 */
export function countOverlappingIncomeEntries(
  entries: IncomeEntry[],
  targetPeriod: IncomePeriod,
): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.spouseContingencyOnly) continue;
    const hasOverlap = entry.periods.some((period) => {
      if (!periodsOverlap(period, targetPeriod)) return false;
      return (
        calcPeriodGrossRevenueMan(period) > 0 ||
        calcPeriodTotalIncomeMan(entry, period) > 0
      );
    });
    if (hasOverlap) count += 1;
  }
  return count;
}
