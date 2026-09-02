import { resolveMemberAge } from './familyDefaults';
import type { CashFlowTableData, CashFlowYearRow } from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../types/income';
import type { PensionByMember } from '../types/pension';
import type { HousingState } from '../types/housing';
import type { LoanState } from '../types/loan';
import type { InsuranceState } from '../types/insurance';
import type { SavingsState } from '../types/savings';
import type { VehicleState } from '../types/vehicle';
import {
  collectIdecoPayoutTaxByMember,
  mergeIdecoAnnuityIntoPensionManByMember,
} from './idecoTax';
import {
  collectCompanyRetirementLumpByMember,
  mergeRetirementLumpSums,
} from './retirementAllowance';
import {
  attachOverlapAdjustedDeduction,
  collectAllRetirementLumpEvents,
} from './retirementDeductionOverlap';
import {
  resolveLevyIncomeReferenceYear,
  resolveResidentTaxLevyMonthRange,
} from './priorYearIncomeResolution';
import {
  buildHouseholdTaxSocialFromMemberBreakdowns,
  buildMemberTaxBreakdownData,
  calcHouseholdTaxSocialMan,
  type MemberTaxBreakdownData,
  type TaxSocialBreakdown,
} from './taxCalculator';
import { calcMemberHousingLoanDeductionYen } from './housingLoanDeduction';

export type { MemberTaxBreakdownData };

export interface HouseholdTaxYearInput {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
  simulationStartYear: number;
  annualPensionManByMember: Record<string, number>;
  pensionByMember?: PensionByMember;
  /** 住宅ローン控除の計算に使用 */
  housingState?: HousingState;
  /** ペアローン等メンバー別借入の控除計算に使用 */
  loanState?: LoanState;
  insuranceState?: InsuranceState;
  vehicleState?: VehicleState;
  /** iDeCo / 企業型DC / DB / 会社退職金の受取税に使用 */
  savingsState?: SavingsState;
}

export interface HouseholdTaxYearResult {
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
  simulationStartYear: number;
  household: TaxSocialBreakdown;
  memberBreakdownByMemberId: Record<string, MemberTaxBreakdownData>;
}

/**
 * 1暦年分の世帯税・社保を計算し、キャッシュフロー表とその他タブで共有する。
 */
export function calcHouseholdTaxYearResult(
  input: HouseholdTaxYearInput,
): HouseholdTaxYearResult {
  const memberBreakdownByMemberId: Record<string, MemberTaxBreakdownData> = {};

  const idecoAssessment = collectIdecoPayoutTaxByMember({
    familyMembers: input.familyMembers,
    savingsState: input.savingsState,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
  });
  const companyRetirement = collectCompanyRetirementLumpByMember({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
  });
  const retirementLumpByMember = mergeRetirementLumpSums(
    idecoAssessment.lumpSumByMember,
    companyRetirement,
  );
  const allRetirementEvents = collectAllRetirementLumpEvents({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    savingsState: input.savingsState,
    referenceDate: input.referenceDate,
  });
  const adjustedRetirementLumpByMember: Record<
    string,
    (typeof retirementLumpByMember)[string]
  > = {};
  for (const [memberId, lump] of Object.entries(retirementLumpByMember)) {
    adjustedRetirementLumpByMember[memberId] = attachOverlapAdjustedDeduction(
      memberId,
      input.calendarYear,
      lump,
      allRetirementEvents,
    );
  }
  const annualPensionManByMember = mergeIdecoAnnuityIntoPensionManByMember(
    input.annualPensionManByMember,
    idecoAssessment.annuityManByMember,
  );

  const levyMonths = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.calendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart,
    assessmentMonthEnd: input.monthEnd,
  });
  const idecoLevy = collectIdecoPayoutTaxByMember({
    familyMembers: input.familyMembers,
    savingsState: input.savingsState,
    referenceDate: input.referenceDate,
    calendarYear: resolveLevyIncomeReferenceYear(input.calendarYear),
    monthStart: levyMonths.monthStart,
    monthEnd: levyMonths.monthEnd,
  });

  const breakdownBase = {
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
    levyPaymentFactor: input.levyPaymentFactor,
    /** 按分表示は試算対象月（6〜12月など）。税額算定は初年度12か月年収読み替えを別途適用 */
    simulationMonthStart: input.monthStart,
    simulationMonthEnd: input.monthEnd,
    annualPensionManByMember,
    pensionByMember: input.pensionByMember,
    simulationStartYear: input.simulationStartYear,
    idecoAnnuityManByMemberForLevy: idecoLevy.annuityManByMember,
    idecoLumpSumByMember: adjustedRetirementLumpByMember,
  };

  const referenceYear = input.referenceDate.getFullYear();

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const housingLoanTaxCreditYen = input.housingState
      ? calcMemberHousingLoanDeductionYen(
          input.housingState,
          member.id,
          resolveMemberAge(member),
          referenceYear,
          input.calendarYear,
          input.familyMembers,
          input.referenceDate,
          input.loanState,
        )
      : 0;
    const data = buildMemberTaxBreakdownData({
      ...breakdownBase,
      memberId: member.id,
      housingLoanTaxCreditYen,
      insuranceState: input.insuranceState,
      housingState: input.housingState,
      vehicleState: input.vehicleState,
      savingsState: input.savingsState,
    });
    if (data) {
      memberBreakdownByMemberId[member.id] = data;
    }
  }

  const baseHousehold = calcHouseholdTaxSocialMan({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
    levyPaymentFactor: input.levyPaymentFactor,
    annualPensionManByMember,
    pensionByMember: input.pensionByMember,
    simulationStartYear: input.simulationStartYear,
    savingsState: input.savingsState,
  });

  const household: TaxSocialBreakdown =
    buildHouseholdTaxSocialFromMemberBreakdowns(
      memberBreakdownByMemberId,
      input.familyMembers,
      baseHousehold.isResidentTaxExemptHousehold,
      input.levyPaymentFactor,
    );

  return {
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
    levyPaymentFactor: input.levyPaymentFactor,
    simulationStartYear: input.simulationStartYear,
    household,
    memberBreakdownByMemberId,
  };
}

