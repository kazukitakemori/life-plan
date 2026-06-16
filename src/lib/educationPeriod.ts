import {
  resolveGraduateProgramType,
  resolveUniversityHousingType,
  SCHOOL_CATEGORY_LABELS,
} from './educationLabels';
import type {
  EducationExpenseEntry,
  GraduateProgramType,
  SchoolCategory,
  SchoolType,
} from '../types/education';

export interface EducationPeriod {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
}

export interface EducationPeriodAlert {
  id: string;
  message: string;
}

const STANDARD_PERIODS = {
  nursery: { startAge: 0, startMonth: 4, endAge: 3, endMonth: 3 },
  kindergarten: { startAge: 3, startMonth: 4, endAge: 6, endMonth: 3 },
  elementary: { startAge: 6, startMonth: 4, endAge: 12, endMonth: 3 },
  junior_high: { startAge: 12, startMonth: 4, endAge: 15, endMonth: 3 },
  high_school: { startAge: 15, startMonth: 4, endAge: 18, endMonth: 3 },
  university: { startAge: 18, startMonth: 4, endAge: 22, endMonth: 3 },
} as const satisfies Record<string, EducationPeriod>;

export const AUTO_PERIOD_CATEGORIES = ['nursery', 'kindergarten'] as const;

export const COMPULSORY_EDUCATION_CATEGORIES = [
  'elementary',
  'junior_high',
  'high_school',
] as const;

export type AutoPeriodCategory = (typeof AUTO_PERIOD_CATEGORIES)[number];
export type CompulsoryEducationCategory =
  (typeof COMPULSORY_EDUCATION_CATEGORIES)[number];

export function isAutoPeriodCategory(
  category: SchoolCategory,
): category is AutoPeriodCategory {
  return (AUTO_PERIOD_CATEGORIES as readonly string[]).includes(category);
}

export function isCompulsoryEducationCategory(
  category: SchoolCategory,
): category is CompulsoryEducationCategory {
  return (COMPULSORY_EDUCATION_CATEGORIES as readonly string[]).includes(
    category,
  );
}

export function isTechnicalCollegeSchoolType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'technical_college_public' ||
    schoolType === 'technical_college_private'
  );
}

export function isJuniorCollegeSchoolType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'junior_college_national' ||
    schoolType === 'junior_college_private'
  );
}

export function isMedicalUniversitySchoolType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'national_medical' || schoolType === 'private_medical'
  );
}

export function getStandardPeriodForHighSchool(
  schoolType: SchoolType,
): EducationPeriod {
  if (isTechnicalCollegeSchoolType(schoolType)) {
    return { startAge: 15, startMonth: 4, endAge: 20, endMonth: 3 };
  }
  return { ...STANDARD_PERIODS.high_school };
}

export function getStandardPeriodForUniversity(
  schoolType: SchoolType,
): EducationPeriod {
  if (isJuniorCollegeSchoolType(schoolType)) {
    return { startAge: 18, startMonth: 4, endAge: 20, endMonth: 3 };
  }
  if (isMedicalUniversitySchoolType(schoolType)) {
    return { startAge: 18, startMonth: 4, endAge: 24, endMonth: 3 };
  }
  return { ...STANDARD_PERIODS.university };
}

export function getStandardPeriodForGraduate(
  programType: GraduateProgramType,
): EducationPeriod {
  if (programType === 'doctoral') {
    return { startAge: 24, startMonth: 4, endAge: 27, endMonth: 3 };
  }
  return { startAge: 22, startMonth: 4, endAge: 24, endMonth: 3 };
}

export function getStandardPeriodForCategory(
  category: SchoolCategory,
): EducationPeriod | null {
  if (category in STANDARD_PERIODS) {
    return { ...STANDARD_PERIODS[category as keyof typeof STANDARD_PERIODS] };
  }
  return null;
}

export function getStandardPeriodForEntry(
  entry: Pick<
    EducationExpenseEntry,
    'schoolCategory' | 'schoolType' | 'graduateProgramType'
  >,
): EducationPeriod | null {
  if (entry.schoolCategory === 'high_school') {
    return getStandardPeriodForHighSchool(entry.schoolType);
  }
  if (entry.schoolCategory === 'university') {
    return getStandardPeriodForUniversity(entry.schoolType);
  }
  if (entry.schoolCategory === 'graduate') {
    return getStandardPeriodForGraduate(
      resolveGraduateProgramType(
        entry.schoolCategory,
        entry.graduateProgramType,
      )!,
    );
  }
  return getStandardPeriodForCategory(entry.schoolCategory);
}

export function formatEducationPeriodLabel(period: EducationPeriod): string {
  return `${period.startAge}才${period.startMonth}月〜${period.endAge}才${period.endMonth}月`;
}

export function isPeriodMatchingStandard(
  entry: Pick<
    EducationExpenseEntry,
    | 'schoolCategory'
    | 'schoolType'
    | 'graduateProgramType'
    | 'startAge'
    | 'startMonth'
    | 'endAge'
    | 'endMonth'
  >,
): boolean {
  const standard = getStandardPeriodForEntry(entry);
  if (!standard) return true;

  return (
    entry.startAge === standard.startAge &&
    entry.startMonth === standard.startMonth &&
    entry.endAge === standard.endAge &&
    entry.endMonth === standard.endMonth
  );
}

