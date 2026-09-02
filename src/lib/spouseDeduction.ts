export interface SpouseTaxDeductions {
  incomeTaxYen: number;
  residentTaxYen: number;
}

/** 配偶者特別控除の合計所得金額上限（円） */
export const SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN = 1_330_000;

export type SpouseDeductionKind = 'none' | 'spouse' | 'special';

/** 納税者本人の合計所得がこの金額を超えると配偶者（特別）控除は適用不可 */
export const TAXPAYER_SPOUSE_DEDUCTION_INCOME_CAP_YEN = 10_000_000;

export type SpouseDeductionTaxYearRule = 'legacy_r6' | 'r7_onward';

/**
 * 課税年度（暦年）から配偶者控除の適用区分を決定する。
 * 令和7年分（2025年）から配偶者の合計所得上限が58万円に引き上げ。
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm
 */
export function resolveSpouseDeductionRule(
  calendarYear: number,
): SpouseDeductionTaxYearRule {
  if (calendarYear < 2025) return 'legacy_r6';
  return 'r7_onward';
}

export function getSpouseTotalIncomeLimitYen(calendarYear: number): number {
  return resolveSpouseDeductionRule(calendarYear) === 'legacy_r6'
    ? 480_000
    : 580_000;
}

type HeadIncomeTier = 0 | 1 | 2;

export function resolveHeadIncomeTier(
  headTotalIncomeYen: number,
): HeadIncomeTier | null {
  if (headTotalIncomeYen > TAXPAYER_SPOUSE_DEDUCTION_INCOME_CAP_YEN) {
    return null;
  }
  if (headTotalIncomeYen <= 9_000_000) return 0;
  if (headTotalIncomeYen <= 9_500_000) return 1;
  return 2;
}

function isElderlySpouse(ageAtYearEnd: number | null): boolean {
  return (ageAtYearEnd ?? 0) >= 70;
}

/** 所得税：配偶者控除（配偶者の合計所得が上限以下） */
const SPOUSE_DEDUCTION_INCOME_TAX: Record<HeadIncomeTier, [number, number]> = {
  0: [380_000, 480_000],
  1: [260_000, 320_000],
  2: [130_000, 160_000],
};

/** 住民税：配偶者控除 */
const SPOUSE_DEDUCTION_RESIDENT_TAX: Record<HeadIncomeTier, [number, number]> = {
  0: [330_000, 380_000],
  1: [220_000, 270_000],
  2: [110_000, 130_000],
};

interface SpecialDeductionRow {
  maxIncome: number;
  incomeTax: [number, number, number];
  residentTax: [number, number, number];
}

/**
 * 所得税・住民税：配偶者特別控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order3/3-3_17.htm
 */
const SPECIAL_SPOUSE_DEDUCTION_TABLE: SpecialDeductionRow[] = [
  {
    maxIncome: 950_000,
    incomeTax: [380_000, 260_000, 130_000],
    residentTax: [330_000, 220_000, 110_000],
  },
  {
    maxIncome: 1_000_000,
    incomeTax: [360_000, 240_000, 120_000],
    residentTax: [300_000, 200_000, 100_000],
  },
  {
    maxIncome: 1_050_000,
    incomeTax: [310_000, 210_000, 110_000],
    residentTax: [260_000, 170_000, 90_000],
  },
  {
    maxIncome: 1_100_000,
    incomeTax: [260_000, 180_000, 90_000],
    residentTax: [220_000, 140_000, 70_000],
  },
  {
    maxIncome: 1_150_000,
    incomeTax: [210_000, 140_000, 70_000],
    residentTax: [180_000, 120_000, 60_000],
  },
  {
    maxIncome: 1_200_000,
    incomeTax: [160_000, 110_000, 60_000],
    residentTax: [130_000, 90_000, 45_000],
  },
  {
    maxIncome: 1_250_000,
    incomeTax: [110_000, 80_000, 40_000],
    residentTax: [90_000, 65_000, 35_000],
  },
  {
    maxIncome: 1_300_000,
    incomeTax: [60_000, 40_000, 20_000],
    residentTax: [50_000, 35_000, 18_000],
  },
  {
    maxIncome: SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
    incomeTax: [30_000, 20_000, 10_000],
    residentTax: [30_000, 20_000, 10_000],
  },
];

function lookupSpecialDeductionYen(
  spouseTotalIncomeYen: number,
  tier: HeadIncomeTier,
): SpouseTaxDeductions {
  for (const row of SPECIAL_SPOUSE_DEDUCTION_TABLE) {
    if (spouseTotalIncomeYen <= row.maxIncome) {
      return {
        incomeTaxYen: row.incomeTax[tier],
        residentTaxYen: row.residentTax[tier],
      };
    }
  }
  return { incomeTaxYen: 0, residentTaxYen: 0 };
}

export interface SpouseDeductionInput {
  /** 納税者（世帯主）の合計所得金額（円） */
  headTotalIncomeYen: number;
  /** 配偶者の合計所得金額（円） */
  spouseTotalIncomeYen: number;
  /** 配偶者の12月31日時点の満年齢 */
  spouseAgeAtYearEnd: number | null;
  calendarYear: number;
}

/**
 * 配偶者控除・配偶者特別控除（所得税・住民税）を算出する。
 * 国税庁タックスアンサー No.1191 / No.1195 準拠。
 */
/** 適用される控除の種別（金額0の場合は 'none'） */
export function resolveSpouseDeductionKind(
  input: SpouseDeductionInput,
): SpouseDeductionKind {
  const tier = resolveHeadIncomeTier(input.headTotalIncomeYen);
  if (tier === null) {
    return 'none';
  }

  if (input.spouseTotalIncomeYen > SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN) {
    return 'none';
  }

  const spouseIncomeLimit = getSpouseTotalIncomeLimitYen(input.calendarYear);

  if (input.spouseTotalIncomeYen <= spouseIncomeLimit) {
    return 'spouse';
  }

  return 'special';
}

export function formatSpouseDeductionLabel(kind: SpouseDeductionKind): string {
  switch (kind) {
    case 'spouse':
      return '配偶者控除';
    case 'special':
      return '配偶者特別控除';
    default:
      return '配偶者控除（配偶者特別控除）';
  }
}

export function calcSpouseDeductions(
  input: SpouseDeductionInput,
): SpouseTaxDeductions {
  const tier = resolveHeadIncomeTier(input.headTotalIncomeYen);
  if (tier === null) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  if (input.spouseTotalIncomeYen > SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  const spouseIncomeLimit = getSpouseTotalIncomeLimitYen(input.calendarYear);

  if (input.spouseTotalIncomeYen <= spouseIncomeLimit) {
    const elderlyIndex = isElderlySpouse(input.spouseAgeAtYearEnd) ? 1 : 0;
    return {
      incomeTaxYen: SPOUSE_DEDUCTION_INCOME_TAX[tier][elderlyIndex],
      residentTaxYen: SPOUSE_DEDUCTION_RESIDENT_TAX[tier][elderlyIndex],
    };
  }

  return lookupSpecialDeductionYen(input.spouseTotalIncomeYen, tier);
}

/** @deprecated calcSpouseDeductions を使用してください */
export function calcSpouseDeductionsFromTotalIncomeYen(
  spouseTotalIncomeYen: number,
  calendarYear = 2026,
): SpouseTaxDeductions {
  return calcSpouseDeductions({
    headTotalIncomeYen: 0,
    spouseTotalIncomeYen,
    spouseAgeAtYearEnd: null,
    calendarYear,
  });
}
