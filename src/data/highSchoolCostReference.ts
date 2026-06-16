import type { SchoolType } from '../types/education';

export interface HighSchoolCostLineItem {
  label: string;
  amount: number;
  paymentCycle: 'monthly' | 'yearly';
}

/** 学校教育費の内訳（文部科学省調査・年間平均） */
export interface HighSchoolEducationBreakdown {
  label: string;
  annualAmount: number;
}

export type HighSchoolReferenceBasis =
  | 'mext_full_time'
  | 'statutory'
  | 'estimated';

/**
 * 高等学校の費用スケジュール。
 * 全日制: 文部科学省「子供の学習費調査（令和5年度）」
 * 定時制・通信制・高専: 標準額または全日制データをベースにした推計
 */
export interface HighSchoolFeeSchedule {
  entranceFee: number;
  tuitionAnnual: number;
  otherExpenses: HighSchoolCostLineItem[];
  schoolEducationBreakdown: HighSchoolEducationBreakdown[];
  sourceLabel: string;
  referenceBasis: HighSchoolReferenceBasis;
}

// ─── 全日制（令和5年度・学習費調査） ─────────────────────────────────

const PUBLIC_SCHOOL_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 18_027 },
  { label: '授業料（就学支援金後・全国平均）', annualAmount: 45_272 },
  { label: '修学旅行費・校外活動費', annualAmount: 36_500 },
  { label: '学校納付金（PTA・生徒会等）', annualAmount: 35_630 },
  { label: '教材・学用品・実習材料費', annualAmount: 62_284 },
  { label: '教科外活動費（部活動等）', annualAmount: 49_499 },
  { label: '通学関係費（制服・交通費等）', annualAmount: 97_634 },
  { label: 'その他学校教育費', annualAmount: 6_677 },
];

const PRIVATE_SCHOOL_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 80_290 },
  { label: '授業料（就学支援金後・全国平均）', annualAmount: 279_170 },
  { label: '修学旅行費・校外活動費', annualAmount: 62_778 },
  { label: '施設整備費・学校納付金等', annualAmount: 127_346 },
  { label: '教材・学用品・実習材料費', annualAmount: 73_312 },
  { label: '教科外活動費', annualAmount: 63_440 },
  { label: '通学関係費（制服・交通費等）', annualAmount: 136_790 },
  { label: 'その他学校教育費', annualAmount: 9_524 },
];

const PUBLIC_EXTRACURRICULAR: HighSchoolCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 16_800,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 3_600,
    paymentCycle: 'monthly',
  },
];

const PRIVATE_EXTRACURRICULAR: HighSchoolCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 14_300,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 14_600,
    paymentCycle: 'monthly',
  },
];

const PUBLIC_HIGH_SCHOOL: HighSchoolFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 45_272,
  otherExpenses: [
    {
      label: '学校教育費（授業料除く：修学旅行・教材・部活等）',
      amount: 306_251,
      paymentCycle: 'yearly',
    },
    ...PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PUBLIC_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・公立全日制（文部科学省「子供の学習費調査」令和5年度）',
  referenceBasis: 'mext_full_time',
};

const PRIVATE_HIGH_SCHOOL: HighSchoolFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 279_170,
  otherExpenses: [
    {
      label: '施設整備費・学校納付金等',
      amount: Math.round(127_346 / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '修学旅行費・校外活動費・教材等',
      amount: Math.round((62_778 + 73_312 + 63_440 + 9_524) / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '通学関係費（制服・交通費等）',
      amount: Math.round(136_790 / 12),
      paymentCycle: 'monthly',
    },
    ...PRIVATE_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PRIVATE_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・私立全日制（文部科学省「子供の学習費調査」令和5年度）',
  referenceBasis: 'mext_full_time',
};

// ─── 定時制（標準額＋全日制公立の45%で推計） ─────────────────────────
//
// 授業料・入学料: 高等学校の定時制における標準額（都道府県共通）
//   授業料 32,400円/年、入学料 2,100円
// その他学校教育費: 学習費調査・全日制公立をベースに推計（通学・部活等を縮小）

const PART_TIME_PUBLIC_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 700 },
  { label: '授業料（標準額）', annualAmount: 32_400 },
  { label: '修学旅行費・校外活動費', annualAmount: 16_000 },
  { label: '学校納付金（PTA・生徒会等）', annualAmount: 16_000 },
  { label: '教材・学用品・実習材料費', annualAmount: 28_000 },
  { label: '教科外活動費（部活動等）', annualAmount: 22_000 },
  { label: '通学関係費（制服・交通費等）', annualAmount: 44_000 },
  { label: 'その他学校教育費', annualAmount: 3_000 },
];

