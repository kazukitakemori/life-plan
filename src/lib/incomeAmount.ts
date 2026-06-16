import type { IncomeBonus, IncomePeriod } from '../types/income';

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
    return monthlyAmountMan + bonusTotal;
  }
  return monthlyAmountMan * 12 + bonusTotal;
}

export function calcPeriodAnnualAmountMan(period: IncomePeriod): number {
  return calcAnnualAmountMan(
    period.monthlyAmountMan,
    period.bonuses,
    isSingleMonthIncomePeriod(period),
  );
}
