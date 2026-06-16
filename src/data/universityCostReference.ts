import type { SchoolType, UniversityHousingType } from '../types/education';

export interface UniversityCostLineItem {
  label: string;
  amount: number;
  paymentCycle: 'monthly' | 'yearly';
  /** 在籍期間内の何年目か（1始まり）。0または未指定は毎年 */
  enrollmentYear?: number;
}

export interface UniversityEducationBreakdown {
  label: string;
  annualAmount: number;
}

export type UniversityReferenceBasis = 'mext_survey' | 'statutory' | 'estimated';

/**
 * 大学の費用スケジュール。
 * 学費: 文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」
 *       国立大学等の授業料その他の費用に関する省令（標準額）
 * 生活費: 全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）
 */
export interface UniversityFeeSchedule {
  entranceFee: number;
  tuitionAnnual: number;
  otherExpenses: UniversityCostLineItem[];
  schoolEducationBreakdown: UniversityEducationBreakdown[];
  sourceLabel: string;
  referenceBasis: UniversityReferenceBasis;
}

// ─── 生活費（大学生協 第61回学生生活実態調査・2025年） ─────────────────
// 自宅生: 月額支出 70,760円
// 下宿生: 月額支出 138,070円、引っ越し費用 116,900円（初年度）

export function getLivingExpenses(
  housingType: UniversityHousingType,
): UniversityCostLineItem[] {
  if (housingType === 'home_commute') {
    return [
      {
        label: '生活費（自宅通学・全国平均）',
        amount: 70_760,
        paymentCycle: 'monthly',
      },
    ];
  }

  return [
    {
      label: '生活費（一人暮らし・全国平均）',
      amount: 138_070,
      paymentCycle: 'monthly',
    },
    {
      label: '引っ越し費用（初年度のみ）',
      amount: 116_900,
      paymentCycle: 'yearly',
      enrollmentYear: 1,
    },
  ];
}

// ─── 短大国立（公立短大平均・令和6年度） ─────────────────────────────
// 出典: 文部科学省「公立短期大学授業料等」昼間部平均

const JUNIOR_COLLEGE_NATIONAL_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料（公立短大平均）', annualAmount: 388_410 },
  { label: '教材・実習費（推計）', annualAmount: 25_000 },
];

const JUNIOR_COLLEGE_NATIONAL: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 219_650,
  tuitionAnnual: 388_410,
  schoolEducationBreakdown: JUNIOR_COLLEGE_NATIONAL_EDUCATION,
  sourceLabel:
    '短大国立（公立短期大学授業料等・令和6年度平均＋生活費は大学生協調査）',
  referenceBasis: 'statutory',
};

// ─── 短大私立（令和5年度・文科省調査） ─────────────────────────────

const JUNIOR_COLLEGE_PRIVATE_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料', annualAmount: 729_069 },
  { label: '施設設備費', annualAmount: 163_836 },
  { label: '実験実習料', annualAmount: 42_229 },
  { label: 'その他学校納付金', annualAmount: 101_732 },
];

const JUNIOR_COLLEGE_PRIVATE: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 237_122,
  tuitionAnnual: 729_069,
  schoolEducationBreakdown: JUNIOR_COLLEGE_PRIVATE_EDUCATION,
  sourceLabel:
    '短大私立（文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」＋生活費は大学生協調査）',
  referenceBasis: 'mext_survey',
};

// ─── 国立他（省令標準額・4年） ─────────────────────────────────────

const NATIONAL_OTHER_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料（省令標準額）', annualAmount: 535_800 },
  { label: '教材・実習費（推計）', annualAmount: 50_000 },
];

const NATIONAL_OTHER: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 282_000,
  tuitionAnnual: 535_800,
  schoolEducationBreakdown: NATIONAL_OTHER_EDUCATION,
  sourceLabel:
    '国立他（国立大学等の授業料省令標準額＋生活費は大学生協調査）',
  referenceBasis: 'statutory',
};

// ─── 国立医（省令標準額・6年） ─────────────────────────────────────

const NATIONAL_MEDICAL_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料（省令標準額）', annualAmount: 535_800 },
  { label: '教材・実習費（推計）', annualAmount: 120_000 },
];

const NATIONAL_MEDICAL: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 282_000,
  tuitionAnnual: 535_800,
  schoolEducationBreakdown: NATIONAL_MEDICAL_EDUCATION,
  sourceLabel:
    '国立医（国立大学等の授業料省令標準額＋生活費は大学生協調査）',
  referenceBasis: 'statutory',
};

