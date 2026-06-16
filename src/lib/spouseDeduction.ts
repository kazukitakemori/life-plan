import {
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
  SPOUSE_TOTAL_INCOME_LIMIT_YEN,
} from './incomeTaxDeductions';

export interface SpouseTaxDeductions {
  incomeTaxYen: number;
  residentTaxYen: number;
}

/** 所得税：配偶者特別控除（95万円超〜133万円以下） */
const SPECIAL_SPOUSE_DEDUCTION_INCOME_TAX: { maxIncome: number; deduction: number }[] =
  [
    { maxIncome: 1_000_000, deduction: 310_000 },
    { maxIncome: 1_050_000, deduction: 260_000 },
    { maxIncome: 1_100_000, deduction: 210_000 },
    { maxIncome: 1_150_000, deduction: 160_000 },
    { maxIncome: 1_200_000, deduction: 110_000 },
    { maxIncome: 1_250_000, deduction: 60_000 },
    { maxIncome: 1_300_000, deduction: 30_000 },
    { maxIncome: 1_330_000, deduction: 30_000 },
  ];

/** 住民税：配偶者特別控除（95万円超〜133万円以下） */
const SPECIAL_SPOUSE_DEDUCTION_RESIDENT_TAX: {
  maxIncome: number;
  deduction: number;
}[] = [
  { maxIncome: 1_000_000, deduction: 280_000 },
  { maxIncome: 1_050_000, deduction: 230_000 },
  { maxIncome: 1_100_000, deduction: 180_000 },
  { maxIncome: 1_150_000, deduction: 130_000 },
  { maxIncome: 1_200_000, deduction: 80_000 },
  { maxIncome: 1_250_000, deduction: 40_000 },
  { maxIncome: 1_300_000, deduction: 30_000 },
  { maxIncome: 1_330_000, deduction: 30_000 },
];

function calcSpecialDeductionYen(
  totalIncomeYen: number,
  table: { maxIncome: number; deduction: number }[],
): number {
  for (const row of table) {
    if (totalIncomeYen <= row.maxIncome) {
      return row.deduction;
    }
  }
  return 0;
}

function calcIncomeTaxSpouseDeductionYen(totalIncomeYen: number): number {
  if (totalIncomeYen <= SPOUSE_TOTAL_INCOME_LIMIT_YEN) {
    return 380_000;
  }
  if (totalIncomeYen > SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN) {
    return 0;
  }
  if (totalIncomeYen <= 950_000) {
    const reduction =
      Math.floor((totalIncomeYen - SPOUSE_TOTAL_INCOME_LIMIT_YEN) / 2_500) *
      2_500;
    return Math.max(0, 380_000 - reduction);
  }
  return calcSpecialDeductionYen(totalIncomeYen, SPECIAL_SPOUSE_DEDUCTION_INCOME_TAX);
}

function calcResidentTaxSpouseDeductionYen(totalIncomeYen: number): number {
  if (totalIncomeYen <= SPOUSE_TOTAL_INCOME_LIMIT_YEN) {
    return 330_000;
  }
  if (totalIncomeYen > SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN) {
    return 0;
  }
  if (totalIncomeYen <= 950_000) {
    const reduction =
      Math.floor((totalIncomeYen - SPOUSE_TOTAL_INCOME_LIMIT_YEN) / 2_500) *
      2_500;
    return Math.max(0, 330_000 - reduction);
  }
  return calcSpecialDeductionYen(
    totalIncomeYen,
    SPECIAL_SPOUSE_DEDUCTION_RESIDENT_TAX,
  );
}

export function calcSpouseDeductionsFromTotalIncomeYen(
  totalIncomeYen: number,
): SpouseTaxDeductions {
  if (totalIncomeYen > SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  return {
    incomeTaxYen: calcIncomeTaxSpouseDeductionYen(totalIncomeYen),
    residentTaxYen: calcResidentTaxSpouseDeductionYen(totalIncomeYen),
  };
}