export function findCashFlowYearRow(
  cashFlowData: CashFlowTableData,
  calendarYear: number,
): CashFlowYearRow | undefined {
  return cashFlowData.years.find((row) => row.calendarYear === calendarYear);
}

export interface ResolveMemberTaxBreakdownInput {
  cashFlowData: CashFlowTableData;
  calendarYear: number;
  memberId: string;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  pensionByMember?: PensionByMember;
  simulationStartYear?: number;
  /** キャッシュフロー行がない場合のフォールバック月範囲 */
  monthStart?: number;
  monthEnd?: number;
  levyPaymentFactor?: number;
}

export function resolveMemberTaxBreakdownFromCashFlow(
  input: ResolveMemberTaxBreakdownInput,
): MemberTaxBreakdownData | null {
  const yearRow = findCashFlowYearRow(input.cashFlowData, input.calendarYear);
  const cached = yearRow?.memberTaxBreakdownByMemberId[input.memberId];
  if (cached) {
    return cached;
  }

  const monthStart =
    yearRow?.simulationMonthStart ?? input.monthStart ?? 1;
  const monthEnd = yearRow?.simulationMonthEnd ?? input.monthEnd ?? 12;
  const levyPaymentFactor =
    yearRow?.levyPaymentFactor ?? input.levyPaymentFactor ?? 1;
  const simulationStartYear =
    input.simulationStartYear ?? input.cashFlowData.startYear;

  return buildMemberTaxBreakdownData({
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    memberId: input.memberId,
    monthStart,
    monthEnd,
    levyPaymentFactor,
    simulationMonthStart: monthStart,
    simulationMonthEnd: monthEnd,
    pensionByMember: input.pensionByMember,
    simulationStartYear,
  });
}

export interface OtherTabTaxBreakdownInput {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  memberId: string;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
  levyPaymentFactor?: number;
  simulationMonthStart?: number;
  simulationMonthEnd?: number;
  simulationStartYear: number;
  memberTaxBreakdownData?: MemberTaxBreakdownData | null;
  assessmentContextNote?: string;
}

/**
 * キャッシュフロー表の該当年行と同じ月範囲・内訳データに揃える。
 */
export function resolveOtherTabTaxBreakdownInput(
  cashFlowData: CashFlowTableData,
  input: OtherTabTaxBreakdownInput,
): OtherTabTaxBreakdownInput {
  const yearRow = findCashFlowYearRow(cashFlowData, input.calendarYear);
  const monthStart = yearRow?.simulationMonthStart ?? input.monthStart ?? 1;
  const monthEnd = yearRow?.simulationMonthEnd ?? input.monthEnd ?? 12;
  const levyPaymentFactor =
    yearRow?.levyPaymentFactor ?? input.levyPaymentFactor ?? 1;
  const memberTaxBreakdownData =
    yearRow?.memberTaxBreakdownByMemberId[input.memberId] ??
    input.memberTaxBreakdownData ??
    resolveMemberTaxBreakdownFromCashFlow({
      cashFlowData,
      calendarYear: input.calendarYear,
      memberId: input.memberId,
      familyMembers: input.familyMembers,
      incomeByMember: input.incomeByMember,
      priorYearIncomeByMember: input.priorYearIncomeByMember,
      referenceDate: input.referenceDate,
      pensionByMember: input.pensionByMember,
      simulationStartYear: input.simulationStartYear,
      monthStart,
      monthEnd,
      levyPaymentFactor,
    });

  return {
    ...input,
    monthStart,
    monthEnd,
    levyPaymentFactor,
    simulationMonthStart: monthStart,
    simulationMonthEnd: monthEnd,
    memberTaxBreakdownData,
  };
}
