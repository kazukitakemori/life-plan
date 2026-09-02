import { calcPeriodAnnualAmountMan } from './incomeAmount';
import type {
  FilingType,
  IncomeCategory,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
} from '../types/income';
import {
  isSalaryLikeCategory,
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';

const MAN_TO_YEN = 10_000;

/**
 * 配偶者控除の合計所得金額上限（円・令和6年分以前）。
 * 令和7年分以降は {@link getSpouseTotalIncomeLimitYen} を使用。
 */
export const SPOUSE_TOTAL_INCOME_LIMIT_YEN = 480_000;

export {
  getSpouseTotalIncomeLimitYen,
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
} from './spouseDeduction';

/** 給与所得者の雑所得：確定申告不要となる収入金額の上限（円） */
export const MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN = 200_000;

/** 一時所得の特別控除上限（円） */
export const TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN = 500_000;

export type SalaryIncomeDeductionTaxYearRule = 'legacy_r6' | 'r7_onward';

/**
 * 給与所得控除の適用区分。
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
 */
export function resolveSalaryIncomeDeductionRule(
  calendarYear: number,
): SalaryIncomeDeductionTaxYearRule {
  if (calendarYear < 2025) return 'legacy_r6';
  return 'r7_onward';
}

/** 令和2年分〜令和6年分 */
function calcSalaryIncomeDeductionYenLegacyR6(revenueYen: number): number {
  if (revenueYen <= 1_625_000) return 550_000;
  if (revenueYen <= 1_800_000) return Math.floor(revenueYen * 0.4 - 100_000);
  if (revenueYen <= 3_600_000) return Math.floor(revenueYen * 0.3 + 80_000);
  if (revenueYen <= 6_600_000) return Math.floor(revenueYen * 0.2 + 440_000);
  if (revenueYen <= 8_500_000) return Math.floor(revenueYen * 0.1 + 1_100_000);
  return 1_950_000;
}

/** 令和7年分以降 */
function calcSalaryIncomeDeductionYenR7(revenueYen: number): number {
  if (revenueYen <= 1_900_000) return 650_000;
  if (revenueYen <= 3_600_000) return Math.floor(revenueYen * 0.3 + 80_000);
  if (revenueYen <= 6_600_000) return Math.floor(revenueYen * 0.2 + 440_000);
  if (revenueYen <= 8_500_000) return Math.floor(revenueYen * 0.1 + 1_100_000);
  return 1_950_000;
}

export function calcSalaryIncomeDeductionYen(
  revenueYen: number,
  calendarYear = 2026,
): number {
  if (revenueYen <= 0) return 0;
  return resolveSalaryIncomeDeductionRule(calendarYear) === 'r7_onward'
    ? calcSalaryIncomeDeductionYenR7(revenueYen)
    : calcSalaryIncomeDeductionYenLegacyR6(revenueYen);
}

export function calcSalaryIncomeYen(
  revenueYen: number,
  calendarYear = 2026,
): number {
  if (revenueYen <= 0) return 0;
  return Math.max(
    0,
    Math.floor(revenueYen - calcSalaryIncomeDeductionYen(revenueYen, calendarYear)),
  );
}

/**
 * 給与のみ・賞与なしで合計所得が thresholdYen ちょうどとなるおおよその年収（額面・円）。
 * 配偶者控除・配偶者特別控除の所得上限から年収目安を出す用途。
 */
export function calcApproximateEmployeeGrossYenForTotalIncomeYen(
  totalIncomeYen: number,
  calendarYear = 2026,
): number {
  if (totalIncomeYen <= 0) return 0;

  if (resolveSalaryIncomeDeductionRule(calendarYear) === 'r7_onward') {
    const viaLowBracket = totalIncomeYen + 650_000;
    if (viaLowBracket <= 1_900_000) return viaLowBracket;
    const viaMidBracket = Math.ceil((totalIncomeYen + 80_000) / 0.7);
    if (viaMidBracket <= 3_600_000) return viaMidBracket;
    const viaHighBracket = Math.ceil((totalIncomeYen + 440_000) / 0.8);
    if (viaHighBracket <= 6_600_000) return viaHighBracket;
    const viaTopBracket = Math.ceil((totalIncomeYen + 1_100_000) / 0.9);
    if (viaTopBracket <= 8_500_000) return viaTopBracket;
    return totalIncomeYen + 1_950_000;
  }

  const viaLowBracket = totalIncomeYen + 550_000;
  if (viaLowBracket <= 1_625_000) return viaLowBracket;
  const viaMidLowBracket = Math.ceil((totalIncomeYen + 100_000) / 0.6);
  if (viaMidLowBracket <= 1_800_000) return viaMidLowBracket;
  const viaMidBracket = Math.ceil((totalIncomeYen + 80_000) / 0.7);
  if (viaMidBracket <= 3_600_000) return viaMidBracket;
  const viaHighBracket = Math.ceil((totalIncomeYen + 440_000) / 0.8);
  if (viaHighBracket <= 6_600_000) return viaHighBracket;
  const viaTopBracket = Math.ceil((totalIncomeYen + 1_100_000) / 0.9);
  if (viaTopBracket <= 8_500_000) return viaTopBracket;
  return totalIncomeYen + 1_950_000;
}

/**
 * 所得金額調整控除（給与収入850万円超かつ要件充足時）。
 * （min(給与収入, 1000万円) − 850万円）× 10%
 * 参考: https://www.mmea.biz/news/12746-2/
 */
export function calcIncomeAdjustmentDeductionYen(
  revenueYen: number,
  qualifies = true,
): number {
  if (!qualifies || revenueYen <= 8_500_000) return 0;
  const excess = Math.min(revenueYen, 10_000_000) - 8_500_000;
  return Math.floor(excess * 0.1);
}

export const INCOME_ADJUSTMENT_SALARY_CAP_YEN = 10_000_000;
export const INCOME_ADJUSTMENT_SALARY_THRESHOLD_YEN = 8_500_000;

export function filingTypeDeductionYen(filingType: FilingType | null): number {
  switch (filingType) {
    case 'blue_65':
      return 650_000;
    case 'blue_55':
      return 550_000;
    case 'blue_10':
      return 100_000;
    case 'white':
    default:
      return 0;
  }
}

export interface TotalIncomeInput {
  grossRevenueYen: number;
  annualExpenseYen: number;
  category: IncomeCategory | null;
  filingType: FilingType | null;
  streamType?: IncomeStreamType | null;
  calendarYear?: number;
}

/** 一時所得の合計所得算入額（円）=（収入−経費−特別控除）× 1/2 */
export function calcTemporaryIncomeYen(
  grossRevenueYen: number,
  annualExpenseYen: number,
): number {
  if (grossRevenueYen <= 0) return 0;
  const profitYen = grossRevenueYen - annualExpenseYen;
  if (profitYen <= 0) return 0;
  const specialDeductionYen = Math.min(
    profitYen,
    TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN,
  );
  return Math.max(0, Math.floor((profitYen - specialDeductionYen) / 2));
}

/**
 * 雑所得の所得金額（円）= 総収入金額 − 必要経費。
 * @see https://www.jili.or.jp/knows_learns/q_a/tax/568.html
 */
export function calcMiscellaneousIncomeYen(
  grossRevenueYen: number,
  annualExpenseYen: number,
): number {
  if (grossRevenueYen <= 0) return 0;
  return Math.max(0, Math.floor(grossRevenueYen - annualExpenseYen));
}

export function calcTotalIncomeAmountYen(input: TotalIncomeInput): number {
  const { grossRevenueYen, annualExpenseYen, category, filingType, streamType } =
    input;
  if (grossRevenueYen <= 0) return 0;

  if (streamType === 'temporary_income') {
    return calcTemporaryIncomeYen(grossRevenueYen, annualExpenseYen);
  }

  if (category != null && isSalaryLikeCategory(category)) {
    const deduction = calcSalaryIncomeDeductionYen(
      grossRevenueYen,
      input.calendarYear ?? 2026,
    );
    return Math.max(0, Math.floor(grossRevenueYen - deduction));
  }

  if (category === 'self_employed') {
    const filingDeduction = filingTypeDeductionYen(filingType);
    return Math.max(
      0,
      Math.floor(grossRevenueYen - annualExpenseYen - filingDeduction),
    );
  }

  if (streamType === 'miscellaneous_income') {
    return calcMiscellaneousIncomeYen(grossRevenueYen, annualExpenseYen);
  }

  return Math.max(0, Math.floor(grossRevenueYen * 0.7));
}

export function calcPeriodGrossRevenueMan(
  period: IncomePeriod,
): number {
  return calcPeriodAnnualAmountMan(period);
}

function calcPeriodAnnualExpenseYen(
  entry: IncomeEntry,
  period: IncomePeriod,
): number {
  const usesExpense =
    treatsPeriodAsBusinessIncome(entry.category, period.streamType) ||
    period.streamType === 'temporary_income' ||
    period.streamType === 'miscellaneous_income';
  return usesExpense
    ? Math.round((entry.expenseManPerMonth ?? 0) * 12 * MAN_TO_YEN)
    : 0;
}

export function calcPeriodTotalIncomeMan(
  entry: IncomeEntry,
  period: IncomePeriod,
  calendarYear = 2026,
): number {
  const grossRevenueYen = Math.round(
    calcPeriodGrossRevenueMan(period) * MAN_TO_YEN,
  );
  const isBusiness = treatsPeriodAsBusinessIncome(
    entry.category,
    period.streamType,
  );
  const isSalary = treatsPeriodAsSalaryIncome(entry.category, period.streamType);
  const annualExpenseYen = calcPeriodAnnualExpenseYen(entry, period);

  return (
    calcTotalIncomeAmountYen({
      grossRevenueYen,
      annualExpenseYen,
      category: isBusiness
        ? 'self_employed'
        : isSalary
          ? 'employee'
          : entry.category,
      filingType: isBusiness ? entry.filingType : null,
      streamType: period.streamType,
      calendarYear,
    }) / MAN_TO_YEN
  );
}

/**
 * 課税計算用の期間所得（万円）。
 * 給与所得者の雑所得20万円以下は確定申告不要のため課税対象から除外する。
 */
export function calcPeriodTaxableIncomeMan(
  entry: IncomeEntry,
  period: IncomePeriod,
  hasSalaryIncome: boolean,
  calendarYear = 2026,
): number {
  if (
    hasSalaryIncome &&
    period.streamType === 'miscellaneous_income' &&
    Math.round(calcPeriodGrossRevenueMan(period) * MAN_TO_YEN) <=
      MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN
  ) {
    return 0;
  }
  return calcPeriodTotalIncomeMan(entry, period, calendarYear);
}

export function calcTotalIncomeManFromProfile(input: {
  grossRevenueMan: number;
  annualExpenseMan: number;
  category: IncomeCategory | null;
  filingType: FilingType | null;
  calendarYear?: number;
}): number {
  return (
    calcTotalIncomeAmountYen({
      grossRevenueYen: Math.round(input.grossRevenueMan * MAN_TO_YEN),
      annualExpenseYen: Math.round(input.annualExpenseMan * MAN_TO_YEN),
      category: input.category,
      filingType: input.filingType,
      calendarYear: input.calendarYear ?? 2026,
    }) / MAN_TO_YEN
  );
}

export type IncomeEntryPeriodPair = {
  entry: IncomeEntry;
  period: IncomePeriod;
};

function collectActiveSalaryPairs(
  entries: IncomeEntry[],
): IncomeEntryPeriodPair[] {
  const pairs: IncomeEntryPeriodPair[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const period of entry.periods) {
      if (!treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
        continue;
      }
      const key = `${entry.id}:${period.id}`;
      if (seen.has(key)) continue;
      const grossRevenueMan = calcPeriodGrossRevenueMan(period);
      if (grossRevenueMan <= 0) continue;
      seen.add(key);
      pairs.push({ entry, period });
    }
  }

  return pairs;
}

