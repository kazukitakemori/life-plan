import { getDefaultSchoolType, resolveGraduateProgramType, resolveSchoolType, resolveUniversityHousingType } from './educationLabels';
import { getStandardPeriodForEntry } from './educationPeriod';
import { getIncomeEligibleMembers } from './memberDisplay';
import type { FamilyMember } from '../types/family';
import type {
  EducationByMember,
  EducationExpenseEntry,
  EducationOtherExpense,
  SchoolCategory,
  SchoolType,
} from '../types/education';

function createId(): string {
  return crypto.randomUUID();
}

interface StandardStage {
  schoolCategory: SchoolCategory;
  schoolType: SchoolType;
}

const STANDARD_CHILD_PATH: StandardStage[] = [
  { schoolCategory: 'nursery', schoolType: 'licensed_childcare' },
  { schoolCategory: 'kindergarten', schoolType: 'public' },
  { schoolCategory: 'elementary', schoolType: 'public' },
  { schoolCategory: 'junior_high', schoolType: 'public' },
  { schoolCategory: 'high_school', schoolType: 'public' },
  { schoolCategory: 'university', schoolType: 'junior_college_national' },
];

function createStandardStageEntry(stage: StandardStage): EducationExpenseEntry {
  const period = getStandardPeriodForEntry(stage);
  return createEducationExpenseEntry({
    ...stage,
    ...period,
  });
}

export function createEducationOtherExpense(
  partial?: Partial<EducationOtherExpense>,
): EducationOtherExpense {
  return {
    id: createId(),
    label: '',
    enrollmentYear: 1,
    paymentCycle: 'monthly',
    amount: 0,
    ...partial,
  };
}

export function createEducationExpenseEntry(
  partial?: Partial<EducationExpenseEntry>,
): EducationExpenseEntry {
  const schoolCategory = partial?.schoolCategory ?? 'kindergarten';
  const schoolType = resolveSchoolType(
    schoolCategory,
    partial?.schoolType ?? getDefaultSchoolType(schoolCategory),
  );
  const standardPeriod = getStandardPeriodForEntry({ schoolCategory, schoolType });
  const fallbackPeriod = getStandardPeriodForEntry({
    schoolCategory: 'kindergarten',
    schoolType: 'public',
  })!;

  return {
    id: createId(),
    schoolCategory,
    schoolType,
    universityHousingType: resolveUniversityHousingType(
      schoolCategory,
      partial?.universityHousingType,
    ),
    graduateProgramType: resolveGraduateProgramType(
      schoolCategory,
      partial?.graduateProgramType,
    ),
    schoolName: '',
    startAge: standardPeriod?.startAge ?? fallbackPeriod.startAge,
    startMonth: standardPeriod?.startMonth ?? fallbackPeriod.startMonth,
    endAge: standardPeriod?.endAge ?? fallbackPeriod.endAge,
    endMonth: standardPeriod?.endMonth ?? fallbackPeriod.endMonth,
    entranceFee: 0,
    tuitionAnnual: 0,
    tuitionPaymentCycle: 'monthly',
    otherExpenses: [],
    ...partial,
  };
}

export function createStandardChildEducationPath(): EducationExpenseEntry[] {
  return STANDARD_CHILD_PATH.map((stage) => createStandardStageEntry(stage));
}

export function createDefaultEducationByMember(
  members: FamilyMember[],
): EducationByMember {
  const result: EducationByMember = {};
  for (const member of getIncomeEligibleMembers(members)) {
    result[member.id] =
      member.role === 'child' ? createStandardChildEducationPath() : [];
  }
  return result;
}

export function syncEducationWithFamily(
  members: FamilyMember[],
  current: EducationByMember,
): EducationByMember {
  const eligible = getIncomeEligibleMembers(members);
  const next: EducationByMember = {};

  for (const member of eligible) {
    if (current[member.id]) {
      next[member.id] = current[member.id];
    } else if (member.role === 'child') {
      next[member.id] = createStandardChildEducationPath();
    } else {
      next[member.id] = [];
    }
  }

  return next;
}

export function getEducationAgeOptions(member: FamilyMember): number[] {
  const maxAge = Math.max(member.expectedLifespan, 30);
  return Array.from({ length: maxAge + 1 }, (_, i) => i);
}