const PART_TIME_PUBLIC_EXTRACURRICULAR: HighSchoolCostLineItem[] = [
  {
    label: '塾・通信教育費（参考値）',
    amount: 14_000,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（参考値）',
    amount: 3_000,
    paymentCycle: 'monthly',
  },
];

const PART_TIME_PUBLIC: HighSchoolFeeSchedule = {
  entranceFee: 2_100,
  tuitionAnnual: 32_400,
  otherExpenses: [
    {
      label: '学校教育費（授業料除く）',
      amount: 109_700,
      paymentCycle: 'yearly',
    },
    ...PART_TIME_PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PART_TIME_PUBLIC_EDUCATION,
  sourceLabel:
    '定時制公立（授業料標準額＋学習費調査全日制公立をベースに推計）',
  referenceBasis: 'estimated',
};

// 定時制私立: 授業料は学校差が大きい。全日制私立の約45%＋教材費を推計
const PART_TIME_PRIVATE_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 55_000 },
  { label: '授業料（推計・就学支援金適用後）', annualAmount: 380_000 },
  { label: '修学旅行費・校外活動費', annualAmount: 28_000 },
  { label: '施設整備費・学校納付金等', annualAmount: 57_000 },
  { label: '教材・学用品・実習材料費', annualAmount: 33_000 },
  { label: '教科外活動費', annualAmount: 28_500 },
  { label: '通学関係費（制服・交通費等）', annualAmount: 61_500 },
  { label: 'その他学校教育費', annualAmount: 4_300 },
];

const PART_TIME_PRIVATE: HighSchoolFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 380_000,
  otherExpenses: [
    {
      label: '施設整備費・学校納付金等',
      amount: Math.round(57_000 / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '修学旅行費・校外活動費・教材等',
      amount: Math.round((28_000 + 33_000 + 28_500 + 4_300) / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '通学関係費（制服・交通費等）',
      amount: Math.round(61_500 / 12),
      paymentCycle: 'monthly',
    },
    ...PRIVATE_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PART_TIME_PRIVATE_EDUCATION,
  sourceLabel:
    '定時制私立（学習費調査・全日制私立をベースに推計。授業料は学校により大きく異なります）',
  referenceBasis: 'estimated',
};

// ─── 通信制（195校調査・標準単価をベースに推計） ─────────────────────
//
// 公立: 25単位履修・単価336円程度、教材費等を加算（年間約4万円）
// 私立: 195校調査の3年平均（初年度710,000円・3年総額2,010,000円）をベースに推計

const CORRESPONDENCE_PUBLIC_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 167 },
  { label: '授業料（25単位履修・単価336円）', annualAmount: 8_400 },
  { label: '教材・学用品費', annualAmount: 25_000 },
  { label: 'スクーリング交通費・諸経費', annualAmount: 8_000 },
];

const CORRESPONDENCE_PUBLIC_EXTRACURRICULAR: HighSchoolCostLineItem[] = [
  {
    label: '塾・通信教育費（参考値）',
    amount: 12_000,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（参考値）',
    amount: 2_000,
    paymentCycle: 'monthly',
  },
];

const CORRESPONDENCE_PUBLIC: HighSchoolFeeSchedule = {
  entranceFee: 500,
  tuitionAnnual: 8_400,
  otherExpenses: [
    {
      label: '教材費・スクーリング諸経費',
      amount: 33_000,
      paymentCycle: 'yearly',
    },
    ...CORRESPONDENCE_PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: CORRESPONDENCE_PUBLIC_EDUCATION,
  sourceLabel:
    '通信制公立（標準単価・25単位履修をベースに推計。都道府県により異なります）',
  referenceBasis: 'estimated',
};

const CORRESPONDENCE_PRIVATE_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 19_333 },
  { label: '授業料（25単位履修・推計）', annualAmount: 250_000 },
  { label: '施設設備費', annualAmount: 35_000 },
  { label: '教材・学用品費', annualAmount: 45_000 },
  { label: '教育関連諸費（システム利用料等）', annualAmount: 20_000 },
];

