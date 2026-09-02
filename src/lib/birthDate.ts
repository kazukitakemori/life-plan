import { toJapaneseEra } from './era';
import type { FamilyMember } from '../types/family';

export function getMemberAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } | null {
  if (member.age == null || member.birthMonth == null) return null;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let age = calendarYear - birthYear;
  if (calendarMonth < member.birthMonth) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return { age, month: calendarMonth };
}

export function calcBirthYear(
  age: number | null | undefined,
  birthMonth: number | null | undefined,
  referenceDate: Date,
): number {
  const safeAge = age ?? 0;
  const safeMonth = birthMonth ?? 1;
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  let birthYear = refYear - safeAge;
  if (safeMonth > refMonth) {
    birthYear -= 1;
  }
  return birthYear;
}

export function formatBirthLabel(
  age: number | null | undefined,
  birthMonth: number | null | undefined,
  referenceDate: Date,
  birthDay?: number | null,
): string {
  if (age == null || birthMonth == null || birthDay == null) return '';
  const birthYear = calcBirthYear(age, birthMonth, referenceDate);
  const era = toJapaneseEra(birthYear, birthMonth);
  return `${birthYear}年/${era}${birthMonth}月${birthDay}日生`;
}

/** 指定年月の日数（うるう年対応） */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 生年月日セレクト用の日オプション（月未選択時は1–31） */
export function getBirthDayOptions(
  age: number | null | undefined,
  birthMonth: number | null | undefined,
  referenceDate: Date,
): number[] {
  if (birthMonth == null) {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }
  const birthYear =
    age != null ? calcBirthYear(age, birthMonth, referenceDate) : 2000;
  const days = getDaysInMonth(birthYear, birthMonth);
  return Array.from({ length: days }, (_, i) => i + 1);
}

export function formatEndYearLabel(
  endAge: number,
  endMonth: number,
  birthYear: number,
  birthMonth: number | null | undefined,
): string {
  const safeBirthMonth = birthMonth ?? 1;
  const year = calcFutureYear(birthYear, endAge, endMonth, safeBirthMonth);
  const era = toJapaneseEra(year, endMonth);
  return `${year}年（${era}）`;
}

export function calcFutureYear(
  birthYear: number,
  endAge: number,
  endMonth: number,
  birthMonth: number,
): number {
  let year = birthYear + endAge;
  if (endMonth < birthMonth) {
    year -= 1;
  }
  return year;
}

export function formatReferenceDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月現在`;
}

/**
 * 期間ラベルの「A歳M月」→ 暦年。
 * 「A歳になる年」（birthYear + age）の暦月として扱う。
 */
export function calcYearAtAge(
  birthYear: number,
  _birthMonth: number,
  age: number,
  _month: number,
): number {
  return birthYear + age;
}

/**
 * getMemberAgeMonth が返す (age, calendarMonth) に対応する暦年。
 * 例: 3月生まれで「40歳1月」→ まだ40歳の1月 = birthYear + age + 1。
 */
export function calendarYearFromAgeCalendarMonth(
  birthYear: number,
  birthMonth: number,
  age: number,
  calendarMonth: number,
): number {
  if (calendarMonth < birthMonth) {
    return birthYear + age + 1;
  }
  return birthYear + age;
}

export function formatYearAtAgeLabel(
  age: number,
  month: number,
  birthYear: number,
  birthMonth: number | null | undefined,
): string {
  const year = calcYearAtAge(birthYear, birthMonth ?? 1, age, month);
  const era = toJapaneseEra(year, month);
  return `${year}年（${era}）`;
}

export function formatReferenceYearLabel(referenceDate: Date): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const era = toJapaneseEra(year, month);
  return `${year}年（${era}）`;
}

/** 生年月から指定年月までの経過月数（誕生月を0か月とする） */
export function calcMonthsFromBirth(
  birthYear: number,
  birthMonth: number,
  year: number,
  month: number,
): number {
  return (year - birthYear) * 12 + (month - birthMonth);
}

/**
 * getMemberAgeMonth が返す (age, calendarMonth) を、誕生月基準の経過月数へ変換する。
 */
export function calcMonthsFromBirthAtAgeCalendarMonth(
  birthMonth: number,
  age: number,
  calendarMonth: number,
): number {
  const bm = Math.min(12, Math.max(1, Math.round(birthMonth) || 1));
  const m = Math.min(12, Math.max(1, Math.round(calendarMonth) || 1));
  if (m >= bm) {
    return age * 12 + (m - bm);
  }
  return age * 12 + (12 - bm + m);
}

/** 期間の開始・終了 (age, month) → 絶対月（「その年齢になる年」の暦月） */
export function absoluteMonthIndexFromPeriodAgeMonth(
  birthYear: number,
  age: number,
  calendarMonth: number,
): number {
  return (birthYear + age) * 12 + calendarMonth;
}

/** getMemberAgeMonth の (age, month) → 絶対月 */
export function absoluteMonthIndexFromMemberAgeMonth(
  birthYear: number,
  birthMonth: number,
  age: number,
  calendarMonth: number,
): number {
  const year = calendarYearFromAgeCalendarMonth(
    birthYear,
    birthMonth,
    age,
    calendarMonth,
  );
  return year * 12 + calendarMonth;
}

/**
 * 収入・生活費などの期間判定。
 * - current: getMemberAgeMonth（その暦月の満年齢）
 * - start/end: UIの「A歳M月」= A歳になる年のM月
 *
 * age*12+calendarMonth だと誕生日が1月以外のとき、
 * 7月開始の翌年1〜誕生日前が「開始より前」と誤判定される。
 */
export function isAgeCalendarMonthInRange(
  age: number,
  calendarMonth: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
  birthYear: number,
  birthMonth: number,
): boolean {
  const current = absoluteMonthIndexFromMemberAgeMonth(
    birthYear,
    birthMonth,
    age,
    calendarMonth,
  );
  const start = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    startAge,
    startMonth,
  );
  const end = absoluteMonthIndexFromPeriodAgeMonth(birthYear, endAge, endMonth);
  return current >= start && current <= end;
}

/** 一括イベントなど: 現時点が期間ラベルの (targetAge, targetMonth) と同一暦月か */
export function isSamePeriodAgeMonth(
  age: number,
  calendarMonth: number,
  targetAge: number,
  targetMonth: number,
  birthYear: number,
  birthMonth: number,
): boolean {
  return (
    absoluteMonthIndexFromMemberAgeMonth(
      birthYear,
      birthMonth,
      age,
      calendarMonth,
    ) ===
    absoluteMonthIndexFromPeriodAgeMonth(birthYear, targetAge, targetMonth)
  );
}

/**
 * 年金タイムライン（20才〜65才）上での「0ヶ月」位置を 0〜1 で返す。
 * 範囲外は 0〜1 にクランプする。
 */
export function calcPensionTimelinePivotRatio(
  birthYear: number,
  birthMonth: number,
  pivotYear: number,
  pivotMonth: number,
  startAge = 20,
  endAge = 65,
): number {
  const startMonths = startAge * 12;
  const endMonths = endAge * 12;
  const pivotMonths = calcMonthsFromBirth(
    birthYear,
    birthMonth,
    pivotYear,
    pivotMonth,
  );
  const span = endMonths - startMonths;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (pivotMonths - startMonths) / span));
}
