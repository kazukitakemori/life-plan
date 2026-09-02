import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_THIRD_ONWARD_YEN_PER_YEAR,
  SURVIVOR_BASIC_DISABLED_CHILD_MAX_AGE,
} from './pensionConstants';
import { toMonthlyMan } from './pensionOldAge';
import type { FamilyMember } from '../types/family';
import type { RequiredCoverageSubject } from '../types/requiredCoverage';
import type { CalendarYearMonth } from './housingLoanAmortization';

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

/** 18歳到達年度の末日（3月） */
export function survivorChildOrdinaryEnd(
  member: FamilyMember,
  referenceDate: Date,
): CalendarYearMonth | null {
  if (member.age == null || member.birthMonth == null) return null;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  if (birthMonth >= 4) {
    return { year: birthYear + 19, month: 3 };
  }
  return { year: birthYear + 18, month: 3 };
}

export function isEligibleSurvivorBasicChild(
  member: FamilyMember,
  referenceDate: Date,
  year: number,
  month: number,
): boolean {
  if (member.role !== 'child') return false;
  const ageMonth = getMemberAgeMonth(member, referenceDate, year, month);
  if (!ageMonth) return false;
  if (member.disability === 'has') {
    return ageMonth.age < SURVIVOR_BASIC_DISABLED_CHILD_MAX_AGE;
  }
  const end = survivorChildOrdinaryEnd(member, referenceDate);
  if (!end) return false;
  return calendarIndex(year, month) <= calendarIndex(end.year, end.month);
}

export function listEligibleSurvivorBasicChildren(
  familyMembers: FamilyMember[],
  referenceDate: Date,
  year: number,
  month: number,
): FamilyMember[] {
  return familyMembers.filter((member) =>
    isEligibleSurvivorBasicChild(member, referenceDate, year, month),
  );
}

export function survivorBasicChildAddYenPerYear(childCount: number): number {
  const count = Math.max(0, Math.floor(childCount));
  if (count <= 0) return 0;
  const firstTwo = Math.min(count, 2) * SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR;
  const rest =
    Math.max(0, count - 2) * SURVIVOR_BASIC_CHILD_ADD_THIRD_ONWARD_YEN_PER_YEAR;
  return firstTwo + rest;
}

/**
 * その月の遺族基礎年金額（円/年の12分の1を万円）。
 * 残る配偶者がいて対象の子がいれば配偶者が受給。配偶者がいなければ子が受給。
 * 対象の子がいなければ 0。遺族厚生・保険料納付要件は未対応。
 */
export function calcSurvivorBasicYenPerYear(
  eligibleChildCount: number,
  spouseReceives: boolean,
): number {
  if (eligibleChildCount <= 0) return 0;
  if (spouseReceives) {
    return (
      FULL_BASIC_PENSION_YEN_PER_YEAR +
      survivorBasicChildAddYenPerYear(eligibleChildCount)
    );
  }
  return (
    FULL_BASIC_PENSION_YEN_PER_YEAR +
    survivorBasicChildAddYenPerYear(eligibleChildCount - 1)
  );
}

export function calcCoverageSurvivorBasicMonthlyMan(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
  referenceDate: Date,
  year: number,
  month: number,
): number {
  const survivorRole = subject === 'head' ? 'spouse' : 'head';
  const survivorSpouse = familyMembers.some(
    (member) => member.role === survivorRole,
  );
  const children = listEligibleSurvivorBasicChildren(
    familyMembers,
    referenceDate,
    year,
    month,
  );
  const yen = calcSurvivorBasicYenPerYear(children.length, survivorSpouse);
  return toMonthlyMan(yen);
}
