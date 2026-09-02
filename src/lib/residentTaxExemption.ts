import { getSpouseTotalIncomeLimitYen } from './spouseDeduction';
import { calcMemberTotalIncomeForNhiYen } from './nationalHealthInsurance';
import type { FamilyMember } from '../types/family';
import type { DependentStatus } from '../types/income';

export interface ResidentTaxMemberProfile {
  role: FamilyMember['role'];
  totalIncomeYen: number;
  annualPensionMan: number;
  age: number | null;
  dependentStatus: DependentStatus;
  taxDependent: boolean;
  hasActiveIncomeBlock: boolean;
}

/** 福岡市・住民税の均等割・所得割ともに非課税となる合計所得金額の加算（扶養等あり） */
const FUKUOKA_FULL_EXEMPT_ADDON_YEN = 210_000;
/** 福岡市・住民税の所得割のみ非課税となる総所得金額等の加算（扶養等あり） */
const FUKUOKA_INCOME_LEVY_EXEMPT_ADDON_YEN = 320_000;
const FUKUOKA_EXEMPT_PER_MEMBER_YEN = 350_000;
const FUKUOKA_EXEMPT_FIXED_ADDON_YEN = 100_000;
const FUKUOKA_SINGLE_NO_DEPENDENT_THRESHOLD_YEN = 450_000;
const FUKUOKA_SPECIAL_EXEMPT_INCOME_LIMIT_YEN = 1_350_000;

export type ResidentTaxExemptionLevel =
  | 'taxable'
  | 'income_levy_exempt'
  | 'fully_exempt';

export interface HouseholdResidentTaxContext {
  /** 同一生計配偶者がいる（配偶者メンバーが登録されている） */
  hasCohabitingSpouse: boolean;
  /** 税法上の扶養親族数（16歳以上・合計所得が上限以下） */
  dependentCount: number;
}

export interface MemberResidentTaxAssessment {
  memberId: string;
  /** 納税義務者として住民税を計算する対象か */
  isTaxpayer: boolean;
  gokeiShotokuYen: number;
  exemptionLevel: ResidentTaxExemptionLevel;
}

function calcFukuokaThresholdYen(
  context: HouseholdResidentTaxContext,
  addonYen: number,
): number {
  if (!context.hasCohabitingSpouse && context.dependentCount === 0) {
    return FUKUOKA_SINGLE_NO_DEPENDENT_THRESHOLD_YEN;
  }

  const memberCount =
    1 + (context.hasCohabitingSpouse ? 1 : 0) + context.dependentCount;
  return (
    FUKUOKA_EXEMPT_PER_MEMBER_YEN * memberCount +
    addonYen +
    FUKUOKA_EXEMPT_FIXED_ADDON_YEN
  );
}

/** 均等割・所得割ともに非課税となる合計所得金額の上限（円） */
export function calcFukuokaFullExemptThresholdYen(
  context: HouseholdResidentTaxContext,
): number {
  return calcFukuokaThresholdYen(context, FUKUOKA_FULL_EXEMPT_ADDON_YEN);
}

/** 所得割のみ非課税となる総所得金額等の上限（円） */
export function calcFukuokaIncomeLevyExemptThresholdYen(
  context: HouseholdResidentTaxContext,
): number {
  return calcFukuokaThresholdYen(context, FUKUOKA_INCOME_LEVY_EXEMPT_ADDON_YEN);
}

export function assessMemberResidentTaxExemption(input: {
  gokeiShotokuYen: number;
  context: HouseholdResidentTaxContext;
  age: number | null;
  disability: FamilyMember['disability'];
}): ResidentTaxExemptionLevel {
  const { gokeiShotokuYen, context, age, disability } = input;

  if (
    disability === 'has' &&
    gokeiShotokuYen <= FUKUOKA_SPECIAL_EXEMPT_INCOME_LIMIT_YEN
  ) {
    return 'fully_exempt';
  }
  if (
    age != null &&
    age < 18 &&
    gokeiShotokuYen <= FUKUOKA_SPECIAL_EXEMPT_INCOME_LIMIT_YEN
  ) {
    return 'fully_exempt';
  }

  if (gokeiShotokuYen <= calcFukuokaFullExemptThresholdYen(context)) {
    return 'fully_exempt';
  }
  if (gokeiShotokuYen <= calcFukuokaIncomeLevyExemptThresholdYen(context)) {
    return 'income_levy_exempt';
  }
  return 'taxable';
}

