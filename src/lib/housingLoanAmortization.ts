import type { HousingLoanRepaymentMethod, OwnedProperty } from '../types/housing';
import { calcBirthYear, calcYearAtAge } from './birthDate';
import type {
  LoanRepaymentMonthEvent,
  LoanRepaymentMonthEventResolver,
} from './housingLoanPrepayment.ts';
import { buildLoanRepaymentEventResolver } from './housingLoanPrepayment.ts';

const MAN_TO_YEN = 10_000;

export interface CalendarYearMonth {
  year: number;
  month: number;
}

/** 返済予定表の1回分 */
export interface LoanRepaymentScheduleEntry {
  /** 返済回数（1始まり） */
  month: number;
  /** 返済額（元金＋利息。繰上げ分を含む） */
  paymentYen: number;
  /** 元金充当分（繰上げ分を含む） */
  principalYen: number;
  /** 利息 */
  interestYen: number;
  /** 繰上げ返済による元金（参考） */
  prepaymentPrincipalYen: number;
  /** 返済後残高 */
  balanceAfterYen: number;
}

/** @deprecated LoanRepaymentScheduleEntry を使用 */
export type EqualPaymentScheduleEntry = LoanRepaymentScheduleEntry;

export type LoanRepaymentRateResolver = (
  repaymentMonthIndex: number,
) => number;

interface SimulatedMonth {
  month: number;
  paymentYen: number;
  principalYen: number;
  interestYen: number;
  prepaymentPrincipalYen: number;
  balanceAfterYen: number;
}

interface EqualPaymentState {
  monthlyPayment: number;
  currentRate: number;
}

interface EqualPrincipalState {
  monthlyPrincipal: number;
}

/** 元利均等返済の月次返済額（円）。金利0の場合は元金均等。 */
export function calcMonthlyPaymentYen(
  principalYen: number,
  annualRatePct: number,
  totalMonths: number,
): number {
  if (totalMonths <= 0 || principalYen <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principalYen / totalMonths;
  return (
    (principalYen * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -totalMonths))
  );
}

function calcEqualPaymentMonthBreakdown(
  balance: number,
  monthlyPayment: number,
  monthlyRate: number,
  month: number,
  totalMonths: number,
): Pick<LoanRepaymentScheduleEntry, 'paymentYen' | 'principalYen' | 'interestYen'> {
  const interestYen = monthlyRate === 0 ? 0 : balance * monthlyRate;

  if (month === totalMonths || balance <= monthlyPayment - interestYen + 0.01) {
    const principalYen = balance;
    return {
      paymentYen: balance + interestYen,
      principalYen,
      interestYen,
    };
  }

  const principalYen = monthlyPayment - interestYen;
  return {
    paymentYen: monthlyPayment,
    principalYen,
    interestYen,
  };
}

function calcEqualPrincipalMonthBreakdown(
  balance: number,
  monthlyPrincipal: number,
  monthlyRate: number,
  month: number,
  totalMonths: number,
): Pick<LoanRepaymentScheduleEntry, 'paymentYen' | 'principalYen' | 'interestYen'> {
  const interestYen = monthlyRate === 0 ? 0 : balance * monthlyRate;
  const principalYen =
    month === totalMonths || balance <= monthlyPrincipal
      ? balance
      : monthlyPrincipal;
  return {
    principalYen,
    interestYen,
    paymentYen: principalYen + interestYen,
  };
}

function recalculateAfterPaymentReduction(
  balance: number,
  month: number,
  totalMonths: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  annualRatePct: number,
  equalPaymentState: EqualPaymentState,
  equalPrincipalState: EqualPrincipalState,
): void {
  const remainingMonths = totalMonths - month;
  if (balance <= 0 || remainingMonths <= 0) return;

  if (repaymentMethod === 'equal_payment') {
    equalPaymentState.monthlyPayment = calcMonthlyPaymentYen(
      balance,
      annualRatePct,
      remainingMonths,
    );
    equalPaymentState.currentRate = annualRatePct;
    return;
  }

  equalPrincipalState.monthlyPrincipal = balance / remainingMonths;
}

