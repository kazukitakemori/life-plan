/** 老齢基礎年金の満額（2026年度・昭和31年4月2日以降生まれ。物価スライドは v1 未対応） */
export const FULL_BASIC_PENSION_YEN_PER_MONTH = 70_608;
export const FULL_BASIC_PENSION_YEN_PER_YEAR =
  FULL_BASIC_PENSION_YEN_PER_MONTH * 12;

/** 老齢基礎年金の満額算定に必要な加入月数 */
export const FULL_BASIC_PENSION_MONTHS = 480;

/**
 * 4年生大学在学中の国民年金猶予（ねんきん定期便なし推計時）。
 * 20歳の誕生月から24か月は加入月数に算入しない。
 */
export const UNIVERSITY_EXEMPTION_START_AGE = 20;
export const UNIVERSITY_EXEMPTION_MONTHS = 24;

/** 平成15年4月以降の報酬比例部分の乗率（÷1000） */
export const PROPORTIONAL_RATE_POST_HEISEI15 = 5.481;

/** 平成15年3月以前の報酬比例部分の乗率（÷1000） */
export const PROPORTIONAL_RATE_PRE_HEISEI15 = 7.125;

/** 報酬比例部分の制度切替（平成15年4月） */
export const HEISEI15_REFORM_YEAR = 2003;
export const HEISEI15_REFORM_MONTH = 4;

/** 標準的な受給開始年齢 */
export const STANDARD_OLD_AGE_START = 65;

/** 繰上げ受給: 1ヶ月あたりの減額率（老齢基礎・厚生共通の簡易値） */
export const EARLY_CLAIM_REDUCTION_PER_MONTH = 0.004;

/** 繰下げ受給: 1ヶ月あたりの増額率 */
export const DEFERRAL_INCREASE_PER_MONTH = 0.007;

/** 年金加入期間の走査開始年齢 */
export const PENSION_ENROLLMENT_START_AGE = 20;

/**
 * 加給年金（老齢厚生年金）2026年度。
 * 受給権者が昭和18年4月2日以後生まれ（現在の受給年齢層はほぼ該当）を前提に統一。
 * 基本額 243,800円＋特別加算 179,900円 = 合計 423,700円。
 */
export const DEPENDENT_SPOUSE_PENSION_YEN_PER_YEAR = 423_700;

/** 加給年金の支給要件：老齢厚生年金の被保険者期間の最低月数（20年） */
export const DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS = 240;

/** 加給年金の打ち切り：配偶者がこの年齢に達したとき停止 */
export const DEPENDENT_PENSION_CUTOFF_AGE = 65;

/**
 * 老齢厚生年金の加入月数推定：Q2に収入未入力の期間を
 * 大卒22歳4月就職・代表報酬で補完する際の開始年月。
 */
export const ASSUMED_EMPLOYMENT_START_AGE = 22;
export const ASSUMED_EMPLOYMENT_START_MONTH = 4;

/**
 * 付加年金の年金額単価（加入月数 × 200円/年）。
 * 第1号被保険者が任意加入できる上乗せ年金。
 * 受給額 = 200円 × 付加保険料納付月数（繰上/繰下で老齢基礎と同率増減）。
 */
export const ADDITIONAL_PENSION_UNIT_YEN_PER_MONTH = 200;

/**
 * 在職老齢年金の支給停止調整額（月額・円）。
 * 令和8年（2026）度改正後の基準額 = 65万円。
 * 基本月額（老齢厚生年金月額）＋ 総報酬月額相当額がこの額を超えた場合、超過分の1/2を支給停止。
 * 調整対象は老齢厚生年金のみ（老齢基礎年金は対象外）。
 */
export const ZAISHOKU_SUSPENSION_THRESHOLD_YEN_PER_MONTH = 650_000;
