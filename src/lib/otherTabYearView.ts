import { buildCalculationBreakdownConfigs } from './calculationBreakdown';
import { buildLateElderlyHealthViewConfig } from './lateElderlyHealthView';
import { buildLongTermCareViewConfig } from './longTermCareView';
import { buildNationalHealthInsuranceViewConfig } from './nationalHealthInsuranceView';
import { buildNationalPensionViewConfig } from './nationalPensionView';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import {
  formatSimulationPeriodLabel,
  resolveOtherStepSimulationTiming,
} from './otherCashFlowLinkage';
import { buildSecondLifeTaxSummaryConfig } from './secondLifeTaxSummary';
import { resolveFullPensionCalendarYear } from './secondLifeAssessment';
import { createDefaultPensionMemberState } from './pensionDefaults';
import {
  resolveOtherTabTaxBreakdownInput,
  type OtherTabTaxBreakdownInput,
} from './householdTaxYear';
import type { MemberTaxBreakdownData } from './taxCalculator';
import type { CashFlowTableData } from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type { CalculationBreakdownConfig } from '../types/calculationBreakdown';
import type { LateElderlyHealthViewConfig } from '../types/lateElderlyHealthView';
import type { LongTermCareViewConfig } from '../types/longTermCareView';
import type { NationalHealthInsuranceViewConfig } from '../types/nationalHealthInsuranceView';
import type { NationalPensionViewConfig } from '../types/nationalPensionView';
import type { SecondLifeTaxSummaryConfig } from '../types/secondLifeTaxSummary';

export const OTHER_TAB_IDS = {
  taxSummary: 'tax-summary',
  incomeTax: 'income-tax',
  residentTax: 'resident-tax',
  pension: 'pension',
  healthInsurance: 'health-insurance',
  employmentInsurance: 'employment-insurance',
  nationalPension: 'national-pension',
  nationalHealthInsurance: 'national-health-insurance',
  lateElderlyHealth: 'late-elderly-health',
  longTermCare: 'long-term-care',
} as const;

export type OtherTabId = (typeof OTHER_TAB_IDS)[keyof typeof OTHER_TAB_IDS];

export interface OtherTabGroupDef {
  label: string;
  tabIds: OtherTabId[];
}

export const OTHER_TAB_GROUPS: OtherTabGroupDef[] = [
  {
    label: '税金',
    tabIds: [
      OTHER_TAB_IDS.taxSummary,
      OTHER_TAB_IDS.incomeTax,
      OTHER_TAB_IDS.residentTax,
    ],
  },
  {
    label: '社会保険',
    tabIds: [
      OTHER_TAB_IDS.pension,
      OTHER_TAB_IDS.healthInsurance,
      OTHER_TAB_IDS.employmentInsurance,
    ],
  },
  {
    label: '公的保険',
    tabIds: [
      OTHER_TAB_IDS.nationalPension,
      OTHER_TAB_IDS.nationalHealthInsurance,
      OTHER_TAB_IDS.lateElderlyHealth,
      OTHER_TAB_IDS.longTermCare,
    ],
  },
];

export const OTHER_TAB_TITLES: Record<OtherTabId, string> = {
  [OTHER_TAB_IDS.taxSummary]: '試算サマリー',
  [OTHER_TAB_IDS.incomeTax]: '所得税',
  [OTHER_TAB_IDS.residentTax]: '住民税',
  [OTHER_TAB_IDS.pension]: '厚生年金',
  [OTHER_TAB_IDS.healthInsurance]: '健康保険',
  [OTHER_TAB_IDS.employmentInsurance]: '雇用保険',
  [OTHER_TAB_IDS.nationalPension]: '国民年金',
  [OTHER_TAB_IDS.nationalHealthInsurance]: '国民健康保険',
  [OTHER_TAB_IDS.lateElderlyHealth]: '後期高齢者医療',
  [OTHER_TAB_IDS.longTermCare]: '介護保険',
};

export interface OtherTabYearOption {
  calendarYear: number;
  label: string;
  memberAge: number | null;
}

export interface OtherTabYearShortcut {
  id: string;
  label: string;
  calendarYear: number;
}

export interface OtherTabPanelProps {
  breakdownTabs: CalculationBreakdownConfig[];
  nationalPensionViewConfig: NationalPensionViewConfig | null;
  nhiViewConfig: NationalHealthInsuranceViewConfig | null;
  secondLifeTaxSummaryConfig: SecondLifeTaxSummaryConfig | null;
  lateElderlyHealthViewConfig: LateElderlyHealthViewConfig | null;
  longTermCareViewConfig: LongTermCareViewConfig | null;
}

