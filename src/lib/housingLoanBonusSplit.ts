import type {
  HousingLoanRepaymentMethod,
  OwnedPropertyLoanSettings,
} from '../types/housing';
import {
  isBonusRepaymentMonth,
  type LoanRepaymentCalendarMonth,
} from './housingLoanPrepayment.ts';

/** 半年利率（6ヶ月複利）。年利の半分 */
export function calcSemiAnnualRate(annualRatePct: number): number {
  return annualRatePct / 100 / 2;
}

/**
 * 元利均等：ボーナス1回あたりの返済額（元金＋利息）から、
 * 半年利率・全ボーナス回数でボーナス返済分の元金を逆算する。
 */
export function calcBonusPrincipalFromEqualPaymentYen(
  bonusPaymentYen: number,
  annualRatePct: number,
  totalBonusPayments: number,
): number {
  if (bonusPaymentYen <= 0 || totalBonusPayments <= 0) return 0;
  const semiAnnualRate = calcSemiAnnualRate(annualRatePct);
  if (semiAnnualRate === 0) return bonusPaymentYen * totalBonusPayments;
  return (
    (bonusPaymentYen * (1 - Math.pow(1 + semiAnnualRate, -totalBonusPayments))) /
    semiAnnualRate
  );
}

/**
 * 元金均等：第1回目のボーナス支払額（元金＋利息）からボーナス返済分の元金を逆算する。
 *
 * 第1回支払額 = BonusLoan × (1/TotalBonusCount + AnnualRate/2)
 * ∴ BonusLoan = UserBonusInput / (1/TotalBonusCount + AnnualRate/2)
 */
export function calcBonusPrincipalFromEqualPrincipalPaymentYen(
  bonusPaymentYen: number,
  annualRatePct: number,
  totalBonusPayments: number,
): number {
  if (bonusPaymentYen <= 0 || totalBonusPayments <= 0) return 0;
  const annualRate = annualRatePct / 100;
  const paymentFactor = 1 / totalBonusPayments + annualRate / 2;
  if (paymentFactor === 0) return bonusPaymentYen * totalBonusPayments;
  return bonusPaymentYen / paymentFactor;
}

/** 元金均等ボーナス分の第1回支払額（元金＋利息）を算出する */
export function calcEqualPrincipalFirstBonusPaymentYen(
  bonusPrincipalYen: number,
  annualRatePct: number,
  totalBonusPayments: number,
): number {
  if (bonusPrincipalYen <= 0 || totalBonusPayments <= 0) return 0;
  const annualRate = annualRatePct / 100;
  return bonusPrincipalYen * (1 / totalBonusPayments + annualRate / 2);
}

/** 返済方式に応じてボーナス返済分の元金を逆算する */
export function calcBonusPrincipalFromPaymentYen(
  bonusPaymentYen: number,
  annualRatePct: number,
  totalBonusPayments: number,
  repaymentMethod: HousingLoanRepaymentMethod,
): number {
  if (repaymentMethod === 'equal_principal') {
    return calcBonusPrincipalFromEqualPrincipalPaymentYen(
      bonusPaymentYen,
      annualRatePct,
      totalBonusPayments,
    );
  }
  return calcBonusPrincipalFromEqualPaymentYen(
    bonusPaymentYen,
    annualRatePct,
    totalBonusPayments,
  );
}

export interface BonusPrincipalSplit {
  /** 毎月返済分の元金（円） */
  monthlyPrincipalYen: number;
  /** ボーナス返済分の元金（円） */
  bonusPrincipalYen: number;
}

/** 総借入額を「毎月返済分」と「ボーナス返済分」に分割する */
export function calcBonusPrincipalSplit(
  totalPrincipalYen: number,
  bonusPaymentYen: number,
  annualRatePct: number,
  totalBonusPayments: number,
  repaymentMethod: HousingLoanRepaymentMethod,
): BonusPrincipalSplit {
  if (totalPrincipalYen <= 0 || bonusPaymentYen <= 0 || totalBonusPayments <= 0) {
    return {
      monthlyPrincipalYen: totalPrincipalYen,
      bonusPrincipalYen: 0,
    };
  }

  const bonusPrincipalYen = Math.min(
    totalPrincipalYen,
    calcBonusPrincipalFromPaymentYen(
      bonusPaymentYen,
      annualRatePct,
      totalBonusPayments,
      repaymentMethod,
    ),
  );
  return {
    monthlyPrincipalYen: Math.max(0, totalPrincipalYen - bonusPrincipalYen),
    bonusPrincipalYen,
  };
}

