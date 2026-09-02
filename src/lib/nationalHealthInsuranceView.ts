import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type {
  NationalHealthInsuranceViewConfig,
  NhiMemberIncomeSummary,
  NhiPremiumTableColumn,
} from '../types/nationalHealthInsuranceView';
import { FUKUOKA_NHI_OFFICIAL_SEGMENTS } from '../types/nationalHealthInsuranceView';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { calcMemberMonthlyPensionBreakdownMan } from './pensionIncome';
import { sumPensionBreakdown } from '../types/cashFlow';
import { buildMemberTaxBreakdownData } from './taxCalculator';
import {
  calcFukuokaHouseholdNhiBreakdown,
  FUKUOKA_NHI_RATES,
  formatNhiReductionTier,
  type NhiHouseholdBreakdown,
  type NhiMemberIncomeDetail,
  type NhiSegmentId,
} from './nationalHealthInsurance';

function calcMemberAnnualPensionManByMember(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear: number;
}): Record<string, number> {
  const result: Record<string, number> = {};

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const memberState =
      input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
    const incomeEntries = input.incomeByMember[member.id] ?? [];
    let memberPension = 0;
    for (let month = 1; month <= 12; month++) {
      memberPension += sumPensionBreakdown(
        calcMemberMonthlyPensionBreakdownMan(
          member,
          memberState,
          incomeEntries,
          input.referenceDate,
          input.calendarYear,
          month,
        ),
      );
    }
    result[member.id] = memberPension;
  }

  return result;
}

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function formatPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function summarizeMemberIncome(member: NhiMemberIncomeDetail): NhiMemberIncomeSummary {
  const lines: string[] = [];

  if (member.grossSalaryRevenueYen > 0) {
    let line = `給与収入 ${formatYen(member.grossSalaryRevenueYen)} − 給与所得控除 ${formatYen(member.salaryIncomeDeductionYen)}`;
    if (member.incomeAdjustmentDeductionYen > 0) {
      line += ` − 所得調整控除 ${formatYen(member.incomeAdjustmentDeductionYen)}`;
    }
    line += ` ＝ 給与所得 ${formatYen(member.salaryIncomeYen)}`;
    lines.push(line);
  }

  if (member.pensionRevenueYen > 0) {
    lines.push(
      `公的年金収入 ${formatYen(member.pensionRevenueYen)} → 雑所得 ${formatYen(member.pensionIncomeYen)}`,
    );
  }

  if (member.otherIncomeYen > 0) {
    lines.push(`その他所得 ${formatYen(member.otherIncomeYen)}`);
  }

  if (lines.length === 0) {
    lines.push('所得なし');
  }

  return {
    name: member.memberLabel ?? '加入者',
    totalIncomeYen: member.totalIncomeYen,
    lines,
  };
}

function isSegmentApplicable(
  segment: NhiSegmentId,
  breakdown: NhiHouseholdBreakdown,
): boolean {
  if (segment === 'ltc') {
    return breakdown.members.some((member) => member.hasLtc);
  }
  return true;
}

function perCapitaLabelForSegment(
  segment: NhiSegmentId,
  breakdown: NhiHouseholdBreakdown,
): string {
  if (!isSegmentApplicable(segment, breakdown)) {
    return '—';
  }

  const rate = breakdown.flatPayRate;
  const rates = FUKUOKA_NHI_RATES[segment];
  let units = 0;
  const noteParts: string[] = [];

  for (const member of breakdown.members) {
    if (segment === 'childcare') {
      if (member.isUnder18) continue;
      units += 1;
      continue;
    }

    if (segment === 'ltc' && !member.hasLtc) continue;

    const unit = member.isPreschool ? 0.5 : 1;
    units += unit;
    if (member.isPreschool) {
      noteParts.push('未就学児5割減');
    }
  }

  if (units <= 0) {
    return '—';
  }

  const unitText = Number.isInteger(units) ? `${units}人` : `${units}人相当`;
  const base = `${formatYen(rates.perCapitaYen)} × ${unitText}`;
  if (rate < 1) {
    noteParts.push(formatNhiReductionTier(breakdown.reductionTier));
  }
  const uniqueNotes = [...new Set(noteParts)];
  return uniqueNotes.length > 0 ? `${base}（${uniqueNotes.join('・')}）` : base;
}

function buildTableColumn(
  segment: NhiSegmentId,
  breakdown: NhiHouseholdBreakdown,
  incomeBaseYen: number,
): NhiPremiumTableColumn {
  const meta = FUKUOKA_NHI_OFFICIAL_SEGMENTS.find((item) => item.segment === segment)!;
  const components = breakdown[segment];
  const rates = FUKUOKA_NHI_RATES[segment];
  const applicable = isSegmentApplicable(segment, breakdown);

  return {
    segment,
    officialRef: meta.officialRef,
    resultRef: meta.resultRef,
    title: meta.title,
    subtitle: meta.subtitle,
    incomeRate: rates.incomeRate,
    incomeBaseYen: applicable ? incomeBaseYen : 0,
    incomeYen: applicable ? components.incomeYen : 0,
    perCapitaUnitYen: rates.perCapitaYen,
    perCapitaLabel: perCapitaLabelForSegment(segment, breakdown),
    perCapitaYen: applicable ? components.perCapitaYen : 0,
    perHouseholdYen: applicable ? components.perHouseholdYen : 0,
    assetYen: applicable ? components.assetYen : 0,
    capYen: rates.annualCapYen,
    rawTotalYen: applicable ? components.rawTotalYen : 0,
    cappedTotalYen: applicable ? components.cappedTotalYen : 0,
    applicable,
  };
}