// ─── 私立文系（令和5年度・文科省調査） ─────────────────────────────

const PRIVATE_LIBERAL_ARTS_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料', annualAmount: 827_135 },
  { label: '施設設備費', annualAmount: 143_838 },
  { label: '教材・実習費（推計）', annualAmount: 30_000 },
];

const PRIVATE_LIBERAL_ARTS: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 223_867,
  tuitionAnnual: 827_135,
  schoolEducationBreakdown: PRIVATE_LIBERAL_ARTS_EDUCATION,
  sourceLabel:
    '私立文系（文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」＋生活費は大学生協調査）',
  referenceBasis: 'mext_survey',
};

// ─── 私立理系（令和5年度・文科省調査） ─────────────────────────────

const PRIVATE_SCIENCE_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料', annualAmount: 1_162_738 },
  { label: '施設設備費', annualAmount: 132_956 },
  { label: '教材・実習費（推計）', annualAmount: 80_000 },
];

const PRIVATE_SCIENCE: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 234_756,
  tuitionAnnual: 1_162_738,
  schoolEducationBreakdown: PRIVATE_SCIENCE_EDUCATION,
  sourceLabel:
    '私立理系（文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」＋生活費は大学生協調査）',
  referenceBasis: 'mext_survey',
};

// ─── 私立医（令和5年度・文科省調査・6年） ───────────────────────────

const PRIVATE_MEDICAL_EDUCATION: UniversityEducationBreakdown[] = [
  { label: '授業料', annualAmount: 2_863_713 },
  { label: '施設設備費', annualAmount: 885_660 },
  { label: '教材・実習費（推計）', annualAmount: 150_000 },
];

const PRIVATE_MEDICAL: Omit<UniversityFeeSchedule, 'otherExpenses'> = {
  entranceFee: 1_077_425,
  tuitionAnnual: 2_863_713,
  schoolEducationBreakdown: PRIVATE_MEDICAL_EDUCATION,
  sourceLabel:
    '私立医（文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」＋生活費は大学生協調査）',
  referenceBasis: 'mext_survey',
};

const UNIVERSITY_BASE_SCHEDULES: Partial<
  Record<SchoolType, Omit<UniversityFeeSchedule, 'otherExpenses'>>
> = {
  junior_college_national: JUNIOR_COLLEGE_NATIONAL,
  junior_college_private: JUNIOR_COLLEGE_PRIVATE,
  national_other: NATIONAL_OTHER,
  national_medical: NATIONAL_MEDICAL,
  private_liberal_arts: PRIVATE_LIBERAL_ARTS,
  private_science: PRIVATE_SCIENCE,
  private_medical: PRIVATE_MEDICAL,
};

function buildSchoolOtherExpenses(
  base: Omit<UniversityFeeSchedule, 'otherExpenses'>,
): UniversityCostLineItem[] {
  const items: UniversityCostLineItem[] = [];

  for (const item of base.schoolEducationBreakdown) {
    if (item.label.startsWith('授業料')) continue;
    items.push({
      label: item.label,
      amount: item.annualAmount,
      paymentCycle: 'yearly',
    });
  }

  return items;
}

function assembleSchedule(
  base: Omit<UniversityFeeSchedule, 'otherExpenses'>,
  housingType: UniversityHousingType,
): UniversityFeeSchedule {
  return {
    ...base,
    otherExpenses: [
      ...buildSchoolOtherExpenses(base),
      ...getLivingExpenses(housingType),
    ],
  };
}

export function isNationalUniversityType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'national_other' ||
    schoolType === 'national_medical' ||
    schoolType === 'junior_college_national'
  );
}

export function isMedicalUniversityType(schoolType: SchoolType): boolean {
  return schoolType === 'national_medical' || schoolType === 'private_medical';
}

export function getUniversityFeeSchedule(
  schoolType: SchoolType,
  housingType: UniversityHousingType,
): UniversityFeeSchedule {
  const base =
    UNIVERSITY_BASE_SCHEDULES[schoolType] ?? NATIONAL_OTHER;
  return assembleSchedule(base, housingType);
}

export function buildUniversityFetchedAmounts(
  schedule: UniversityFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: UniversityCostLineItem[];
} {
  return {
    tuitionAnnual: schedule.tuitionAnnual,
    otherExpenses: [...schedule.otherExpenses],
  };
}