/** 給与期間ペアから年収・給与所得（円）を合算 */
export function calcSalaryBreakdownYenFromPairs(
  pairs: IncomeEntryPeriodPair[],
  calendarYear = 2026,
): { grossSalaryRevenueYen: number; salaryIncomeYen: number } {
  let grossSalaryRevenueYen = 0;
  let salaryIncomeYen = 0;
  for (const { entry, period } of pairs) {
    if (!treatsPeriodAsSalaryIncome(entry.category, period.streamType)) continue;
    grossSalaryRevenueYen += Math.round(
      calcPeriodGrossRevenueMan(period) * MAN_TO_YEN,
    );
    salaryIncomeYen += Math.round(
      calcPeriodTotalIncomeMan(entry, period, calendarYear) * MAN_TO_YEN,
    );
  }
  return { grossSalaryRevenueYen, salaryIncomeYen };
}

/**
 * @deprecated 全Q7期間の給与年額を暦年無視で合算する。税・CFの年次評価では使わないこと。
 * 代わりに {@link calcMemberSalaryBreakdownYenForTaxYear}（`memberYearIncome`）を使う。
 */
export function calcMemberSalaryBreakdownYen(
  entries: IncomeEntry[],
  calendarYear = 2026,
): { grossSalaryRevenueYen: number; salaryIncomeYen: number } {
  return calcSalaryBreakdownYenFromPairs(
    collectActiveSalaryPairs(entries),
    calendarYear,
  );
}

