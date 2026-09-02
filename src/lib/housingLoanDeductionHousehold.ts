import { getMemberAgeMonth } from './birthDate';
import type { FamilyMember } from '../types/family';

export type HousingLoanDeductionHouseholdType =
  | 'child_rearing_young_couple'
  | 'other';

export const HOUSING_LOAN_DEDUCTION_HOUSEHOLD_LABELS: Record<
  HousingLoanDeductionHouseholdType,
  string
> = {
  child_rearing_young_couple: '子育て・若者夫婦世帯',
  other: 'その他の世帯',
};

const YOUNG_COUPLE_MAX_AGE = 39;
const CHILD_REARING_MAX_AGE = 18;

function isChildRearingHouseholdAtYearEnd(
  members: FamilyMember[],
  referenceDate: Date,
  occupancyYear: number,
): boolean {
  return members.some((member) => {
    if (member.role !== 'child') return false;
    const ageAtYearEnd = getMemberAgeMonth(
      member,
      referenceDate,
      occupancyYear,
      12,
    )?.age;
    return ageAtYearEnd != null && ageAtYearEnd <= CHILD_REARING_MAX_AGE;
  });
}

function isYoungCoupleHouseholdAtYearEnd(
  members: FamilyMember[],
  referenceDate: Date,
  occupancyYear: number,
): boolean {
  const head = members.find((member) => member.role === 'head');
  const spouse = members.find((member) => member.role === 'spouse');
  if (!head || !spouse) return false;

  const headAge = getMemberAgeMonth(head, referenceDate, occupancyYear, 12)?.age;
  const spouseAge = getMemberAgeMonth(
    spouse,
    referenceDate,
    occupancyYear,
    12,
  )?.age;
  if (headAge == null || spouseAge == null) return false;

  return headAge <= YOUNG_COUPLE_MAX_AGE || spouseAge <= YOUNG_COUPLE_MAX_AGE;
}

/**
 * 入居年の12月31日時点で「子育て・若者夫婦世帯」に該当するか判定する。
 * - 子育て世帯: 19歳未満の子がいる
 * - 若者夫婦世帯: 夫婦のいずれかが39歳以下
 */
export function resolveHousingLoanDeductionHouseholdType(
  members: FamilyMember[],
  referenceDate: Date,
  occupancyYear: number,
): HousingLoanDeductionHouseholdType {
  if (
    isChildRearingHouseholdAtYearEnd(members, referenceDate, occupancyYear) ||
    isYoungCoupleHouseholdAtYearEnd(members, referenceDate, occupancyYear)
  ) {
    return 'child_rearing_young_couple';
  }
  return 'other';
}
