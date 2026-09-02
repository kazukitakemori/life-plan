/**
 * 全国健康保険協会 福岡支部
 * 令和8年3月分（4月納付分）からの健康保険・厚生年金保険の保険料額表（R8_40fukuoka）に基づく等級表。
 *
 * - 健康保険: 等級1〜50
 * - 厚生年金: 等級1〜35（報酬月額635,000円以上は標準報酬月額650,000円）
 */

export interface StandardRemunerationGrade {
  grade: number;
  /** 標準報酬月額（円） */
  standardYen: number;
  /** 報酬月額の下限（円以上） */
  lowerBoundYen: number;
  /** 報酬月額の上限（円未満）。null は上限なし */
  upperBoundYen: number | null;
}

/** 協会けんぽ福岡支部・令和8年度 標準報酬月額等級 */
export const FUKUOKA_STANDARD_REMUNERATION_GRADES_R8: StandardRemunerationGrade[] =
  [
    { grade: 1, standardYen: 58_000, lowerBoundYen: 0, upperBoundYen: 63_000 },
    { grade: 2, standardYen: 68_000, lowerBoundYen: 63_000, upperBoundYen: 73_000 },
    { grade: 3, standardYen: 78_000, lowerBoundYen: 73_000, upperBoundYen: 83_000 },
    { grade: 4, standardYen: 88_000, lowerBoundYen: 83_000, upperBoundYen: 93_000 },
    { grade: 5, standardYen: 98_000, lowerBoundYen: 93_000, upperBoundYen: 101_000 },
    { grade: 6, standardYen: 104_000, lowerBoundYen: 101_000, upperBoundYen: 107_000 },
    { grade: 7, standardYen: 110_000, lowerBoundYen: 107_000, upperBoundYen: 114_000 },
    { grade: 8, standardYen: 118_000, lowerBoundYen: 114_000, upperBoundYen: 122_000 },
    { grade: 9, standardYen: 126_000, lowerBoundYen: 122_000, upperBoundYen: 130_000 },
    { grade: 10, standardYen: 134_000, lowerBoundYen: 130_000, upperBoundYen: 138_000 },
    { grade: 11, standardYen: 142_000, lowerBoundYen: 138_000, upperBoundYen: 146_000 },
    { grade: 12, standardYen: 150_000, lowerBoundYen: 146_000, upperBoundYen: 155_000 },
    { grade: 13, standardYen: 160_000, lowerBoundYen: 155_000, upperBoundYen: 165_000 },
    { grade: 14, standardYen: 170_000, lowerBoundYen: 165_000, upperBoundYen: 175_000 },
    { grade: 15, standardYen: 180_000, lowerBoundYen: 175_000, upperBoundYen: 185_000 },
    { grade: 16, standardYen: 190_000, lowerBoundYen: 185_000, upperBoundYen: 195_000 },
    { grade: 17, standardYen: 200_000, lowerBoundYen: 195_000, upperBoundYen: 210_000 },
    { grade: 18, standardYen: 220_000, lowerBoundYen: 210_000, upperBoundYen: 230_000 },
    { grade: 19, standardYen: 240_000, lowerBoundYen: 230_000, upperBoundYen: 250_000 },
    { grade: 20, standardYen: 260_000, lowerBoundYen: 250_000, upperBoundYen: 270_000 },
    { grade: 21, standardYen: 280_000, lowerBoundYen: 270_000, upperBoundYen: 290_000 },
    { grade: 22, standardYen: 300_000, lowerBoundYen: 290_000, upperBoundYen: 310_000 },
    { grade: 23, standardYen: 320_000, lowerBoundYen: 310_000, upperBoundYen: 330_000 },
    { grade: 24, standardYen: 340_000, lowerBoundYen: 330_000, upperBoundYen: 350_000 },
    { grade: 25, standardYen: 360_000, lowerBoundYen: 350_000, upperBoundYen: 370_000 },
    { grade: 26, standardYen: 380_000, lowerBoundYen: 370_000, upperBoundYen: 395_000 },
    { grade: 27, standardYen: 410_000, lowerBoundYen: 395_000, upperBoundYen: 425_000 },
    { grade: 28, standardYen: 440_000, lowerBoundYen: 425_000, upperBoundYen: 455_000 },
    { grade: 29, standardYen: 470_000, lowerBoundYen: 455_000, upperBoundYen: 485_000 },
    { grade: 30, standardYen: 500_000, lowerBoundYen: 485_000, upperBoundYen: 515_000 },
    { grade: 31, standardYen: 530_000, lowerBoundYen: 515_000, upperBoundYen: 545_000 },
    { grade: 32, standardYen: 560_000, lowerBoundYen: 545_000, upperBoundYen: 575_000 },
    { grade: 33, standardYen: 590_000, lowerBoundYen: 575_000, upperBoundYen: 605_000 },
    { grade: 34, standardYen: 620_000, lowerBoundYen: 605_000, upperBoundYen: 635_000 },
    { grade: 35, standardYen: 650_000, lowerBoundYen: 635_000, upperBoundYen: 665_000 },
    { grade: 36, standardYen: 680_000, lowerBoundYen: 665_000, upperBoundYen: 695_000 },
    { grade: 37, standardYen: 710_000, lowerBoundYen: 695_000, upperBoundYen: 730_000 },
    { grade: 38, standardYen: 750_000, lowerBoundYen: 730_000, upperBoundYen: 770_000 },
    { grade: 39, standardYen: 790_000, lowerBoundYen: 770_000, upperBoundYen: 810_000 },
    { grade: 40, standardYen: 830_000, lowerBoundYen: 810_000, upperBoundYen: 855_000 },
    { grade: 41, standardYen: 880_000, lowerBoundYen: 855_000, upperBoundYen: 905_000 },
    { grade: 42, standardYen: 930_000, lowerBoundYen: 905_000, upperBoundYen: 955_000 },
    { grade: 43, standardYen: 980_000, lowerBoundYen: 955_000, upperBoundYen: 1_005_000 },
    { grade: 44, standardYen: 1_030_000, lowerBoundYen: 1_005_000, upperBoundYen: 1_055_000 },
    { grade: 45, standardYen: 1_090_000, lowerBoundYen: 1_055_000, upperBoundYen: 1_115_000 },
    { grade: 46, standardYen: 1_150_000, lowerBoundYen: 1_115_000, upperBoundYen: 1_175_000 },
    { grade: 47, standardYen: 1_210_000, lowerBoundYen: 1_175_000, upperBoundYen: 1_235_000 },
    { grade: 48, standardYen: 1_270_000, lowerBoundYen: 1_235_000, upperBoundYen: 1_295_000 },
    { grade: 49, standardYen: 1_330_000, lowerBoundYen: 1_295_000, upperBoundYen: 1_355_000 },
    {
      grade: 50,
      standardYen: 1_390_000,
      lowerBoundYen: 1_355_000,
      upperBoundYen: null,
    },
  ];