function applyMonthEvents(
  balance: number,
  month: number,
  totalMonths: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  annualRatePct: number,
  equalPaymentState: EqualPaymentState,
  equalPrincipalState: EqualPrincipalState,
  events: LoanRepaymentMonthEvent[],
): { balance: number; prepaymentPrincipalYen: number; eventInterestYen: number } {
  let currentBalance = balance;
  let prepaymentPrincipalYen = 0;
  let eventInterestYen = 0;

  for (const event of events) {
    let principalToApply: number;
    if (event.isGrossPayment) {
      // amountYen は「元金＋利息」の合計。
      // 現在残高に対する月次利息を算出し、元金分だけを残高に適用する。
      const monthlyRate = annualRatePct / 100 / 12;
      const interest = monthlyRate === 0 ? 0 : currentBalance * monthlyRate;
      const interestApplied = Math.min(interest, event.amountYen);
      principalToApply = Math.max(0, event.amountYen - interestApplied);
      eventInterestYen += interestApplied;
    } else {
      principalToApply = event.amountYen;
    }

    const prepay = Math.min(currentBalance, principalToApply);
    if (prepay <= 0) continue;

    prepaymentPrincipalYen += prepay;
    currentBalance -= prepay;

    if (event.type === 'payment_reduction') {
      recalculateAfterPaymentReduction(
        currentBalance,
        month,
        totalMonths,
        repaymentMethod,
        annualRatePct,
        equalPaymentState,
        equalPrincipalState,
      );
    }

    if (currentBalance <= 0) break;
  }

  return { balance: Math.max(0, currentBalance), prepaymentPrincipalYen, eventInterestYen };
}

function simulateLoanRepayment(
  principalYen: number,
  totalMonths: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  getRateForMonth: LoanRepaymentRateResolver,
  getMonthEvents: LoanRepaymentMonthEventResolver = () => [],
  maxMonth = totalMonths,
): SimulatedMonth[] {
  if (totalMonths <= 0 || principalYen <= 0) return [];

  const results: SimulatedMonth[] = [];
  let balance = principalYen;
  const equalPaymentState: EqualPaymentState = {
    monthlyPayment: 0,
    currentRate: -1,
  };
  const equalPrincipalState: EqualPrincipalState = {
    monthlyPrincipal: principalYen / totalMonths,
  };
  let paidOff = false;
  const lastMonth = Math.min(totalMonths, Math.max(0, maxMonth));

  for (let month = 1; month <= lastMonth; month += 1) {
    if (paidOff || balance <= 0) {
      results.push({
        month,
        paymentYen: 0,
        principalYen: 0,
        interestYen: 0,
        prepaymentPrincipalYen: 0,
        balanceAfterYen: 0,
      });
      continue;
    }

    const annualRatePct = getRateForMonth(month);
    const monthlyRate = annualRatePct / 100 / 12;
    const remainingMonths = totalMonths - month + 1;

    let breakdown: Pick<
      LoanRepaymentScheduleEntry,
      'paymentYen' | 'principalYen' | 'interestYen'
    >;

    if (repaymentMethod === 'equal_principal') {
      breakdown = calcEqualPrincipalMonthBreakdown(
        balance,
        equalPrincipalState.monthlyPrincipal,
        monthlyRate,
        month,
        totalMonths,
      );
    } else {
      if (annualRatePct !== equalPaymentState.currentRate) {
        equalPaymentState.currentRate = annualRatePct;
        equalPaymentState.monthlyPayment = calcMonthlyPaymentYen(
          balance,
          annualRatePct,
          remainingMonths,
        );
      }
      breakdown = calcEqualPaymentMonthBreakdown(
        balance,
        equalPaymentState.monthlyPayment,
        monthlyRate,
        month,
        totalMonths,
      );
    }

    balance = Math.max(0, balance - breakdown.principalYen);

    const {
      balance: balanceAfterPrepay,
      prepaymentPrincipalYen,
      eventInterestYen,
    } = applyMonthEvents(
      balance,
      month,
      totalMonths,
      repaymentMethod,
      annualRatePct,
      equalPaymentState,
      equalPrincipalState,
      getMonthEvents(month),
    );
    balance = balanceAfterPrepay;

    if (balance <= 0) {
      balance = 0;
      paidOff = true;
    }

    results.push({
      month,
      paymentYen: breakdown.paymentYen + prepaymentPrincipalYen + eventInterestYen,
      principalYen: breakdown.principalYen + prepaymentPrincipalYen,
      interestYen: breakdown.interestYen + eventInterestYen,
      prepaymentPrincipalYen,
      balanceAfterYen: balance,
    });
  }

  return results;
}

/**
 * 返済予定表を生成する（固定・変動金利・繰上げ返済共通）。
 */
export function buildLoanRepaymentSchedule(
  principalYen: number,
  totalMonths: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  getRateForMonth: LoanRepaymentRateResolver,
  getMonthEvents: LoanRepaymentMonthEventResolver = () => [],
): LoanRepaymentScheduleEntry[] {
  return simulateLoanRepayment(
    principalYen,
    totalMonths,
    repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );
}

