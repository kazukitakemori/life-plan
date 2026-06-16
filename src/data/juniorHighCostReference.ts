import type { SchoolType } from '../types/education';

export interface JuniorHighCostLineItem {
  label: string;
  amount: number;
  paymentCycle: 'monthly' | 'yearly';
}

/** 学校教育費の内訳（文部科学省調査・年間平均） */
export interface JuniorHighSchoolEducationBreakdown {
  label: string;
  annualAmount: number;
}

/**
 * 中学校の費用スケジュール。
 * 出典: 文部科学省「子供の学習費調査（令和5年度）」
 * 学校教育費・学校給食費のみ（学校外活動費は含まない）。
 */
export interface JuniorHighFeeSchedule {
  entranceFee: number;
  tuitionAnnual: number;
  lunchAnnual: number;
  otherExpenses: JuniorHighCostLineItem[];
  schoolEducationBreakdown: JuniorHighSchoolEducationBreakdown[];
  sourceLabel: string;
}

// ─── 令和5年度・全国平均（文部科学省「子供の学習費調査」） ────────────
//
// 公立中学校
//   学校教育費: 150,761円/年（授業料0円・義務教育）
//   学校給食費:  35,671円/年
//   学校外活動費（令和3年度）:
//     補助学習費（塾・通信教育等）: 243,653円/年 → 20,300円/月
//     その他学校外活動費（習い事等）:  67,204円/年 →  5,600円/月
//
// 私立中学校
//   学校教育費: 1,128,061円/年（授業料約498,000円を含む・令和5年度推計）
//   学校給食費:     9,317円/年
//   学校外活動費（令和3年度）:
//     補助学習費（塾・通信教育等）: 約254,000円/年 → 21,200円/月
//     その他学校外活動費（習い事等）: 約169,000円/年 → 14,100円/月
//
// ─── 学校教育費の内訳 ──────────────────────────────────────────────
//
// 公立中学校 学校教育費内訳（令和3年度・合計 139,870円）
//   ※令和5年度の合計は 150,761円。内訳は令和3年度データを使用。
//   授業料・入学金: 0円（義務教育無償）
//   修学旅行費等:      21,134円
//   学校納付金（PTA等）: 18,453円
//   図書・学用品等:    42,745円
//   教科外活動費（部活等）: 35,101円
//   通学関係費（制服・交通費等）: 14,681円
//   その他:             7,756円
//
// 私立中学校 学校教育費内訳（令和5年度推計・合計 1,128,061円）
//   令和3年度（970,153円）の比率を令和5年度総額にスケール
//   入学金等（年平均・3年で按分）:   82,700円
//   授業料:                         498,000円
//   修学旅行費等:                   113,800円
//   施設整備費・学校納付金等:       244,100円
//   図書・学用品等:                  79,500円
//   教科外活動費:                    44,800円
//   通学関係費（制服・通学費等）:    49,900円
//   その他:                          15,261円

const PUBLIC_SCHOOL_EDUCATION: JuniorHighSchoolEducationBreakdown[] = [
  { label: '修学旅行費・校外活動費', annualAmount: 21_134 },
  { label: '学校納付金（PTA・学級費等）', annualAmount: 18_453 },
  { label: '教材・学用品・実習材料費', annualAmount: 42_745 },
  { label: '教科外活動費（部活動等）', annualAmount: 35_101 },
  { label: '通学関係費（制服・交通費等）', annualAmount: 14_681 },
  { label: 'その他学校教育費', annualAmount: 7_756 },
];

const PRIVATE_SCHOOL_EDUCATION: JuniorHighSchoolEducationBreakdown[] = [
  { label: '入学金等（年平均・3年按分）', annualAmount: 82_700 },
  { label: '授業料', annualAmount: 498_000 },
  { label: '修学旅行費・校外活動費', annualAmount: 113_800 },
  { label: '施設整備費・学校納付金等', annualAmount: 244_100 },
  { label: '教材・学用品・実習材料費', annualAmount: 79_500 },
  { label: '教科外活動費', annualAmount: 44_800 },
  { label: '通学関係費（制服・通学費等）', annualAmount: 49_900 },
  { label: 'その他学校教育費', annualAmount: 15_261 },
];

// 学校外活動費（令和3年度・全国平均）
// ─────────────────────────────────────────────────
// 公立:  補助学習費 243,653円/年 → 20,304円/月 ≈ 20,300円/月
//        その他活動費  67,204円/年 →  5,600円/月
//
// 私立:  補助学習費  約254,000円/年 → 21,200円/月（令和3年度推計）
//        その他活動費 約169,000円/年 → 14,100円/月（令和3年度推計）

const PUBLIC_EXTRACURRICULAR: JuniorHighCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 20_300,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 5_600,
    paymentCycle: 'monthly',
  },
];

const PRIVATE_EXTRACURRICULAR: JuniorHighCostLineItem[] = [
  {
    label: '塾・通信教育費（全国平均）',
    amount: 21_200,
    paymentCycle: 'monthly',
  },
  {
    label: '習い事等（全国平均）',
    amount: 14_100,
    paymentCycle: 'monthly',
  },
];

// 公立中学校（令和5年度）
// 授業料・入学金なし。教材費・給食費・修学旅行費等が毎年かかる。
const PUBLIC_JUNIOR_HIGH: JuniorHighFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 0,
  lunchAnnual: 35_671,
  otherExpenses: [
    {
      label: '学校給食費',
      amount: Math.round(35_671 / 12), // 2,973円/月
      paymentCycle: 'monthly',
    },
    {
      label: '学校教育費（修学旅行・部活・教材等）',
      amount: 150_761,
      paymentCycle: 'yearly',
    },
    ...PUBLIC_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PUBLIC_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・公立（文部科学省「子供の学習費調査」令和5年度）',
};

// 私立中学校（令和5年度推計）
// 授業料は月払いが一般的。入学金は学校により大きく異なるため省略。
const PRIVATE_JUNIOR_HIGH: JuniorHighFeeSchedule = {
  entranceFee: 0,
  tuitionAnnual: 498_000,
  lunchAnnual: 9_317,
  otherExpenses: [
    {
      label: '学校給食費',
      amount: Math.round(9_317 / 12), // 776円/月
      paymentCycle: 'monthly',
    },
    {
      label: '施設整備費・学校納付金等',
      amount: Math.round(244_100 / 12), // 20,342円/月
      paymentCycle: 'monthly',
    },
    {
      label: '教材・修学旅行・活動費等',
      amount: Math.round((113_800 + 79_500 + 44_800 + 15_261) / 12), // 21,113円/月
      paymentCycle: 'monthly',
    },
    {
      label: '通学関係費（制服・交通費等）',
      amount: Math.round(49_900 / 12), // 4,158円/月
      paymentCycle: 'monthly',
    },
    ...PRIVATE_EXTRACURRICULAR,
  ],
  schoolEducationBreakdown: PRIVATE_SCHOOL_EDUCATION,
  sourceLabel: '全国平均・私立（文部科学省「子供の学習費調査」令和5年度推計）',
};

export function getJuniorHighFeeSchedule(
  schoolType: SchoolType,
): JuniorHighFeeSchedule {
  return schoolType === 'private' ? PRIVATE_JUNIOR_HIGH : PUBLIC_JUNIOR_HIGH;
}

export function buildJuniorHighFetchedAmounts(
  schedule: JuniorHighFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: JuniorHighCostLineItem[];
} {
  return {
    tuitionAnnual: schedule.tuitionAnnual,
    otherExpenses: [...schedule.otherExpenses],
  };
}
