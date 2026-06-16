import type {
  OtherExpensePaymentCycle,
  SchoolCategory,
  SchoolType,
  TuitionPaymentCycle,
  UniversityHousingType,
  GraduateProgramType,
} from '../types/education';

export const SCHOOL_CATEGORY_LABELS: Record<SchoolCategory, string> = {
  nursery: '保育園',
  kindergarten: '幼稚園',
  elementary: '小学校',
  junior_high: '中学校',
  high_school: '高校',
  university: '大学',
  graduate: '大学院',
  other: 'その他',
};

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  public: '公立',
  private: '私立',
  part_time_public: '定時制公立（3年）',
  part_time_private: '定時制私立（3年）',
  correspondence_public: '通信公立',
  correspondence_private: '通信私立',
  technical_college_public: '高専公立（5年）',
  technical_college_private: '高専私立（5年）',
  junior_college_national: '短大国立',
  junior_college_private: '短大私立',
  national_medical: '国立医（6年）',
  national_other: '国立他',
  private_liberal_arts: '私立文系',
  private_science: '私立理系',
  private_medical: '私立医（6年）',
  graduate_national_medical: '国立医',
  graduate_national_other: '国立他',
  graduate_private_liberal_arts: '私立文系',
  graduate_private_science: '私立理系',
  graduate_private_medical: '私立医',
  national: '国立',
  licensed_childcare: '認可保育',
  unlicensed_childcare: '未認可保育',
};

const HIGH_SCHOOL_TYPE_OPTIONS: SchoolType[] = [
  'public',
  'private',
  'part_time_public',
  'part_time_private',
  'correspondence_public',
  'correspondence_private',
  'technical_college_public',
  'technical_college_private',
];

const UNIVERSITY_TYPE_OPTIONS: SchoolType[] = [
  'junior_college_national',
  'junior_college_private',
  'national_medical',
  'national_other',
  'private_liberal_arts',
  'private_science',
  'private_medical',
];

const LEGACY_UNIVERSITY_SCHOOL_TYPE_MAP: Partial<
  Record<SchoolType, SchoolType>
> = {
  national: 'national_other',
  public: 'national_other',
  private: 'private_liberal_arts',
};

const GRADUATE_TYPE_OPTIONS: SchoolType[] = [
  'graduate_national_medical',
  'graduate_national_other',
  'graduate_private_liberal_arts',
  'graduate_private_science',
  'graduate_private_medical',
];

const LEGACY_GRADUATE_SCHOOL_TYPE_MAP: Partial<Record<SchoolType, SchoolType>> =
  {
    national: 'graduate_national_other',
    public: 'graduate_national_other',
    private: 'graduate_private_liberal_arts',
    national_medical: 'graduate_national_medical',
    national_other: 'graduate_national_other',
    private_liberal_arts: 'graduate_private_liberal_arts',
    private_science: 'graduate_private_science',
    private_medical: 'graduate_private_medical',
  };

const SCHOOL_CATEGORY_ORDER: SchoolCategory[] = [
  'nursery',
  'kindergarten',
  'elementary',
  'junior_high',
  'high_school',
  'university',
  'graduate',
  'other',
];

export const TUITION_PAYMENT_CYCLE_LABELS: Record<TuitionPaymentCycle, string> = {
  monthly: '毎月',
  yearly: '毎年',
  semiannual: '半年ごと',
};

export const OTHER_EXPENSE_PAYMENT_CYCLE_LABELS: Record<
  OtherExpensePaymentCycle,
  string
> = {
  monthly: '月額',
  yearly: '年額',
};

