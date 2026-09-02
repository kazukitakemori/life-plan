import { calcTotalIncomeManFromProfile } from './incomeTaxDeductions';
import { memberHasNewIncomeFromStartById } from './incomeStartFlags';
import { isFirstSimulationYearAssessment } from './otherCashFlowLinkage';
import {
  buildMemberIncomeProfileFromIncomeTaxAnnualBasis,
  resolveMemberYearIncomeProfile,
} from './memberYearIncome';
import type { FamilyMember } from '../types/family';
import type {
  IncomeByMember,
  IncomeCategory,
  IncomeEntry,
  IncomeStreamType,
  PriorYearIncomeByMember,
  PriorYearIncomeOverride,
} from '../types/income';

export type PriorYearIncomeResolution =
  | 'unset'
  | 'reference_year'
  | 'current_year_proxy'
  | 'prior_year_override';

/**
 * 住民税（前年所得）の算定フェーズ。
 * - simulation_start: 計算開始年（試算初年度）
 * - simulation_start_next: 計算開始翌年（前年＝試算開始年）
 * - subsequent: 3年目以降（前年＝通常の暦年所得）
 */
export type ResidentTaxLevyPhase =
  | 'simulation_start'
  | 'simulation_start_next'
  | 'subsequent';

export interface ResolvedPriorYearIncome {
  profile: ReturnType<typeof resolveMemberYearIncomeProfile>;
  resolution: PriorYearIncomeResolution;
  incomeReferenceYear: number;
}

function streamTypeForPriorYearCategory(
  category: IncomeCategory,
): IncomeStreamType {
  if (category === 'civil_servant') return 'salary_civil_mutual';
  if (category === 'self_employed') return 'business_national_insurance';
  return 'salary_social_insurance';
}

export function buildMemberYearIncomeProfileFromOverride(
  override: PriorYearIncomeOverride,
): ReturnType<typeof resolveMemberYearIncomeProfile> {
  const grossIncomeMan = override.monthlyAmountMan * 12;
  const grossRevenueMan = grossIncomeMan;
  const category = override.category;
  const filingType = category === 'self_employed' ? 'blue_65' : null;
  const totalIncomeMan = calcTotalIncomeManFromProfile({
    grossRevenueMan,
    annualExpenseMan: 0,
    category,
    filingType,
  });

  return {
    grossIncomeMan,
    grossRevenueMan,
    annualExpenseMan: 0,
    totalIncomeMan,
    taxableIncomeMan: totalIncomeMan,
    dependentStatus: 'none',
    taxDependent: false,
    socialInsuranceDependent: false,
    category,
    streamType: streamTypeForPriorYearCategory(category),
    filingType,
    hasActiveIncomeBlock: grossIncomeMan > 0,
  };
}

/** 課税・保険料算定の前年度（暦年） */
export function resolveLevyIncomeReferenceYear(assessmentCalendarYear: number): number {
  return assessmentCalendarYear - 1;
}

export function resolveResidentTaxLevyPhase(
  assessmentCalendarYear: number,
  simulationStartYear: number,
): ResidentTaxLevyPhase {
  if (
    isFirstSimulationYearAssessment(
      assessmentCalendarYear,
      simulationStartYear,
    )
  ) {
    return 'simulation_start';
  }
  if (assessmentCalendarYear === simulationStartYear + 1) {
    return 'simulation_start_next';
  }
  return 'subsequent';
}

export function isSecondSimulationYearAssessment(
  assessmentCalendarYear: number,
  simulationStartYear: number,
): boolean {
  return assessmentCalendarYear === simulationStartYear + 1;
}

/**
 * 住民税の所得参照に使う月範囲。
 * 計算開始年のみ試算対象月、それ以外は前年暦年（1〜12月）。
 */