export function countBonusRepaymentMonths(
  repaymentStart: LoanRepaymentCalendarMonth,
  totalMonths: number,
): number {
  let count = 0;
  for (let month = 1; month <= totalMonths; month += 1) {
    if (isBonusRepaymentMonth(repaymentStart, month)) count += 1;
  }
  return count;
}

export function countBonusRepaymentsBefore(
  repaymentStart: LoanRepaymentCalendarMonth,
  beforeMonth: number,
): number {
  let count = 0;
  for (let month = 1; month < beforeMonth; month += 1) {
    if (isBonusRepaymentMonth(repaymentStart, month)) count += 1;
  }
  return count;
}

export function findNextBonusRepaymentMonthIndex(
  repaymentStart: LoanRepaymentCalendarMonth,
  fromMonth: number,
  totalMonths: number,
): number | null {
  for (let month = fromMonth; month <= totalMonths; month += 1) {
    if (isBonusRepaymentMonth(repaymentStart, month)) return month;
  }
  return null;
}

/** 元金均等ボーナス1回分の返済内訳（毎回の元金は一定） */
export function calcEqualPrincipalBonusPaymentBreakdownYen(
  bonusBalanceYen: number,
  bonusPrincipalYen: number,
  totalBonusPayments: number,
  annualRatePct: number,
): { principalYen: number; interestYen: number } {
  if (bonusBalanceYen <= 0 || totalBonusPayments <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }
  const interestYen = bonusBalanceYen * calcSemiAnnualRate(annualRatePct);
  const principalYen = Math.min(
    bonusBalanceYen,
    bonusPrincipalYen / totalBonusPayments,
  );
  return { principalYen, interestYen };
}

export function calcBonusPaymentBreakdownYen(
  bonusBalanceYen: number,
  bonusPrincipalYen: number,
  bonusPaymentYen: number,
  totalBonusPayments: number,
  annualRatePct: number,
  repaymentMethod: HousingLoanRepaymentMethod,
): { principalYen: number; interestYen: number } {
  if (repaymentMethod === 'equal_principal') {
    return calcEqualPrincipalBonusPaymentBreakdownYen(
      bonusBalanceYen,
      bonusPrincipalYen,
      totalBonusPayments,
      annualRatePct,
    );
  }
  return calcGrossBonusPaymentBreakdownYen(
    bonusBalanceYen,
    bonusPaymentYen,
    annualRatePct,
  );
}

/** ボーナス1回分の返済額（元金＋利息）を、元金と利息に分解する */
export function calcGrossBonusPaymentBreakdownYen(
  bonusBalanceYen: number,
  bonusPaymentYen: number,
  annualRatePct: number,
): { principalYen: number; interestYen: number } {
  const interestYen = bonusBalanceYen * calcSemiAnnualRate(annualRatePct);
  const interestApplied = Math.min(interestYen, bonusPaymentYen);
  const principalYen = Math.min(
    bonusBalanceYen,
    Math.max(0, bonusPaymentYen - interestApplied),
  );
  return { principalYen, interestYen: interestApplied };
}

/** ボーナス返済 n 回目直前のボーナス分残高（円） */
export function calcBonusTrackBalanceBeforePaymentYen(
  bonusPrincipalYen: number,
  annualRatePct: number,
  bonusPaymentsBefore: number,
  bonusPaymentYen: number,
  totalBonusPayments: number,
  repaymentMethod: HousingLoanRepaymentMethod,
): number {
  let balance = bonusPrincipalYen;
  for (let i = 0; i < bonusPaymentsBefore; i += 1) {
    const { principalYen } = calcBonusPaymentBreakdownYen(
      balance,
      bonusPrincipalYen,
      bonusPaymentYen,
      totalBonusPayments,
      annualRatePct,
      repaymentMethod,
    );
    balance = Math.max(0, balance - principalYen);
  }
  return balance;
}

export function shouldUseBonusPrincipalSplitDisplay(
  settings: OwnedPropertyLoanSettings,
): boolean {
  return (
    settings.bonusRepaymentEnabled &&
    settings.bonusRepaymentAmountMan > 0 &&
    (settings.repaymentMethod === 'equal_payment' ||
      settings.repaymentMethod === 'equal_principal')
  );
}