export const OTHER_EXPENSE_PAYMENT_OPTIONS = (
  Object.entries(OTHER_EXPENSE_PAYMENT_CYCLE_LABELS) as [
    OtherExpensePaymentCycle,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export const SCHOOL_CATEGORY_OPTIONS = SCHOOL_CATEGORY_ORDER.map((value) => ({
  value,
  label: SCHOOL_CATEGORY_LABELS[value],
}));

function toSchoolTypeOptions(
  types: SchoolType[],
): { value: SchoolType; label: string }[] {
  return types.map((value) => ({
    value,
    label: SCHOOL_TYPE_LABELS[value],
  }));
}

export function getSchoolTypeOptions(
  category: SchoolCategory,
): { value: SchoolType; label: string }[] {
  if (category === 'nursery') {
    return toSchoolTypeOptions(['licensed_childcare', 'unlicensed_childcare']);
  }

  if (category === 'kindergarten') {
    return toSchoolTypeOptions([
      'public',
      'private',
      'licensed_childcare',
      'unlicensed_childcare',
    ]);
  }

  if (category === 'graduate') {
    return toSchoolTypeOptions(GRADUATE_TYPE_OPTIONS);
  }

  if (category === 'university') {
    return toSchoolTypeOptions(UNIVERSITY_TYPE_OPTIONS);
  }

  if (category === 'high_school') {
    return toSchoolTypeOptions(HIGH_SCHOOL_TYPE_OPTIONS);
  }

  return toSchoolTypeOptions(['public', 'private']);
}

export function getDefaultSchoolType(category: SchoolCategory): SchoolType {
  return getSchoolTypeOptions(category)[0].value;
}

export function resolveSchoolType(
  category: SchoolCategory,
  schoolType: SchoolType,
): SchoolType {
  const options = getSchoolTypeOptions(category);
  if (options.some((opt) => opt.value === schoolType)) {
    return schoolType;
  }

  if (category === 'university') {
    return (
      LEGACY_UNIVERSITY_SCHOOL_TYPE_MAP[schoolType] ??
      getDefaultSchoolType(category)
    );
  }

  if (category === 'graduate') {
    return (
      LEGACY_GRADUATE_SCHOOL_TYPE_MAP[schoolType] ??
      getDefaultSchoolType(category)
    );
  }

  return getDefaultSchoolType(category);
}

export function getSchoolNamePlaceholder(category: SchoolCategory): string {
  return category === 'nursery' || category === 'kindergarten'
    ? '施設名'
    : '学校名';
}

export const UNIVERSITY_HOUSING_TYPE_LABELS: Record<
  UniversityHousingType,
  string
> = {
  home_commute: '自宅通学',
  dorm_apartment: '寮・アパート',
};

export const DEFAULT_UNIVERSITY_HOUSING_TYPE: UniversityHousingType =
  'home_commute';

export const UNIVERSITY_HOUSING_TYPE_OPTIONS = (
  Object.entries(UNIVERSITY_HOUSING_TYPE_LABELS) as [
    UniversityHousingType,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export function resolveUniversityHousingType(
  category: SchoolCategory,
  housingType?: UniversityHousingType,
): UniversityHousingType | undefined {
  if (category !== 'university' && category !== 'graduate') {
    return undefined;
  }
  return housingType ?? DEFAULT_UNIVERSITY_HOUSING_TYPE;
}

export const GRADUATE_PROGRAM_TYPE_LABELS: Record<GraduateProgramType, string> =
  {
    masters: '修士課程',
    doctoral: '博士課程',
    working_adult: '社会人入学',
  };

export const DEFAULT_GRADUATE_PROGRAM_TYPE: GraduateProgramType = 'masters';

export const GRADUATE_PROGRAM_TYPE_OPTIONS = (
  Object.entries(GRADUATE_PROGRAM_TYPE_LABELS) as [GraduateProgramType, string][]
).map(([value, label]) => ({ value, label }));

export function resolveGraduateProgramType(
  category: SchoolCategory,
  programType?: GraduateProgramType,
): GraduateProgramType | undefined {
  if (category !== 'graduate') {
    return undefined;
  }
  return programType ?? DEFAULT_GRADUATE_PROGRAM_TYPE;
}
