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
  return entry.paymentMode === 'monthlyRepayment'
    ? 'monthlyRepayment'
    : 'loanSettings';
}

export function isLoanMonthlyRepaymentMode(
  entry: Pick<LoanEntry, 'paymentMode'> | { paymentMode?: LoanPaymentMode },
): boolean {
  return resolveLoanPaymentMode(entry) === 'monthlyRepayment';
}

export interface LoanMonthlyRepaymentPeriod {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

/** 月々返済モードの計上期間（開始〜終了・両端含む）を解決する */
export function resolveLoanMonthlyRepaymentPeriod(
  entry: LoanEntry,
  referenceDate: Date,
): LoanMonthlyRepaymentPeriod {
  const settings = entry.settings;
  const defaultStart = resolveDefaultStartCalendar(referenceDate);

  const startYear =
    entry.repaymentStartYear > 0
      ? entry.repaymentStartYear
      : settings.startYear > 0
        ? settings.startYear
        : defaultStart.year;
  const startMonth =
    entry.repaymentStartMonth > 0
      ? entry.repaymentStartMonth
      : settings.startMonth > 0
        ? settings.startMonth
        : defaultStart.month;

  if (entry.repaymentEndYear > 0 && entry.repaymentEndMonth > 0) {
    return {
      startYear,
      startMonth,
      endYear: entry.repaymentEndYear,
      endMonth: entry.repaymentEndMonth,
    };
  }

  const totalMonths =
    settings.repaymentCount != null && settings.repaymentCount > 0
      ? settings.repaymentCount
      : Math.max(1, (settings.years > 0 ? settings.years : 5) * 12);
  const end = fromCalendarMonthIndex(
    calendarMonthIndex(startYear, startMonth) + totalMonths - 1,
  );

  return {
    startYear,
    startMonth,
    endYear: end.year,
    endMonth: end.month,
  };
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
