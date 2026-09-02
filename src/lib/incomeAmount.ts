import type { IncomeBonus, IncomePeriod } from '../types/income';

/** 万円単位を小数点第1位（千円単位）に丸める */
export function roundAmountMan(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 開始・終了が同じ月＝一時金（単月）期間 */
export function isSingleMonthIncomePeriod(
  period: Pick<
    IncomePeriod,
    'startAge' | 'startMonth' | 'endAge' | 'endMonth'
  >,
): boolean {
  return (
    period.startAge === period.endAge && period.startMonth === period.endMonth
  );
}

export function calcAnnualAmountMan(
  monthlyAmountMan: number,
  bonuses: IncomeBonus[],
  singleMonth = false,
): number {
  const bonusTotal = bonuses.reduce((sum, b) => sum + b.amountMan, 0);
  if (singleMonth) {
    return roundAmountMan(monthlyAmountMan + bonusTotal);
  }
  return roundAmountMan(monthlyAmountMan * 12 + bonusTotal);
}

/** 年額から月額を逆算（賞与は月額に含めない） */
export function calcMonthlyAmountManFromAnnual(
  annualAmountMan: number,
  bonuses: IncomeBonus[],
  singleMonth = false,
): number {
  const bonusTotal = bonuses.reduce((sum, b) => sum + b.amountMan, 0);
  const base = Math.max(0, annualAmountMan - bonusTotal);
  if (singleMonth) {
    return roundAmountMan(base);
  }
  return roundAmountMan(base / 12);
}

export function calcPeriodAnnualAmountMan(period: IncomePeriod): number {
  return period.annualAmountMan;
}

/** 月額・賞与から年額を再計算（月額変更時に使用） */
export function calcPeriodAnnualAmountFromMonthly(
  period: Pick<IncomePeriod, 'monthlyAmountMan' | 'bonuses'> &
    Pick<IncomePeriod, 'startAge' | 'startMonth' | 'endAge' | 'endMonth'>,
): number {
  return calcAnnualAmountMan(
    period.monthlyAmountMan,
    period.bonuses,
    isSingleMonthIncomePeriod(period),
  );
}
