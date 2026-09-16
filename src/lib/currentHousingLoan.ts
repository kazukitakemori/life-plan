import {
  addCalendarMonths,
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
 * 既存の住宅ローン償却ロジックへ現在残高方式の期間を渡すため、
 * settings 側の開始時期・返済月数も現在基準へ同期する。
 * 所有開始や取得価格そのものは変更しない。
 */
export function syncCurrentBalanceLoanSchedule(
  entry: LoanEntry,
  referenceDate: Date,
): LoanEntry {
  const schedule = resolveCurrentHousingLoanSchedule(entry, referenceDate);
  const ownershipStart = addCalendarMonths(schedule.repaymentStart, -1);
  return {
    ...entry,
    settings: {
      ...entry.settings,
      startYear: ownershipStart.year,
      startMonth: ownershipStart.month,
      years: schedule.totalMonths / 12,
      repaymentCount: undefined,
    },
  };
}

/**
 * 従来の購入時条件から「現在残高から計算」へ明示的に切り替える。
 * 旧 settings.amountMan や物件取得価格は残し、現在残高は別フィールドで新規入力する。
 * 過去起点の金利期間・繰上げ返済は現在基準へ持ち越さない。
 */
export function prepareCurrentBalanceLoanEntry(
  entry: LoanEntry,
  referenceDate: Date,
): LoanEntry {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const seed: LoanEntry = {
    ...entry,
    paymentMode: 'currentBalance',
    currentBalanceMan:
      entry.paymentMode === 'currentBalance' ? entry.currentBalanceMan : 0,
    repaymentStartYear: referenceYear,
    repaymentStartMonth: referenceMonth,
    settingsConfigured:
      entry.paymentMode === 'currentBalance' && entry.currentBalanceMan > 0,
    settings: {
      ...entry.settings,
      interestRatePeriods: entry.settings.interestRatePeriods.slice(0, 1).map(
        (period) => ({
          ...period,
          startYear: 0,
          startMonth: 0,
          endYear: 0,
          endMonth: 0,
        }),
      ),
      groupCreditLifeSurchargeRatePct: 0,
      bonusRepaymentEnabled: false,
      prepaymentEnabled: false,
      prepayments: [],
      lumpSumRepaymentEnabled: false,
    },
  };
  return syncCurrentBalanceLoanSchedule(seed, referenceDate);
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
