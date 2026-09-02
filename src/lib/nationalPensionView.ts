import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type { NationalPensionViewConfig } from '../types/nationalPensionView';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import {
  NATIONAL_PENSION_ANNUAL_YEN,
  NATIONAL_PENSION_MONTHLY_YEN,
} from './pensionConstants';
import { buildMemberTaxBreakdownData } from './taxCalculator';
import { calcMemberAnnualPensionManByMember } from './calculationBreakdown';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function resolveStatus(input: {
  memberPremiumYen: number;
  isEmployeeInsured: boolean;
  isNhiMember: boolean;
  memberAge: number | null;
}): Pick<NationalPensionViewConfig, 'isLiable' | 'statusLabel' | 'statusNote'> {
  if (input.memberPremiumYen > 0) {
    return {
      isLiable: true,
      statusLabel: '納付対象（第1号被保険者）',
      statusNote: null,
    };
  }

  if (input.isEmployeeInsured) {
    return {
      isLiable: false,
      statusLabel: '対象外',
      statusNote:
        '会社員等（厚生年金被保険者）のため、国民年金の直接納付はありません。',
    };
  }

  if (input.memberAge != null && input.memberAge >= 75) {
    return {
      isLiable: false,
      statusLabel: '対象外',
      statusNote: '75歳以上は後期高齢者医療制度の対象です。',
    };
  }

  if (input.memberAge != null && input.memberAge >= 60) {
    return {
      isLiable: false,
      statusLabel: '対象外',
      statusNote: '60歳以上は国民年金保険料の納付はありません。',
    };
  }

  if (input.isNhiMember) {
    return {
      isLiable: false,
      statusLabel: '対象外',
      statusNote: '国民年金の納付対象外と判定されています。',
    };
  }

  return {
    isLiable: false,
    statusLabel: '対象外',
    statusNote:
      '国民年金の加入・納付対象となる収入がない、または被扶養者のため試算対象外です。',
  };
}

export function buildNationalPensionViewConfig(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear?: number;
  memberId: string;
  simulationStartYear?: number;
  memberTaxBreakdownData?: import('./taxCalculator').MemberTaxBreakdownData | null;
}): NationalPensionViewConfig | null {
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
  const memberPremiumYen = breakdownData.nhiInsurance.nationalPensionYen;
  const status = resolveStatus({
    memberPremiumYen,
    isEmployeeInsured: breakdownData.employeeInsurance.isEmployeeInsured,
    isNhiMember: breakdownData.nhiInsurance.isNhiMember,
    memberAge,
  });

  const notes = [
    `試算対象は${calendarYear}年です。`,
    `保険料は2026年度の月額${formatYen(NATIONAL_PENSION_MONTHLY_YEN)}（年額${formatYen(NATIONAL_PENSION_ANNUAL_YEN)}）を採用しています。`,
    '事業主・自営業者など第1号被保険者で、60歳未満の場合に年額保険料を計上します。',
    '会社員等は厚生年金被保険者となるため、国民年金の直接納付はありません。',
    '学生納付特例・猶予などの制度は反映していません。',
  ];

  if (!status.isLiable && status.statusNote) {
    notes.unshift(status.statusNote);
  }

  return {
    fiscalYearLabel: `${calendarYear}年`,
    monthlyPremiumYen: NATIONAL_PENSION_MONTHLY_YEN,
    annualPremiumYen: NATIONAL_PENSION_ANNUAL_YEN,
    memberPremiumYen,
    memberAge,
    notes,
    ...status,
  };
}

export { formatYen };
