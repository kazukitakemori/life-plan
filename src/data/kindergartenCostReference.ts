import type { SchoolType } from '../types/education';

/**
 * 幼児教育・保育の無償化補助上限（公立・私立幼稚園・月額・円）。
 * 出典: 子ども・子育て支援法 施行令（令和元年10月〜）
 */
export const KINDERGARTEN_SUBSIDY_CAP_YEN = 25_700;

export interface KindergartenCostLineItem {
  label: string;
  monthlyAmount: number;
}

/**
 * 幼稚園の費用スケジュール。
 * monthlyGrossTuition: 施設への月額支払い総額（補助前）。
 * subsidyCap: 無償化補助の月額上限（公立・私立・認可のみ）。
 * subsidyIsGuaranteed:
 *   true  → 補助は確定受給 → tuitionAnnual = max(0, gross − cap) × 12
 *   false → 補助は条件付き（認可外等）→ tuitionAnnual = gross × 12 そのまま
 */
export interface KindergartenFeeSchedule {
  entranceFee: number;
  monthlyGrossTuition: number;
  subsidyCap: number;
  subsidyIsGuaranteed: boolean;
  otherExpenses: KindergartenCostLineItem[];
  sourceLabel: string;
}

// ─── 全国平均参考値 ────────────────────────────────────────────────
//
// 出典: 文部科学省「子供の学習費調査（令和3年度）」
//       幼稚園・認定こども園の在園者に係る利用者負担額（令和6年度）
//
// 公立幼稚園:
//   月額保育料 ~16,000円 → 無償化（上限25,700円）で自己負担0円
//   実費: 教材・用品費 ~3,500円/月、給食費なし（弁当が主流）
//   学校外活動費（令和3年度平均 ~100,000円/年）:
//     補助学習費（塾・通信教育等）~3,000円/月、習い事等 ~5,500円/月
//
// 私立幼稚園:
//   月額保育料 ~27,500円（全国平均）→ 補助後超過分 ~1,800円/月
//   実費: 教材・施設費 ~6,000円/月、給食費 ~5,000円/月
//   学校外活動費（令和3年度平均 ~160,000円/年）:
//     補助学習費（塾・通信教育等）~3,700円/月、習い事等 ~9,700円/月
//
// 認可（認定こども園 2号認定）:
//   3歳以上は幼児教育無償化 → 0円
//   実費: おかず・おやつ代 ~4,500円/月、学校外活動費は公立幼稚園準拠
//
// 認可外:
//   月額総額 ~50,000円 → 補助（37,000円）後超過分 ~13,000円/月
//   実費: おかず・おやつ代 ~5,000円/月、学校外活動費は公立幼稚園準拠
// ─────────────────────────────────────────────────────────────────

// 学校外活動費（公立・認可・認可外共通）
const EXTRACURRICULAR_PUBLIC: KindergartenCostLineItem[] = [
  { label: '塾・通信教育費（全国平均・参考値）', monthlyAmount: 3_000 },
  { label: '習い事等（全国平均・参考値）', monthlyAmount: 5_500 },
];

// 学校外活動費（私立）
const EXTRACURRICULAR_PRIVATE: KindergartenCostLineItem[] = [
  { label: '塾・通信教育費（全国平均・参考値）', monthlyAmount: 3_700 },
  { label: '習い事等（全国平均・参考値）', monthlyAmount: 9_700 },
];

const PUBLIC_NATIONAL: KindergartenFeeSchedule = {
  entranceFee: 5_500,
  monthlyGrossTuition: 16_000,
  subsidyCap: KINDERGARTEN_SUBSIDY_CAP_YEN,
  subsidyIsGuaranteed: true,
  otherExpenses: [
    { label: '教材・用品費（実費）', monthlyAmount: 3_500 },
    ...EXTRACURRICULAR_PUBLIC,
  ],
  sourceLabel: '全国平均・公立（文部科学省調査）',
};

const PRIVATE_NATIONAL: KindergartenFeeSchedule = {
  entranceFee: 65_000,
  monthlyGrossTuition: 27_500,
  subsidyCap: KINDERGARTEN_SUBSIDY_CAP_YEN,
  subsidyIsGuaranteed: true,
  otherExpenses: [
    { label: '教材・施設費（実費）', monthlyAmount: 6_000 },
    { label: '給食費（実費）', monthlyAmount: 5_000 },
    ...EXTRACURRICULAR_PRIVATE,
  ],
  sourceLabel: '全国平均・私立（文部科学省調査）',
};

// 認定こども園（認可型）3歳以上：2号認定で幼児教育無償化
const LICENSED_NATIONAL: KindergartenFeeSchedule = {
  entranceFee: 0,
  monthlyGrossTuition: 0,
  subsidyCap: KINDERGARTEN_SUBSIDY_CAP_YEN,
  subsidyIsGuaranteed: true,
  otherExpenses: [
    { label: 'おかず・おやつ代', monthlyAmount: 4_500 },
    ...EXTRACURRICULAR_PUBLIC,
  ],
  sourceLabel: '全国（認定こども園・認可型・2号認定無償化）',
};

// 認可外施設（幼稚園的機能）3歳以上。
// 無償化補助（上限37,000円/月）は市区町村の認定が条件のため補助なしで計算する。
const UNLICENSED_NATIONAL: KindergartenFeeSchedule = {
  entranceFee: 50_000,
  monthlyGrossTuition: 50_000,
  subsidyCap: 0,
  subsidyIsGuaranteed: false,
  otherExpenses: [
    { label: 'おかず・おやつ代', monthlyAmount: 5_000 },
    ...EXTRACURRICULAR_PUBLIC,
  ],
  sourceLabel: '全国平均（認可外・補助なしで試算）',
};

export function getKindergartenFeeSchedule(
  schoolType: SchoolType,
): KindergartenFeeSchedule {
  switch (schoolType) {
    case 'public':
      return PUBLIC_NATIONAL;
    case 'private':
      return PRIVATE_NATIONAL;
    case 'licensed_childcare':
      return LICENSED_NATIONAL;
    case 'unlicensed_childcare':
      return UNLICENSED_NATIONAL;
    default:
      return PUBLIC_NATIONAL;
  }
}

/**
 * 幼稚園の費用組み立て。
 *
 * 補助が確定している施設（公立・私立・認可）:
 *   授業料 = max(0, 月額総額 − 補助上限) × 12
 *   超過分があればその他費用に追加する。
 *
 * 補助が条件付きの施設（認可外）:
 *   補助なしで計算し、施設への月額支払い総額をそのまま授業料とする。
 */
export function buildKindergartenFetchedAmounts(
  schedule: KindergartenFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: KindergartenCostLineItem[];
} {
  const otherExpenses: KindergartenCostLineItem[] = [...schedule.otherExpenses];

  if (!schedule.subsidyIsGuaranteed) {
    return {
      tuitionAnnual: schedule.monthlyGrossTuition * 12,
      otherExpenses,
    };
  }

  const excessMonthly = Math.max(
    0,
    schedule.monthlyGrossTuition - schedule.subsidyCap,
  );
  const tuitionAnnual = excessMonthly * 12;

  if (excessMonthly > 0) {
    const capMan = Math.round(schedule.subsidyCap / 1_000) / 10;
    otherExpenses.push({
      label: `無償化補助額（${capMan}万円）を超えた分の保育料`,
      monthlyAmount: excessMonthly,
    });
  }

  return { tuitionAnnual, otherExpenses };
}
