/**
 * 福岡市・令和8年度 国民健康保険料率
 * 出典: https://www.city.fukuoka.lg.jp/hofuku/kokuho/hp/seido/06-02.html
 */
import { calcPensionMiscIncomeYen } from './publicPensionDeduction';

export const FUKUOKA_NHI_RATES = {
  medical: {
    incomeRate: 0.0558,
    perCapitaYen: 19_807,
    perHouseholdYen: 18_664,
    annualCapYen: 670_000,
    assetRate: 0,
  },
  support: {
    incomeRate: 0.0314,
    perCapitaYen: 10_441,
    perHouseholdYen: 9_838,
    annualCapYen: 260_000,
    assetRate: 0,
  },
  ltc: {
    incomeRate: 0.0261,
    perCapitaYen: 10_160,
    perHouseholdYen: 7_751,
    annualCapYen: 170_000,
    assetRate: 0,
  },
  childcare: {
    incomeRate: 0.0028,
    /** 18歳以上被保険者均等割72円を含む */
    perCapitaYen: 1_039,
    perHouseholdYen: 911,
    annualCapYen: 30_000,
    assetRate: 0,
  },
  /** 所得割の算定基礎から控除（1人あたり） */
  basicDeductionYen: 430_000,
} as const;

export type NhiReductionTier = 'none' | '20' | '50' | '70';

export type NhiSegmentId = 'medical' | 'support' | 'ltc' | 'childcare';

export interface NhiMemberIncomeDetail {
  memberId?: string;
  memberLabel?: string;
  age: number;
  grossSalaryRevenueYen: number;
  salaryIncomeDeductionYen: number;
  incomeAdjustmentDeductionYen: number;
  salaryIncomeYen: number;
  pensionRevenueYen: number;
  pensionIncomeYen: number;
  otherIncomeYen: number;
  /** 総所得金額等（軽減判定・所得割算定の基礎） */
  totalIncomeYen: number;
  hasSalary: boolean;
  isPreschool: boolean;
  isUnder18: boolean;
  hasLtc: boolean;
}

export type NhiMemberInput = NhiMemberIncomeDetail;

export interface NhiSegmentComponents {
  incomeYen: number;
  perCapitaYen: number;
  perHouseholdYen: number;
  assetYen: number;
  rawTotalYen: number;
  cappedTotalYen: number;
}

