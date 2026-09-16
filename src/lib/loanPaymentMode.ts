import type { LoanEntry, LoanPaymentMode } from '../types/loan';
import { resolveDefaultStartCalendar } from './simulationTiming';

function calendarMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function fromCalendarMonthIndex(index: number): { year: number; month: number } {
  const year = Math.floor((index - 1) / 12);
  const month = ((index - 1) % 12) + 1;
  return { year, month };
}

export function resolveLoanPaymentMode(
  entry: Pick<LoanEntry, 'paymentMode'> | { paymentMode?: LoanPaymentMode },
): LoanPaymentMode {
  if (entry.paymentMode === 'monthlyRepayment') return 'monthlyRepayment';
  if (entry.paymentMode === 'currentBalance') return 'currentBalance';
  return 'loanSettings';
}

export function isLoanMonthlyRepaymentMode(
  entry: Pick<LoanEntry, 'paymentMode'> | { paymentMode?: LoanPaymentMode },
): boolean {
  return resolveLoanPaymentMode(entry) === 'monthlyRepayment';
}

export function isLoanCurrentBalanceMode(
  entry: Pick<LoanEntry, 'paymentMode'> | { paymentMode?: LoanPaymentMode },
): boolean {
  return resolveLoanPaymentMode(entry) === 'currentBalance';
}

export interface LoanMonthlyRepaymentPeriod {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

export interface LoanCurrentBalancePeriod extends LoanMonthlyRepaymentPeriod {
  totalMonths: number;
}

function resolveDirectRepaymentPeriod(
  entry: LoanEntry,
  referenceDate: Date,
): LoanCurrentBalancePeriod {
  const settings = entry.settings;
  const defaultStart = resolveDefaultStartCalendar(referenceDate);

  const startYear =
    entry.repaymentStartYear > 0
      ? entry.repaymentStartYear
      : defaultStart.year;
  const startMonth =
    entry.repaymentStartMonth > 0
      ? entry.repaymentStartMonth
      : defaultStart.month;

  let endYear: number;
  let endMonth: number;
  if (entry.repaymentEndYear > 0 && entry.repaymentEndMonth > 0) {
    endYear = entry.repaymentEndYear;
    endMonth = entry.repaymentEndMonth;
  } else {
    const totalMonths =
      settings.repaymentCount != null && settings.repaymentCount > 0
        ? settings.repaymentCount
        : Math.max(1, (settings.years > 0 ? settings.years : 5) * 12);
    const end = fromCalendarMonthIndex(
      calendarMonthIndex(startYear, startMonth) + totalMonths - 1,
    );
    endYear = end.year;
    endMonth = end.month;
  }

  const startIndex = calendarMonthIndex(startYear, startMonth);
  const rawEndIndex = calendarMonthIndex(endYear, endMonth);
  const endIndex = Math.max(startIndex, rawEndIndex);
  const normalizedEnd = fromCalendarMonthIndex(endIndex);

  return {
    startYear,
    startMonth,
    endYear: normalizedEnd.year,
    endMonth: normalizedEnd.month,
    totalMonths: endIndex - startIndex + 1,
  };
}

/** 月々返済モードの計上期間（開始〜終了・両端含む）を解決する */
export function resolveLoanMonthlyRepaymentPeriod(
  entry: LoanEntry,
  referenceDate: Date,
): LoanMonthlyRepaymentPeriod {
  const period = resolveDirectRepaymentPeriod(entry, referenceDate);
  return {
    startYear: period.startYear,
    startMonth: period.startMonth,
    endYear: period.endYear,
    endMonth: period.endMonth,
  };
}

/** 現在残高モードの計算期間（基準月〜返済終了・両端含む）を解決する */
export function resolveLoanCurrentBalancePeriod(
  entry: LoanEntry,
  referenceDate: Date,
): LoanCurrentBalancePeriod {
  return resolveDirectRepaymentPeriod(entry, referenceDate);
}

export function isLoanMonthlyRepaymentActiveMonth(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (!isLoanMonthlyRepaymentMode(entry)) return false;
  if ((entry.monthlyRepaymentMan ?? 0) <= 0) return false;

  const period = resolveLoanMonthlyRepaymentPeriod(entry, referenceDate);
  const current = calendarMonthIndex(calendarYear, calendarMonth);
  return (
    current >= calendarMonthIndex(period.startYear, period.startMonth) &&
    current <= calendarMonthIndex(period.endYear, period.endMonth)
  );
}

export function isLoanCurrentBalanceActiveMonth(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (!isLoanCurrentBalanceMode(entry)) return false;
  if ((entry.currentBalanceMan ?? 0) <= 0) return false;

  const period = resolveLoanCurrentBalancePeriod(entry, referenceDate);
  const current = calendarMonthIndex(calendarYear, calendarMonth);
  return (
    current >= calendarMonthIndex(period.startYear, period.startMonth) &&
    current <= calendarMonthIndex(period.endYear, period.endMonth)
  );
}

/** 月々返済モードのカード要約用 */
export function formatLoanMonthlyRepaymentSummary(
  entry: LoanEntry,
  referenceDate: Date,
  configured: boolean,
): string {
  if (!configured && (entry.monthlyRepaymentMan ?? 0) <= 0) {
    return '未登録';
  }
  if ((entry.monthlyRepaymentMan ?? 0) <= 0) {
    return '月々返済額未入力';
  }
  const period = resolveLoanMonthlyRepaymentPeriod(entry, referenceDate);
  return `月々${entry.monthlyRepaymentMan}万円 / ${period.endYear}年${period.endMonth}月まで`;
}

/** 現在残高モードのカード要約用 */
export function formatLoanCurrentBalanceSummary(
  entry: LoanEntry,
  referenceDate: Date,
  configured: boolean,
): string {
  if (!configured && (entry.currentBalanceMan ?? 0) <= 0) {
    return '未登録';
  }
  if ((entry.currentBalanceMan ?? 0) <= 0) {
    return '現在残高未入力';
  }
  const period = resolveLoanCurrentBalancePeriod(entry, referenceDate);
  return `残高${entry.currentBalanceMan}万円 / ${period.endYear}年${period.endMonth}月まで`;
}