/** 返済 n 回目（1始まり）の通常返済額（円。ボーナス・繰上げ分は含まない） */
export function calcLoanRegularPaymentAtMonthYen(
  principalYen: number,
  totalMonths: number,
  repaymentMonthIndex: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  getRateForMonth: LoanRepaymentRateResolver,
  getMonthEvents: LoanRepaymentMonthEventResolver = () => [],
): number {
  if (repaymentMonthIndex <= 0 || repaymentMonthIndex > totalMonths || principalYen <= 0) {
    return 0;
  }

  const results = simulateLoanRepayment(
    principalYen,
    totalMonths,
    repaymentMethod,
    getRateForMonth,
    getMonthEvents,
    repaymentMonthIndex,
  );
  const month = results[results.length - 1];
  if (!month) return 0;
  return month.paymentYen - month.prepaymentPrincipalYen;
}

/** 返済 n 回目（1始まり）の元金・利息（円。繰上げ分は元金に含む） */
export function calcLoanRepaymentMonthYen(
  principalYen: number,
  totalMonths: number,
  repaymentMonthIndex: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  getRateForMonth: LoanRepaymentRateResolver,
  getMonthEvents: LoanRepaymentMonthEventResolver = () => [],
): { principalYen: number; interestYen: number } {
  if (repaymentMonthIndex <= 0 || repaymentMonthIndex > totalMonths || principalYen <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  const results = simulateLoanRepayment(
    principalYen,
    totalMonths,
    repaymentMethod,
    getRateForMonth,
    getMonthEvents,
    repaymentMonthIndex,
  );
  const month = results[results.length - 1];

  if (!month || (month.principalYen === 0 && month.interestYen === 0)) {
    return { principalYen: 0, interestYen: 0 };
  }

  return {
    principalYen: month.principalYen,
    interestYen: month.interestYen,
  };
}

/** n 回返済後の残高（円） */
export function calcLoanRepaymentBalanceAfterMonthYen(
  principalYen: number,
  totalMonths: number,
  afterMonthIndex: number,
  repaymentMethod: HousingLoanRepaymentMethod,
  getRateForMonth: LoanRepaymentRateResolver,
  getMonthEvents: LoanRepaymentMonthEventResolver = () => [],
): number {
  if (totalMonths <= 0 || principalYen <= 0) return 0;
  if (afterMonthIndex <= 0) return principalYen;

  const results = simulateLoanRepayment(
    principalYen,
    totalMonths,
    repaymentMethod,
    getRateForMonth,
    getMonthEvents,
    afterMonthIndex,
  );
  return results[results.length - 1]?.balanceAfterYen ?? 0;
}

/** 元利均等返済の全期間スケジュール（固定金利） */
export function buildEqualPaymentSchedule(
  principalYen: number,
  annualRatePct: number,
  totalMonths: number,
): LoanRepaymentScheduleEntry[] {
  return buildLoanRepaymentSchedule(
    principalYen,
    totalMonths,
    'equal_payment',
    () => annualRatePct,
  );
}

/** 返済 n 回目（1始まり）の元金・利息（円・元利均等・固定金利） */
export function calcEqualPaymentMonthYen(
  principalYen: number,
  annualRatePct: number,
  totalMonths: number,
  repaymentMonthIndex: number,
): { principalYen: number; interestYen: number } {
  return calcLoanRepaymentMonthYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    'equal_payment',
    () => annualRatePct,
  );
}

/** n 回返済後の残高（円・元利均等・固定金利） */
export function calcEqualPaymentBalanceAfterMonthYen(
  principalYen: number,
  annualRatePct: number,
  totalMonths: number,
  afterMonthIndex: number,
): number {
  return calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    totalMonths,
    afterMonthIndex,
    'equal_payment',
    () => annualRatePct,
  );
}

/** @deprecated calcEqualPaymentMonthYen を使用 */
export function calcPrincipalInterestAtRepaymentMonthYen(
  principalYen: number,
  annualRatePct: number,
  totalMonths: number,
  repaymentMonthIndex: number,
): { principalYen: number; interestYen: number } {
  return calcEqualPaymentMonthYen(
    principalYen,
    annualRatePct,
    totalMonths,
    repaymentMonthIndex,
  );
}

/** 金利期間ごとに返済額を見直す元利均等返済 */
export function calcEqualPaymentMonthWithVariableRatesYen(
  principalYen: number,
  totalMonths: number,
  repaymentMonthIndex: number,
  getRateForMonth: LoanRepaymentRateResolver,
): { principalYen: number; interestYen: number } {
  return calcLoanRepaymentMonthYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    'equal_payment',
    getRateForMonth,
  );
}

