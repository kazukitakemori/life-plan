import { absoluteMonthIndexFromPeriodAgeMonth } from './birthDate';
import { roundAmountMan } from './incomeAmount';
import type { IncomePeriod } from '../types/income';

/** 上昇率（%/年）を小数第1位に丸める */
export function roundIncreaseRatePct(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 期間開始〜終了で上昇率が何回適用されるか（試算と同じ floor(月差/12)）。
 * UI の「A歳M月」は A歳になる年の M月として扱う。
 */
export function calcPeriodIncreaseYears(
  period: Pick<
    IncomePeriod,
    'startAge' | 'startMonth' | 'endAge' | 'endMonth'
  >,
  birthYear: number,
): number {
  const fromMonths = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    period.startAge,
    period.startMonth,
  );
  const toMonths = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    period.endAge,
    period.endMonth,
  );
  return Math.max(0, Math.floor((toMonths - fromMonths) / 12));
}

/** 開始年額と上昇率から期間終了時の年収（万円）を算出 */
export function calcEndAnnualAmountMan(
  startAnnualAmountMan: number,
  annualIncreaseRatePct: number | null | undefined,
  years: number,
): number {
  if (startAnnualAmountMan <= 0) return 0;
  if (years <= 0) return roundAmountMan(startAnnualAmountMan);
  const rate = annualIncreaseRatePct ?? 0;
  return roundAmountMan(
    startAnnualAmountMan * Math.pow(1 + rate / 100, years),
  );
}

/**
 * 開始年額と終了時年収から年間上昇率（%/年）を逆算。
 * 適用年数がない・開始年額が非正のときは null（呼び出し側で rate を変えない）。
 */
export function calcAnnualIncreaseRateFromEnd(
  startAnnualAmountMan: number,
  endAnnualAmountMan: number,
  years: number,
): number | null {
  if (years <= 0 || startAnnualAmountMan <= 0) return null;
  if (endAnnualAmountMan < 0) return null;
  if (endAnnualAmountMan === 0) return roundIncreaseRatePct(-100);
  const ratio = endAnnualAmountMan / startAnnualAmountMan;
  const rate = (Math.pow(ratio, 1 / years) - 1) * 100;
  if (!Number.isFinite(rate)) return null;
  return roundIncreaseRatePct(rate);
}