function buildTableColumns(
  breakdown: NhiHouseholdBreakdown,
  incomeBaseGeneralYen: number,
  incomeBaseLtcYen: number,
): NhiPremiumTableColumn[] {
  return FUKUOKA_NHI_OFFICIAL_SEGMENTS.map((meta) =>
    buildTableColumn(
      meta.segment,
      breakdown,
      meta.segment === 'ltc' ? incomeBaseLtcYen : incomeBaseGeneralYen,
    ),
  );
}

function calcIncomeBases(breakdown: NhiHouseholdBreakdown): {
  incomeBaseGeneralYen: number;
  incomeBaseLtcYen: number;
} {
  let incomeBaseGeneralYen = 0;
  let incomeBaseLtcYen = 0;

  for (const member of breakdown.members) {
    const base = Math.max(
      0,
      member.totalIncomeYen - FUKUOKA_NHI_RATES.basicDeductionYen,
    );
    incomeBaseGeneralYen += base;
    if (member.hasLtc) {
      incomeBaseLtcYen += base;
    }
  }

  return { incomeBaseGeneralYen, incomeBaseLtcYen };
}

export function buildNationalHealthInsuranceViewConfig(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear?: number;
  memberId: string;
  simulationStartYear?: number;
  assessmentContextNote?: string;
  memberTaxBreakdownData?: import('./taxCalculator').MemberTaxBreakdownData | null;
}): NationalHealthInsuranceViewConfig | null {
  const calendarYear = input.calendarYear ?? input.referenceDate.getFullYear();
  const levyIncomeYear = calendarYear - 1;
  const annualPensionManByMember = calcMemberAnnualPensionManByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
    calendarYear,
  });

  const breakdownData =
    input.memberTaxBreakdownData ??
    buildMemberTaxBreakdownData({
      familyMembers: input.familyMembers,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      calendarYear,
      memberId: input.memberId,
      annualPensionManByMember,
      pensionByMember: input.pensionByMember,
      simulationStartYear:
        input.simulationStartYear ?? input.referenceDate.getFullYear(),
    });

  const nhi = breakdownData?.nhiInsurance;
  const breakdown =
    nhi?.breakdown ?? calcFukuokaHouseholdNhiBreakdown([]);
  if (!breakdownData) {
    return null;
  }

  const { incomeBaseGeneralYen, incomeBaseLtcYen } = calcIncomeBases(breakdown);
  const columns = buildTableColumns(
    breakdown,
    incomeBaseGeneralYen,
    incomeBaseLtcYen,
  );

  const notes = [
    input.assessmentContextNote ??
      `試算対象は${calendarYear}年です。`,
    `所得割の算定基礎は${levyIncomeYear}年（前年1月～12月）の所得です。Q7の前年度収入設定を反映しています。`,
    '保険料は国保加入者全員分を世帯ごとに計算します。',
    '(1)基礎分・(2)支援分・(4)子ども分は全加入者、(3)介護分は40～64歳の加入者のみ負担します。',
    '(1)～(4)それぞれの保険料が賦課限度額を超える場合は、賦課限度額が保険料となります。',
    '①～④は各区分ごとに100円未満を切り捨ててから合算します。',
    '料率は福岡市・2026年度（出典：福岡市国民健康保険料の計算方法）に基づく概算です。',
    '資産割は固定資産税の入力がないため0円としています。',
  ];

  if (breakdown.insuredCount === 0) {
    notes.unshift('この世帯に国保加入者がいません。');
  } else if (!nhi?.isNhiMember) {
    notes.unshift(
      'このメンバーは国保加入対象外です。同一世帯の加入者に基づく世帯試算を表示しています。',
    );
  }

  return {
    fiscalYearLabel: `${calendarYear}年`,
    householdIncomeYen: breakdown.householdIncomeYen,
    insuredCount: breakdown.insuredCount,
    salaryEarnerCount: breakdown.salaryEarnerCount,
    reductionLabel: formatNhiReductionTier(breakdown.reductionTier),
    incomeBaseGeneralYen,
    incomeBaseLtcYen,
    members: breakdown.members.map(summarizeMemberIncome),
    columns,
    premiumYen: breakdown.premiumYen,
    isNhiMember: nhi?.isNhiMember ?? false,
    memberShareYen: nhi?.memberShareYen ?? 0,
    nationalPensionYen: nhi?.nationalPensionYen ?? 0,
    notes,
  };
}

export { formatYen, formatPercent };