export function resolveResidentTaxLevyMonthRange(input: {
  assessmentCalendarYear: number;
  simulationStartYear: number;
  assessmentMonthStart: number;
  assessmentMonthEnd: number;
}): { monthStart: number; monthEnd: number } {
  if (
    resolveResidentTaxLevyPhase(
      input.assessmentCalendarYear,
      input.simulationStartYear,
    ) === 'simulation_start'
  ) {
    return {
      monthStart: input.assessmentMonthStart,
      monthEnd: input.assessmentMonthEnd,
    };
  }
  return { monthStart: 1, monthEnd: 12 };
}

/** @deprecated resolveResidentTaxLevyPhase を使用 */
export function usesPriorCalendarYearForResidentTaxLevy(
  assessmentCalendarYear: number,
  simulationStartYear: number,
): boolean {
  return (
    resolveResidentTaxLevyPhase(
      assessmentCalendarYear,
      simulationStartYear,
    ) !== 'simulation_start'
  );
}

/**
 * 前年が試算開始暦年かつ「新しい収入」でないとき、
 * 暦年実績（途中就職の月割）ではなく Q7 の12か月年収を使う。
 */
export function usesSimulationStartYearAnnualBasisForLevy(
  incomeReferenceYear: number,
  simulationStartYear: number,
  hasNewIncomeFromStart: boolean,
): boolean {
  return (
    incomeReferenceYear === simulationStartYear && !hasNewIncomeFromStart
  );
}

/** @deprecated residentTaxLevyUsesAnnualIncomeBasis を使用 */
export function usesSimulationStartYearAnnualBasisForLevySocialInsurance(
  _levyIncomeCalendarYear: number,
  assessmentCalendarYear: number,
  simulationStartYear: number,
  hasNewIncomeFromStart: boolean,
): boolean {
  return residentTaxLevyUsesAnnualIncomeBasis(
    resolveResidentTaxLevyPhase(
      assessmentCalendarYear,
      simulationStartYear,
    ),
    hasNewIncomeFromStart,
  );
}

/**
 * 住民税の所得・社保控除を Q7 の12か月年収ベースにそろえるか。
 *
 * - 計算開始年: 継続収入なら前年所得を12か月年収で読み替え（初年度の所得税と同じ）
 * - 計算開始翌年: 前年＝試算開始年を12か月年収で評価（350万円の月割実績にしない）
 * - 3年目以降: 前年の暦年所得（1〜12月）をそのまま使用
 */
export function residentTaxLevyUsesAnnualIncomeBasis(
  phase: ResidentTaxLevyPhase,
  hasNewIncomeFromStart: boolean,
): boolean {
  if (hasNewIncomeFromStart) {
    return false;
  }
  return phase === 'simulation_start' || phase === 'simulation_start_next';
}

function resolveAnnualLevyIncomeProfile(
  member: FamilyMember,
  entries: IncomeEntry[],
  calendarYear: number,
  referenceDate: Date,
): ReturnType<typeof resolveMemberYearIncomeProfile> | null {
  return buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
    member,
    entries,
    calendarYear,
    referenceDate,
  );
}

