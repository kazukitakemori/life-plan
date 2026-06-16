/** 福岡市・令和7年度 国民健康保険料率（簡易版） */
export const FUKUOKA_NHI_RATES = {
  medical: {
    incomeRate: 0.0596,
    perCapitaYen: 19_980,
    perHouseholdYen: 18_863,
    annualCapYen: 660_000,
  },
  support: {
    incomeRate: 0.0328,
    perCapitaYen: 10_334,
    perHouseholdYen: 9_757,
    annualCapYen: 260_000,
  },
  ltc: {
    incomeRate: 0.0281,
    perCapitaYen: 10_386,
    perHouseholdYen: 7_912,
    annualCapYen: 170_000,
  },
  /** 所得割の算定基礎から控除（1人あたり） */
  basicDeductionYen: 430_000,
} as const;

export type NhiReductionTier = 'none' | '20' | '50' | '70';

export interface NhiMemberInput {
  age: number;
  /** 軽減判定・所得割用の総所得金額等（円） */
  totalIncomeYen: number;
  hasSalary: boolean;
}

/**
 * 福岡市：均等割・平等割の軽減区分（7割・5割・2割）。
 * 基準は世帯の前年中所得合計（総所得金額等・控除前）と被保険者数・給与所得者数。
 */
export function calcFukuokaNhiReductionTier(
  householdIncomeYen: number,
  insuredCount: number,
  salaryEarnerCount: number,
): NhiReductionTier {
  if (insuredCount <= 0) return 'none';

  const salaryAdj = 100_000 * Math.max(0, salaryEarnerCount - 1);
  const threshold70 = 430_000 + salaryAdj;
  const threshold50 = 430_000 + 310_000 * insuredCount + salaryAdj;
  const threshold20 = 430_000 + 570_000 * insuredCount + salaryAdj;

  if (householdIncomeYen <= threshold70) return '70';
  if (householdIncomeYen <= threshold50) return '50';
  if (householdIncomeYen <= threshold20) return '20';
  return 'none';
}

/** 軽減後に本人が負担する均等割・平等割の割合（7割軽減 → 3割負担） */
export function nhiFlatPremiumPayRate(tier: NhiReductionTier): number {
  switch (tier) {
    case '70':
      return 0.3;
    case '50':
      return 0.5;
    case '20':
      return 0.8;
    default:
      return 1;
  }
}

export function formatNhiReductionTier(tier: NhiReductionTier): string {
  switch (tier) {
    case '70':
      return '7割軽減';
    case '50':
      return '5割軽減';
    case '20':
      return '2割軽減';
    default:
      return '軽減なし';
  }
}

function applySegmentCap(amount: number, cap: number): number {
  return Math.min(Math.max(0, amount), cap);
}

/**
 * 福岡市ベースの国保料（医療・支援・介護の所得割＋均等割＋平等割、軽減適用後）。
 * 国民年金は含まない。
 */
export function calcFukuokaHouseholdNhiPremiumYen(members: NhiMemberInput[]): {
  premiumYen: number;
  reductionTier: NhiReductionTier;
} {
  if (members.length === 0) {
    return { premiumYen: 0, reductionTier: 'none' };
  }

  const householdIncomeYen = members.reduce(
    (sum, member) => sum + member.totalIncomeYen,
    0,
  );
  const insuredCount = members.length;
  const salaryEarnerCount = members.filter((member) => member.hasSalary).length;
  const reductionTier = calcFukuokaNhiReductionTier(
    householdIncomeYen,
    insuredCount,
    salaryEarnerCount,
  );
  const flatPayRate = nhiFlatPremiumPayRate(reductionTier);

  let medicalIncome = 0;
  let supportIncome = 0;
  let ltcIncome = 0;
  let medicalPerCapita = 0;
  let supportPerCapita = 0;
  let ltcPerCapita = 0;

  for (const member of members) {
    const incomeBase = Math.max(
      0,
      member.totalIncomeYen - FUKUOKA_NHI_RATES.basicDeductionYen,
    );
    const hasLtc = member.age >= 40 && member.age < 65;

    medicalIncome += incomeBase * FUKUOKA_NHI_RATES.medical.incomeRate;
    supportIncome += incomeBase * FUKUOKA_NHI_RATES.support.incomeRate;
    if (hasLtc) {
      ltcIncome += incomeBase * FUKUOKA_NHI_RATES.ltc.incomeRate;
    }

    medicalPerCapita += FUKUOKA_NHI_RATES.medical.perCapitaYen;
    supportPerCapita += FUKUOKA_NHI_RATES.support.perCapitaYen;
    if (hasLtc) {
      ltcPerCapita += FUKUOKA_NHI_RATES.ltc.perCapitaYen;
    }
  }

  const hasLtcHousehold = members.some(
    (member) => member.age >= 40 && member.age < 65,
  );

  const medicalFlat =
    (medicalPerCapita + FUKUOKA_NHI_RATES.medical.perHouseholdYen) * flatPayRate;
  const supportFlat =
    (supportPerCapita + FUKUOKA_NHI_RATES.support.perHouseholdYen) * flatPayRate;
  const ltcFlat = hasLtcHousehold
    ? (ltcPerCapita + FUKUOKA_NHI_RATES.ltc.perHouseholdYen) * flatPayRate
    : 0;

  const medicalTotal = applySegmentCap(
    medicalIncome + medicalFlat,
    FUKUOKA_NHI_RATES.medical.annualCapYen,
  );
  const supportTotal = applySegmentCap(
    supportIncome + supportFlat,
    FUKUOKA_NHI_RATES.support.annualCapYen,
  );
  const ltcTotal = hasLtcHousehold
    ? applySegmentCap(ltcIncome + ltcFlat, FUKUOKA_NHI_RATES.ltc.annualCapYen)
    : 0;

  return {
    premiumYen: Math.floor(medicalTotal + supportTotal + ltcTotal),
    reductionTier,
  };
}

/** 公的年金等の雑所得（円）— 国保の総所得金額等算定用 */
function calcPensionIncomeForNhiYen(pensionYen: number, age: number): number {
  if (pensionYen <= 0) return 0;

  let deduction = 0;
  if (age >= 65) {
    if (pensionYen <= 3_300_000) deduction = 1_100_000;
    else if (pensionYen <= 4_100_000) deduction = Math.floor(pensionYen * 0.25 + 275_000);
    else if (pensionYen <= 7_700_000) deduction = Math.floor(pensionYen * 0.15 + 685_000);
    else if (pensionYen <= 10_000_000) deduction = Math.floor(pensionYen * 0.05 + 1_455_000);
    else deduction = 1_955_000;
  } else {
    if (pensionYen <= 1_300_000) deduction = 600_000;
    else if (pensionYen <= 4_100_000) deduction = Math.floor(pensionYen * 0.25 + 275_000);
    else if (pensionYen <= 7_700_000) deduction = Math.floor(pensionYen * 0.15 + 685_000);
    else if (pensionYen <= 10_000_000) deduction = Math.floor(pensionYen * 0.05 + 1_455_000);
    else deduction = 1_955_000;
  }

  return Math.max(0, pensionYen - deduction);
}

/** 国保の総所得金額等（軽減判定・所得割用・円） */
export function calcMemberTotalIncomeForNhiYen(input: {
  totalIncomeYen: number;
  annualPensionMan: number;
  age: number;
}): number {
  const pensionYen = Math.round(input.annualPensionMan * 10_000);
  const pensionIncomeYen = calcPensionIncomeForNhiYen(pensionYen, input.age);
  return Math.max(0, input.totalIncomeYen + pensionIncomeYen);
}