const CORRESPONDENCE_PRIVATE: HighSchoolFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 250_000,
  otherExpenses: [
    {
      label: '施設設備費',
      amount: Math.round(35_000 / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '教材費・教育関連諸費',
      amount: Math.round((45_000 + 20_000) / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '塾・通信教育費（参考値）',
      amount: 10_000,
      paymentCycle: 'monthly',
    },
    {
      label: '習い事等（参考値）',
      amount: 3_000,
      paymentCycle: 'monthly',
    },
  ],
  schoolEducationBreakdown: CORRESPONDENCE_PRIVATE_EDUCATION,
  sourceLabel:
    '通信制私立（195校調査の平均学費をベースに推計。コースにより大きく異なります）',
  referenceBasis: 'estimated',
};

// ─── 高専（省令標準額＋実習・教材費を推計） ───────────────────────────
//
// 国立高等専門学校の授業料その他の費用に関する省令（平成16年文部科学省令第17号）
//   授業料 234,600円/年、入学料 84,600円
// 私立: 近畿大学工業高専等の公表額をベースに5年平均を推計

const TECHNICAL_COLLEGE_PUBLIC_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・5年按分）', annualAmount: 16_920 },
  { label: '授業料（省令標準額）', annualAmount: 234_600 },
  { label: '教材・実習材料費', annualAmount: 90_000 },
  { label: '研修・実習交通費', annualAmount: 35_000 },
  { label: '諸会費・消耗品', annualAmount: 25_000 },
  { label: '通学関係費', annualAmount: 60_000 },
  { label: 'その他学校教育費', annualAmount: 10_000 },
];

const TECHNICAL_COLLEGE_PUBLIC_EXTRACURRICULAR: HighSchoolCostLineItem[] = [
  {
    label: '塾・通信教育費（参考値）',
    amount: 8_000,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（参考値）',
    amount: 3_000,
    paymentCycle: 'monthly',
  },
];

const TECHNICAL_COLLEGE_PUBLIC: HighSchoolFeeSchedule = {
  entranceFee: 84_600,
  tuitionAnnual: 234_600,
  otherExpenses: [
    {
      label: '教材・実習・諸会費等（授業料除く）',
      amount: 220_000,
      paymentCycle: 'yearly',
    },
    ...TECHNICAL_COLLEGE_PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: TECHNICAL_COLLEGE_PUBLIC_EDUCATION,
  sourceLabel:
    '高専公立（国立高等専門学校の授業料省令標準額＋教材・実習費を推計）',
  referenceBasis: 'statutory',
};

const TECHNICAL_COLLEGE_PRIVATE_EDUCATION: HighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・5年按分）', annualAmount: 40_000 },
  { label: '授業料（5年平均・推計）', annualAmount: 746_000 },
  { label: '教材・実習材料費', annualAmount: 120_000 },
  { label: '研修・実習交通費', annualAmount: 45_000 },
  { label: '諸会費・施設費', annualAmount: 50_000 },
  { label: '通学関係費', annualAmount: 70_000 },
  { label: 'その他学校教育費', annualAmount: 15_000 },
];

const TECHNICAL_COLLEGE_PRIVATE: HighSchoolFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 746_000,
  otherExpenses: [
    {
      label: '施設費・諸会費',
      amount: Math.round(50_000 / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '教材・実習・研修費等',
      amount: Math.round((120_000 + 45_000 + 15_000) / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '通学関係費',
      amount: Math.round(70_000 / 12),
      paymentCycle: 'monthly',
    },
    {
      label: '塾・通信教育費（参考値）',
      amount: 10_000,
      paymentCycle: 'monthly',
    },
    {
      label: '習い事等（参考値）',
      amount: 5_000,
      paymentCycle: 'monthly',
    },
  ],
  schoolEducationBreakdown: TECHNICAL_COLLEGE_PRIVATE_EDUCATION,
  sourceLabel:
    '高専私立（公表額をベースに5年平均を推計。学校・学年により大きく異なります）',
  referenceBasis: 'estimated',
};

const HIGH_SCHOOL_SCHEDULES: Partial<Record<SchoolType, HighSchoolFeeSchedule>> =
  {
    public: PUBLIC_HIGH_SCHOOL,
    private: PRIVATE_HIGH_SCHOOL,
    part_time_public: PART_TIME_PUBLIC,
    part_time_private: PART_TIME_PRIVATE,
    correspondence_public: CORRESPONDENCE_PUBLIC,
    correspondence_private: CORRESPONDENCE_PRIVATE,
    technical_college_public: TECHNICAL_COLLEGE_PUBLIC,
    technical_college_private: TECHNICAL_COLLEGE_PRIVATE,
  };

export function isPublicHighSchoolType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'public' ||
    schoolType === 'part_time_public' ||
    schoolType === 'correspondence_public' ||
    schoolType === 'technical_college_public'
  );
}

export function getHighSchoolFeeSchedule(
  schoolType: SchoolType,
): HighSchoolFeeSchedule {
  return HIGH_SCHOOL_SCHEDULES[schoolType] ?? PUBLIC_HIGH_SCHOOL;
}

export function buildHighSchoolFetchedAmounts(
  schedule: HighSchoolFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: HighSchoolCostLineItem[];
} {
  return {
    tuitionAnnual: schedule.tuitionAnnual,
    otherExpenses: [...schedule.otherExpenses],
  };
}
