import type { FamilyMember } from '../types/family';
import type { IncomeByMember } from '../types/income';
import { addCalendarMonths } from './housingLoanAmortization';
import { nextPeriodStart } from './incomePeriod';

/**
 * 試算の既定開始（年齢・月）= 基準月の翌月。
 * 12月の翌月は年齢+1・1月。
 */
export function resolveDefaultStartAgeMonth(
  memberAge: number | null | undefined,
  referenceMonth: number,
): { startAge: number; startMonth: number } {
  return nextPeriodStart({
    endAge: memberAge ?? 0,
    endMonth: referenceMonth,
  });
}

/** 試算の既定開始（暦年月）= 基準日の翌月 */
export function resolveDefaultStartCalendar(referenceDate: Date): {
  year: number;
  month: number;
} {
  return addCalendarMonths(
    {
      year: referenceDate.getFullYear(),
      month: referenceDate.getMonth() + 1,
    },
    1,
  );
}

/**
 * 試算初年度の開始月（1–12）。
 *
 * 世帯主の収入期間が試算既定開始（基準月の翌月）から始まる場合はその開始月を使う。
 * それ以外は基準月の翌月にフォールバックする。
 */
export function resolveSimulationMonthStart(
  head: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
): number {
  const referenceMonth = referenceDate.getMonth() + 1;
  const defaultStart = resolveDefaultStartAgeMonth(head.age, referenceMonth);
  const entries = incomeByMember[head.id] ?? [];
  const baselineStartMonths: number[] = [];

  for (const entry of entries) {
    for (const period of entry.periods) {
      if (
        head.age != null &&
        period.startAge === defaultStart.startAge &&
        period.startMonth === defaultStart.startMonth
      ) {
        baselineStartMonths.push(period.startMonth);
      }
    }
  }

  if (baselineStartMonths.length > 0) {
    return Math.min(...baselineStartMonths);
  }

  return defaultStart.startMonth;
}

/** 初年度のシミュレーション対象月数（1–12） */
export function resolveSimulationMonthsInFirstYear(
  head: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
): number {
  const monthStart = resolveSimulationMonthStart(
    head,
    incomeByMember,
    referenceDate,
  );
  return 12 - monthStart + 1;
}

/** 前年度所得ベースの支払い（国保・国民年金・住民税等）の初年度按分係数 */
export function resolveLevyPaymentFactorForYear(input: {
  calendarYear: number;
  startYear: number;
  head: FamilyMember;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
}): number {
  if (input.calendarYear !== input.startYear) return 1;
  const monthStart = resolveSimulationMonthStart(
    input.head,
    input.incomeByMember,
    input.referenceDate,
  );
  if (monthStart <= 1) return 1;
  return (12 - monthStart + 1) / 12;
}
