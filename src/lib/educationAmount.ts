/** 年額から月額を算出（四捨五入） */
export function tuitionAnnualToMonthly(tuitionAnnual: number): number {
  return Math.round(tuitionAnnual / 12);
}

/** 月額から年額を算出 */
export function tuitionMonthlyToAnnual(tuitionMonthly: number): number {
  return tuitionMonthly * 12;
}