/** 厚生年金の標準報酬月額上限（等級35） */
export const PENSION_STANDARD_REMUNERATION_CAP_YEN = 650_000;

/** 厚生年金で等級35に該当する報酬月額の下限 */
export const PENSION_STANDARD_REMUNERATION_LOWER_YEN = 635_000;

/** 健康保険の標準賞与額 年間上限（円） */
export const HEALTH_STANDARD_BONUS_ANNUAL_CAP_YEN = 5_730_000;

/**
 * 協会けんぽ福岡支部・令和8年3月分（4月納付分）～の健康保険料率（労使折半前の総率）。
 * 出典: R8_40fukuoka（全国健康保険協会 福岡支部 保険料額表）
 *
 * - 全国健康保険協会管掌健康保険料（医療・支援）: 10.11%
 * - 子ども・子育て支援金: 0.23%（令和8年4月分＝5月納付分～）
 * - 介護保険料（第2号被保険者・40〜64歳）: 1.62%
 *
 * 計算内訳では ÷2 して被保険者負担分を算出する。
 */
export const FUKUOKA_HEALTH_INSURANCE_RATES_R8 = {
  medicalSupport: 0.1011,
  childcare: 0.0023,
  nursingCare: 0.0162,
} as const;

/** 厚生年金保険料率（労使折半前の総率）。平成29年9月分～（R8_40fukuoka） */
export const FUKUOKA_PENSION_INSURANCE_RATE = 0.183;

/** 厚生年金の標準賞与額 1回あたり上限（円） */
export const PENSION_STANDARD_BONUS_PER_PAYMENT_CAP_YEN = 1_500_000;

/**
 * 賞与として扱える年間支給回数の上限。
 * 4回以上支給される場合は報酬（給与）として毎月に按分する。
 */
export const BONUS_PAYMENT_COUNT_THRESHOLD = 4;
