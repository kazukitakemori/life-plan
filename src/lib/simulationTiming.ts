import type { FamilyMember } from '../types/family';
import type { IncomeByMember } from '../types/income';
import { calcBirthYear } from './birthDate';
import { addCalendarMonths } from './housingLoanAmortization';
import { nextPeriodStart } from './incomePeriod';

/**
 * 試算の既定開始（年齢・月）= 基準月の翌月。
 * 12月の翌月は年齢+1・1月。
 *
 * 注: 誕生日を考慮しない簡易版。期間ピッカーの下限・上限には
 * resolveSimulationStartAgeMonth / resolveReferenceNowAgeMonth を使う。
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

/**
 * 暦年月 → 期間ラベルの「A歳M月」（A歳になる年のM月 = birthYear+A 年のM月）。
 * 誕生日が基準月より後でも、表示年が実際の暦とずれるのを防ぐ。
 */
export function periodAgeMonthFromCalendar(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return {
    age: Math.max(0, calendarYear - birthYear),
    month: calendarMonth,
  };
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

/** 試算開始の暦年月（基準月の翌月。12月→翌年1月） */
export function resolveSimulationStartCalendar(referenceDate: Date): {
  year: number;
  month: number;
} {
  return resolveDefaultStartCalendar(referenceDate);
}

/** 試算開始の暦年（基準月が12月のときは翌年） */
export function resolveSimulationStartYear(referenceDate: Date): number {
  return resolveSimulationStartCalendar(referenceDate).year;
}

/** 例: 2026年8月現在 */
export function formatReferenceMonthLabel(referenceDate: Date): string {
  return `${referenceDate.getFullYear()}年${referenceDate.getMonth() + 1}月現在`;
}

/** 例: 試算は2026年9月から */
export function formatSimulationStartLabel(referenceDate: Date): string {
  const start = resolveSimulationStartCalendar(referenceDate);
  return `試算は${start.year}年${start.month}月から`;
}

/**
 * Q1用サブタイトル。
 * 例: 2026年8月現在／試算は9月から（同年は月のみ。年跨ぎは年月）
 */
export function formatReferenceSimSubtitle(referenceDate: Date): string {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const start = resolveSimulationStartCalendar(referenceDate);
  const startPart =
    start.year === refYear
      ? `試算は${start.month}月から`
      : `試算は${start.year}年${start.month}月から`;
  return `${refYear}年${refMonth}月現在／${startPart}`;
}

/**
 * 今月＝基準月、来月＝試算開始、が基準日相対であることの短い注記。
 */
export function formatReferenceRelativeMonthHelp(): string {
  return '今月・来月はQ1の基準月基準（試算開始＝基準月の翌月）です';
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
