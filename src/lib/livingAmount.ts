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

export function formatManAmount(value: number): string {
  return `${value.toFixed(1)}万円`;
}
