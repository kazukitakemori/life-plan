import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type { LateElderlyHealthViewConfig } from '../types/lateElderlyHealthView';
import { calcMemberAnnualPensionManByMember } from './calculationBreakdown';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import { buildMemberTaxBreakdownData } from './taxCalculator';
import { resolveLevyIncomeReferenceYear } from './priorYearIncomeResolution';

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function formatPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

function resolveStatus(input: {
  isApplicable: boolean;
  memberAge: number | null;
}): Pick<LateElderlyHealthViewConfig, 'statusLabel' | 'statusNote'> {
  if (input.isApplicable) {
    return {
      statusLabel: '納付対象（75歳以上）',
      statusNote: null,
    };
  }

  if (input.memberAge != null && input.memberAge < 75) {
    return {
      statusLabel: '対象外',
      statusNote: `${input.memberAge}歳のため、後期高齢者医療制度の対象外です（75歳以上で適用）。75歳以降の満額試算は、該当年齢に達した暦年で表示します。`,
    };
  }

  return {
    statusLabel: '対象外',
    statusNote:
      '後期高齢者医療の加入対象となる年金・給与収入がない、または被扶養者のため試算対象外です。',
  };
}

export function buildLateElderlyHealthViewConfig(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear?: number;
  memberId: string;
  simulationStartYear?: number;
  memberTaxBreakdownData?: import('./taxCalculator').MemberTaxBreakdownData | null;
}): LateElderlyHealthViewConfig | null {
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
  const lateElderly = breakdownData.lateElderlyHealth;
  const status = resolveStatus({
    isApplicable: lateElderly.isApplicable,
    memberAge,
  });

  const levyIncomeYear = resolveLevyIncomeReferenceYear(calendarYear);
  const notes = [
    `試算対象は${calendarYear}年です（75歳以上で後期高齢者医療の保険料を満額負担する年）。`,
    `所得割の算定基礎は${levyIncomeYear}年（前年1月～12月）の所得です。Q7の前年度収入設定を反映しています。`,
    `所得割率は福岡市国保の医療分＋支援分（${formatPercent(lateElderly.incomeLevyRate)}）を採用しています。`,
    `均等割は福岡市国保の医療分＋支援分（軽減前 ${formatYen(lateElderly.rawPerCapitaYen)}）を採用しています。`,
    '後期高齢者医療の保険料は加入者ごとに個別計算します（平等割はありません）。',
    lateElderly.lateElderlyInsuredCount > 1
      ? `均等割の軽減判定は、同一世帯の後期高齢被保険者${lateElderly.lateElderlyInsuredCount}人の所得合計（${formatYen(lateElderly.householdIncomeYen)}）で行います。`
      : '均等割の軽減判定は、この人の所得のみで行います。',
    '算定基礎となる所得 ＝ 公的年金等の雑所得 ＋ 給与所得等（給与収入がある場合）。',
    '自治体ごとの保険料率・均等割額・所得割の上限は福岡市ベースの概算です。',
    '前期高齢者（65～74歳）の医療保険は国民健康保険または組合健保の対象です。',
  ];

  if (!status.statusNote && lateElderly.isApplicable) {
    notes.unshift(
      '75歳以上は国民健康保険から後期高齢者医療制度へ移行します。',
    );
  } else if (status.statusNote) {
    notes.unshift(status.statusNote);
  }

  return {
    fiscalYearLabel: `${calendarYear}年`,
    memberAge,
    isApplicable: lateElderly.isApplicable,
    pensionRevenueYen: lateElderly.pensionRevenueYen,
    pensionIncomeYen: lateElderly.pensionIncomeYen,
    salaryIncomeYen: lateElderly.salaryIncomeYen,
    otherIncomeYen: lateElderly.otherIncomeYen,
    incomeBaseYen: lateElderly.incomeBaseYen,
    incomeLevyRate: lateElderly.incomeLevyRate,
    incomeLevyYen: lateElderly.incomeLevyYen,
    rawPerCapitaYen: lateElderly.rawPerCapitaYen,
    fixedYen: lateElderly.fixedYen,
    memberPremiumYen: lateElderly.memberPremiumYen,
    householdIncomeYen: lateElderly.householdIncomeYen,
    lateElderlyInsuredCount: lateElderly.lateElderlyInsuredCount,
    reductionLabel: lateElderly.reductionLabel,
    flatPayRate: lateElderly.flatPayRate,
    levyIncomeYear,
    notes,
    ...status,
  };
}

export { formatYen, formatPercent };
