/** 退職所得控除の下限（円） */
export const RETIREMENT_INCOME_DEDUCTION_MIN_YEN = 800_000;

/** 勤続20年以下の年あたり控除（円） */
export const RETIREMENT_INCOME_DEDUCTION_PER_YEAR_YEN = 400_000;

/** 勤続20年超のベース控除（円） */
export const RETIREMENT_INCOME_DEDUCTION_BASE_OVER_20_YEN = 8_000_000;

/** 勤続20年超の追加年あたり控除（円） */
export const RETIREMENT_INCOME_DEDUCTION_EXTRA_PER_YEAR_YEN = 700_000;

/** 退職所得に対する住民税所得割の簡略税率 */
export const RETIREMENT_RESIDENT_TAX_RATE = 0.1;

export interface AgeMonthPoint {
  age: number;
  month: number;
}

/** 勤続・拠出の年齢月期間（両端含む） */
export interface EnrollmentAgeMonthPeriod {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + Math.min(12, Math.max(1, month));
}

function toInclusiveMonthRange(
  period: EnrollmentAgeMonthPeriod,
): { start: number; end: number } | null {
  const start = ageMonthIndex(period.startAge, period.startMonth);
  const end = ageMonthIndex(period.endAge, period.endMonth);
  if (end < start) return null;
  return { start, end };
}

/** inclusive な月レンジを和集合にマージ（隣接も結合） */
export function mergeInclusiveMonthRanges(
  ranges: readonly { start: number; end: number }[],
): { start: number; end: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const out: { start: number; end: number }[] = [
    { start: sorted[0].start, end: sorted[0].end },
  ];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end + 1) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

export function countInclusiveMonthRanges(
  ranges: readonly { start: number; end: number }[],
): number {
  return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}

/**
 * 同年合算の勤続年数（国税庁 No.2735）。
 * 各期間の和集合月数を取り、1年未満の端数は切り上げ。
 */
export function calcMergedEnrollmentYearsFromPeriods(
  periods: readonly EnrollmentAgeMonthPeriod[],
): number {
  const ranges = periods
    .map(toInclusiveMonthRange)
    .filter((r): r is { start: number; end: number } => r != null);
  if (ranges.length === 0) return 1;
  const months = countInclusiveMonthRanges(mergeInclusiveMonthRanges(ranges));
  if (months <= 0) return 1;
  return Math.ceil(months / 12);
}

/**
 * 加入月数 = (受給開始年月 − 加入年月) + 1。
 * 加入年数 = ceil(加入月数 / 12)（端数月は切り上げ1年）。
 * 例: 10年1か月 → 11年。
 *
 * 退職所得控除の「20年ルール」:
 * - 勤続20年以下: max(80万, 40万 × 年数)
 * - 勤続20年超: 800万 + 70万 × (年数 − 20)
 */
export function calcEnrollmentYearsFromAgeMonths(
  join: AgeMonthPoint,
  end: AgeMonthPoint,
): number {
  const months =
    ageMonthIndex(end.age, end.month) -
    ageMonthIndex(join.age, join.month) +
    1;
  if (months <= 0) return 1;
  return Math.ceil(months / 12);
}

/** 退職所得控除額（円）。勤続20年を境に単価が変わる（20年ルール）。 */
export function calcRetirementIncomeDeductionYen(enrollmentYears: number): number {
  const years = Math.max(1, Math.floor(enrollmentYears));
  if (years <= 20) {
    return Math.max(
      RETIREMENT_INCOME_DEDUCTION_MIN_YEN,
      RETIREMENT_INCOME_DEDUCTION_PER_YEAR_YEN * years,
    );
  }
  return (
    RETIREMENT_INCOME_DEDUCTION_BASE_OVER_20_YEN +
    RETIREMENT_INCOME_DEDUCTION_EXTRA_PER_YEAR_YEN * (years - 20)
  );
}

/**
 * 退職所得（円）= max(0, 収入 − 控除) × 1/2（円未満切り捨て）。
 */
export function calcRetirementIncomeYen(
  revenueYen: number,
  enrollmentYears: number,
): number {
  const revenue = Math.max(0, Math.round(revenueYen));
  const deduction = calcRetirementIncomeDeductionYen(enrollmentYears);
  return Math.floor(Math.max(0, revenue - deduction) / 2);
}

/** 退職所得に対する所得税（分離・累進・所得税と同じブラケット） */
export function calcRetirementIncomeTaxYen(retirementIncomeYen: number): number {
  const taxable = Math.max(0, retirementIncomeYen);
  if (taxable <= 0) return 0;
  const brackets: { limit: number; rate: number; deduction: number }[] = [
    { limit: 1_950_000, rate: 0.05, deduction: 0 },
    { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
    { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
    { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
    { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
    { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 4_796_000 },
  ];
  for (const bracket of brackets) {
    if (taxable <= bracket.limit) {
      return Math.max(0, Math.floor(taxable * bracket.rate - bracket.deduction));
    }
  }
  return 0;
}

/** 退職所得に対する住民税（所得割・簡略 10%） */
export function calcRetirementResidentTaxYen(retirementIncomeYen: number): number {
  if (retirementIncomeYen <= 0) return 0;
  return Math.floor(retirementIncomeYen * RETIREMENT_RESIDENT_TAX_RATE);
}

export interface RetirementIncomeTaxBreakdown {
  enrollmentYears: number;
  revenueYen: number;
  deductionYen: number;
  retirementIncomeYen: number;
  incomeTaxYen: number;
  residentTaxYen: number;
}

export function calcRetirementIncomeTaxBreakdown(
  revenueYen: number,
  enrollmentYears: number,
  options?: { deductionYenOverride?: number },
): RetirementIncomeTaxBreakdown {
  const deductionYen =
    options?.deductionYenOverride != null
      ? Math.max(0, Math.round(options.deductionYenOverride))
      : calcRetirementIncomeDeductionYen(enrollmentYears);
  const revenue = Math.max(0, Math.round(revenueYen));
  const retirementIncomeYen = Math.floor(Math.max(0, revenue - deductionYen) / 2);
  return {
    enrollmentYears: Math.max(1, Math.floor(enrollmentYears)),
    revenueYen: revenue,
    deductionYen,
    retirementIncomeYen,
    incomeTaxYen: calcRetirementIncomeTaxYen(retirementIncomeYen),
    residentTaxYen: calcRetirementResidentTaxYen(retirementIncomeYen),
  };
}

/**
 * 一時金の税引後手取り（万円）。
 * revenueMan は税引前の収入金額、breakdown の税額を差し引く。
 */
export function calcRetirementLumpNetMan(
  revenueMan: number,
  breakdown: Pick<
    RetirementIncomeTaxBreakdown,
    'incomeTaxYen' | 'residentTaxYen'
  > | null,
): number {
  const gross = Math.max(0, Number(revenueMan) || 0);
  if (!breakdown) return Math.round(gross * 10) / 10;
  const taxMan =
    (Math.max(0, breakdown.incomeTaxYen) +
      Math.max(0, breakdown.residentTaxYen)) /
    10_000;
  return Math.max(0, Math.round((gross - taxMan) * 10) / 10);
}
