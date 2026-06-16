import { toJapaneseEra } from './era';
import type { FamilyMember } from '../types/family';

export function getMemberAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } | null {
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
  age: number,
  birthMonth: number,
  referenceDate: Date,
): number {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  let birthYear = refYear - age;
  if (birthMonth > refMonth) {
    birthYear -= 1;
  }
  return birthYear;
}

export function formatBirthLabel(
  age: number,
  birthMonth: number,
  referenceDate: Date,
): string {
  const birthYear = calcBirthYear(age, birthMonth, referenceDate);
  const era = toJapaneseEra(birthYear, birthMonth);
  return `${birthYear}年/${era}${birthMonth}月生`;
}

export function formatEndYearLabel(
  endAge: number,
  endMonth: number,
  birthYear: number,
  birthMonth: number,
): string {
  const year = calcFutureYear(birthYear, endAge, endMonth, birthMonth);
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

export function calcYearAtAge(
  birthYear: number,
  birthMonth: number,
  age: number,
  month: number,
): number {
  let year = birthYear + age;
  if (month < birthMonth) {
    year -= 1;
  }
  return year;
}

export function formatYearAtAgeLabel(
  age: number,
  month: number,
  birthYear: number,
  birthMonth: number,
): string {
  const year = calcYearAtAge(birthYear, birthMonth, age, month);
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