function isTaxpayerMember(profile: ResidentTaxMemberProfile): boolean {
  if (!profile.hasActiveIncomeBlock && profile.annualPensionMan <= 0) {
    return profile.role === 'head';
  }
  return profile.dependentStatus === 'none' || !profile.taxDependent;
}

export function countHouseholdTaxDependents(
  familyMembers: FamilyMember[],
  profilesByMemberId: Record<string, ResidentTaxMemberProfile>,
  calendarYear = 2026,
): number {
  const incomeLimitYen = getSpouseTotalIncomeLimitYen(calendarYear);
  let count = 0;

  for (const member of familyMembers) {
    if (member.role !== 'child' && member.role !== 'other') continue;

    const profile = profilesByMemberId[member.id];
    if (!profile?.taxDependent) continue;

    const age = profile.age ?? 0;
    if (age < 16) continue;

    const gokeiShotokuYen = calcMemberTotalIncomeForNhiYen({
      totalIncomeYen: profile.totalIncomeYen,
      annualPensionMan: profile.annualPensionMan,
      age,
    });
    if (gokeiShotokuYen > incomeLimitYen) continue;

    count += 1;
  }

  return count;
}

export function buildHouseholdResidentTaxContext(
  familyMembers: FamilyMember[],
  profilesByMemberId: Record<string, ResidentTaxMemberProfile>,
  calendarYear = 2026,
): HouseholdResidentTaxContext {
  return {
    hasCohabitingSpouse: familyMembers.some((member) => member.role === 'spouse'),
    dependentCount: countHouseholdTaxDependents(
      familyMembers,
      profilesByMemberId,
      calendarYear,
    ),
  };
}

export function assessHouseholdResidentTax(
  familyMembers: FamilyMember[],
  memberProfiles: { memberId: string; profile: ResidentTaxMemberProfile }[],
  context: HouseholdResidentTaxContext,
): {
  assessments: MemberResidentTaxAssessment[];
  isExemptHousehold: boolean;
} {
  const disabilityByMemberId = new Map(
    familyMembers.map((member) => [member.id, member.disability]),
  );

  const assessments: MemberResidentTaxAssessment[] = memberProfiles.map(
    ({ memberId, profile }) => {
      const isTaxpayer = isTaxpayerMember(profile);
      const gokeiShotokuYen = calcMemberTotalIncomeForNhiYen({
        totalIncomeYen: profile.totalIncomeYen,
        annualPensionMan: profile.annualPensionMan,
        age: profile.age ?? 0,
      });
      const exemptionLevel = isTaxpayer
        ? assessMemberResidentTaxExemption({
            gokeiShotokuYen,
            context,
            age: profile.age,
            disability: disabilityByMemberId.get(memberId) ?? 'none',
          })
        : 'fully_exempt';

      return {
        memberId,
        isTaxpayer,
        gokeiShotokuYen,
        exemptionLevel,
      };
    },
  );

  const isExemptHousehold = assessments
    .filter((assessment) => assessment.isTaxpayer)
    .every((assessment) => assessment.exemptionLevel === 'fully_exempt');

  return { assessments, isExemptHousehold };
}

export function formatResidentTaxExemptionLevel(
  level: ResidentTaxExemptionLevel,
): string {
  switch (level) {
    case 'fully_exempt':
      return '均等割・所得割ともに非課税';
    case 'income_levy_exempt':
      return '所得割のみ非課税（均等割は課税）';
    default:
      return '課税';
  }
}