export interface BusinessIncomeBreakdownYen {
  grossRevenueYen: number;
  annualExpenseYen: number;
  filingDeductionYen: number;
  businessIncomeYen: number;
}

function collectActiveBusinessPairs(
  entries: IncomeEntry[],
): IncomeEntryPeriodPair[] {
  const pairs: IncomeEntryPeriodPair[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const period of entry.periods) {
      if (!treatsPeriodAsBusinessIncome(entry.category, period.streamType)) {
        continue;
      }
      const key = `${entry.id}:${period.id}`;
      if (seen.has(key)) continue;
      const grossRevenueMan = calcPeriodGrossRevenueMan(period);
      if (grossRevenueMan <= 0) continue;
      seen.add(key);
      pairs.push({ entry, period });
    }
  }

  return pairs;
}

/** 事業期間ペアから総収入・経費・事業所得（円）を合算 */
export function calcBusinessIncomeBreakdownYenFromPairs(
  pairs: IncomeEntryPeriodPair[],
  calendarYear = 2026,
): BusinessIncomeBreakdownYen | null {
  const businessPairs = pairs.filter(({ entry, period }) =>
    treatsPeriodAsBusinessIncome(entry.category, period.streamType),
  );
  if (businessPairs.length === 0) return null;

  let grossRevenueYen = 0;
  let annualExpenseYen = 0;
  let businessIncomeYen = 0;
  for (const { entry, period } of businessPairs) {
    grossRevenueYen += Math.round(
      calcPeriodGrossRevenueMan(period) * MAN_TO_YEN,
    );
    annualExpenseYen += calcPeriodAnnualExpenseYen(entry, period);
    businessIncomeYen += Math.round(
      calcPeriodTotalIncomeMan(entry, period, calendarYear) * MAN_TO_YEN,
    );
  }

  const filingDeductionYen = Math.max(
    0,
    grossRevenueYen - annualExpenseYen - businessIncomeYen,
  );

  return {
    grossRevenueYen,
    annualExpenseYen,
    filingDeductionYen,
    businessIncomeYen,
  };
}

/**
 * @deprecated 全Q7期間の事業年額を暦年無視で合算する。税・CFの年次評価では使わないこと。
 * 代わりに {@link calcMemberBusinessIncomeBreakdownYenForTaxYear}（`memberYearIncome`）を使う。
 */
export function calcMemberBusinessIncomeBreakdownYen(
  entries: IncomeEntry[],
  calendarYear = 2026,
): BusinessIncomeBreakdownYen | null {
  return calcBusinessIncomeBreakdownYenFromPairs(
    collectActiveBusinessPairs(entries),
    calendarYear,
  );
}