/** @deprecated calcEqualPaymentMonthWithVariableRatesYen を使用 */
export function calcPrincipalInterestWithVariableRatesYen(
  principalYen: number,
  totalMonths: number,
  repaymentMonthIndex: number,
  getRateForMonth: LoanRepaymentRateResolver,
): { principalYen: number; interestYen: number } {
  return calcEqualPaymentMonthWithVariableRatesYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    getRateForMonth,
  );
}

/** n 回返済後の残高（円・元利均等・変動金利） */
export function calcEqualPaymentBalanceAfterMonthWithVariableRatesYen(
  principalYen: number,
  totalMonths: number,
  afterMonthIndex: number,
  getRateForMonth: LoanRepaymentRateResolver,
): number {
  return calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    totalMonths,
    afterMonthIndex,
    'equal_payment',
    getRateForMonth,
  );
}

function calendarMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export { calendarMonthIndex };

export function addCalendarMonths(
  base: CalendarYearMonth,
  monthsToAdd: number,
): CalendarYearMonth {
  if (monthsToAdd === 0) return { ...base };
  const total = calendarMonthIndex(base.year, base.month) + monthsToAdd;
  const year = Math.floor((total - 1) / 12);
  const month = ((total - 1) % 12) + 1;
  return { year, month };
}

/**
 * 所有開始の暦年月（試算基準日時点の年齢から換算）。
 * birthMonth を渡すと物件の維持費・購入初期費用と同じ年齢月換算になる。
 */
export function getOwnershipStartCalendar(
  property: Pick<OwnedProperty, 'startAge' | 'startMonth'>,
  memberAgeAtReference: number,
  referenceYear: number,
  birthMonth?: number | null,
  referenceMonth = 1,
): CalendarYearMonth {
  const month = property.startMonth;
  if (birthMonth != null && birthMonth >= 1 && birthMonth <= 12) {
    const refDate = new Date(
      referenceYear,
      Math.max(0, referenceMonth - 1),
      1,
    );
    const birthYear = calcBirthYear(
      memberAgeAtReference,
      birthMonth,
      refDate,
    );
    return {
      year: calcYearAtAge(
        birthYear,
        birthMonth,
        property.startAge,
        month,
      ),
      month,
    };
  }
  return {
    year: referenceYear + (property.startAge - memberAgeAtReference),
    month,
  };
}

/** 返済開始は所有開始月の翌月 */
export function getLoanRepaymentStartCalendar(
  ownershipStart: CalendarYearMonth,
): CalendarYearMonth {
  if (ownershipStart.month === 12) {
    return { year: ownershipStart.year + 1, month: 1 };
  }
  return { year: ownershipStart.year, month: ownershipStart.month + 1 };
}

/** 返済開始前は null、完済後は totalMonths を超える値 */
export function calcRepaymentMonthIndex(
  repaymentStart: CalendarYearMonth,
  calendarYear: number,
  calendarMonth: number,
): number | null {
  const startIdx = calendarMonthIndex(repaymentStart.year, repaymentStart.month);
  const currentIdx = calendarMonthIndex(calendarYear, calendarMonth);
  if (currentIdx < startIdx) return null;
  return currentIdx - startIdx + 1;
}

/**
 * calendarYear の年末ローン残高（円）。
 * 返済開始前は借入額、完済後は 0。
 */
export function calcYearEndLoanBalanceYen(
  property: OwnedProperty,
  memberAgeAtReference: number,
  referenceYear: number,
  calendarYear: number,
): number {
  const { loan } = property;
  if (!loan || loan.amountMan <= 0 || loan.years <= 0) return 0;

  const principalYen = loan.amountMan * MAN_TO_YEN;
  const totalMonths = loan.years * 12;
  const ownershipStart = getOwnershipStartCalendar(
    property,
    memberAgeAtReference,
    referenceYear,
  );
  const repaymentStart = getLoanRepaymentStartCalendar(ownershipStart);

  const elapsed = calcRepaymentMonthIndex(
    repaymentStart,
    calendarYear,
    12,
  );
  if (elapsed === null) return principalYen;
  if (elapsed >= totalMonths) return 0;

  const annualRatePct = loan.interestRatePeriods[0]?.interestRatePct ?? 0;
  return calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    totalMonths,
    elapsed,
    loan.repaymentMethod ?? 'equal_payment',
    () => annualRatePct,
    buildLoanRepaymentEventResolver(loan, {
      repaymentStart,
      totalMonths,
    }),
  );
}

export function yenToMan(yen: number): number {
  return yen / MAN_TO_YEN;
}
