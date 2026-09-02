import {
  calcMemberSalaryBreakdownYenForTaxYear,
  resolveMemberYearIncomeProfile,
} from './memberYearIncome';
import { memberHasNewIncomeFromStartById } from './incomeStartFlags';
import {
  resolveLevyPaymentFactorForYear,
} from './simulationTiming';
import type { CashFlowTableData } from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';

const MAN_TO_YEN = 10_000;

export interface OtherStepSimulationTiming {
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
  simulationMonthStart: number;
  simulationMonthCount: number;
  isFirstSimulationYear: boolean;
}

export interface AnnualIncomeTaxBasisOptions {
  calendarYear: number;
  referenceDate: Date;
  /** 試算開始年（referenceDate の暦年） */
  simulationStartYear: number;
}

/**
 * 所得税算定で Q7 の12か月年収（暦年に依存しない年額）を使うか。
 * 継続収入（「新しい収入」OFF）では試算期間中の各年とも Q7 年収を基準にする。
 * 試算初年度に始まる就職・開業収入のみ、当該年の暦年実績を使う。
 */
export function memberUsesAnnualBasisForIncomeTax(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  monthStart: number,
  monthEnd: number,
  options?: AnnualIncomeTaxBasisOptions,
): boolean {
  if (
    memberHasNewIncomeFromStartById(
      member,
      incomeByMember,
      options?.referenceDate
        ? options.referenceDate.getMonth() + 1
        : undefined,
    )
  ) {
    return false;
  }
  if (!options) {
    return false;
  }
  const yearProfile = resolveMemberYearIncomeProfile(
    member,
    incomeByMember[member.id] ?? [],
    options.referenceDate,
    options.calendarYear,
    monthStart,
    monthEnd,
  );
  return yearProfile.hasActiveIncomeBlock;
}

/** 試算初年度の課税・住民税算定に12か月年収の読み替えを使うか */
export function isFirstSimulationYearAssessment(
  assessmentCalendarYear: number,
  simulationStartYear: number,
): boolean {
  return assessmentCalendarYear === simulationStartYear;
}

export function resolveOtherStepSimulationTiming(
  cashFlowData: CashFlowTableData,
  head: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
  calendarYear: number,
): OtherStepSimulationTiming {
  const isFirstSimulationYear = calendarYear === cashFlowData.startYear;
  const monthStart = isFirstSimulationYear
    ? cashFlowData.simulationMonthStart
    : 1;
  const monthEnd = 12;
  const simulationMonthCount = monthEnd - monthStart + 1;

  return {
    calendarYear,
    monthStart,
    monthEnd,
    levyPaymentFactor: isFirstSimulationYear
      ? resolveLevyPaymentFactorForYear({
          calendarYear,
          startYear: cashFlowData.startYear,
          head,
          incomeByMember,
          referenceDate,
        })
      : 1,
    simulationMonthStart: cashFlowData.simulationMonthStart,
    simulationMonthCount,
    isFirstSimulationYear,
  };
}

export function formatSimulationPeriodLabel(monthStart: number, monthEnd: number): string {
  if (monthStart <= 1 && monthEnd >= 12) {
    return '1月〜12月';
  }
  return `${monthStart}月〜${monthEnd}月`;
}

/** Q7の12か月年収（円）— 税・社保の算定基礎（当該暦年に有効な給与期間のみ） */
export function resolveAnnualTaxBasisSalaryYen(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
): number {
  return calcMemberSalaryBreakdownYenForTaxYear({
    member,
    entries: incomeEntries,
    referenceDate,
    calendarYear,
    annualize: true,
  }).grossSalaryRevenueYen;
}

export interface OtherProrationContext {
  /** Q7の12か月年収（円） */
  annualGrossSalaryYen: number;
  /** 試算初年度の対象月（例: 6月〜12月） */
  periodLabel: string;
  simulationMonthCount: number;
  /** 年間支払額を試算対象月数で按分する係数（7/12 など） */
  levyPaymentFactor: number;
  isPartialFirstYear: boolean;
}

export function buildOtherProrationContext(input: {
  member: FamilyMember;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
  /** 住民税算定の年収（前年度入力がある場合はそちらを優先） */
  residentTaxBasisGrossSalaryYen?: number;
}): OtherProrationContext {
  return {
    annualGrossSalaryYen:
      input.residentTaxBasisGrossSalaryYen ??
      resolveAnnualTaxBasisSalaryYen(
        input.member,
        input.incomeEntries,
        input.referenceDate,
        input.calendarYear,
      ),
    periodLabel: formatSimulationPeriodLabel(input.monthStart, input.monthEnd),
    simulationMonthCount: input.monthEnd - input.monthStart + 1,
    levyPaymentFactor: input.levyPaymentFactor,
    isPartialFirstYear: input.levyPaymentFactor < 1,
  };
}

export function prorateAnnualLevyYen(
  annualYen: number,
  levyPaymentFactor: number,
): number {
  if (levyPaymentFactor >= 1) return annualYen;
  return Math.round(annualYen * levyPaymentFactor);
}

export function formatManFromYen(yen: number): string {
  const man = yen / MAN_TO_YEN;
  const rounded = Math.round(man * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatLevyProrationLabel(
  simulationMonthCount: number,
): string {
  return `${simulationMonthCount}か月／12か月`;
}
