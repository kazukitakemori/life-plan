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

/** 配偶者控除の合計所得金額上限（円） */
export const SPOUSE_TOTAL_INCOME_LIMIT_YEN = 480_000;

/** 配偶者特別控除の合計所得金額上限（円） */
export const SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN = 1_330_000;

/** 給与所得者の雑所得：確定申告不要となる収入金額の上限（円） */
export const MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN = 200_000;

/** 一時所得の特別控除上限（円） */
const TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN = 500_000;

export function calcSalaryIncomeDeductionYen(revenueYen: number): number {
  if (revenueYen <= 0) return 0;
  if (revenueYen <= 1_625_000) return 550_000;
  if (revenueYen <= 1_800_000) return revenueYen * 0.4 - 100_000;
  if (revenueYen <= 3_600_000) return revenueYen * 0.3 + 80_000;
  if (revenueYen <= 6_600_000) return revenueYen * 0.2 + 440_000;
  if (revenueYen <= 8_500_000) return revenueYen * 0.1 + 1_100_000;
  return 1_950_000;
}

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

export function calcTotalIncomeAmountYen(input: TotalIncomeInput): number {
  const { grossRevenueYen, annualExpenseYen, category, filingType, streamType } =
    input;
  if (grossRevenueYen <= 0) return 0;

  if (streamType === 'temporary_income') {
    return calcTemporaryIncomeYen(grossRevenueYen, annualExpenseYen);
  }

  if (category != null && isSalaryLikeCategory(category)) {
    const deduction = calcSalaryIncomeDeductionYen(grossRevenueYen);
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
    return Math.max(
      0,
      Math.floor((grossRevenueYen - annualExpenseYen) * 0.7),
    );
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
): number {
  if (
    hasSalaryIncome &&
    period.streamType === 'miscellaneous_income' &&
    Math.round(calcPeriodGrossRevenueMan(period) * MAN_TO_YEN) <=
      MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN
  ) {
    return 0;
  }
  return calcPeriodTotalIncomeMan(entry, period);
}

export function calcTotalIncomeManFromProfile(input: {
  grossRevenueMan: number;
  annualExpenseMan: number;
  category: IncomeCategory | null;
  filingType: FilingType | null;
}): number {
  return (
    calcTotalIncomeAmountYen({
      grossRevenueYen: Math.round(input.grossRevenueMan * MAN_TO_YEN),
      annualExpenseYen: Math.round(input.annualExpenseMan * MAN_TO_YEN),
      category: input.category,
      filingType: input.filingType,
    }) / MAN_TO_YEN
  );
}
