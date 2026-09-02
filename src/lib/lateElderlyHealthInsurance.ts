/**
 * 後期高齢者医療保険料（福岡市・国保の医療＋支援分をベースに個人単位で算定）
 * - 平等割なし（所得割＋均等割のみ）
 * - 所得割は本人の所得で個別計算
 * - 均等割の軽減判定は同一世帯の後期高齢被保険者のみで判定
 */
import {
  FUKUOKA_NHI_RATES,
  calcFukuokaNhiReductionTier,
  formatNhiReductionTier,
  nhiFlatPremiumPayRate,
  type NhiMemberInput,
  type NhiReductionTier,
} from './nationalHealthInsurance';

const LATE_ELDERLY_SEGMENTS = ['medical', 'support'] as const;

export const LATE_ELDERLY_HEALTH_INCOME_RATE =
  FUKUOKA_NHI_RATES.medical.incomeRate + FUKUOKA_NHI_RATES.support.incomeRate;

export const LATE_ELDERLY_HEALTH_PER_CAPITA_YEN =
  FUKUOKA_NHI_RATES.medical.perCapitaYen + FUKUOKA_NHI_RATES.support.perCapitaYen;

export interface LateElderlyHealthMemberBreakdown {
  memberId?: string;
  totalIncomeYen: number;
  incomeBaseYen: number;
  incomeLevyYen: number;
  rawPerCapitaYen: number;
  perCapitaYen: number;
  premiumYen: number;
  pensionRevenueYen: number;
  pensionIncomeYen: number;
  salaryIncomeYen: number;
  otherIncomeYen: number;
}

export interface LateElderlyHealthHouseholdBreakdown {
  members: LateElderlyHealthMemberBreakdown[];
  householdIncomeYen: number;
  insuredCount: number;
  salaryEarnerCount: number;
  reductionTier: NhiReductionTier;
  flatPayRate: number;
  incomeLevyRate: number;
  perCapitaUnitYen: number;
}

function truncateTo100Yen(amount: number): number {
  return Math.floor(Math.max(0, amount) / 100) * 100;
}

function applySegmentCap(amount: number, cap: number): number {
  return Math.min(Math.max(0, amount), cap);
}

/**
 * 1人分の後期高齢者医療保険料（医療分＋支援分、平等割なし）。
 */
export function calcLateElderlyHealthMemberPremiumYen(
  member: NhiMemberInput,
  flatPayRate: number,
): LateElderlyHealthMemberBreakdown {
  const incomeBaseYen = Math.max(
    0,
    member.totalIncomeYen - FUKUOKA_NHI_RATES.basicDeductionYen,
  );

  let incomeLevyYen = 0;
  let premiumYen = 0;
  const rawPerCapitaYen = LATE_ELDERLY_HEALTH_PER_CAPITA_YEN;
  const perCapitaYen = rawPerCapitaYen * flatPayRate;

  for (const segment of LATE_ELDERLY_SEGMENTS) {
    const rates = FUKUOKA_NHI_RATES[segment];
    const segmentIncomeYen = incomeBaseYen * rates.incomeRate;
    incomeLevyYen += segmentIncomeYen;
    const segmentRawTotalYen = segmentIncomeYen + rates.perCapitaYen * flatPayRate;
    const segmentTruncatedYen = truncateTo100Yen(segmentRawTotalYen);
    premiumYen += applySegmentCap(segmentTruncatedYen, rates.annualCapYen);
  }

  return {
    memberId: member.memberId,
    totalIncomeYen: member.totalIncomeYen,
    incomeBaseYen,
    incomeLevyYen,
    rawPerCapitaYen,
    perCapitaYen,
    premiumYen,
    pensionRevenueYen: member.pensionRevenueYen,
    pensionIncomeYen: member.pensionIncomeYen,
    salaryIncomeYen: member.salaryIncomeYen,
    otherIncomeYen: member.otherIncomeYen,
  };
}

/**
 * 同一世帯の後期高齢被保険者をまとめて軽減区分を判定し、各人の保険料を個別算定する。
 */
export function calcLateElderlyHealthHouseholdBreakdown(
  members: NhiMemberInput[],
): LateElderlyHealthHouseholdBreakdown {
  if (members.length === 0) {
    return {
      members: [],
      householdIncomeYen: 0,
      insuredCount: 0,
      salaryEarnerCount: 0,
      reductionTier: 'none',
      flatPayRate: 1,
      incomeLevyRate: LATE_ELDERLY_HEALTH_INCOME_RATE,
      perCapitaUnitYen: LATE_ELDERLY_HEALTH_PER_CAPITA_YEN,
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

  return {
    members: members.map((member) =>
      calcLateElderlyHealthMemberPremiumYen(member, flatPayRate),
    ),
    householdIncomeYen,
    insuredCount,
    salaryEarnerCount,
    reductionTier,
    flatPayRate,
    incomeLevyRate: LATE_ELDERLY_HEALTH_INCOME_RATE,
    perCapitaUnitYen: LATE_ELDERLY_HEALTH_PER_CAPITA_YEN,
  };
}

export { formatNhiReductionTier as formatLateElderlyReductionTier };
