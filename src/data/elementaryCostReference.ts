import type { SchoolType } from '../types/education';

export interface ElementaryCostLineItem {
  label: string;
  amount: number;
  paymentCycle: 'monthly' | 'yearly';
}

/** 学校教育費の内訳（文部科学省調査・年間平均） */
export interface ElementarySchoolEducationBreakdown {
  label: string;
  annualAmount: number;
}

/**
 * 小学校の費用スケジュール。
 * 出典: 文部科学省「子供の学習費調査（令和5年度）」
 * 学校教育費・学校給食費のみ（学校外活動費は含まない）。
 */
export interface ElementaryFeeSchedule {
  entranceFee: number;
  tuitionAnnual: number;
  lunchAnnual: number;
  otherExpenses: ElementaryCostLineItem[];
  schoolEducationBreakdown: ElementarySchoolEducationBreakdown[];
  sourceLabel: string;
}

// ─── 令和5年度・全国平均（文部科学省「子供の学習費調査」） ────────────
//
// 公立小学校
//   学校教育費:   74,336円/年（授業料0円を含む）
//   学校給食費:   35,774円/年
//   学校外活動費: 256,000円/年（令和5年度推計）
//     補助学習費（塾・通信教育等）: 令和3年度 166,729円/年
//     その他学校外活動費（習い事等）: 令和3年度  80,853円/年
//
// 私立小学校
//   学校教育費:  978,271円/年（授業料 510,823円 を含む）
//   学校給食費:   53,578円/年
//   学校外活動費: 710,000円/年（令和5年度推計）
//     補助学習費（塾・通信教育等）: 令和5年度 366,000円/年（推計）
//     その他学校外活動費（習い事等）: 令和5年度 344,000円/年（推計）
//
// ─── 学校教育費の内訳（令和3年度詳細データ） ──────────────────────────
//
// 公立小学校 学校教育費内訳（合計 74,336円）
//   入学金等（年平均） :     526円（入学時費用を6年で割った値。通学関係費に含まれる）
//   修学旅行費等       :   6,718円
//   学校納付金等       :   9,533円（PTA・学級費等）
//   図書・学用品等     :  26,860円
//   教科外活動費       :   3,154円
//   通学関係費         :  21,718円（ランドセル・制服・交通費等。初年度に集中）
//   その他             :   5,827円
//
// 私立小学校 学校教育費内訳（合計 978,271円）
//   入学金等（年平均） :  62,402円（入学時費用を6年で割った値）
//   授業料             : 510,823円
//   修学旅行費等       :  36,799円
//   施設整備費・納付金等: 168,731円
//   図書・学用品等     :  61,830円
//   教科外活動費       :  13,032円
//   通学関係費         : 111,053円（制服・通学費等）
//   その他             :  13,601円

const PUBLIC_SCHOOL_EDUCATION: ElementarySchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・通学関係費に含まれる）', annualAmount: 526 },
  { label: '修学旅行費・校外活動費', annualAmount: 6_718 },
  { label: '学校納付金（PTA・学級費等）', annualAmount: 9_533 },
  { label: '教材・学用品・実習材料費', annualAmount: 26_860 },
  { label: '教科外活動費', annualAmount: 3_154 },
  { label: '通学関係費（ランドセル・制服・交通費等）', annualAmount: 21_718 },
  { label: 'その他学校教育費', annualAmount: 5_827 },
];

const PRIVATE_SCHOOL_EDUCATION: ElementarySchoolEducationBreakdown[] = [
  { label: '入学金等（年平均）', annualAmount: 62_402 },
  { label: '授業料', annualAmount: 510_823 },
  { label: '修学旅行費・校外活動費', annualAmount: 36_799 },
  { label: '施設整備費・学校納付金等', annualAmount: 168_731 },
  { label: '教材・学用品・実習材料費', annualAmount: 61_830 },
  { label: '教科外活動費', annualAmount: 13_032 },
  { label: '通学関係費（制服・通学費等）', annualAmount: 111_053 },
  { label: 'その他学校教育費', annualAmount: 13_601 },
];

// 学校外活動費（令和3年度・全国平均）
// ─────────────────────────────────────────────────
// 公立:  補助学習費 166,729円/年 → 13,894円/月 ≈ 13,900円/月
//        その他活動費  80,853円/年 →  6,738円/月 ≈  6,700円/月
//
// 私立:  補助学習費・その他の調査詳細内訳が未公表のため
//        学習費総額（令和5年度 710,000円/年）から按分推計
//        補助学習費 366,000円/年 → 30,500円/月（推計）
//        その他活動費 344,000円/年 → 28,700円/月（推計）

const PUBLIC_EXTRACURRICULAR: ElementaryCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 13_900,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 6_700,
    paymentCycle: 'monthly',
  },
];

const PRIVATE_EXTRACURRICULAR: ElementaryCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 30_500,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 28_700,
    paymentCycle: 'monthly',
  },
];

// 公立小学校（令和5年度）
// 授業料・入学金なし。教材費・給食費・修学旅行費等が毎年かかる。
const PUBLIC_ELEMENTARY: ElementaryFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 0,
  lunchAnnual: 35_774,
  otherExpenses: [
    {
      label: '学校給食費',
      amount: Math.round(35_774 / 12), // 2,981円/月
      paymentCycle: 'monthly',
    },
    {
      label: '学校教育費（教材・修学旅行等）',
      amount: 74_336,
      paymentCycle: 'yearly',
    },
    ...PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PUBLIC_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・公立（文部科学省「子供の学習費調査」令和5年度）',
};

// 私立小学校（令和5年度）
// 授業料は月払いが一般的。入学金は学校により大きく異なるため省略。
const PRIVATE_ELEMENTARY: ElementaryFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 510_823,
  lunchAnnual: 53_578,
  otherExpenses: [
    {
      label: '学校給食費',
      amount: Math.round(53_578 / 12), // 4,465円/月
      paymentCycle: 'monthly',
    },
    {
      label: '施設整備費・学校納付金等',
      amount: Math.round(168_731 / 12), // 14,061円/月
      paymentCycle: 'monthly',
    },
    {
      label: '教材・修学旅行・活動費等',
      amount: Math.round((61_830 + 36_799 + 13_032 + 13_601) / 12), // 10,439円/月
      paymentCycle: 'monthly',
    },
    {
      label: '通学関係費（制服・交通費等）',
      amount: Math.round(111_053 / 12), // 9,254円/月
      paymentCycle: 'monthly',
    },
    ...PRIVATE_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PRIVATE_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・私立（文部科学省「子供の学習費調査」令和5年度）',
};

export function getElementaryFeeSchedule(
  schoolType: SchoolType,
): ElementaryFeeSchedule {
  return schoolType === 'private' ? PRIVATE_ELEMENTARY : PUBLIC_ELEMENTARY;
}

export function buildElementaryFetchedAmounts(
  schedule: ElementaryFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: ElementaryCostLineItem[];
} {
  return {
    tuitionAnnual: schedule.tuitionAnnual,
    otherExpenses: [...schedule.otherExpenses],
  };
}
