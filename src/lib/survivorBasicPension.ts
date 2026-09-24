import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import {
  isPensionSpouseLikeMember,
  resolveMemberBirthMonth,
} from './familyDefaults';
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
import {
  createEmptySurvivorBasicDetail,
  type SurvivorBasicDetail,
} from '../types/cashFlow';
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
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
    member.birthDay,
  );
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
  // 通常は18歳到達年度末まで。Q1で障害等級1級・2級の状態が
  // 明示されている場合だけ、制度どおり20歳未満まで延長する。
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

export function isEligiblePensionChildAdditionResidence(
  member: FamilyMember,
  year: number,
  month: number,
): boolean {
  if (
    year < SURVIVOR_BASIC_CHILD_ADD_REFORM_START_YEAR ||
    (year === SURVIVOR_BASIC_CHILD_ADD_REFORM_START_YEAR &&
      month < SURVIVOR_BASIC_CHILD_ADD_REFORM_START_MONTH)
  ) {
    return true;
  }
  return (
    member.pensionChildResidence === 'japan' ||
    member.pensionChildResidence === 'overseas_exception'
  );
}

/**
 * 老齢年金の子の加算は、年金受給者本人が子の生計を維持していると
 * 確認できる場合だけ自動計上する。旧データ・未確認は安全側で対象外。
 */
export function isConfirmedPensionChildAdditionLivelihood(
  member: FamilyMember,
  pensionerId: string,
): boolean {
  return member.pensionChildLivelihoodByMember?.[pensionerId] === 'met';
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
  childAdditionCount = eligibleChildCount,
): number {
  if (eligibleChildCount <= 0) return 0;
  if (spouseReceives) {
    return (
      spouseFullBasicPensionYenPerYear +
      survivorBasicChildAddYenPerYear(childAdditionCount, year, month)
    );
  }
  return (
    FULL_BASIC_PENSION_YEN_PER_YEAR +
    survivorBasicChildAddYenPerYear(
      Math.max(0, childAdditionCount - 1),
      year,
      month,
    )
  );
}

export function calcCoverageSurvivorBasicDetailMonthlyMan(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
  referenceDate: Date,
  year: number,
  month: number,
): SurvivorBasicDetail {
  const detail = createEmptySurvivorBasicDetail();
  const survivorSpouse =
    subject === 'head'
      ? familyMembers.some((member) => isPensionSpouseLikeMember(member))
      : familyMembers.some((member) => member.role === 'head');
  const children = listEligibleSurvivorBasicChildren(
    familyMembers,
    referenceDate,
    year,
    month,
  );
  if (children.length <= 0) return detail;

  const spouse =
    subject === 'head'
      ? familyMembers.find((member) => isPensionSpouseLikeMember(member))
      : familyMembers.find((member) => member.role === 'head');
  const spouseFullBasicPensionYenPerYear = (() => {
    if (!spouse) return FULL_BASIC_PENSION_YEN_PER_YEAR;
    const birthYear = calcBirthYear(spouse.age, spouse.birthMonth, referenceDate);
    const birthMonth = resolveMemberBirthMonth(spouse);
    const birthDay = spouse.birthDay ?? 1;
    return birthYear < 1956 ||
      (birthYear === 1956 &&
        (birthMonth < 4 || (birthMonth === 4 && birthDay <= 1)))
      ? FULL_BASIC_PENSION_YEN_PER_YEAR_LEGACY
      : FULL_BASIC_PENSION_YEN_PER_YEAR;
  })();
  const childAdditionCount = children.filter((member) =>
    isEligiblePensionChildAdditionResidence(member, year, month),
  ).length;

  detail.basic = toMonthlyMan(
    survivorSpouse
      ? spouseFullBasicPensionYenPerYear
      : FULL_BASIC_PENSION_YEN_PER_YEAR,
  );
  detail.children = toMonthlyMan(
    survivorBasicChildAddYenPerYear(
      survivorSpouse
        ? childAdditionCount
        : Math.max(0, childAdditionCount - 1),
      year,
      month,
    ),
  );
  return detail;
}

export function calcCoverageSurvivorBasicMonthlyMan(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
  referenceDate: Date,
  year: number,
  month: number,
): number {
  const detail = calcCoverageSurvivorBasicDetailMonthlyMan(
    familyMembers,
    subject,
    referenceDate,
    year,
    month,
  );
  return detail.basic + detail.children + detail.widow;
}
