/**
 * 基礎控除額の算出。
 *
 * 所得税: 国税庁タックスアンサー No.1199
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 *
 * 住民税: 令和7年度税制改正では所得税のみ見直し。住民税は最高43万円のまま
 * （合計所得2,400万円超から段階的に減額）。
 */

export type BasicDeductionTaxYearRule = 'legacy_r6' | 'r7_r8' | 'r9_onward';

/** 課税年度（暦年）から基礎控除の適用区分を決定する */
export function resolveBasicDeductionRule(calendarYear: number): BasicDeductionTaxYearRule {
  if (calendarYear < 2025) return 'legacy_r6';
  if (calendarYear <= 2026) return 'r7_r8';
  return 'r9_onward';
}

function lookupBracketDeductionYen(
  totalIncomeYen: number,
  brackets: readonly { upperYen: number; deductionYen: number }[],
): number {
  if (totalIncomeYen <= 0) return 0;
  for (const bracket of brackets) {
    if (totalIncomeYen <= bracket.upperYen) {
      return bracket.deductionYen;
    }
  }
  return 0;
}

/** 令和6年分以前（所得税） */
const INCOME_TAX_BASIC_DEDUCTION_LEGACY_BRACKETS = [
  { upperYen: 1_320_000, deductionYen: 480_000 },
  { upperYen: 3_360_000, deductionYen: 880_000 },
  { upperYen: 4_890_000, deductionYen: 680_000 },
  { upperYen: 6_550_000, deductionYen: 630_000 },
  { upperYen: 23_500_000, deductionYen: 580_000 },
  { upperYen: 24_000_000, deductionYen: 480_000 },
  { upperYen: 24_500_000, deductionYen: 320_000 },
  { upperYen: 25_000_000, deductionYen: 160_000 },
] as const;

/**
 * 令和7年分・令和8年分（所得税）。
 * 合計所得2,350万円以下は引き上げ、2,350万円超の段階的減額は従前どおり。
 */
const INCOME_TAX_BASIC_DEDUCTION_R7_R8_BRACKETS = [
  { upperYen: 1_320_000, deductionYen: 950_000 },
  { upperYen: 23_500_000, deductionYen: 580_000 },
  { upperYen: 24_000_000, deductionYen: 480_000 },
  { upperYen: 24_500_000, deductionYen: 320_000 },
  { upperYen: 25_000_000, deductionYen: 160_000 },
] as const;

/** 令和9年分以後（所得税） */
const INCOME_TAX_BASIC_DEDUCTION_R9_ONWARD_BRACKETS = [
  { upperYen: 1_320_000, deductionYen: 950_000 },
  { upperYen: 24_000_000, deductionYen: 580_000 },
  { upperYen: 24_500_000, deductionYen: 320_000 },
  { upperYen: 25_000_000, deductionYen: 160_000 },
] as const;

/** 住民税（令和8年度課税時点の一般的な自治体基準） */
const RESIDENT_TAX_BASIC_DEDUCTION_BRACKETS = [
  { upperYen: 24_000_000, deductionYen: 430_000 },
  { upperYen: 24_500_000, deductionYen: 290_000 },
  { upperYen: 25_000_000, deductionYen: 150_000 },
] as const;

/**
 * 所得税の基礎控除額（円）。
 * @param totalIncomeYen 納税者本人の合計所得金額
 */
export function calcBasicDeductionIncomeTaxYen(
  totalIncomeYen: number,
  calendarYear: number,
): number {
  const rule = resolveBasicDeductionRule(calendarYear);
  const brackets =
    rule === 'legacy_r6'
      ? INCOME_TAX_BASIC_DEDUCTION_LEGACY_BRACKETS
      : rule === 'r7_r8'
        ? INCOME_TAX_BASIC_DEDUCTION_R7_R8_BRACKETS
        : INCOME_TAX_BASIC_DEDUCTION_R9_ONWARD_BRACKETS;

  return lookupBracketDeductionYen(totalIncomeYen, brackets);
}

/** 住民税の基礎控除額（円） */
export function calcBasicDeductionResidentTaxYen(totalIncomeYen: number): number {
  return lookupBracketDeductionYen(
    totalIncomeYen,
    RESIDENT_TAX_BASIC_DEDUCTION_BRACKETS,
  );
}

/** 所得税と住民税の基礎控除額の差（調整控除の人的控除差に使用） */
export function calcBasicDeductionDiffYen(
  totalIncomeYen: number,
  calendarYear: number,
): number {
  return Math.max(
    0,
    calcBasicDeductionIncomeTaxYen(totalIncomeYen, calendarYear) -
      calcBasicDeductionResidentTaxYen(totalIncomeYen),
  );
}
