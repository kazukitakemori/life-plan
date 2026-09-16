import {
  calcLoanRepaymentBalanceAfterMonthYen,
  calcLoanRepaymentMonthYen,
  calcRepaymentMonthIndex,
} from './housingLoanAmortization';
import {
  isLoanCurrentBalanceMode,
  resolveLoanCurrentBalancePeriod,
} from './loanPaymentMode';
import type { LoanEntry } from '../types/loan';

const MAN_TO_YEN = 10_000;

export interface CurrentHousingLoanSchedule {
  repaymentStart: { year: number; month: number };
  repaymentEnd: { year: number; month: number };
  totalMonths: number;
}

/**
 * 居住中住宅の「現在残高から計算」用スケジュール。
 * 過去の取得価格・当初借入額は使わず、基準日時点の残高から将来分だけを計算する。
 */
export function resolveCurrentHousingLoanSchedule(
  entry: LoanEntry,
  referenceDate: Date,
): CurrentHousingLoanSchedule {
  const period = resolveLoanCurrentBalancePeriod(entry, referenceDate);
  return {
    repaymentStart: {
      year: period.startYear,
      month: period.startMonth,
    },
    repaymentEnd: {
      year: period.endYear,
      month: period.endMonth,
    },
    totalMonths: period.totalMonths,
  };
}

/**
 * 現在残高方式では「現在金利」をそのまま使う。
 * 購入時の諸費用上乗せ・団信上乗せ・過去の金利期間は別途足さない。
 */
export function getCurrentHousingLoanAnnualRatePct(entry: LoanEntry): number {
  return Math.max(
    0,
    entry.settings.interestRatePeriods[0]?.interestRatePct ?? 0,
  );
}

function resolveRepaymentMonthIndex(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { schedule: CurrentHousingLoanSchedule; monthIndex: number | null } {
  const schedule = resolveCurrentHousingLoanSchedule(entry, referenceDate);
  return {
    schedule,
    monthIndex: calcRepaymentMonthIndex(
      schedule.repaymentStart,
      calendarYear,
      calendarMonth,
    ),
  };
}

/** 該当月の元金・利息（円） */
export function calcCurrentHousingLoanMonthYen(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { principalYen: number; interestYen: number } {
  if (!isLoanCurrentBalanceMode(entry) || entry.currentBalanceMan <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  const { schedule, monthIndex } = resolveRepaymentMonthIndex(
    entry,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (
    monthIndex == null ||
    monthIndex <= 0 ||
    monthIndex > schedule.totalMonths
  ) {
    return { principalYen: 0, interestYen: 0 };
  }

  const principalYen = entry.currentBalanceMan * MAN_TO_YEN;
  const annualRatePct = getCurrentHousingLoanAnnualRatePct(entry);
  return calcLoanRepaymentMonthYen(
    principalYen,
    schedule.totalMonths,
    monthIndex,
    entry.settings.repaymentMethod,
    () => annualRatePct,
    () => [],
  );
}

/** 指定月の通常返済後残高（円）。返済開始前は現在残高を返す。 */
export function calcCurrentHousingLoanBalanceAfterCalendarMonthYen(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (!isLoanCurrentBalanceMode(entry) || entry.currentBalanceMan <= 0) {
    return 0;
  }

  const { schedule, monthIndex } = resolveRepaymentMonthIndex(
    entry,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  const principalYen = entry.currentBalanceMan * MAN_TO_YEN;
  if (monthIndex == null || monthIndex <= 0) return principalYen;
  if (monthIndex >= schedule.totalMonths) return 0;

  const annualRatePct = getCurrentHousingLoanAnnualRatePct(entry);
  return calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    schedule.totalMonths,
    monthIndex,
    entry.settings.repaymentMethod,
    () => annualRatePct,
    () => [],
  );
}

/** 住宅ローン控除などで使う各年12月末の残高（円） */
export function calcCurrentHousingLoanYearEndBalanceYen(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
): number {
  return calcCurrentHousingLoanBalanceAfterCalendarMonthYen(
    entry,
    referenceDate,
    calendarYear,
    12,
  );
}

/** 現在の条件から求める初回月の返済額（円） */
export function calcCurrentHousingLoanInitialPaymentYen(
  entry: LoanEntry,
  referenceDate: Date,
): number {
  const schedule = resolveCurrentHousingLoanSchedule(entry, referenceDate);
  const result = calcCurrentHousingLoanMonthYen(
    entry,
    referenceDate,
    schedule.repaymentStart.year,
    schedule.repaymentStart.month,
  );
  return result.principalYen + result.interestYen;
}