export interface OtherTabYearView {
  calendarYear: number;
  memberAge: number | null;
  yearLabel: string;
  description: string;
  visibleTabIds: OtherTabId[];
  tabGroups: Array<{
    label: string;
    tabs: Array<{ id: OtherTabId; title: string }>;
  }>;
  panelProps: OtherTabPanelProps;
  shortcuts: OtherTabYearShortcut[];
}

export interface BuildOtherTabYearViewInput {
  cashFlowData: CashFlowTableData;
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  headMember: FamilyMember;
  member: FamilyMember;
  calendarYear: number;
}

function resolveVisibleTabIds(
  breakdown: MemberTaxBreakdownData,
  memberAge: number | null,
): OtherTabId[] {
  const ids: OtherTabId[] = [];
  const employee = breakdown.employeeInsurance;
  const nhi = breakdown.nhiInsurance;
  const insuredCount = nhi.breakdown?.insuredCount ?? 0;

  if (breakdown.incomeTax.pensionRevenueYen > 0) {
    ids.push(OTHER_TAB_IDS.taxSummary);
  }

  ids.push(OTHER_TAB_IDS.incomeTax, OTHER_TAB_IDS.residentTax);

  if (
    employee.isEmployeeInsured ||
    employee.annualPensionYen > 0 ||
    employee.annualHealthYen > 0 ||
    employee.annualEmploymentYen > 0
  ) {
    ids.push(
      OTHER_TAB_IDS.pension,
      OTHER_TAB_IDS.healthInsurance,
      OTHER_TAB_IDS.employmentInsurance,
    );
  }

  if (
    (memberAge != null && memberAge < 60 && !employee.isEmployeeInsured) ||
    nhi.nationalPensionYen > 0
  ) {
    ids.push(OTHER_TAB_IDS.nationalPension);
  }

  if (
    nhi.isNhiMember ||
    insuredCount > 0 ||
    (memberAge != null &&
      memberAge >= 20 &&
      memberAge < 75 &&
      !employee.isEmployeeInsured)
  ) {
    ids.push(OTHER_TAB_IDS.nationalHealthInsurance);
  }

  if (
    breakdown.lateElderlyHealth.isApplicable ||
    (memberAge != null && memberAge >= 75)
  ) {
    ids.push(OTHER_TAB_IDS.lateElderlyHealth);
  }

  if (
    breakdown.longTermCare.isApplicable ||
    (memberAge != null && memberAge >= 40)
  ) {
    ids.push(OTHER_TAB_IDS.longTermCare);
  }

  return ids;
}

function buildYearDescription(input: {
  calendarYear: number;
  memberAge: number | null;
  isFirstSimulationYear: boolean;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
}): string {
  const parts = [
    `${input.calendarYear}年の税・社会保険料の計算内訳です。キャッシュフロー表の同年列と同じ算定です。`,
  ];

  if (input.memberAge != null) {
    parts.push(`試算年末時点の年齢は${input.memberAge}歳です。`);
  }

  if (input.isFirstSimulationYear && input.levyPaymentFactor < 1) {
    parts.push(
      `試算初年度は${formatSimulationPeriodLabel(input.monthStart, input.monthEnd)}を対象とし、年間算定額を${input.monthEnd - input.monthStart + 1}か月／12か月で按分してキャッシュフロー表に反映しています。`,
    );
  } else if (input.isFirstSimulationYear) {
    parts.push(
      '試算初年度の継続収入はQ7の12か月年収を算定基礎とします。',
    );
  } else {
    parts.push('継続収入はQ7の12か月年収を算定基礎とします。');
  }

  return parts.join(' ');
}

function resolveYearShortcuts(input: {
  cashFlowData: CashFlowTableData;
  member: FamilyMember;
  pensionByMember: PensionByMember;
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  calendarYear: number;
}): OtherTabYearShortcut[] {
  const shortcuts: OtherTabYearShortcut[] = [];

  if (input.calendarYear !== input.cashFlowData.startYear) {
    shortcuts.push({
      id: 'simulation-start',
      label: '試算開始年',
      calendarYear: input.cashFlowData.startYear,
    });
  }

  const fullPensionYear = resolveFullPensionCalendarYear({
    member: input.member,
    memberState:
      input.pensionByMember[input.member.id] ?? createDefaultPensionMemberState(),
    incomeEntries: input.incomeByMember[input.member.id] ?? [],
    referenceDate: input.referenceDate,
  });

  if (
    fullPensionYear != null &&
    fullPensionYear !== input.calendarYear &&
    !shortcuts.some((shortcut) => shortcut.calendarYear === fullPensionYear)
  ) {
    shortcuts.push({
      id: 'full-pension',
      label: '年金満額受給年',
      calendarYear: fullPensionYear,
    });
  }

  return shortcuts;
}

