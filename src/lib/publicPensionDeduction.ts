/**
 * 公的年金等控除（令和2年分以後・措法41条の15の3）
 * 参考: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm
 */

/** 公的年金等に係る雑所得以外の合計所得金額に応じた列（0=1,000万円以下） */
export type PublicPensionOtherIncomeTier = 0 | 1 | 2;

const LOW_LIMIT_65_PLUS = 3_300_000;
const LOW_LIMIT_UNDER_65 = 1_300_000;

const LOW_FIXED_65_PLUS: readonly [number, number, number] = [
  1_100_000,
  1_000_000,
  900_000,
];
const LOW_FIXED_UNDER_65: readonly [number, number, number] = [
  600_000,
  500_000,
  400_000,
];
const ADDEND_25: readonly [number, number, number] = [275_000, 175_000, 75_000];
const ADDEND_15: readonly [number, number, number] = [685_000, 585_000, 485_000];
const ADDEND_05: readonly [number, number, number] = [
  1_455_000,
  1_355_000,
  1_255_000,
];
const MAX_DEDUCTION: readonly [number, number, number] = [
  1_955_000,
  1_855_000,
  1_755_000,
];

export function resolvePublicPensionOtherIncomeTier(
  otherIncomeYen: number,
): PublicPensionOtherIncomeTier {
  if (otherIncomeYen > 20_000_000) return 2;
  if (otherIncomeYen > 10_000_000) return 1;
  return 0;
}

/** 公的年金等に係る雑所得以外の合計所得金額（円） */
export function calcOtherIncomeExcludingPensionYen(
  taxableIncomeYen: number,
  incomeAdjustmentDeductionYen = 0,
): number {
  return Math.max(0, taxableIncomeYen - incomeAdjustmentDeductionYen);
}

export function calcPublicPensionDeductionYen(
  pensionYen: number,
  age: number,
  otherIncomeYen = 0,
): number {
  if (pensionYen <= 0) return 0;

  const tier = resolvePublicPensionOtherIncomeTier(otherIncomeYen);
  const lowLimit = age >= 65 ? LOW_LIMIT_65_PLUS : LOW_LIMIT_UNDER_65;
  const lowFixed = age >= 65
    ? LOW_FIXED_65_PLUS[tier]
    : LOW_FIXED_UNDER_65[tier];

  if (pensionYen <= lowLimit) return lowFixed;
  if (pensionYen <= 4_100_000) {
    return Math.floor(pensionYen * 0.25 + ADDEND_25[tier]);
  }
  if (pensionYen <= 7_700_000) {
    return Math.floor(pensionYen * 0.15 + ADDEND_15[tier]);
  }
  if (pensionYen <= 10_000_000) {
    return Math.floor(pensionYen * 0.05 + ADDEND_05[tier]);
  }
  return MAX_DEDUCTION[tier];
}

/** 公的年金等の雑所得（円）= 受給額 − 公的年金等控除額 */
export function calcPensionMiscIncomeYen(
  pensionYen: number,
  age: number,
  otherIncomeYen = 0,
): number {
  return Math.max(
    0,
    pensionYen - calcPublicPensionDeductionYen(pensionYen, age, otherIncomeYen),
  );
}

export function describePublicPensionOtherIncomeTierLabel(
  otherIncomeYen: number,
): string {
  if (otherIncomeYen > 20_000_000) {
    return '公的年金等以外の合計所得が2,000万円超';
  }
  if (otherIncomeYen > 10_000_000) {
    return '公的年金等以外の合計所得が1,000万円超2,000万円以下';
  }
  return '公的年金等以外の合計所得が1,000万円以下';
}

export function describePublicPensionDeductionFormula(
  pensionYen: number,
  age: number,
  otherIncomeYen = 0,
): string {
  if (pensionYen <= 0) return '—';

  const tier = resolvePublicPensionOtherIncomeTier(otherIncomeYen);
  const lowLimit = age >= 65 ? LOW_LIMIT_65_PLUS : LOW_LIMIT_UNDER_65;
  const lowFixed = age >= 65
    ? LOW_FIXED_65_PLUS[tier]
    : LOW_FIXED_UNDER_65[tier];
  const lowLimitMan = lowLimit / 10_000;

  if (pensionYen <= lowLimit) {
    return `${(lowFixed / 10_000).toLocaleString('ja-JP')}万円（収入${lowLimitMan.toLocaleString('ja-JP')}万円以下）`;
  }
  if (pensionYen <= 4_100_000) {
    return `収入金額×25％＋${(ADDEND_25[tier] / 10_000).toLocaleString('ja-JP')}万円`;
  }
  if (pensionYen <= 7_700_000) {
    return `収入金額×15％＋${(ADDEND_15[tier] / 10_000).toLocaleString('ja-JP')}万円`;
  }
  if (pensionYen <= 10_000_000) {
    return `収入金額×5％＋${(ADDEND_05[tier] / 10_000).toLocaleString('ja-JP')}万円`;
  }
  return `${(MAX_DEDUCTION[tier] / 10_000).toLocaleString('ja-JP')}万円（上限）`;
}