function resolveStartYearResidentTaxLevyIncome(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
  assessmentCalendarYear: number;
  monthStart: number;
  monthEnd: number;
}): ResolvedPriorYearIncome | null {
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  if (!canUsePriorYearIncomeOverride(input.member)) {
    return resolveFallbackStartYearLevyIncome(input);
  }

  if (hasNewIncomeFromStart) {
    const refYearProfile = resolveMemberYearIncomeProfile(
      input.member,
      input.entries,
      input.referenceDate,
      input.incomeReferenceYear,
      input.monthStart,
      input.monthEnd,
    );

    if (refYearProfile.hasActiveIncomeBlock) {
      return {
        profile: refYearProfile,
        resolution: 'reference_year',
        incomeReferenceYear: input.incomeReferenceYear,
      };
    }

    return null;
  }

  // 継続収入: 試算開始年に支払う住民税は Q7 の12か月年収を前年所得の代用にする
  const annualProfile = resolveAnnualLevyIncomeProfile(
    input.member,
    input.entries,
    input.incomeReferenceYear,
    input.referenceDate,
  );
  if (annualProfile?.hasActiveIncomeBlock) {
    const refYearProfile = resolveMemberYearIncomeProfile(
      input.member,
      input.entries,
      input.referenceDate,
      input.incomeReferenceYear,
      1,
      12,
    );
    return {
      profile: annualProfile,
      resolution: refYearProfile.hasActiveIncomeBlock
        ? 'reference_year'
        : 'current_year_proxy',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  return resolveFallbackStartYearLevyIncome(input);
}

function resolveFallbackStartYearLevyIncome(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
  assessmentCalendarYear: number;
  monthStart: number;
  monthEnd: number;
}): ResolvedPriorYearIncome | null {
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  const refYearProfile = resolveMemberYearIncomeProfile(
    input.member,
    input.entries,
    input.referenceDate,
    input.incomeReferenceYear,
    input.monthStart,
    input.monthEnd,
  );

  if (refYearProfile.hasActiveIncomeBlock) {
    return {
      profile: refYearProfile,
      resolution: 'reference_year',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  if (hasNewIncomeFromStart) {
    return null;
  }

  const proxyProfile = resolveAnnualLevyIncomeProfile(
    input.member,
    input.entries,
    input.assessmentCalendarYear,
    input.referenceDate,
  );

  if (proxyProfile?.hasActiveIncomeBlock) {
    return {
      profile: proxyProfile,
      resolution: 'current_year_proxy',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  return null;
}

function resolveStartNextYearResidentTaxLevyIncome(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
}): ResolvedPriorYearIncome | null {
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  if (hasNewIncomeFromStart) {
    const priorYearProfile = resolveMemberYearIncomeProfile(
      input.member,
      input.entries,
      input.referenceDate,
      input.incomeReferenceYear,
      1,
      12,
    );
    if (priorYearProfile.hasActiveIncomeBlock) {
      return {
        profile: priorYearProfile,
        resolution: 'reference_year',
        incomeReferenceYear: input.incomeReferenceYear,
      };
    }
    return null;
  }

  // 継続収入: 前年＝試算開始年は12か月年収（600万円）で評価
  const annualProfile = resolveAnnualLevyIncomeProfile(
    input.member,
    input.entries,
    input.incomeReferenceYear,
    input.referenceDate,
  );
  if (annualProfile?.hasActiveIncomeBlock) {
    return {
      profile: annualProfile,
      resolution: 'reference_year',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  const fallbackProfile = resolveMemberYearIncomeProfile(
    input.member,
    input.entries,
    input.referenceDate,
    input.incomeReferenceYear,
    1,
    12,
  );
  if (fallbackProfile.hasActiveIncomeBlock) {
    return {
      profile: fallbackProfile,
      resolution: 'reference_year',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  return null;
}

function resolveSubsequentYearResidentTaxLevyIncome(input: {
  member: FamilyMember;
  entries: IncomeEntry[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
}): ResolvedPriorYearIncome | null {
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  const priorYearProfile = resolveMemberYearIncomeProfile(
    input.member,
    input.entries,
    input.referenceDate,
    input.incomeReferenceYear,
    1,
    12,
  );

  if (priorYearProfile.hasActiveIncomeBlock) {
    return {
      profile: priorYearProfile,
      resolution: 'reference_year',
      incomeReferenceYear: input.incomeReferenceYear,
    };
  }

  if (hasNewIncomeFromStart) {
    return null;
  }

  return null;
}

export function canUsePriorYearIncomeOverride(member: FamilyMember): boolean {
  return member.role === 'head' || member.role === 'spouse';
}

/** Q7「前年度の収入は今年度と異なる」が指す暦年（試算開始年の前年） */
export function resolveConfiguredPriorYearOverrideYear(
  simulationStartYear: number,
): number {
  return simulationStartYear - 1;
}

function tryResolvePriorYearIncomeOverride(input: {
  member: FamilyMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  incomeReferenceYear: number;
  simulationStartYear: number;
}): ResolvedPriorYearIncome | null {
  if (!canUsePriorYearIncomeOverride(input.member)) {
    return null;
  }
  if (
    input.incomeReferenceYear !==
    resolveConfiguredPriorYearOverrideYear(input.simulationStartYear)
  ) {
    return null;
  }
  const override = input.priorYearIncomeByMember[input.member.id];
  if (!override?.differsFromCurrentYear) {
    return null;
  }
  return {
    profile: buildMemberYearIncomeProfileFromOverride(override),
    resolution: 'prior_year_override',
    incomeReferenceYear: input.incomeReferenceYear,
  };
}

/**
 * 前年度の所得プロファイルを解決する。
 * フェーズごとにルールを分岐する（計算開始年 / 翌年 / 3年目以降）。
 */
export function resolveMemberPriorYearIncome(input: {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  referenceDate: Date;
  incomeReferenceYear: number;
  /** 課税・住民税の試算対象年（暦年） */
  assessmentCalendarYear: number;
  simulationStartYear: number;
  monthStart?: number;
  monthEnd?: number;
}): ResolvedPriorYearIncome | null {
  const overrideResult = tryResolvePriorYearIncomeOverride({
    member: input.member,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    incomeReferenceYear: input.incomeReferenceYear,
    simulationStartYear: input.simulationStartYear,
  });
  if (overrideResult) {
    return overrideResult;
  }

  const entries = input.incomeByMember[input.member.id] ?? [];
  const phase = resolveResidentTaxLevyPhase(
    input.assessmentCalendarYear,
    input.simulationStartYear,
  );
  const { monthStart, monthEnd } = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.assessmentCalendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart ?? 1,
    assessmentMonthEnd: input.monthEnd ?? 12,
  });

  switch (phase) {
    case 'simulation_start':
      return resolveStartYearResidentTaxLevyIncome({
        member: input.member,
        entries,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        incomeReferenceYear: input.incomeReferenceYear,
        assessmentCalendarYear: input.assessmentCalendarYear,
        monthStart,
        monthEnd,
      });
    case 'simulation_start_next':
      return resolveStartNextYearResidentTaxLevyIncome({
        member: input.member,
        entries,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        incomeReferenceYear: input.incomeReferenceYear,
      });
    case 'subsequent':
      return resolveSubsequentYearResidentTaxLevyIncome({
        member: input.member,
        entries,
        incomeByMember: input.incomeByMember,
        priorYearIncomeByMember: input.priorYearIncomeByMember,
        referenceDate: input.referenceDate,
        incomeReferenceYear: input.incomeReferenceYear,
      });
  }
}

export function resolveMemberPriorYearIncomeProfile(
  input: Parameters<typeof resolveMemberPriorYearIncome>[0],
): ReturnType<typeof resolveMemberYearIncomeProfile> {
  const resolved = resolveMemberPriorYearIncome(input);
  if (resolved) return resolved.profile;

  const phase = resolveResidentTaxLevyPhase(
    input.assessmentCalendarYear,
    input.simulationStartYear,
  );
  const hasNewIncomeFromStart = memberHasNewIncomeFromStartById(
    input.member,
    input.incomeByMember,
    input.referenceDate.getMonth() + 1,
  );

  if (residentTaxLevyUsesAnnualIncomeBasis(phase, hasNewIncomeFromStart)) {
    const annualized = buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
      input.member,
      input.incomeByMember[input.member.id] ?? [],
      phase === 'simulation_start_next'
        ? input.incomeReferenceYear
        : input.assessmentCalendarYear,
      input.referenceDate,
    );
    if (annualized) return annualized;
  }

  const { monthStart, monthEnd } = resolveResidentTaxLevyMonthRange({
    assessmentCalendarYear: input.assessmentCalendarYear,
    simulationStartYear: input.simulationStartYear,
    assessmentMonthStart: input.monthStart ?? 1,
    assessmentMonthEnd: input.monthEnd ?? 12,
  });

  return resolveMemberYearIncomeProfile(
    input.member,
    input.incomeByMember[input.member.id] ?? [],
    input.referenceDate,
    input.incomeReferenceYear,
    monthStart,
    monthEnd,
  );
}
