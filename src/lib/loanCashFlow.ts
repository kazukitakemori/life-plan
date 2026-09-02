import { resolveGroupCreditLifeSurchargeRatePct } from './groupCreditLife';
import {
  calcLoanRepaymentMonthYen,
  calcRepaymentMonthIndex,
  yenToMan,
} from './housingLoanAmortization';
import { buildLoanRepaymentEventResolver } from './housingLoanPrepayment';
import { getAllLoanEntries } from './loanDefaults';
import {
  getBaseInterestRateAtRepaymentMonth,
  resolveLoanRepaymentSchedule,
} from './loanInterestRatePeriod';
import {
  isLoanMonthlyRepaymentActiveMonth,
  isLoanMonthlyRepaymentMode,
} from './loanPaymentMode';
import type { LoanEntry, LoanState } from '../types/loan';
import {
  createEmptyOtherLoanRepaymentDetail,
  type OtherLoanRepaymentDetail,
} from '../types/cashFlow';

const MAN_TO_YEN = 10_000;

/** 住まい/乗り物に未リンクのローン（教育・フリー、および未紐づけの住宅・自動車） */
export function isOtherLoanForCashFlow(entry: LoanEntry): boolean {
  return !entry.housingLink && !entry.vehicleLink;
}

/** ローン1本の指定年月の返済額（元金＋利息・万円） */
export function calcLoanEntryMonthlyRepaymentMan(
  entry: LoanEntry,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (isLoanMonthlyRepaymentMode(entry)) {
    return isLoanMonthlyRepaymentActiveMonth(
      entry,
      referenceDate,
      calendarYear,
      calendarMonth,
    )
      ? entry.monthlyRepaymentMan
      : 0;
  }

  const settings = entry.settings;
  const amountMan = settings.amountMan ?? 0;
  if (amountMan <= 0) return 0;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const schedule = resolveLoanRepaymentSchedule(settings, {
    referenceYear,
    referenceMonth,
  });
  if (schedule.totalMonths <= 0) return 0;

  const repaymentMonthIndex = calcRepaymentMonthIndex(
    schedule.repaymentStart,
    calendarYear,
    calendarMonth,
  );
  if (
    repaymentMonthIndex == null ||
    repaymentMonthIndex <= 0 ||
    repaymentMonthIndex > schedule.totalMonths
  ) {
    return 0;
  }

  const principalYen = amountMan * MAN_TO_YEN;
  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanRepaymentEventResolver(settings, {
    repaymentStart: schedule.repaymentStart,
    totalMonths: schedule.totalMonths,
  });

  const { principalYen: principalPaid, interestYen } = calcLoanRepaymentMonthYen(
    principalYen,
    schedule.totalMonths,
    repaymentMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );

  return yenToMan(principalPaid + interestYen);
}

/** 世帯の「ローン」フォルダ月次内訳（万円）。紐づけ済み住宅・自動車は含めない */
export function calcHouseholdMonthlyOtherLoanDetailMan(
  loanState: LoanState | undefined,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): OtherLoanRepaymentDetail {
  const detail = createEmptyOtherLoanRepaymentDetail();
  if (!loanState) return detail;

  for (const entry of getAllLoanEntries(loanState)) {
    if (!isOtherLoanForCashFlow(entry)) continue;
    const amount = calcLoanEntryMonthlyRepaymentMan(
      entry,
      referenceDate,
      calendarYear,
      calendarMonth,
    );
    if (amount === 0) continue;
    detail[entry.category] += amount;
  }
  return detail;
}
