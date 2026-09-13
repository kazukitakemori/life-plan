import type { LivingExpenseItem } from '../types/living';

function cycleMonthsPerPayment(item: LivingExpenseItem): number {
  if (item.cycleInterval <= 0) return 0;
  return item.cycleUnit === 'year'
    ? item.cycleInterval * 12
    : item.cycleInterval;
}

export function calcMonthlyEquivalentMan(items: LivingExpenseItem[]): number {
  return items.reduce((sum, item) => {
    const months = cycleMonthsPerPayment(item);
    if (months <= 0) return sum;
    return sum + item.amountMan / months;
  }, 0);
}

/**
 * 生活費の保存・計算値は既存互換のため万円を維持し、入力UIだけ千円単位で扱う。
 */
export function manToThousandYen(valueMan: number): number {
  return Number((valueMan * 10).toFixed(3));
}

export function thousandYenToMan(valueThousandYen: number): number {
  return Number((valueThousandYen / 10).toFixed(4));
}

export function formatThousandYenFromMan(valueMan: number): string {
  const valueThousandYen = manToThousandYen(valueMan);
  return `${valueThousandYen.toLocaleString('ja-JP', {
    maximumFractionDigits: 1,
  })}千円`;
}

export function formatManAmount(value: number): string {
  return `${value.toFixed(1)}万円`;
}