export interface NhiHouseholdBreakdown {
  members: NhiMemberIncomeDetail[];
  householdIncomeYen: number;
  insuredCount: number;
  salaryEarnerCount: number;
  reductionTier: NhiReductionTier;
  flatPayRate: number;
  fixedAssetTaxYen: number;
  medical: NhiSegmentComponents;
  support: NhiSegmentComponents;
  ltc: NhiSegmentComponents;
  childcare: NhiSegmentComponents;
  premiumYen: number;
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

function truncateTo100Yen(amount: number): number {
  return Math.floor(Math.max(0, amount) / 100) * 100;
}

function memberPerCapitaRate(
  member: NhiMemberIncomeDetail,
  segment: NhiSegmentId,
  flatPayRate: number,
): number {
  if (segment === 'childcare') {
    if (member.isUnder18) return 0;
    return flatPayRate;
  }

  if (segment === 'ltc' && !member.hasLtc) return 0;

  let rate = flatPayRate;
  if (member.isPreschool) {
    rate *= 0.5;
  }
  return rate;
}

function calcSegmentAssetYen(
  fixedAssetTaxYen: number,
  assetRate: number,
): number {
  if (fixedAssetTaxYen <= 0 || assetRate <= 0) return 0;
  return Math.floor(fixedAssetTaxYen * assetRate);
}

function buildEmptySegment(): NhiSegmentComponents {
  return {
    incomeYen: 0,
    perCapitaYen: 0,
    perHouseholdYen: 0,
    assetYen: 0,
    rawTotalYen: 0,
    cappedTotalYen: 0,
  };
}

function calcSegmentBreakdown(input: {
  segment: NhiSegmentId;
  members: NhiMemberIncomeDetail[];
  flatPayRate: number;
  fixedAssetTaxYen: number;
  includeHouseholdFlat: boolean;
}): NhiSegmentComponents {
  const rates = FUKUOKA_NHI_RATES[input.segment];

  let incomeYen = 0;
  let perCapitaYen = 0;

  for (const member of input.members) {
    const incomeBase = Math.max(
      0,
      member.totalIncomeYen - FUKUOKA_NHI_RATES.basicDeductionYen,
    );

    if (input.segment === 'ltc') {
      if (member.hasLtc) {
        incomeYen += incomeBase * rates.incomeRate;
      }
    } else {
      incomeYen += incomeBase * rates.incomeRate;
    }

    perCapitaYen +=
      rates.perCapitaYen *
      memberPerCapitaRate(member, input.segment, input.flatPayRate);
  }

  const perHouseholdYen = input.includeHouseholdFlat
    ? rates.perHouseholdYen * input.flatPayRate
    : 0;
  const assetYen = calcSegmentAssetYen(input.fixedAssetTaxYen, rates.assetRate);
  const rawTotalYen = incomeYen + perCapitaYen + perHouseholdYen + assetYen;
  const truncatedTotalYen = truncateTo100Yen(rawTotalYen);

  return {
    incomeYen,
    perCapitaYen,
    perHouseholdYen,
    assetYen,
    rawTotalYen,
    cappedTotalYen: applySegmentCap(truncatedTotalYen, rates.annualCapYen),
  };
}

/**
 * 福岡市ベースの国保料内訳（医療・支援・介護・子育て、軽減適用後）。
 * 国民年金は含まない。
 */
export function calcFukuokaHouseholdNhiBreakdown(
  members: NhiMemberInput[],
  options?: { fixedAssetTaxYen?: number },
): NhiHouseholdBreakdown {
  const fixedAssetTaxYen = options?.fixedAssetTaxYen ?? 0;

  if (members.length === 0) {
    return {
      members: [],
      householdIncomeYen: 0,
      insuredCount: 0,
      salaryEarnerCount: 0,
      reductionTier: 'none',
      flatPayRate: 1,
      fixedAssetTaxYen,
      medical: buildEmptySegment(),
      support: buildEmptySegment(),
      ltc: buildEmptySegment(),
      childcare: buildEmptySegment(),
      premiumYen: 0,
    };
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

  const hasLtcHousehold = members.some((member) => member.hasLtc);

  const medical = calcSegmentBreakdown({
    segment: 'medical',
    members,
    flatPayRate,
    fixedAssetTaxYen,
    includeHouseholdFlat: true,
  });
  const support = calcSegmentBreakdown({
    segment: 'support',
    members,
    flatPayRate,
    fixedAssetTaxYen,
    includeHouseholdFlat: true,
  });
  const ltc = hasLtcHousehold
    ? calcSegmentBreakdown({
        segment: 'ltc',
        members,
        flatPayRate,
        fixedAssetTaxYen,
        includeHouseholdFlat: true,
      })
    : buildEmptySegment();
  const childcare = calcSegmentBreakdown({
    segment: 'childcare',
    members,
    flatPayRate,
    fixedAssetTaxYen,
    includeHouseholdFlat: true,
  });

  const premiumYen =
    medical.cappedTotalYen +
    support.cappedTotalYen +
    ltc.cappedTotalYen +
    childcare.cappedTotalYen;

  return {
    members,
    householdIncomeYen,
    insuredCount,
    salaryEarnerCount,
    reductionTier,
    flatPayRate,
    fixedAssetTaxYen,
    medical,
    support,
    ltc,
    childcare,
    premiumYen,
  };
}

/**
 * 福岡市ベースの国保料（年額・円）。後方互換ラッパー。
 */
export function calcFukuokaHouseholdNhiPremiumYen(members: NhiMemberInput[]): {
  premiumYen: number;
  reductionTier: NhiReductionTier;
} {
  const breakdown = calcFukuokaHouseholdNhiBreakdown(members);
  return {
    premiumYen: breakdown.premiumYen,
    reductionTier: breakdown.reductionTier,
  };
}

/** 公的年金等の雑所得（円）— 国保の総所得金額等算定用 */
export function calcPensionIncomeForNhiYen(
  pensionYen: number,
  age: number,
  otherIncomeYen = 0,
): number {
  return calcPensionMiscIncomeYen(pensionYen, age, otherIncomeYen);
}

/** 国保の総所得金額等（軽減判定・所得割用・円） */
export function calcMemberTotalIncomeForNhiYen(input: {
  totalIncomeYen: number;
  annualPensionMan: number;
  age: number;
}): number {
  const pensionYen = Math.round(input.annualPensionMan * 10_000);
  const pensionIncomeYen = calcPensionIncomeForNhiYen(
    pensionYen,
    input.age,
    input.totalIncomeYen,
  );
  return Math.max(0, input.totalIncomeYen + pensionIncomeYen);
}

/** 年齢区分に基づく国保加入者属性 */
export function resolveNhiMemberAgeFlags(age: number): {
  isPreschool: boolean;
  isUnder18: boolean;
  hasLtc: boolean;
} {
  return {
    isPreschool: age < 6,
    isUnder18: age < 18,
    hasLtc: age >= 40 && age < 65,
  };
}

/** 世帯内の国保被保険者按分（端数は先頭から1円ずつ） */
export function allocateNhiPremiumAmongMembers(
  premiumYen: number,
  memberCount: number,
): number[] {
  if (memberCount <= 0 || premiumYen <= 0) {
    return Array.from({ length: Math.max(0, memberCount) }, () => 0);
  }

  const baseShare = Math.floor(premiumYen / memberCount);
  let remainder = premiumYen - baseShare * memberCount;
  return Array.from({ length: memberCount }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return baseShare + extra;
  });
}
