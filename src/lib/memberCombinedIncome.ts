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

/** cover が target の全期間を覆うか（通年併存の判定用） */
export function periodFullyCovers(
  cover: IncomePeriod,
  target: IncomePeriod,
): boolean {
  const coverStart = ageMonthIndex(cover.startAge, cover.startMonth);
  const coverEnd = ageMonthIndex(cover.endAge, cover.endMonth);
  const targetStart = ageMonthIndex(target.startAge, target.startMonth);
  const targetEnd = ageMonthIndex(target.endAge, target.endMonth);
  return coverStart <= targetStart && coverEnd >= targetEnd;
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

/**
 * 対象期間の扶養判定用に、同時期の収入を合算する。
 *
 * 対象期間そのものに加え、対象を全期間カバーする他期間（通年の給与+事業など）だけを含める。
 * 1か月だけ重なる年中切替などは合算しない（高収入期間の年額が低収入期間の扶養判定を壊すため）。
 */
export function calcCombinedIncomeForOverlappingPeriods(
  entries: IncomeEntry[],
  targetPeriod: IncomePeriod,
  calendarYear = 2026,
): CombinedIncomeSnapshot {
  const pairs: EntryPeriodPair[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const period of entry.periods) {
      // 自身は常にカバー扱い。他期間は対象を全期間覆う場合のみ（通年併存）
      if (!periodFullyCovers(period, targetPeriod)) continue;
      const key = `${entry.id}:${period.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ entry, period });
    }
  }
  return calcCombinedIncomeFromPairs(pairs, calendarYear);
}

export function calcCombinedIncomeFromPairs(
  pairs: EntryPeriodPair[],
  calendarYear = 2026,
): CombinedIncomeSnapshot {
  let totalIncomeMan = 0;
  let taxableIncomeMan = 0;
  let socialInsuranceIncomeMan = 0;
  const hasSalaryIncome = pairHasSalaryIncome(pairs);

  for (const { entry, period } of pairs) {
    totalIncomeMan += calcPeriodTotalIncomeMan(entry, period, calendarYear);
    taxableIncomeMan += calcPeriodTaxableIncomeMan(
      entry,
      period,
      hasSalaryIncome,
      calendarYear,
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

/** 対象期間を全期間カバーする収入ブロック（entry）の数（通年併存の検出用） */
export function countOverlappingIncomeEntries(
  entries: IncomeEntry[],
  targetPeriod: IncomePeriod,
): number {
  let count = 0;
  for (const entry of entries) {
    const hasCover = entry.periods.some((period) => {
      if (!periodFullyCovers(period, targetPeriod)) return false;
      return (
        calcPeriodGrossRevenueMan(period) > 0 ||
        calcPeriodTotalIncomeMan(entry, period) > 0
      );
    });
    if (hasCover) count += 1;
  }
  return count;
}
