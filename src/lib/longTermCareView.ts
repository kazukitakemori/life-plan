import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type { LongTermCareViewConfig } from '../types/longTermCareView';
import { calcMemberAnnualPensionManByMember } from './calculationBreakdown';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import { buildMemberTaxBreakdownData, TAX_RATE_CONSTANTS } from './taxCalculator';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function formatPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export function buildLongTermCareViewConfig(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear?: number;
  memberId: string;
  simulationStartYear?: number;
  memberTaxBreakdownData?: import('./taxCalculator').MemberTaxBreakdownData | null;
}): LongTermCareViewConfig | null {
  const calendarYear = input.calendarYear ?? input.referenceDate.getFullYear();
  const member = input.familyMembers.find((m) => m.id === input.memberId);
  if (!member || member.role === 'pet') {
    return null;
  }

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

  if (!breakdownData) {
    return null;
  }

  const memberAge =
    getMemberAgeAtYearEnd(member, input.referenceDate, calendarYear) ?? null;
  const ltc = breakdownData.longTermCare;
  const monthlyPremiumYen =
    ltc.memberPremiumYen > 0 ? Math.round(ltc.memberPremiumYen / 12) : null;

  const notes = [
    `試算対象は${calendarYear}年です。`,
    `65歳以上の第1号被保険者は福岡市概算（年額${formatYen(TAX_RATE_CONSTANTS.longTermCareFirstClassAnnual)}）を採用しています。`,
    '40～64歳の第2号被保険者は、給与から天引き（会社員）または国保の介護分（自営業等）で納付します。',
    '所得に応じた軽減・減免、特定入所者介護サービス費等は反映していません。',
  ];

  if (ltc.statusNote) {
    notes.unshift(ltc.statusNote);
  }

  if (ltc.rate != null) {
    notes.unshift(
      `第2号被保険者の保険料率（被保険者負担分）は${formatPercent(ltc.rate)}です。`,
    );
  }

  return {
    fiscalYearLabel: `${calendarYear}年`,
    memberAge,
    isApplicable: ltc.isApplicable,
    variant: ltc.variant,
    memberPremiumYen: ltc.memberPremiumYen,
    monthlyPremiumYen,
    rate: ltc.rate,
    viaNhi: ltc.viaNhi,
    statusLabel: ltc.statusLabel,
    statusNote: ltc.isApplicable ? null : ltc.statusNote,
    notes,
  };
}

export { formatYen, formatPercent };
