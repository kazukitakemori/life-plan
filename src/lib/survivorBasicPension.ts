import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  FULL_BASIC_PENSION_YEN_PER_YEAR_LEGACY,
  SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_REFORM_2026_LEVEL_YEN_PER_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_REFORM_START_MONTH,
  SURVIVOR_BASIC_CHILD_ADD_REFORM_START_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_THIRD_ONWARD_YEN_PER_YEAR,
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
  // 通常は18歳到達年度末まで。障害年金1級・2級の受給状況が
  // Q1で明示されている場合だけ、制度どおり20歳未満まで延長する。
  const end = survivorChildOrdinaryEnd(member, referenceDate);
  if (!end) return false;
  if (calendarIndex(year, month) <= calendarIndex(end.year, end.month)) {
    return true;
  }

  const hasGradeOneOrTwoDisability =
    member.disability === 'has' &&
    (member.disabilityGrade === 'grade1' ||
      member.disabilityGrade === 'grade2');
  return hasGradeOneOrTwoDisability && ageMonth.age < 20;
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

function isOnOrAfterSurvivorChildAddReform(
  year: number,
  month: number,
): boolean {
  return (
    year > SURVIVOR_BASIC_CHILD_ADD_REFORM_START_YEAR ||
    (year === SURVIVOR_BASIC_CHILD_ADD_REFORM_START_YEAR &&
      month >= SURVIVOR_BASIC_CHILD_ADD_REFORM_START_MONTH)
  );
}

export function survivorBasicChildAddYenPerYear(
  childCount: number,
  year = 2026,
  month = 4,
): number {
  const count = Math.max(0, Math.floor(childCount));
  if (count <= 0) return 0;

  if (isOnOrAfterSurvivorChildAddReform(year, month)) {
    return (
      count * SURVIVOR_BASIC_CHILD_ADD_REFORM_2026_LEVEL_YEN_PER_YEAR
    );
  }

  const firstTwo =
    Math.min(count, 2) * SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR;
  const rest =
    Math.max(0, count - 2) *
    SURVIVOR_BASIC_CHILD_ADD_THIRD_ONWARD_YEN_PER_YEAR;
  return firstTwo + rest;
}

/**
 * その月の遺族基礎年金額（円/年の12分の1を万円）。
 * 残る配偶者がいて対象の子がいれば配偶者が受給。配偶者がいなければ子が受給。
 * 対象の子がいなければ 0。死亡した方の受給要件・保険料納付要件は
 * 必要保障額側の呼び出し元で確認する。
 */
export function calcSurvivorBasicYenPerYear(
  eligibleChildCount: number,
  spouseReceives: boolean,
  spouseFullBasicPensionYenPerYear = FULL_BASIC_PENSION_YEN_PER_YEAR,
  year = 2026,
  month = 4,
): number {
  if (eligibleChildCount <= 0) return 0;
  if (spouseReceives) {
    return (
      spouseFullBasicPensionYenPerYear +
      survivorBasicChildAddYenPerYear(eligibleChildCount, year, month)
    );
  }
  return (
    FULL_BASIC_PENSION_YEN_PER_YEAR +
    survivorBasicChildAddYenPerYear(eligibleChildCount - 1, year, month)
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
  const spouse = familyMembers.find((member) => member.role === survivorRole);
  const spouseFullBasicPensionYenPerYear = (() => {
    if (!spouse) return FULL_BASIC_PENSION_YEN_PER_YEAR;
    const birthYear = calcBirthYear(spouse.age, spouse.birthMonth, referenceDate);
    const birthMonth = resolveMemberBirthMonth(spouse);
    const birthDay = spouse.birthDay ?? 1;
    return birthYear < 1956 ||
      (birthYear === 1956 && (birthMonth < 4 || (birthMonth === 4 && birthDay <= 1)))
      ? FULL_BASIC_PENSION_YEN_PER_YEAR_LEGACY
      : FULL_BASIC_PENSION_YEN_PER_YEAR;
  })();
  const yen = calcSurvivorBasicYenPerYear(
    children.length,
    survivorSpouse,
    spouseFullBasicPensionYenPerYear,
    year,
    month,
  );
  return toMonthlyMan(yen);
}
