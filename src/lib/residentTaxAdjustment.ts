/** 調整控除の適用外となる合計所得金額の上限（円） */
const TOTAL_INCOME_EXCLUSION_YEN = 25_000_000;

/** 合計課税所得200万円以下／超えで計算式が分岐する閾値（円） */
const TAXABLE_INCOME_THRESHOLD_YEN = 2_000_000;

/** 合計課税所得200万円超の場合の調整控除の下限（円） */
const ADJUSTMENT_CREDIT_FLOOR_YEN = 2_500;

/** 所得税と住民税の基礎控除の差額（円）— 後方互換のフォールバック */
export const BASIC_DEDUCTION_DIFF_YEN = 50_000;

export interface PersonalDeductionDiffInput {
  /** 所得税の基礎控除額（円）。指定時はこちらを優先 */
  basicDeductionIncomeTaxYen?: number;
  /** 住民税の基礎控除額（円）。指定時はこちらを優先 */
  basicDeductionResidentTaxYen?: number;
  spouseIncomeTaxYen: number;
  spouseResidentTaxYen: number;
  dependentIncomeTaxYen: number;
  dependentResidentTaxYen: number;
  singleParentIncomeTaxYen?: number;
  singleParentResidentTaxYen?: number;
  disabilityIncomeTaxYen?: number;
  disabilityResidentTaxYen?: number;
  workingStudentIncomeTaxYen?: number;
  workingStudentResidentTaxYen?: number;
  lifeInsuranceIncomeTaxYen?: number;
  lifeInsuranceResidentTaxYen?: number;
}

/**
 * 所得税と住民税の人的控除額の差の合計（円）。
 * 参考: https://www.mmea.biz/look_up/juminzei-choseikojo/
 */
export function calcPersonalDeductionDiffYen(
  input: PersonalDeductionDiffInput,
): number {
  let diff = 0;

  if (
    input.basicDeductionIncomeTaxYen != null &&
    input.basicDeductionResidentTaxYen != null
  ) {
    diff += Math.max(
      0,
      input.basicDeductionIncomeTaxYen - input.basicDeductionResidentTaxYen,
    );
  } else {
    diff += BASIC_DEDUCTION_DIFF_YEN;
  }

  const addDiff = (incomeTaxYen: number, residentTaxYen: number) => {
    diff += Math.max(0, incomeTaxYen - residentTaxYen);
  };

  addDiff(input.spouseIncomeTaxYen, input.spouseResidentTaxYen);
  addDiff(input.dependentIncomeTaxYen, input.dependentResidentTaxYen);
  addDiff(
    input.singleParentIncomeTaxYen ?? 0,
    input.singleParentResidentTaxYen ?? 0,
  );
  addDiff(
    input.disabilityIncomeTaxYen ?? 0,
    input.disabilityResidentTaxYen ?? 0,
  );
  addDiff(
    input.workingStudentIncomeTaxYen ?? 0,
    input.workingStudentResidentTaxYen ?? 0,
  );
  addDiff(
    input.lifeInsuranceIncomeTaxYen ?? 0,
    input.lifeInsuranceResidentTaxYen ?? 0,
  );

  return diff;
}

/**
 * 住民税の調整控除額（円）。所得割から控除する税額控除。
 * 参考: https://www.mmea.biz/look_up/juminzei-choseikojo/
 */
export function calcResidentTaxAdjustmentCreditYen(
  taxableIncomeYen: number,
  personalDeductionDiffYen: number,
  totalIncomeYen: number,
): number {
  if (totalIncomeYen > TOTAL_INCOME_EXCLUSION_YEN) return 0;
  if (personalDeductionDiffYen <= 0 || taxableIncomeYen <= 0) return 0;

  if (taxableIncomeYen <= TAXABLE_INCOME_THRESHOLD_YEN) {
    return Math.min(
      Math.floor(personalDeductionDiffYen * 0.05),
      Math.floor(taxableIncomeYen * 0.05),
    );
  }

  const raw = Math.floor(
    (personalDeductionDiffYen -
      (taxableIncomeYen - TAXABLE_INCOME_THRESHOLD_YEN)) *
      0.05,
  );
  return Math.max(ADJUSTMENT_CREDIT_FLOOR_YEN, raw);
}

export interface ResidentTaxWithAdjustmentInput {
  taxableIncomeYen: number;
  totalIncomeYen: number;
  personalDeductionDiffYen: number;
  incomeLevyYen: number;
  perCapitaYen: number;
}

export function calcResidentTaxWithAdjustmentYen(
  input: ResidentTaxWithAdjustmentInput,
): {
  adjustmentCreditYen: number;
  residentTaxYen: number;
  adjustedResidentTaxYen: number;
} {
  const adjustmentCreditYen = calcResidentTaxAdjustmentCreditYen(
    input.taxableIncomeYen,
    input.personalDeductionDiffYen,
    input.totalIncomeYen,
  );
  const incomeLevyAfterCredit = Math.max(
    0,
    input.incomeLevyYen - adjustmentCreditYen,
  );
  const residentTaxYen = input.incomeLevyYen + input.perCapitaYen;
  const adjustedResidentTaxYen = incomeLevyAfterCredit + input.perCapitaYen;

  return {
    adjustmentCreditYen,
    residentTaxYen,
    adjustedResidentTaxYen,
  };
}
