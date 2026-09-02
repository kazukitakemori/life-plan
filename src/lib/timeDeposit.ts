/**
 * 定期預金の預入・満期・利息課税（簡易）。
 * 期中は元本のみ保有し、満期月に単利利息を一括計上。利息に 20.315% を源泉徴収し、
 * 元本＋税引後利息を普通預金（残現金）へ振り替える。
 */

import type { SavingsEntry } from '../types/savings';
import { TAXABLE_CAPITAL_GAINS_TAX_RATE } from './taxableCapitalGains';

/** 利子所得の源泉徴収相当（所得税 15.315% + 住民税 5%） */
export const TIME_DEPOSIT_INTEREST_TAX_RATE = TAXABLE_CAPITAL_GAINS_TAX_RATE;

/** 預入期間の既定（年） */
export const TIME_DEPOSIT_DEFAULT_TERM_YEARS = 1;

/** 預入期間の上限（年） */
export const TIME_DEPOSIT_MAX_TERM_YEARS = 10;

/** UI 用の預入期間選択肢（年） */
export const TIME_DEPOSIT_TERM_YEAR_OPTIONS = Array.from(
  { length: TIME_DEPOSIT_MAX_TERM_YEARS },
  (_, i) => i + 1,
);

export function isTimeDepositCategory(
  category: SavingsEntry['category'],
): category is 'time_deposit' {
  return category === 'time_deposit';
}

export function resolveTimeDepositTermYears(
  entry: Pick<SavingsEntry, 'termYears'>,
): number {
  const years = Math.round(Number(entry.termYears) || 0);
  if (years >= 1) {
    return Math.min(years, TIME_DEPOSIT_MAX_TERM_YEARS);
  }
  return TIME_DEPOSIT_DEFAULT_TERM_YEARS;
}

/** 預入金額（万円） */
export function getTimeDepositDepositMan(
  entry: Pick<SavingsEntry, 'balanceMan'>,
): number {
  return Math.max(0, Number(entry.balanceMan) || 0);
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + (month - 1);
}

function indexToAgeMonth(index: number): { age: number; month: number } {
  return {
    age: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

/** 満期の年齢・月（預入開始＋預入年数） */
export function getTimeDepositMaturity(
  entry: Pick<SavingsEntry, 'startAge' | 'startMonth' | 'termYears'>,
): { age: number; month: number } {
  const startIndex = ageMonthIndex(entry.startAge, entry.startMonth);
  const termYears = resolveTimeDepositTermYears(entry);
  return indexToAgeMonth(startIndex + termYears * 12);
}

export interface TimeDepositMaturityProceeds {
  /** 預入元本（万円） */
  principalMan: number;
  /** 満期利息・税引前（万円）。元本×年率×預入年数（単利） */
  interestMan: number;
  /** 利息税（万円） */
  taxMan: number;
  /** 税引後の受取合計（元本＋利息−税） */
  netProceedsMan: number;
}

/**
 * 満期時の受取額。
 * 利息 = 元本 × 年率 × 預入年数（単利・満期一括）。
 * 税 = 利息 × 20.315%（損失・還付なし）。
 */
export function calcTimeDepositMaturityProceeds(
  principalMan: number,
  annualRatePct: number,
  termYears: number,
): TimeDepositMaturityProceeds {
  const principal = Math.max(0, principalMan);
  const rate = Math.max(0, annualRatePct) / 100;
  const years = Math.max(0, termYears);
  const interestMan = principal * rate * years;
  const taxMan = interestMan * TIME_DEPOSIT_INTEREST_TAX_RATE;
  return {
    principalMan: principal,
    interestMan,
    taxMan,
    netProceedsMan: principal + interestMan - taxMan,
  };
}

/** 入力値から満期見込みを算出（UI 表示用） */
export function calcTimeDepositMaturityProceedsFromEntry(
  entry: SavingsEntry,
): TimeDepositMaturityProceeds {
  return calcTimeDepositMaturityProceeds(
    getTimeDepositDepositMan(entry),
    Math.max(0, Number(entry.expectedReturnRatePct) || 0),
    resolveTimeDepositTermYears(entry),
  );
}

export function ensureTimeDepositFields(entry: SavingsEntry): SavingsEntry {
  if (!isTimeDepositCategory(entry.category)) return entry;
  const termYears = resolveTimeDepositTermYears(entry);
  const maturity = getTimeDepositMaturity({
    startAge: entry.startAge,
    startMonth: entry.startMonth,
    termYears,
  });
  return {
    ...entry,
    contributionMode: 'none',
    contributionMan: 0,
    termYears,
    endMode: 'until',
    endAge: maturity.age,
    endMonth: maturity.month,
    balanceMan: getTimeDepositDepositMan(entry),
  };
}
