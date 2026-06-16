import type { NurseryFeeTier } from '../lib/nurseryHouseholdIncome';
import type { SchoolType } from '../types/education';

/**
 * 認可外保育施設の無償化補助上限（月額・円）。
 * この補助は市区町村の認定が条件のため、費用計算には使用しない（参照値のみ）。
 */
export const NURSERY_MUNICIPAL_SUBSIDY_CAP_YEN = 37_000;

export interface NurseryCostLineItem {
  label: string;
  monthlyAmount: number;
}

/**
 * 保育園の費用スケジュール。
 *
 * monthlyTuition3go: 3号認定（0〜2歳）の月額保育料。D-tier 別に設定。
 * monthlyTuition2go: 2号認定（3歳以上）の月額保育料。
 *                    幼児教育・保育の無償化（2019年10月〜）により原則0円。
 * snackMonthlyAmount: おかず・おやつ代（月額・実費）。
 *   授業料は補助上限内、超過分は「その他費用」として fetch 時に算出する。
 */
export interface NurseryFeeSchedule {
  entranceFee: number;
  monthlyTuition3go: Record<NurseryFeeTier, number>;
  monthlyTuition2go: number;
  snackMonthlyAmount: number;
  sourceLabel: string;
}

// ─── 国基準・3号認定（0〜2歳・標準時間）月額保育料（円） ─────────────
//
// 出典: 子ども・子育て支援法 施行令 第13条「利用者負担額の上限額」
// ※国が定める上限額。各自治体はこの額以下で独自の保育料表を設定可能。
// ※市民税所得割額（両親合算）により階層が決まる。
//
// D1: 生活保護世帯            →    0円
// D2: 非課税世帯              →    0円
// D3: 所得割   〜 48,600円    → 19,500円
// D4: 所得割 〜  60,000円     → 23,100円
// D5: 所得割 〜  80,000円     → 30,000円
// D6: 所得割 〜 101,000円     → 38,000円
// D7: 所得割 〜 133,000円     → 44,500円
// D8: 所得割 〜 169,000円     → 50,000円
// D9: 所得割 〜 301,000円     → 61,000円
// D10: 所得割  301,000円超    → 104,000円
// ─────────────────────────────────────────────────────────────────
const NATIONAL_3GO_TUITION: Record<NurseryFeeTier, number> = {
  D1:  0,
  D2:  0,
  D3:  19_500,
  D4:  23_100,
  D5:  30_000,
  D6:  38_000,
  D7:  44_500,
  D8:  50_000,
  D9:  61_000,
  D10: 104_000,
};

const DEFAULT_SNACK_MONTHLY = 4_500;

/** 認可保育園・福岡県（国基準上限額） */
const LICENSED_SCHEDULE: NurseryFeeSchedule = {
  entranceFee: 0,
  monthlyTuition3go: NATIONAL_3GO_TUITION,
  monthlyTuition2go: 0,
  snackMonthlyAmount: DEFAULT_SNACK_MONTHLY,
  sourceLabel: '福岡県（国基準上限額）',
};

/**
 * 未認可保育園（認可外保育施設）の参考費用。
 * monthlyTuition3go / monthlyTuition2go は施設への支払い総額（月額・円）。
 * 無償化補助（上限37,000円/月）は市区町村の認定が条件のため補助なしで計算する。
 */
const UNLICENSED_NATIONAL_SCHEDULE: NurseryFeeSchedule = {
  entranceFee: 50_000,
  monthlyTuition3go: {
    D1: 55_000,
    D2: 55_000,
    D3: 55_000,
    D4: 55_000,
    D5: 55_000,
    D6: 55_000,
    D7: 55_000,
    D8: 55_000,
    D9: 55_000,
    D10: 55_000,
  },
  // 3歳以上も施設への支払い総額（全国平均）
  monthlyTuition2go: 55_000,
  snackMonthlyAmount: 5_000,
  sourceLabel: '全国平均（認可外・補助なしで試算）',
};

// ─── 学校外活動費（習い事等）参考値 ──────────────────────────────────
//
// 保育園在籍中（主に3〜5歳期）の習い事費用参考値。
// 出典: 文部科学省「子供の学習費調査（令和3年度）」幼稚園在園者の学校外活動費を参考に推計。
// 幼稚園より保育時間が長く習い事の時間が限られるため、習い事等のみ設定。
//
//   習い事等（スポーツ・芸術等）: 5,500円/月（幼稚園公立全国平均を参考）
//
export const NURSERY_EXTRACURRICULAR_EXPENSES: NurseryCostLineItem[] = [
  { label: '習い事等（全国平均・参考値）', monthlyAmount: 5_500 },
];

// ─── 公開 API ─────────────────────────────────────────────────────

/** 保育料スケジュールを返す。認可保育園は D-tier 別の月額保育料テーブルを持つ。 */
export function getNurseryFeeSchedule(schoolType: SchoolType): NurseryFeeSchedule {
  if (schoolType === 'unlicensed_childcare') {
    return UNLICENSED_NATIONAL_SCHEDULE;
  }

  return LICENSED_SCHEDULE;
}

/** 認可保育園の費用組み立て：D-tier の保育料をそのまま授業料に、その他はおかず・おやつ代のみ */
export function buildLicensedNurseryFetchedAmounts(
  monthlyTuition: number,
  snackMonthlyAmount: number,
): {
  tuitionAnnual: number;
  otherExpenses: NurseryCostLineItem[];
} {
  return {
    tuitionAnnual: monthlyTuition * 12,
    otherExpenses: [
      { label: 'おかず・おやつ代', monthlyAmount: snackMonthlyAmount },
    ],
  };
}

/**
 * 認可外保育園の費用組み立て。
 * 無償化補助（上限 37,000円/月）は市区町村の認定が条件のため補助なしで計算する。
 * 施設への月額支払い総額をそのまま授業料として返す。
 */
export function buildUnlicensedNurseryFetchedAmounts(
  monthlyGrossFee: number,
  snackMonthlyAmount: number,
): {
  tuitionAnnual: number;
  otherExpenses: NurseryCostLineItem[];
} {
  return {
    tuitionAnnual: monthlyGrossFee * 12,
    otherExpenses: [
      { label: 'おかず・おやつ代', monthlyAmount: snackMonthlyAmount },
    ],
  };
}
