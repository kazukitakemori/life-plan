import type { NhiSegmentId } from '../lib/nationalHealthInsurance';

/** 福岡市公式ページの区分表記 */
export interface NhiOfficialSegmentMeta {
  segment: NhiSegmentId;
  officialRef: string;
  resultRef: string;
  title: string;
  subtitle: string;
}

export const FUKUOKA_NHI_OFFICIAL_SEGMENTS: NhiOfficialSegmentMeta[] = [
  {
    segment: 'medical',
    officialRef: '(1)',
    resultRef: '①',
    title: '基礎分',
    subtitle: '国保加入者の医療費のため',
  },
  {
    segment: 'support',
    officialRef: '(2)',
    resultRef: '②',
    title: '支援分',
    subtitle: '後期高齢者医療制度のため',
  },
  {
    segment: 'ltc',
    officialRef: '(3)',
    resultRef: '③',
    title: '介護分',
    subtitle: '介護保険事業のため',
  },
  {
    segment: 'childcare',
    officialRef: '(4)',
    resultRef: '④',
    title: '子ども分',
    subtitle: '子ども・子育て支援金制度のため',
  },
];

export interface NhiPremiumTableColumn {
  segment: NhiSegmentId;
  officialRef: string;
  resultRef: string;
  title: string;
  subtitle: string;
  incomeRate: number;
  incomeBaseYen: number;
  incomeYen: number;
  perCapitaUnitYen: number;
  perCapitaLabel: string;
  perCapitaYen: number;
  perHouseholdYen: number;
  assetYen: number;
  capYen: number;
  rawTotalYen: number;
  cappedTotalYen: number;
  /** 介護分など、当該区分が世帯に適用されるか */
  applicable: boolean;
}

export interface NhiMemberIncomeSummary {
  name: string;
  totalIncomeYen: number;
  lines: string[];
}

export interface NationalHealthInsuranceViewConfig {
  fiscalYearLabel: string;
  householdIncomeYen: number;
  insuredCount: number;
  salaryEarnerCount: number;
  reductionLabel: string;
  incomeBaseGeneralYen: number;
  incomeBaseLtcYen: number;
  members: NhiMemberIncomeSummary[];
  columns: NhiPremiumTableColumn[];
  premiumYen: number;
  isNhiMember: boolean;
  memberShareYen: number;
  nationalPensionYen: number;
  notes: string[];
}