function buildBreakdownInput(
  input: BuildOtherTabYearViewInput,
): OtherTabTaxBreakdownInput {
  const timing = resolveOtherStepSimulationTiming(
    input.cashFlowData,
    input.headMember,
    input.incomeByMember,
    input.referenceDate,
    input.calendarYear,
  );

  return resolveOtherTabTaxBreakdownInput(input.cashFlowData, {
    familyMembers: input.members,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    pensionByMember: input.pensionByMember,
    referenceDate: input.referenceDate,
    memberId: input.member.id,
    calendarYear: input.calendarYear,
    monthStart: timing.monthStart,
    monthEnd: timing.monthEnd,
    levyPaymentFactor: timing.levyPaymentFactor,
    simulationMonthStart: timing.monthStart,
    simulationMonthEnd: timing.monthEnd,
    simulationStartYear: input.cashFlowData.startYear,
  });
}

export function getOtherTabYearOptions(
  cashFlowData: CashFlowTableData,
  member: FamilyMember,
  referenceDate: Date,
): OtherTabYearOption[] {
  const options: OtherTabYearOption[] = [];

  for (
    let calendarYear = cashFlowData.startYear;
    calendarYear <= cashFlowData.endYear;
    calendarYear++
  ) {
    const memberAge =
      getMemberAgeAtYearEnd(member, referenceDate, calendarYear) ?? null;
    const ageLabel = memberAge != null ? `（${memberAge}歳）` : '';
    options.push({
      calendarYear,
      label: `${calendarYear}年${ageLabel}`,
      memberAge,
    });
  }

  return options;
}

export function buildOtherTabYearView(
  input: BuildOtherTabYearViewInput,
): OtherTabYearView | null {
  const breakdownInput = buildBreakdownInput(input);
  const breakdownData = breakdownInput.memberTaxBreakdownData;
  if (!breakdownData) {
    return null;
  }

  const memberAge =
    getMemberAgeAtYearEnd(
      input.member,
      input.referenceDate,
      input.calendarYear,
    ) ?? null;
  const timing = resolveOtherStepSimulationTiming(
    input.cashFlowData,
    input.headMember,
    input.incomeByMember,
    input.referenceDate,
    input.calendarYear,
  );
  const visibleTabIds = resolveVisibleTabIds(breakdownData, memberAge);
  const visibleTabIdSet = new Set<OtherTabId>(visibleTabIds);

  const tabGroups = OTHER_TAB_GROUPS.map((group) => ({
    label: group.label,
    tabs: group.tabIds
      .filter((tabId) => visibleTabIdSet.has(tabId))
      .map((tabId) => ({
        id: tabId,
        title: OTHER_TAB_TITLES[tabId],
      })),
  })).filter((group) => group.tabs.length > 0);

  const panelProps: OtherTabPanelProps = {
    breakdownTabs: buildCalculationBreakdownConfigs(breakdownInput).filter((tab) =>
      visibleTabIdSet.has(tab.id as OtherTabId),
    ),
    nationalPensionViewConfig: visibleTabIdSet.has(OTHER_TAB_IDS.nationalPension)
      ? buildNationalPensionViewConfig(breakdownInput)
      : null,
    nhiViewConfig: visibleTabIdSet.has(OTHER_TAB_IDS.nationalHealthInsurance)
      ? buildNationalHealthInsuranceViewConfig(breakdownInput)
      : null,
    secondLifeTaxSummaryConfig: visibleTabIdSet.has(OTHER_TAB_IDS.taxSummary)
      ? buildSecondLifeTaxSummaryConfig(breakdownInput)
      : null,
    lateElderlyHealthViewConfig: visibleTabIdSet.has(
      OTHER_TAB_IDS.lateElderlyHealth,
    )
      ? buildLateElderlyHealthViewConfig(breakdownInput)
      : null,
    longTermCareViewConfig: visibleTabIdSet.has(OTHER_TAB_IDS.longTermCare)
      ? buildLongTermCareViewConfig(breakdownInput)
      : null,
  };

  const ageLabel = memberAge != null ? `（${memberAge}歳）` : '';

  return {
    calendarYear: input.calendarYear,
    memberAge,
    yearLabel: `${input.calendarYear}年${ageLabel}`,
    description: buildYearDescription({
      calendarYear: input.calendarYear,
      memberAge,
      isFirstSimulationYear: timing.isFirstSimulationYear,
      monthStart: timing.monthStart,
      monthEnd: timing.monthEnd,
      levyPaymentFactor: timing.levyPaymentFactor,
    }),
    visibleTabIds,
    tabGroups,
    panelProps,
    shortcuts: resolveYearShortcuts(input),
  };
}

export function resolveOtherTabActiveTabId(
  currentTabId: string,
  visibleTabIds: OtherTabId[],
): OtherTabId {
  if (visibleTabIds.includes(currentTabId as OtherTabId)) {
    return currentTabId as OtherTabId;
  }

  return (
    visibleTabIds[0] ??
    OTHER_TAB_IDS.incomeTax
  );
}