export function getEducationPeriodAlerts(
  entry: Pick<
    EducationExpenseEntry,
    | 'id'
    | 'schoolCategory'
    | 'schoolType'
    | 'graduateProgramType'
    | 'startAge'
    | 'startMonth'
    | 'endAge'
    | 'endMonth'
  >,
): EducationPeriodAlert[] {
  if (!isCompulsoryEducationCategory(entry.schoolCategory)) {
    return [];
  }

  if (isPeriodMatchingStandard(entry)) {
    return [];
  }

  const standard = getStandardPeriodForEntry(entry);
  if (!standard) return [];

  const label = SCHOOL_CATEGORY_LABELS[entry.schoolCategory];
  const periodLabel = formatEducationPeriodLabel(standard);
  const scopeLabel =
    entry.schoolCategory === 'high_school' ? '一般的な' : '義務教育の一般的な';

  return [
    {
      id: `${entry.id}-period-mismatch`,
      message: `${label}の${scopeLabel}在籍期間は${periodLabel}です。入力内容をご確認ください。`,
    },
  ];
}

function toAbsoluteMonths(age: number, month: number): number {
  return age * 12 + (month - 1);
}

/** 在籍期間に含まれる学年数（4月始まり・3月終わり想定） */
export function countEnrollmentYears(
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): number {
  const end = toAbsoluteMonths(endAge, endMonth);
  const schoolYearStart =
    startMonth >= 4
      ? toAbsoluteMonths(startAge, 4)
      : toAbsoluteMonths(startAge - 1, 4);

  if (end < schoolYearStart) return 1;

  let count = 0;
  for (let cursor = schoolYearStart; cursor <= end; cursor += 12) {
    count++;
  }
  return Math.max(1, count);
}

/** 在籍期間の毎年を表す enrollmentYear の値 */
export const ENROLLMENT_YEAR_EVERY = 0;

export function getEnrollmentYearOptions(
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): number[] {
  const count = countEnrollmentYears(startAge, startMonth, endAge, endMonth);
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function getEnrollmentYearSelectOptions(
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): { value: number; label: string }[] {
  const yearOptions = getEnrollmentYearOptions(
    startAge,
    startMonth,
    endAge,
    endMonth,
  );
  return [
    { value: ENROLLMENT_YEAR_EVERY, label: '毎年' },
    ...yearOptions.map((year) => ({
      value: year,
      label: formatEnrollmentYearLabel(year),
    })),
  ];
}

export function formatEnrollmentYearLabel(year: number): string {
  if (year === ENROLLMENT_YEAR_EVERY) return '毎年';
  return `${year}年目`;
}

export function clampEnrollmentYear(
  year: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): number {
  if (year === ENROLLMENT_YEAR_EVERY) return ENROLLMENT_YEAR_EVERY;
  const maxYear = countEnrollmentYears(startAge, startMonth, endAge, endMonth);
  return Math.min(Math.max(1, year), maxYear);
}

export function applySchoolCategoryChange(
  entry: EducationExpenseEntry,
  schoolCategory: SchoolCategory,
  schoolType: EducationExpenseEntry['schoolType'],
): EducationExpenseEntry {
  const next: EducationExpenseEntry = {
    ...entry,
    schoolCategory,
    schoolType,
  };

  if (schoolCategory === 'high_school') {
    return { ...next, ...getStandardPeriodForHighSchool(schoolType) };
  }

  if (schoolCategory === 'university') {
    return {
      ...next,
      ...getStandardPeriodForUniversity(schoolType),
      universityHousingType: resolveUniversityHousingType(
        schoolCategory,
        entry.universityHousingType,
      ),
      graduateProgramType: undefined,
    };
  }

  if (schoolCategory === 'graduate') {
    const graduateProgramType = resolveGraduateProgramType(
      schoolCategory,
      entry.graduateProgramType,
    )!;
    return {
      ...next,
      graduateProgramType,
      universityHousingType: resolveUniversityHousingType(
        schoolCategory,
        entry.universityHousingType,
      ),
      ...getStandardPeriodForGraduate(graduateProgramType),
    };
  }

  const {
    universityHousingType: _housing,
    graduateProgramType: _program,
    ...withoutCategoryFields
  } = next;

  if (!isAutoPeriodCategory(schoolCategory)) {
    return withoutCategoryFields;
  }

  const period = getStandardPeriodForCategory(schoolCategory);
  if (!period) return withoutCategoryFields;

  return { ...withoutCategoryFields, ...period };
}

export function applySchoolTypeChange(
  entry: EducationExpenseEntry,
  schoolType: EducationExpenseEntry['schoolType'],
): EducationExpenseEntry {
  const next: EducationExpenseEntry = {
    ...entry,
    schoolType,
  };

  if (entry.schoolCategory === 'high_school') {
    return { ...next, ...getStandardPeriodForHighSchool(schoolType) };
  }

  if (entry.schoolCategory === 'university') {
    return { ...next, ...getStandardPeriodForUniversity(schoolType) };
  }

  if (entry.schoolCategory === 'graduate') {
    return {
      ...next,
      ...getStandardPeriodForGraduate(
        resolveGraduateProgramType(
          entry.schoolCategory,
          entry.graduateProgramType,
        )!,
      ),
    };
  }

  return next;
}

export function applyGraduateProgramTypeChange(
  entry: EducationExpenseEntry,
  graduateProgramType: EducationExpenseEntry['graduateProgramType'],
): EducationExpenseEntry {
  const next: EducationExpenseEntry = {
    ...entry,
    graduateProgramType,
  };

  if (entry.schoolCategory !== 'graduate' || !graduateProgramType) {
    return next;
  }

  return {
    ...next,
    ...getStandardPeriodForGraduate(graduateProgramType),
  };
}
