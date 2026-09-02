import { calcBirthYear, calcYearAtAge, getMemberAgeMonth, isAgeCalendarMonthInRange } from './birthDate';
import {
  buildCashFlowTable,
  calcMonthlyLivingItemsMan,
  type CashFlowInput,
} from './cashFlow';
import type { CashFlowTableData } from '../types/cashFlow';
import { calcMemberMonthlyEducationYen, yenToMan } from './educationCashFlow';
import { SCHOOL_CATEGORY_LABELS } from './educationLabels';
import {
  resolveMemberAge,
  resolveMemberBirthMonth,
} from './familyDefaults';
import {
  addCalendarMonths,
  calcRepaymentMonthIndex,
  getLoanRepaymentStartCalendar,
  yenToMan as yenToManFromLoan,
  type CalendarYearMonth,
} from './housingLoanAmortization';
import { calcHouseholdMonthlyHousingDetailMan, addHousingExpenseDetail } from './housingCashFlow';
import { housingLoanCoverageDesignedFactor, isHousingLoanPaidByGroupCreditLife, isOwnedHousingLoanInForce } from './housingCreditLifeCoverage';
import {
  calcHousingLoanBalanceAfterRepaymentMonthsYen,
  calcHousingLoanTotalAmountMan,
} from './housingLoanAmount';
import { calcMemberMonthlyInsuranceDetailMan } from './insuranceCashFlow';
import { calcMemberMonthlyLifeEventBreakdownMan } from './lifeEventCashFlow';
import { getAllLoanEntries } from './loanDefaults';
import { isOtherLoanForCashFlow, calcLoanEntryMonthlyRepaymentMan } from './loanCashFlow';
import {
  calcLoanEntryAmountMan,
  getHousingLinkedLoansForProperty,
  getLoansForHousingProperty,
  resolveHousingPropertyFinanceLoans,
  toLoanEntryAmountOptions,
} from './loanResolution';
import {
  resolveLoanOwnershipStartCalendar,
  resolveLoanRepaymentSchedule,
} from './loanInterestRatePeriod';
import {
  isLoanMonthlyRepaymentMode,
  resolveLoanMonthlyRepaymentPeriod,
} from './loanPaymentMode';
import { getMemberTabLabel } from './memberDisplay';
import { STANDARD_OLD_AGE_START } from './pensionConstants';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { resolveSimulationMonthStart } from './simulationTiming';
import { calcMemberMonthlyVehicleDetailMan } from './vehicleCashFlow';
import type { EducationByMember, EducationExpenseEntry } from '../types/education';
import type { FamilyMember } from '../types/family';
import type {
  HousingState,
  HousingTargetData,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../types/housing';
import { HOUSEHOLD_HOUSING_KEY } from '../types/housing';
import type { LoanEntry, LoanState, HousingLinkedLoanView } from '../types/loan';
import type { PensionByMember } from '../types/pension';
import type {
  MedicalStoppableExpenseKind,
  MedicalStoppableExpenses,
  RequiredCoverageExpenseDesigns,
  RequiredCoverageHorizonKind,
  RequiredCoverageDesignStage,
  RequiredCoverageMedicalDesign,
  RequiredCoverageMedicalDesigns,
  RequiredCoverageRiskKind,
  RequiredCoverageState,
  RequiredCoverageSubject,
} from '../types/requiredCoverage';
import {
  MEDICAL_STOPPABLE_EXPENSE_ORDER,
} from '../types/requiredCoverage';
import {
  calcHighCostSelfPayCapYen,
  inferHighCostIncomeBracket,
  manToYen,
  type HighCostIncomeBracket,
} from './highCostMedicalExpenses';
import { resolveHealthStandardRemunerationYen } from './standardRemuneration';
import {
  accumulateCoverageIncome,
  createDefaultWorkDesigns,
  emptyCoverageIncomeTotals,
  migrateCoverageWorkDesigns,
  resolveCoverageIncomeByMember,
  type RequiredCoverageIncomeTotals,
} from './requiredCoverageIncome';
import {
  buildRequiredCoverageYearlyCashFlow,
  calcCoverageOpeningBalancesMan,
  resolveDeathTimeBalancesMan,
} from './requiredCoverageYearlyCashFlow';
import type {
  RequiredCoverageYearlyCashFlow,
} from './requiredCoverageYearlyCashFlow';
import {
  coverageLineFactor,
  coverageLivingLineId,
  coverageOwnedHoldingLineId,
  coverageOwnedHoldingPartLineId,
  createDefaultCoverageDesigns,
  getCoverageDesign,
  migrateCoverageDesigns,
  overlayLivingItems,
} from './requiredCoverageDesign';
import {
  addOtherInsurancePremiumDetail,
  addVehicleExpenseDetail,
  createEmptyExpenseBreakdown,
  createEmptyHousingExpenseDetail,
  createEmptyLifeEventExpenseDetail,
  createEmptyOtherLoanRepaymentDetail,
  createEmptyVehicleExpenseDetail,
  sumEducationExpense,
  sumExpenseBreakdown,
  sumHousingExpenseDetail,
  sumLifeEventExpenseDetail,
  sumOtherInsurancePremiumDetail,
  sumOtherLoanRepaymentDetail,
  sumVehicleExpenseDetail,
  type ExpenseBreakdown,
  type HousingExpenseDetail,
  type LifeEventExpenseDetail,
  type OtherInsurancePremiumDetail,
  type VehicleExpenseDetail,
} from '../types/cashFlow';

const HORIZON_KINDS: RequiredCoverageHorizonKind[] = [
  'survivor_expected_lifespan',
  'youngest_child_education',
  'spouse_old_age_pension',
  'housing_loan_payoff',
  'custom',
];

function isHorizonKind(value: unknown): value is RequiredCoverageHorizonKind {
  return (
    typeof value === 'string' &&
    HORIZON_KINDS.includes(value as RequiredCoverageHorizonKind)
  );
}

type LegacyRequiredCoverageState = Partial<RequiredCoverageState> & {
  /** v1: 詳細設計として扱う */
  designs?: RequiredCoverageState['detailDesigns'];
  horizons?: {
    youngestChildEducation?: boolean;
    spouseOldAgePension?: boolean;
    housingLoanPayoff?: boolean;
  };
};

function migrateHorizonKind(
  raw?: LegacyRequiredCoverageState | null,
): RequiredCoverageHorizonKind {
  if (isHorizonKind(raw?.kind)) return raw.kind;
  const horizons = raw?.horizons;
  if (!horizons) return 'youngest_child_education';
  if (horizons.housingLoanPayoff) return 'housing_loan_payoff';
  if (horizons.spouseOldAgePension) return 'spouse_old_age_pension';
  return 'youngest_child_education';
}

/** 手術・入院試算：所得区分ごとの試算用医療費（万円／月・限度額到達の概算） */
export const MEDICAL_RISK_ASSUMED_MONTHLY_MEDICAL_MAN: Record<
  HighCostIncomeBracket,
  number
> = {
  A: 27,
  B: 18,
  C: 9,
  D: 6,
  E: 4,
};

/** 参考表示用：総医療費100万円のときの自己負担 */
export const MEDICAL_RISK_REFERENCE_MONTHLY_TOTAL_MEDICAL_MAN = 100;

/** 手術・入院試算：70歳未満の既定自己負担割合（参考表の算出用） */
export const MEDICAL_RISK_FIXED_COPAY_RATE = 0.3;

export function createDefaultStoppableExpenses(): MedicalStoppableExpenses {
  return {
    pocketMoney: 0,
    savingsContribution: 0,
    eatingOut: 0,
    hobby: 0,
    entertainment: 0,
    clothing: 0,
    socializing: 0,
    other: 0,
  };
}

/** 止められる支出の月額合計（円） */
export function sumStoppableExpenseYenPerMonth(
  expenses: MedicalStoppableExpenses | null | undefined,
): number {
  if (!expenses) return 0;
  let total = 0;
  for (const kind of MEDICAL_STOPPABLE_EXPENSE_ORDER) {
    const value = expenses[kind];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      total += value;
    }
  }
  return Math.round(total);
}

/** 止められる支出の月額合計（万円） */
export function sumStoppableExpenseManPerMonth(
  expenses: MedicalStoppableExpenses | null | undefined,
): number {
  return Math.round((sumStoppableExpenseYenPerMonth(expenses) / 10_000) * 10) / 10;
}

const LEGACY_STOPPABLE_EXPENSE_KINDS = [
  ...MEDICAL_STOPPABLE_EXPENSE_ORDER,
  'commuting',
  'carFuel',
  'subscriptions',
  'beauty',
] as const;

function migrateStoppableExpensesYen(
  rawYen: unknown,
  rawMan: unknown,
  legacyTotalManPerMonth = 0,
): MedicalStoppableExpenses {
  const defaults = createDefaultStoppableExpenses();
  const next = { ...defaults };

  const yenSource =
    rawYen && typeof rawYen === 'object'
      ? (rawYen as Partial<Record<string, unknown>>)
      : null;
  if (yenSource) {
    for (const kind of MEDICAL_STOPPABLE_EXPENSE_ORDER) {
      next[kind] = sanitizeNonNegativeNumber(yenSource[kind], defaults[kind]);
    }
    return next;
  }

  const manSource =
    rawMan && typeof rawMan === 'object'
      ? (rawMan as Partial<Record<string, unknown>>)
      : null;
  let otherMan = 0;
  if (manSource) {
    for (const kind of LEGACY_STOPPABLE_EXPENSE_KINDS) {
      const value = sanitizeNonNegativeNumber(manSource[kind], 0);
      if (value <= 0) continue;
      if (
        (MEDICAL_STOPPABLE_EXPENSE_ORDER as readonly string[]).includes(kind)
      ) {
        next[kind as MedicalStoppableExpenseKind] = Math.round(value * 10_000);
      } else {
        otherMan += value;
      }
    }
  }
  if (
    sumStoppableExpenseYenPerMonth(next) <= 0 &&
    legacyTotalManPerMonth > 0
  ) {
    otherMan += legacyTotalManPerMonth;
  }
  if (otherMan > 0) {
    next.other = Math.round(otherMan * 10_000);
  }
  return next;
}

export function createDefaultMedicalDesign(): RequiredCoverageMedicalDesign {
  return {
    monthlyIncomeMan: 0,
    isLowIncome: false,
    employmentType: 'employee',
    hospitalMonthsPerYear: 6,
    inpatientDays: 28,
    diseasePreset: null,
    extraBedCostYenPerDay: 8_000,
    mealCostYenPerDay: 1_380,
    clothingCostYenPerDay: 500,
    transportCostYenPerDay: 0,
    consumablesCostYenPerDay: 0,
    incomeLossManPerMonth: 0,
    incomeLossManual: false,
    stoppableExpensesYen: createDefaultStoppableExpenses(),
    existingBenefitMan: 0,
  };
}

export function createDefaultMedicalDesigns(): RequiredCoverageMedicalDesigns {
  return {
    head: createDefaultMedicalDesign(),
    spouse: createDefaultMedicalDesign(),
  };
}

function sanitizeNonNegativeNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function migrateMedicalEmploymentType(
  raw?: unknown,
): import('../types/requiredCoverage').MedicalEmploymentType {
  if (
    raw === 'employee' ||
    raw === 'selfEmployed' ||
    raw === 'other'
  ) {
    return raw;
  }
  return 'employee';
}

export function migrateMedicalDesign(
  raw?: Partial<RequiredCoverageMedicalDesign> | null,
): RequiredCoverageMedicalDesign {
  const defaults = createDefaultMedicalDesign();
  const legacy = raw as
    | (Partial<RequiredCoverageMedicalDesign> & {
        hospitalDays?: number;
        hospitalDaysPerMonth?: number;
        inpatientMonthsPerYear?: number;
        extraBedCostManPerDay?: number;
        extraBedCostManPerMonth?: number;
        mealCostManPerDay?: number;
        mealCostManPerMonth?: number;
        clothingCostMan?: number;
        clothingCostYen?: number;
        transportCostManPerDay?: number;
        transportCostManPerMonth?: number;
        consumablesCostManPerDay?: number;
        consumablesCostManPerMonth?: number;
      })
    | null
    | undefined;

  const hospitalMonthsPerYear = sanitizeNonNegativeNumber(
    legacy?.hospitalMonthsPerYear,
    defaults.hospitalMonthsPerYear,
  );
  const maxInpatientDays = Math.max(0, hospitalMonthsPerYear * 30);
  let inpatientDays: number;
  if (
    typeof legacy?.inpatientDays === 'number' &&
    Number.isFinite(legacy.inpatientDays) &&
    legacy.inpatientDays >= 0
  ) {
    inpatientDays = Math.min(legacy.inpatientDays, maxInpatientDays || legacy.inpatientDays);
  } else if (
    typeof legacy?.inpatientMonthsPerYear === 'number' &&
    Number.isFinite(legacy.inpatientMonthsPerYear) &&
    legacy.inpatientMonthsPerYear >= 0
  ) {
    inpatientDays = Math.min(
      Math.round(legacy.inpatientMonthsPerYear * 30),
      maxInpatientDays || Math.round(legacy.inpatientMonthsPerYear * 30),
    );
  } else {
    inpatientDays = Math.min(defaults.inpatientDays, maxInpatientDays || defaults.inpatientDays);
  }

  /** 円フィールドへ。円がなければ万円系から換算 */
  const toYen = (
    yen: unknown,
    manPerDay: unknown,
    manPerMonth: unknown,
    fallback: number,
    perDay: boolean,
  ): number => {
    if (typeof yen === 'number' && Number.isFinite(yen) && yen >= 0) {
      return yen;
    }
    if (typeof manPerDay === 'number' && Number.isFinite(manPerDay) && manPerDay >= 0) {
      return Math.round(manPerDay * 10_000);
    }
    if (typeof manPerMonth === 'number' && Number.isFinite(manPerMonth) && manPerMonth >= 0) {
      const man = perDay ? manPerMonth / 30 : manPerMonth;
      return Math.round(man * 10_000);
    }
    return fallback;
  };

  return {
    monthlyIncomeMan: sanitizeNonNegativeNumber(
      legacy?.monthlyIncomeMan,
      defaults.monthlyIncomeMan,
    ),
    isLowIncome: legacy?.isLowIncome === true,
    employmentType: migrateMedicalEmploymentType(legacy?.employmentType),
    hospitalMonthsPerYear,
    inpatientDays,
    diseasePreset:
      typeof legacy?.diseasePreset === 'string' ? legacy.diseasePreset : null,
    extraBedCostYenPerDay: toYen(
      legacy?.extraBedCostYenPerDay,
      legacy?.extraBedCostManPerDay,
      legacy?.extraBedCostManPerMonth,
      defaults.extraBedCostYenPerDay,
      true,
    ),
    mealCostYenPerDay: toYen(
      legacy?.mealCostYenPerDay,
      legacy?.mealCostManPerDay,
      legacy?.mealCostManPerMonth,
      defaults.mealCostYenPerDay,
      true,
    ),
    clothingCostYenPerDay: (() => {
      if (
        typeof legacy?.clothingCostYenPerDay === 'number' &&
        Number.isFinite(legacy.clothingCostYenPerDay) &&
        legacy.clothingCostYenPerDay >= 0
      ) {
        return legacy.clothingCostYenPerDay;
      }
      // 旧・一時費用（万円）や大きな円額は日額既定へ。小さな円額のみ日額として引き継ぐ
      if (
        typeof legacy?.clothingCostYen === 'number' &&
        Number.isFinite(legacy.clothingCostYen) &&
        legacy.clothingCostYen >= 0 &&
        legacy.clothingCostYen <= 2_000
      ) {
        return legacy.clothingCostYen;
      }
      return defaults.clothingCostYenPerDay;
    })(),
    transportCostYenPerDay: toYen(
      legacy?.transportCostYenPerDay,
      legacy?.transportCostManPerDay,
      legacy?.transportCostManPerMonth,
      defaults.transportCostYenPerDay,
      true,
    ),
    consumablesCostYenPerDay: toYen(
      legacy?.consumablesCostYenPerDay,
      legacy?.consumablesCostManPerDay,
      legacy?.consumablesCostManPerMonth,
      defaults.consumablesCostYenPerDay,
      true,
    ),
    incomeLossManPerMonth: sanitizeNonNegativeNumber(
      legacy?.incomeLossManPerMonth,
      defaults.incomeLossManPerMonth,
    ),
    incomeLossManual: legacy?.incomeLossManual === true,
    stoppableExpensesYen: migrateStoppableExpensesYen(
      (legacy as { stoppableExpensesYen?: unknown } | null | undefined)
        ?.stoppableExpensesYen,
      (legacy as { stoppableExpenses?: unknown } | null | undefined)
        ?.stoppableExpenses,
      sanitizeNonNegativeNumber(
        (legacy as { stoppableExpenseManPerMonth?: unknown } | null | undefined)
          ?.stoppableExpenseManPerMonth,
        0,
      ),
    ),
    existingBenefitMan: sanitizeNonNegativeNumber(
      legacy?.existingBenefitMan,
      defaults.existingBenefitMan,
    ),
  };
}

export function migrateMedicalDesigns(
  raw?: Partial<RequiredCoverageMedicalDesigns> | null,
): RequiredCoverageMedicalDesigns {
  return {
    head: migrateMedicalDesign(raw?.head),
    spouse: migrateMedicalDesign(raw?.spouse),
  };
}

export interface MedicalRiskExtraCosts {
  extraBedMan: number;
  mealMan: number;
  clothingMan: number;
  transportMan: number;
  consumablesMan: number;
  /** 雑費小計（収入減少を含まない） */
  incidentalMan: number;
  /** 収入の目減り総額（止められる支出控除前） */
  incomeLossGrossMan: number;
  /** 止められる支出総額 */
  stoppableExpenseMan: number;
  /**
   * 純不足（必要保障に載せる収入減少）。
   * max(0, 目減り − 止められる支出)
   */
  incomeLossMan: number;
  /** 雑費 + 純不足 */
  totalMan: number;
}

/**
 * 傷病手当金の試算。
 * 会社員・公務員が業務外の傷病で働けなくなった場合、
 * 標準報酬日額（月収 ÷ 30）の 2/3 を最大 1年6か月受け取れる。
 * @param monthlyIncomeMan 月収（万円）
 * @param treatmentMonths 治療月数
 * @returns 傷病手当金の総額（万円）
 */
export function calcSickLeaveAllowance(
  monthlyIncomeMan: number,
  treatmentMonths: number,
): number {
  if (monthlyIncomeMan <= 0 || treatmentMonths <= 0) return 0;
  const eligibleMonths = Math.min(treatmentMonths, 18);
  return (monthlyIncomeMan * (2 / 3)) * eligibleMonths;
}

/** ライフプラン（Q7）のいまの月収（万円）。賞与は含めない */
export function quoteMemberMonthlyIncomeMan(
  input: Pick<CashFlowInput, 'familyMembers' | 'incomeByMember' | 'referenceDate'>,
  subject: RequiredCoverageSubject,
): number {
  const member = input.familyMembers.find((item) => item.role === subject);
  if (!member) return 0;
  const entries = input.incomeByMember[member.id] ?? [];
  if (entries.length === 0) return 0;

  const year = input.referenceDate.getFullYear();
  const month = input.referenceDate.getMonth() + 1;
  const birthYear = calcBirthYear(member.age, member.birthMonth, input.referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const ageMonth = getMemberAgeMonth(member, input.referenceDate, year, month);

  const sumMatching = (
    match: (period: (typeof entries)[number]['periods'][number]) => boolean,
  ): number => {
    let total = 0;
    for (const entry of entries) {
      for (const period of entry.periods) {
        if (match(period)) total += Math.max(0, period.monthlyAmountMan);
      }
    }
    return total;
  };

  if (ageMonth) {
    const current = sumMatching((period) =>
      isAgeCalendarMonthInRange(
        ageMonth.age,
        ageMonth.month,
        period.startAge,
        period.startMonth,
        period.endAge,
        period.endMonth,
        birthYear,
        birthMonth,
      ),
    );
    if (current > 0) return current;
  }

  const currentAge = member.age;
  if (currentAge != null) {
    const byAge = sumMatching(
      (period) => currentAge >= period.startAge && currentAge <= period.endAge,
    );
    if (byAge > 0) return byAge;
  }

  return Math.max(0, entries[0]?.periods[0]?.monthlyAmountMan ?? 0);
}

export function resolveMedicalRiskMonthlyIncomeMan(
  design: RequiredCoverageMedicalDesign,
  quotedMonthlyIncomeMan = 0,
): number {
  if (design.monthlyIncomeMan > 0) return design.monthlyIncomeMan;
  return Math.max(0, quotedMonthlyIncomeMan);
}

export function resolveMedicalRiskIncomeBracket(
  design: RequiredCoverageMedicalDesign,
  quotedMonthlyIncomeMan = 0,
): { bracket: HighCostIncomeBracket; standardRemunerationMan: number } {
  if (design.isLowIncome) {
    return { bracket: 'E', standardRemunerationMan: 0 };
  }
  const monthlyIncomeMan = resolveMedicalRiskMonthlyIncomeMan(
    design,
    quotedMonthlyIncomeMan,
  );
  const standardYen = resolveHealthStandardRemunerationYen(
    manToYen(monthlyIncomeMan),
  );
  const standardRemunerationMan = yenToMan(standardYen);
  return {
    bracket: inferHighCostIncomeBracket(standardRemunerationMan),
    standardRemunerationMan,
  };
}

export interface MedicalRiskCoverageResult {
  /** 試算で用いる1か月あたりの医療費（万円・所得区分ごとの概算） */
  monthlyTotalMedicalCostMan: number;
  incomeBracket: HighCostIncomeBracket;
  /** 月収から等級表で決めた標準報酬月額（万円） */
  standardRemunerationMan: number;
  effectiveMonthlyIncomeMan: number;
  /** 1〜3か月目の1か月あたり自己負担（試算医療費） */
  normalMonthlySelfPayMan: number;
  /** 4か月目以降の1か月あたり自己負担（多数回該当） */
  multipleTimesMonthlySelfPayMan: number | null;
  /** 通常限度額の月数（最大3） */
  normalSelfPayMonths: number;
  /** 多数回該当の月数 */
  multipleTimesSelfPayMonths: number;
  /** 治療期間の医療費自己負担合計 */
  annualMedicalSelfPayMan: number;
  /** 治療月数（高額療養費が発生する月数） */
  hospitalMonthsPerYear: number;
  /** 実際の入院日数 */
  inpatientDays: number;
  /** 付帯費用の内訳 */
  extraCosts: MedicalRiskExtraCosts;
  totalCostMan: number;
  existingBenefitMan: number;
  /**
   * 傷病手当金の試算額（万円）。
   * 会社員・公務員の場合のみ算出、それ以外は 0。
   */
  sickLeaveAllowanceMan: number;
  requiredAmountMan: number;
}

function calcMedicalExtraCosts(
  design: RequiredCoverageMedicalDesign,
): MedicalRiskExtraCosts {
  const treatmentMonths = Math.max(0, design.hospitalMonthsPerYear);
  const maxInpatientDays = treatmentMonths * 30;
  const inpatientDays = Math.max(
    0,
    Math.min(design.inpatientDays, maxInpatientDays || design.inpatientDays),
  );
  const extraBedMan = (design.extraBedCostYenPerDay * inpatientDays) / 10_000;
  const mealMan = (design.mealCostYenPerDay * inpatientDays) / 10_000;
  const clothingMan = (design.clothingCostYenPerDay * inpatientDays) / 10_000;
  const transportMan = (design.transportCostYenPerDay * inpatientDays) / 10_000;
  const consumablesMan =
    (design.consumablesCostYenPerDay * inpatientDays) / 10_000;
  const incidentalMan =
    extraBedMan + mealMan + clothingMan + transportMan + consumablesMan;
  // 収入の目減り・止められる支出は治療月数ベース（通院中も続く想定）
  const incomeLossGrossMan =
    Math.max(0, design.incomeLossManPerMonth || 0) * treatmentMonths;
  const stoppableExpenseManPerMonth = sumStoppableExpenseManPerMonth(
    design.stoppableExpensesYen,
  );
  const stoppableExpenseMan = stoppableExpenseManPerMonth * treatmentMonths;
  const incomeLossMan = Math.max(0, incomeLossGrossMan - stoppableExpenseMan);
  return {
    extraBedMan,
    mealMan,
    clothingMan,
    transportMan,
    consumablesMan,
    incidentalMan,
    incomeLossGrossMan,
    stoppableExpenseMan,
    incomeLossMan,
    totalMan: incidentalMan + incomeLossMan,
  };
}

/** 手術・入院シナリオの自己負担不足額（万円） */
export function calcMedicalRiskCoverage(
  design: RequiredCoverageMedicalDesign,
  quotedMonthlyIncomeMan = 0,
): MedicalRiskCoverageResult {
  const existingBenefitMan = Math.max(0, design.existingBenefitMan);
  const extraCosts = calcMedicalExtraCosts(design);
  const { bracket, standardRemunerationMan } = resolveMedicalRiskIncomeBracket(
    design,
    quotedMonthlyIncomeMan,
  );
  const effectiveMonthlyIncomeMan = resolveMedicalRiskMonthlyIncomeMan(
    design,
    quotedMonthlyIncomeMan,
  );

  const hospitalMonths = Math.max(0, Math.floor(design.hospitalMonthsPerYear));
  const maxInpatientDays = hospitalMonths * 30;
  const inpatientDays = Math.max(
    0,
    Math.min(design.inpatientDays, maxInpatientDays || design.inpatientDays),
  );

  const normalMonthlySelfPayMan = MEDICAL_RISK_ASSUMED_MONTHLY_MEDICAL_MAN[bracket];
  const multipleTimesMonthlySelfPayMan =
    hospitalMonths >= 4
      ? yenToMan(
          calcHighCostSelfPayCapYen(bracket, manToYen(100), true),
        )
      : null;
  const normalSelfPayMonths = Math.min(3, hospitalMonths);
  const multipleTimesSelfPayMonths = Math.max(0, hospitalMonths - 3);
  const annualMedicalSelfPayMan =
    normalMonthlySelfPayMan * normalSelfPayMonths +
    (multipleTimesMonthlySelfPayMan ?? 0) * multipleTimesSelfPayMonths;
  const totalCostMan = annualMedicalSelfPayMan + extraCosts.totalMan;

  const sickLeaveAllowanceMan =
    design.employmentType === 'employee'
      ? calcSickLeaveAllowance(effectiveMonthlyIncomeMan, hospitalMonths)
      : 0;

  return {
    monthlyTotalMedicalCostMan: normalMonthlySelfPayMan,
    incomeBracket: bracket,
    standardRemunerationMan,
    effectiveMonthlyIncomeMan,
    normalMonthlySelfPayMan,
    multipleTimesMonthlySelfPayMan,
    normalSelfPayMonths,
    multipleTimesSelfPayMonths,
    annualMedicalSelfPayMan,
    hospitalMonthsPerYear: hospitalMonths,
    inpatientDays,
    extraCosts,
    totalCostMan,
    existingBenefitMan,
    sickLeaveAllowanceMan,
    requiredAmountMan: Math.max(0, totalCostMan - existingBenefitMan),
  };
}

function migrateRiskKind(raw?: unknown): RequiredCoverageRiskKind {
  return raw === 'medical' ? 'medical' : 'death';
}

export function createDefaultRequiredCoverageState(): RequiredCoverageState {
  return {
    riskKind: 'death',
    subject: 'head',
    kind: 'survivor_expected_lifespan',
    customEndYear: 0,
    customEndMonth: 0,
    simpleDesigns: createDefaultCoverageDesigns(),
    detailDesigns: createDefaultCoverageDesigns(),
    workDesigns: createDefaultWorkDesigns(),
    medicalDesigns: createDefaultMedicalDesigns(),
  };
}

export function migrateRequiredCoverageState(
  raw?: LegacyRequiredCoverageState | null,
): RequiredCoverageState {
  const defaults = createDefaultRequiredCoverageState();
  const legacyDetail = raw?.detailDesigns ?? raw?.designs;
  return {
    riskKind: migrateRiskKind(raw?.riskKind),
    subject: raw?.subject === 'spouse' ? 'spouse' : defaults.subject,
    kind: migrateHorizonKind(raw),
    customEndYear:
      typeof raw?.customEndYear === 'number' && raw.customEndYear > 0
        ? raw.customEndYear
        : defaults.customEndYear,
    customEndMonth:
      typeof raw?.customEndMonth === 'number' && raw.customEndMonth > 0
        ? raw.customEndMonth
        : defaults.customEndMonth,
    simpleDesigns: migrateCoverageDesigns(
      raw?.simpleDesigns ?? defaults.simpleDesigns,
    ),
    detailDesigns: migrateCoverageDesigns(
      legacyDetail ?? defaults.detailDesigns,
    ),
    workDesigns: migrateCoverageWorkDesigns(raw?.workDesigns),
    medicalDesigns: migrateMedicalDesigns(raw?.medicalDesigns),
  };
}

export function resolveCoverageSubject(
  subject: RequiredCoverageSubject | undefined,
  familyMembers: FamilyMember[],
): RequiredCoverageSubject {
  if (
    subject === 'spouse' &&
    familyMembers.some((member) => member.role === 'spouse')
  ) {
    return 'spouse';
  }
  return 'head';
}

export function getRequiredCoverageHorizonRows(
  subject: RequiredCoverageSubject,
): {
  kind: Exclude<RequiredCoverageHorizonKind, 'custom'>;
  label: string;
  description: string;
}[] {
  const survivorLabel = subject === 'head' ? '配偶者' : '世帯主';
  const deceasedLabel = subject === 'head' ? '世帯主' : '配偶者';
  return [
    {
      kind: 'survivor_expected_lifespan',
      label: `${survivorLabel}の想定寿命まで`,
      description:
        'Q1の想定寿命の12月までです。途中の資金不足や、その後の老後資金も年次の残高で見ます。',
    },
    {
      kind: 'youngest_child_education',
      label: '末子の最終学歴まで',
      description: '教育費の入力がある場合はその終了月。未入力なら独立想定（22歳3月）を使います。',
    },
    {
      kind: 'spouse_old_age_pension',
      label: `${survivorLabel}が老齢年金を受け取り始めるまで`,
      description: 'Q8の受給開始年齢（既定65歳）の誕生月です。',
    },
    {
      kind: 'housing_loan_payoff',
      label: '住宅ローン完済まで',
      description:
        subject === 'head'
          ? '団信でローンがなくならない場合に選んでください。一般団信がある場合、世帯主に万一があっても残債は通常なくなります。'
          : `団信でローンがなくならない場合に選んでください。夫婦連生団信でない場合、${deceasedLabel}に万一があってもローンは残ります。`,
    },
  ];
}

export const REQUIRED_COVERAGE_HORIZON_ROWS =
  getRequiredCoverageHorizonRows('head');

export const REQUIRED_COVERAGE_CUSTOM_OPTION = {
  kind: 'custom' as const,
  label: '期間を直接入力',
  description: '保障が必要な最後の年月を指定します。',
};

export interface RequiredCoverageHorizonResult {
  kind: Exclude<RequiredCoverageHorizonKind, 'custom'>;
  label: string;
  description: string;
  available: boolean;
  end: CalendarYearMonth | null;
  detail: string | null;
}

export interface RequiredCoverageExpenseTotals {
  living: number;
  education: number;
  housing: number;
  lifeEvent: number;
  vehicle: number;
  loanRepayment: number;
  insuranceOther: number;
  total: number;
  livingByLabel: Record<string, number>;
  livingByItem: Record<string, number>;
  byItem: Record<string, number>;
  /** 所有物件の「維持費など」内訳（物件ごと） */
  holdingDetailByItem: Record<string, HousingExpenseDetail>;
  educationByMember: { memberId: string; label: string; amount: number }[];
}

export interface RequiredCoverageChartPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: number | null;
  living: number;
  housing: number;
  vehicle: number;
  education: number;
  lifeEvent: number;
  loan: number;
  insurance: number;
  taxSocial: number;
  yearLiving: number;
  yearHousing: number;
  yearVehicle: number;
  yearEducation: number;
  yearLifeEvent: number;
  yearLoan: number;
  yearInsurance: number;
  yearTaxSocial: number;
  yearEarned: number;
  yearSurvivorBasic: number;
  yearSurvivorEmployees: number;
  yearMiddleAgedWidowAdd: number;
  yearChildAllowance: number;
  yearOldAgeBasic: number;
  yearOldAgeEmployees: number;
  yearIncome: number;
  yearExpense: number;
  yearNet: number;
  yearHousingPrincipal: number;
  savingsBalance: number;
  /** その年始（前年年末）の現預金。初年は試算開始時点 */
  deathTimeDepositMan: number;
  /** その年始（前年年末）の金融資産。初年は試算開始時点 */
  deathTimeFinancialAssetsMan: number;
  remainingExpenseTotal: number;
  remainingEarned: number;
  remainingSurvivorBasic: number;
  remainingSurvivorEmployees: number;
  remainingMiddleAgedWidowAdd: number;
  remainingChildAllowance: number;
  remainingOldAgeBasic: number;
  remainingOldAgeEmployees: number;
  remainingTaxSocial: number;
  remainingIncome: number;
  remainingTotal: number;
}

export interface RequiredCoverageResult {
  horizons: RequiredCoverageHorizonResult[];
  coverageStart: CalendarYearMonth;
  coverageEnd: CalendarYearMonth | null;
  durationMonths: number;
  /** 万一後の上書き後 */
  expenses: RequiredCoverageExpenseTotals;
  /** 入力どおりの期間累計（上書き前） */
  baselineExpenses: RequiredCoverageExpenseTotals;
  /** 万一後の働き方・遺族基礎年金・児童手当・老齢基礎・老齢厚生・遺族厚生年金を反映した収入累計 */
  income: RequiredCoverageIncomeTotals;
  /** 試算開始時点の現預金（普通・定期・その他貯蓄） */
  initialSavings: number;
  /** 試算開始時点の金融資産（貯蓄＋運用。iDeCo・企業年金を含む） */
  initialFinancialAssets: number;
  /** 年次の貯蓄残高推移 */
  yearlyCashFlow: RequiredCoverageYearlyCashFlow[];
  /** 全期間の貯蓄残高の最小値 */
  minSavingsBalance: number;
  requiredAmount: number;
  chartPoints: RequiredCoverageChartPoint[];
}

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

function roundMan(value: number): number {
  return Math.round(value);
}

interface CoverageYearFlow {
  calendarYear: number;
  living: number;
  housing: number;
  /** その年始時点の住宅ローン残元金（ストック。累積しない） */
  housingPrincipal: number;
  vehicle: number;
  education: number;
  lifeEvent: number;
  loan: number;
  insurance: number;
  /** 税・社会保険料（CF表と同じく支出側） */
  taxSocial: number;
  earned: number;
  survivorBasic: number;
  survivorEmployees: number;
  middleAgedWidowAdd: number;
  childAllowance: number;
  oldAgeBasic: number;
  oldAgeEmployees: number;
  income: number;
}

function createEmptyYearFlow(calendarYear: number): CoverageYearFlow {
  return {
    calendarYear,
    living: 0,
    housing: 0,
    housingPrincipal: 0,
    vehicle: 0,
    education: 0,
    lifeEvent: 0,
    loan: 0,
    insurance: 0,
    taxSocial: 0,
    earned: 0,
    survivorBasic: 0,
    survivorEmployees: 0,
    middleAgedWidowAdd: 0,
    childAllowance: 0,
    oldAgeBasic: 0,
    oldAgeEmployees: 0,
    income: 0,
  };
}

function formatYearMonth(end: CalendarYearMonth): string {
  return `${end.year}年${end.month}月`;
}

function ageMonthToCalendar(
  member: FamilyMember,
  referenceDate: Date,
  age: number,
  month: number,
): CalendarYearMonth | null {
  if (member.age == null) return null;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  return {
    year: calcYearAtAge(birthYear, birthMonth, age, month),
    month,
  };
}

function resolveEducationEntryEnd(
  member: FamilyMember,
  referenceDate: Date,
  entry: EducationExpenseEntry,
): CalendarYearMonth | null {
  return ageMonthToCalendar(member, referenceDate, entry.endAge, entry.endMonth);
}

export function resolveYoungestChildEducationEnd(
  familyMembers: FamilyMember[],
  educationByMember: EducationByMember,
  referenceDate: Date,
): { end: CalendarYearMonth; detail: string } | null {
  const children = familyMembers.filter((m) => m.role === 'child');
  if (children.length === 0) return null;

  let latest: {
    end: CalendarYearMonth;
    detail: string;
  } | null = null;

  for (const child of children) {
    const entries = educationByMember[child.id] ?? [];
    let childEnd: CalendarYearMonth | null = null;
    let childDetail = '';

    for (const entry of entries) {
      const end = resolveEducationEntryEnd(child, referenceDate, entry);
      if (!end) continue;
      if (
        !childEnd ||
        calendarIndex(end.year, end.month) >
          calendarIndex(childEnd.year, childEnd.month)
      ) {
        childEnd = end;
        const school = SCHOOL_CATEGORY_LABELS[entry.schoolCategory];
        const name = entry.schoolName.trim();
        childDetail = name
          ? `${getMemberTabLabel(child)}・${school}（${name}）`
          : `${getMemberTabLabel(child)}・${school}`;
      }
    }

    if (!childEnd) {
      const period = child.householdPeriod;
      childEnd = ageMonthToCalendar(
        child,
        referenceDate,
        period.endAge,
        period.endMonth,
      );
      if (childEnd) {
        childDetail = `${getMemberTabLabel(child)}・独立想定（${period.endAge}歳${period.endMonth}月）`;
      }
    }

    if (!childEnd) continue;
    if (
      !latest ||
      calendarIndex(childEnd.year, childEnd.month) >
        calendarIndex(latest.end.year, latest.end.month)
    ) {
      latest = { end: childEnd, detail: childDetail };
    }
  }

  return latest;
}

export function resolveMemberOldAgePensionStart(
  member: FamilyMember | undefined,
  pensionByMember: PensionByMember,
  referenceDate: Date,
): { end: CalendarYearMonth; detail: string } | null {
  if (!member) return null;
  if (member.age == null || member.birthMonth == null) return null;

  const state =
    pensionByMember[member.id] ?? createDefaultPensionMemberState();
  const rows = [
    state.benefitSettings.oldAgeBasic,
    state.benefitSettings.oldAgeGeneralEmployees,
    state.benefitSettings.oldAgePublicPrivate,
  ];
  let startAge = STANDARD_OLD_AGE_START;
  let startMonthOffset = 0;
  for (const row of rows) {
    const age = row.startAge > 0 ? row.startAge : STANDARD_OLD_AGE_START;
    const month = row.startMonth ?? 0;
    const months = age * 12 + month;
    if (months < startAge * 12 + startMonthOffset) {
      startAge = age;
      startMonthOffset = month;
    }
  }

  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const atBirthday: CalendarYearMonth = {
    year: calcYearAtAge(birthYear, birthMonth, startAge, birthMonth),
    month: birthMonth,
  };
  const end =
    startMonthOffset > 0
      ? addCalendarMonths(atBirthday, startMonthOffset)
      : atBirthday;

  const ageLabel =
    startMonthOffset > 0
      ? `${startAge}歳${startMonthOffset}か月`
      : `${startAge}歳`;
  return {
    end,
    detail: `${getMemberTabLabel(member)}・老齢年金開始（${ageLabel}）`,
  };
}

export function resolveSpouseOldAgePensionStart(
  familyMembers: FamilyMember[],
  pensionByMember: PensionByMember,
  referenceDate: Date,
): { end: CalendarYearMonth; detail: string } | null {
  return resolveMemberOldAgePensionStart(
    familyMembers.find((m) => m.role === 'spouse'),
    pensionByMember,
    referenceDate,
  );
}

export function resolveMemberExpectedLifespanEnd(
  member: FamilyMember | undefined,
  referenceDate: Date,
): { end: CalendarYearMonth; detail: string } | null {
  if (!member) return null;
  if (member.age == null || member.expectedLifespan == null) return null;
  const end = ageMonthToCalendar(
    member,
    referenceDate,
    member.expectedLifespan,
    12,
  );
  if (!end) return null;
  return {
    end,
    detail: `${getMemberTabLabel(member)}・想定寿命（${member.expectedLifespan}歳）`,
  };
}

function findOwnedPropertyForLoan(
  housingState: HousingState,
  entry: LoanEntry,
): OwnedProperty | undefined {
  const link = entry.housingLink;
  if (!link) return undefined;
  return housingState.byTarget[link.targetId]?.owned.find(
    (property) => property.id === link.propertyId,
  );
}

function resolveHousingLoanMember(
  familyMembers: FamilyMember[],
  entry: LoanEntry,
): FamilyMember | undefined {
  const head = familyMembers.find((m) => m.role === 'head');
  const targetId = entry.housingLink?.targetId;
  if (!targetId || targetId === HOUSEHOLD_HOUSING_KEY) return head;
  return familyMembers.find((m) => m.id === targetId) ?? head;
}

export function resolveHousingLoanPayoffEnd(
  familyMembers: FamilyMember[],
  housingState: HousingState,
  loanState: LoanState | undefined,
  referenceDate: Date,
): { end: CalendarYearMonth; detail: string } | null {
  if (!loanState) return null;
  const housingLoans = getAllLoanEntries(loanState).filter(
    (entry) => entry.category === 'housing',
  );
  if (housingLoans.length === 0) return null;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  let latest: { end: CalendarYearMonth; name: string } | null = null;

  for (const entry of housingLoans) {
    let end: CalendarYearMonth | null = null;
    if (isLoanMonthlyRepaymentMode(entry)) {
      const period = resolveLoanMonthlyRepaymentPeriod(entry, referenceDate);
      if (period.endYear > 0 && period.endMonth > 0) {
        end = { year: period.endYear, month: period.endMonth };
      }
    } else {
      const member = resolveHousingLoanMember(familyMembers, entry);
      const property = findOwnedPropertyForLoan(housingState, entry);
      const schedule = resolveLoanRepaymentSchedule(entry.settings, {
        property,
        memberAgeAtReference: member ? resolveMemberAge(member) : undefined,
        referenceYear,
        referenceMonth,
        birthMonth: member ? resolveMemberBirthMonth(member) : undefined,
      });
      if (schedule.totalMonths > 0) {
        end = schedule.repaymentEnd;
      }
    }
    if (!end) continue;
    const name = entry.name.trim() || '住宅ローン';
    if (
      !latest ||
      calendarIndex(end.year, end.month) >
        calendarIndex(latest.end.year, latest.end.month)
    ) {
      latest = { end, name };
    }
  }

  if (!latest) return null;
  return {
    end: latest.end,
    detail: `${latest.name}・完済`,
  };
}

export function resolveRequiredCoverageHorizons(
  input: Pick<
    CashFlowInput,
    | 'familyMembers'
    | 'educationByMember'
    | 'pensionByMember'
    | 'housingState'
    | 'loanState'
    | 'referenceDate'
  >,
  subject: RequiredCoverageSubject = 'head',
): RequiredCoverageHorizonResult[] {
  const survivorRole = subject === 'head' ? 'spouse' : 'head';
  const survivor = input.familyMembers.find((m) => m.role === survivorRole);
  const lifespan = resolveMemberExpectedLifespanEnd(survivor, input.referenceDate);
  const child = resolveYoungestChildEducationEnd(
    input.familyMembers,
    input.educationByMember,
    input.referenceDate,
  );
  const survivorPension = resolveMemberOldAgePensionStart(
    survivor,
    input.pensionByMember,
    input.referenceDate,
  );
  const loan = resolveHousingLoanPayoffEnd(
    input.familyMembers,
    input.housingState,
    input.loanState,
    input.referenceDate,
  );

  const resolved: Record<
    Exclude<RequiredCoverageHorizonKind, 'custom'>,
    { end: CalendarYearMonth; detail: string } | null
  > = {
    survivor_expected_lifespan: lifespan,
    youngest_child_education: child,
    spouse_old_age_pension: survivorPension,
    housing_loan_payoff: loan,
  };
  const survivorLabel = subject === 'head' ? '配偶者' : '世帯主';
  const unavailableReason: Record<
    Exclude<RequiredCoverageHorizonKind, 'custom'>,
    string
  > = {
    survivor_expected_lifespan: survivor
      ? `${survivorLabel}の生年月が未入力です`
      : `${survivorLabel}が登録されていません`,
    youngest_child_education: '子供が登録されていません',
    spouse_old_age_pension: survivor
      ? `${survivorLabel}の生年月が未入力です`
      : `${survivorLabel}が登録されていません`,
    housing_loan_payoff: '住宅ローンが登録されていません',
  };

  return getRequiredCoverageHorizonRows(subject).map((row) => {
    const match = resolved[row.kind];
    return {
      ...row,
      available: match != null,
      end: match?.end ?? null,
      detail: match?.detail ?? unavailableReason[row.kind],
    };
  });
}

export function resolveCoverageEnd(
  kind: RequiredCoverageHorizonKind,
  horizons: RequiredCoverageHorizonResult[],
  customEndYear: number,
  customEndMonth: number,
): CalendarYearMonth | null {
  if (kind === 'custom') {
    if (customEndYear > 0 && customEndMonth >= 1 && customEndMonth <= 12) {
      return { year: customEndYear, month: customEndMonth };
    }
    return null;
  }
  const horizon = horizons.find((row) => row.kind === kind);
  if (!horizon?.available || !horizon.end) return null;
  return horizon.end;
}

function scaleVehicleDetail(
  detail: VehicleExpenseDetail,
  factor: number,
): VehicleExpenseDetail {
  return {
    purchase: detail.purchase * factor,
    maintenance: detail.maintenance * factor,
    loanRepayment: detail.loanRepayment * factor,
    insurance: detail.insurance * factor,
  };
}

function scaleHousingDetail(
  detail: HousingExpenseDetail,
  factor: number,
): HousingExpenseDetail {
  return {
    purchaseInitial: detail.purchaseInitial * factor,
    rentalInitialCost: detail.rentalInitialCost * factor,
    rentalMoveOutCost: detail.rentalMoveOutCost * factor,
    monthlyCost: detail.monthlyCost * factor,
    renewalCost: detail.renewalCost * factor,
    managementFee: detail.managementFee * factor,
    repairReserve: detail.repairReserve * factor,
    selfRepairCost: detail.selfRepairCost * factor,
    improvementCost: detail.improvementCost * factor,
    taxDetail: {
      realEstateAcquisition: detail.taxDetail.realEstateAcquisition * factor,
      fixedAsset: detail.taxDetail.fixedAsset * factor,
      cityPlanning: detail.taxDetail.cityPlanning * factor,
    },
    loanRepaymentDetail: {
      principal: detail.loanRepaymentDetail.principal * factor,
      interest: detail.loanRepaymentDetail.interest * factor,
      fees: detail.loanRepaymentDetail.fees * factor,
      groupCreditLife: detail.loanRepaymentDetail.groupCreditLife * factor,
    },
    rentalInsurancePremium: detail.rentalInsurancePremium * factor,
    ownedInsurancePremium: detail.ownedInsurancePremium * factor,
    simpleMonthlyCost: detail.simpleMonthlyCost * factor,
  };
}

function scaleHousingHoldingCoverageParts(
  detail: HousingExpenseDetail,
  factorForKey: (partKey: string) => number,
): HousingExpenseDetail {
  return {
    purchaseInitial: detail.purchaseInitial * factorForKey('purchaseInitial'),
    rentalInitialCost: 0,
    rentalMoveOutCost: 0,
    monthlyCost: 0,
    renewalCost: 0,
    managementFee: detail.managementFee * factorForKey('managementFee'),
    repairReserve: detail.repairReserve * factorForKey('repairReserve'),
    selfRepairCost: detail.selfRepairCost * factorForKey('selfRepairCost'),
    improvementCost: detail.improvementCost * factorForKey('improvementCost'),
    taxDetail: {
      realEstateAcquisition:
        detail.taxDetail.realEstateAcquisition *
        factorForKey('tax.realEstateAcquisition'),
      fixedAsset: detail.taxDetail.fixedAsset * factorForKey('tax.fixedAsset'),
      cityPlanning:
        detail.taxDetail.cityPlanning * factorForKey('tax.cityPlanning'),
    },
    loanRepaymentDetail: {
      principal: 0,
      interest: 0,
      fees: 0,
      groupCreditLife: 0,
    },
    rentalInsurancePremium: 0,
    ownedInsurancePremium:
      detail.ownedInsurancePremium * factorForKey('ownedInsurancePremium'),
    simpleMonthlyCost:
      detail.simpleMonthlyCost * factorForKey('simpleMonthlyCost'),
  };
}

function scaleLifeEventDetail(
  detail: LifeEventExpenseDetail,
  factor: number,
): LifeEventExpenseDetail {
  return {
    travel: detail.travel * factor,
    appliance: detail.appliance * factor,
    celebration: detail.celebration * factor,
    medical: detail.medical * factor,
    nursing: detail.nursing * factor,
    other: detail.other * factor,
  };
}

function scaleOtherInsuranceDetail(
  detail: OtherInsurancePremiumDetail,
  factor: number,
): OtherInsurancePremiumDetail {
  return {
    nonlife_other: detail.nonlife_other * factor,
    life: detail.life * factor,
    medical: detail.medical * factor,
    cancer: detail.cancer * factor,
    education: detail.education * factor,
    personal_pension: detail.personal_pension * factor,
    life_other: detail.life_other * factor,
  };
}

function emptyCoverageTotals(): RequiredCoverageExpenseTotals {
  return {
    living: 0,
    education: 0,
    housing: 0,
    lifeEvent: 0,
    vehicle: 0,
    loanRepayment: 0,
    insuranceOther: 0,
    total: 0,
    livingByLabel: {},
    livingByItem: {},
    byItem: {},
    holdingDetailByItem: {},
    educationByMember: [],
  };
}

function ensureHoldingDetail(
  map: Record<string, HousingExpenseDetail>,
  id: string,
): HousingExpenseDetail {
  const current = map[id];
  if (current) return current;
  const next = createEmptyHousingExpenseDetail();
  map[id] = next;
  return next;
}

function addByItem(
  map: Record<string, number>,
  id: string,
  amount: number,
): void {
  if (amount === 0) return;
  map[id] = (map[id] ?? 0) + amount;
}

function housingStateForProperty(
  housingState: HousingState,
  targetId: string,
  kind: 'rental' | 'owned',
  propertyId: string,
): HousingState {
  const target = housingState.byTarget[targetId];
  if (!target) return { ...housingState, byTarget: {} };
  const next: HousingTargetData = {
    ...target,
    rentals:
      kind === 'rental'
        ? target.rentals.filter((item) => item.id === propertyId)
        : [],
    owned:
      kind === 'owned'
        ? target.owned.filter((item) => item.id === propertyId)
        : [],
  };
  return {
    ...housingState,
    byTarget: { [targetId]: next },
  };
}

function coverageHousingMember(
  familyMembers: FamilyMember[],
  targetId: string,
): FamilyMember | undefined {
  if (targetId === HOUSEHOLD_HOUSING_KEY) {
    return familyMembers.find((member) => member.role === 'head');
  }
  return familyMembers.find((member) => member.id === targetId);
}

function calcLoanSettingsCoveragePrincipalMan(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  member: FamilyMember | undefined,
  referenceDate: Date,
  at: CalendarYearMonth,
  coverageEnd: CalendarYearMonth,
  amountMan: number,
  amountOptions?: Parameters<
    typeof calcHousingLoanBalanceAfterRepaymentMonthsYen
  >[5],
): number {
  if (amountMan <= 0) return 0;
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const memberAge = member ? resolveMemberAge(member) : undefined;
  const ownershipStart = resolveLoanOwnershipStartCalendar(
    settings,
    property,
    memberAge,
    referenceYear,
    referenceMonth,
    undefined,
    member ? resolveMemberBirthMonth(member) : undefined,
  );
  if (
    calendarIndex(ownershipStart.year, ownershipStart.month) >
    calendarIndex(coverageEnd.year, coverageEnd.month)
  ) {
    return 0;
  }
  const repaymentStart = getLoanRepaymentStartCalendar(ownershipStart);
  const repaymentMonthIndex = calcRepaymentMonthIndex(
    repaymentStart,
    at.year,
    at.month,
  );
  if (repaymentMonthIndex == null || repaymentMonthIndex <= 1) {
    return amountMan;
  }
  const balanceYen = calcHousingLoanBalanceAfterRepaymentMonthsYen(
    property,
    settings,
    repaymentMonthIndex - 1,
    memberAge ?? 0,
    referenceYear,
    amountOptions,
  );
  return Math.max(0, yenToManFromLoan(balanceYen));
}

function calcMonthlyRepaymentCoveragePrincipalMan(
  entry: LoanEntry,
  amountMan: number,
  referenceDate: Date,
  at: CalendarYearMonth,
  coverageEnd: CalendarYearMonth,
): number {
  const period = resolveLoanMonthlyRepaymentPeriod(entry, referenceDate);
  const startIdx = calendarIndex(period.startYear, period.startMonth);
  if (startIdx > calendarIndex(coverageEnd.year, coverageEnd.month)) {
    return 0;
  }
  const endIdx = calendarIndex(period.endYear, period.endMonth);
  const atIdx = calendarIndex(at.year, at.month);
  if (atIdx > endIdx) return 0;
  const totalMonths = endIdx - startIdx + 1;
  if (totalMonths <= 0) return 0;
  const paidMonths = Math.max(0, atIdx - startIdx);
  const remainingMonths = totalMonths - paidMonths;
  if (amountMan > 0) {
    return (amountMan * remainingMonths) / totalMonths;
  }
  return entry.monthlyRepaymentMan * remainingMonths;
}

function calcHousingLinkedLoanCoveragePrincipalMan(
  input: CashFlowInput,
  targetId: string,
  property: OwnedProperty,
  entry: LoanEntry,
  at: CalendarYearMonth,
  coverageEnd: CalendarYearMonth,
): number {
  const financeLoans = input.loanState
    ? resolveHousingPropertyFinanceLoans(
        getLoansForHousingProperty(input.loanState, targetId, property.id),
      )
    : [entry];
  const amountMan = calcLoanEntryAmountMan(property, entry, financeLoans);
  if (isLoanMonthlyRepaymentMode(entry)) {
    return calcMonthlyRepaymentCoveragePrincipalMan(
      entry,
      amountMan,
      input.referenceDate,
      at,
      coverageEnd,
    );
  }
  return calcLoanSettingsCoveragePrincipalMan(
    property,
    entry.settings,
    coverageHousingMember(input.familyMembers, targetId),
    input.referenceDate,
    at,
    coverageEnd,
    amountMan,
    toLoanEntryAmountOptions(property, entry, financeLoans),
  );
}

function calcUnlinkedOwnedLoanCoveragePrincipalMan(
  input: CashFlowInput,
  targetId: string,
  property: OwnedProperty,
  at: CalendarYearMonth,
  coverageEnd: CalendarYearMonth,
): number {
  if (property.paymentMethod !== 'loan' || !property.loan) return 0;
  return calcLoanSettingsCoveragePrincipalMan(
    property,
    property.loan,
    coverageHousingMember(input.familyMembers, targetId),
    input.referenceDate,
    at,
    coverageEnd,
    calcHousingLoanTotalAmountMan(property, property.loan),
  );
}

function calcOwnedCoverageMonth(
  input: CashFlowInput,
  targetId: string,
  propertyId: string,
  year: number,
  month: number,
  activeLoanIds?: string[],
): HousingExpenseDetail {
  return calcHouseholdMonthlyHousingDetailMan(
    input.familyMembers,
    housingStateForProperty(input.housingState, targetId, 'owned', propertyId),
    input.referenceDate,
    year,
    month,
    input.loanState,
    activeLoanIds != null ? { activeLoanIds } : undefined,
  );
}

function calcOwnedLoanCashMonthMan(
  input: CashFlowInput,
  targetId: string,
  propertyId: string,
  year: number,
  month: number,
  holdingSum: number,
  activeLoanIds?: string[],
): number {
  const withLoan = calcOwnedCoverageMonth(
    input,
    targetId,
    propertyId,
    year,
    month,
    activeLoanIds,
  );
  return Math.max(0, sumHousingExpenseDetail(withLoan) - holdingSum);
}

function coverageOwnedLinkedLoanFactor(
  design: RequiredCoverageExpenseDesigns,
  loan: HousingLinkedLoanView,
  owned: OwnedProperty,
  targetId: string,
  subject: RequiredCoverageSubject,
): number {
  const paid = isHousingLoanPaidByGroupCreditLife(
    loan.entry,
    loan.contractorRole,
    subject,
  );
  const loanTargetId = loan.contractorId ?? targetId;
  return housingLoanCoverageDesignedFactor({
    paidByCreditLife: paid,
    propertyInForce: isOwnedHousingLoanInForce(owned),
    lineFactor: coverageLineFactor(
      design.housing,
      loan.entry.id,
      loanTargetId,
      undefined,
      '所有',
    ),
  });
}

function roundLivingByLabel(
  livingByLabel: Record<string, number>,
): Record<string, number> {
  const rounded: Record<string, number> = {};
  for (const [label, amount] of Object.entries(livingByLabel)) {
    rounded[label] = roundMan(amount);
  }
  return rounded;
}

function accumulateExpensesThrough(
  input: CashFlowInput,
  start: CalendarYearMonth,
  end: CalendarYearMonth,
  design: RequiredCoverageExpenseDesigns,
  subject: RequiredCoverageSubject,
): {
  breakdown: ExpenseBreakdown;
  yearFlows: CoverageYearFlow[];
  baselineExpenses: RequiredCoverageExpenseTotals;
  livingByItem: Record<string, number>;
  baselineLivingByItem: Record<string, number>;
  byItem: Record<string, number>;
  baselineByItem: Record<string, number>;
  holdingDetailByItem: Record<string, HousingExpenseDetail>;
  baselineHoldingDetailByItem: Record<string, HousingExpenseDetail>;
} {
  const displayMembers = input.familyMembers.filter((m) => m.role !== 'pet');
  const head = displayMembers.find((member) => member.role === 'head');
  const expenseMemberIds = displayMembers.map((member) => member.id);
  const expenseBreakdown = createEmptyExpenseBreakdown(expenseMemberIds);
  const livingByLabel: Record<string, number> = {};
  const baselineLivingByLabel: Record<string, number> = {};
  const livingByItem: Record<string, number> = {};
  const baselineLivingByItem: Record<string, number> = {};
  const byItem: Record<string, number> = {};
  const baselineByItem: Record<string, number> = {};
  const holdingDetailByItem: Record<string, HousingExpenseDetail> = {};
  const baselineHoldingDetailByItem: Record<string, HousingExpenseDetail> =
    {};
  const annualHousingDetail = createEmptyHousingExpenseDetail();
  const annualVehicleDetail = createEmptyVehicleExpenseDetail();
  const annualLifeEventDetail = createEmptyLifeEventExpenseDetail();
  const annualOtherLoanDetail = createEmptyOtherLoanRepaymentDetail();
  const yearFlowMap = new Map<number, CoverageYearFlow>();
  const baseline = {
    living: 0,
    education: 0,
    housing: 0,
    lifeEvent: 0,
    vehicle: 0,
    loanRepayment: 0,
    insuranceOther: 0,
  };

  const startIdx = calendarIndex(start.year, start.month);
  const endIdx = calendarIndex(end.year, end.month);
  if (endIdx < startIdx) {
    return {
      breakdown: expenseBreakdown,
      yearFlows: [],
      baselineExpenses: emptyCoverageTotals(),
      livingByItem: {},
      baselineLivingByItem: {},
      byItem: {},
      baselineByItem: {},
      holdingDetailByItem: {},
      baselineHoldingDetailByItem: {},
    };
  }

  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const year = Math.floor((idx - 1) / 12);
    const month = ((idx - 1) % 12) + 1;

    const monthlyLivingOrig = calcMonthlyLivingItemsMan(input, year, month);
    const monthlyLiving = overlayLivingItems(
      monthlyLivingOrig,
      design.living,
    );
    for (const item of monthlyLivingOrig) {
      const lineId = coverageLivingLineId(item.targetId, item.label);
      addByItem(baselineLivingByItem, lineId, item.amount);
      addByItem(baselineByItem, lineId, item.amount);
      baselineLivingByLabel[item.label] =
        (baselineLivingByLabel[item.label] ?? 0) + item.amount;
    }
    for (const item of monthlyLiving) {
      const lineId = coverageLivingLineId(item.targetId, item.label);
      addByItem(livingByItem, lineId, item.amount);
      addByItem(byItem, lineId, item.amount);
      livingByLabel[item.label] =
        (livingByLabel[item.label] ?? 0) + item.amount;
    }
    const yearFlow =
      yearFlowMap.get(year) ?? createEmptyYearFlow(year);
    const at: CalendarYearMonth = { year, month };
    const isCoverageStartMonth = idx === startIdx;
    const isPrincipalSnapshotMonth =
      month === 1 || (year === start.year && month === start.month);
    baseline.living += monthlyLivingOrig.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    yearFlow.living += monthlyLiving.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    for (const member of displayMembers) {
      for (const entry of input.lifeEventState.byMember[member.id] ?? []) {
        const orig = calcMemberMonthlyLifeEventBreakdownMan(
          member,
          [entry],
          input.lifeEventState,
          input.referenceDate,
          year,
          month,
          input.familyMembers,
        );
        const factor = coverageLineFactor(
          design.lifeEvent,
          entry.id,
          member.id,
        );
        addByItem(baselineByItem, entry.id, orig.lifeEvent);
        addByItem(byItem, entry.id, orig.lifeEvent * factor);
        baseline.lifeEvent += orig.lifeEvent;
        const scaled = scaleLifeEventDetail(orig.detail, factor);
        annualLifeEventDetail.travel += scaled.travel;
        annualLifeEventDetail.appliance += scaled.appliance;
        annualLifeEventDetail.celebration += scaled.celebration;
        annualLifeEventDetail.medical += scaled.medical;
        annualLifeEventDetail.nursing += scaled.nursing;
        annualLifeEventDetail.other += scaled.other;
        expenseBreakdown.medicalCare += orig.medicalCare * factor;
        yearFlow.lifeEvent += orig.lifeEvent * factor;
      }

      const vehicleState = input.vehicleState ?? { byMember: {} };
      for (const entry of vehicleState.byMember[member.id] ?? []) {
        const orig = calcMemberMonthlyVehicleDetailMan(
          member,
          [entry],
          vehicleState,
          input.referenceDate,
          year,
          month,
          input.loanState,
        );
        const origSum = sumVehicleExpenseDetail(orig);
        const factor = coverageLineFactor(design.vehicle, entry.id, member.id);
        addByItem(baselineByItem, entry.id, origSum);
        addByItem(byItem, entry.id, origSum * factor);
        baseline.vehicle += origSum;
        addVehicleExpenseDetail(
          annualVehicleDetail,
          scaleVehicleDetail(orig, factor),
        );
        yearFlow.vehicle += origSum * factor;
      }

      for (const entry of input.educationByMember[member.id] ?? []) {
        const orig = yenToMan(
          calcMemberMonthlyEducationYen(
            member,
            [entry],
            input.referenceDate,
            year,
            month,
          ),
        );
        const factor = coverageLineFactor(
          design.education,
          entry.id,
          member.id,
        );
        addByItem(baselineByItem, entry.id, orig);
        addByItem(byItem, entry.id, orig * factor);
        baseline.education += orig;
        expenseBreakdown.educationByMember[member.id] += orig * factor;
        yearFlow.education += orig * factor;
      }
    }

    for (const [targetId, target] of Object.entries(
      input.housingState.byTarget,
    )) {
      for (const rental of target.rentals) {
        const orig = calcHouseholdMonthlyHousingDetailMan(
          input.familyMembers,
          housingStateForProperty(
            input.housingState,
            targetId,
            'rental',
            rental.id,
          ),
          input.referenceDate,
          year,
          month,
          input.loanState,
        );
        const origSum = sumHousingExpenseDetail(orig);
        const factor = coverageLineFactor(
          design.housing,
          rental.id,
          targetId,
          undefined,
          '賃貸',
        );
        addByItem(baselineByItem, rental.id, origSum);
        addByItem(byItem, rental.id, origSum * factor);
        baseline.housing += origSum;
        addHousingExpenseDetail(
          annualHousingDetail,
          scaleHousingDetail(orig, factor),
        );
        yearFlow.housing += origSum * factor;
      }
      for (const owned of target.owned) {
        const linkedLoans = input.loanState
          ? getHousingLinkedLoansForProperty(
              input.loanState,
              input.familyMembers,
              targetId,
              owned.id,
            )
          : [];
        const holdingOrig = calcOwnedCoverageMonth(
          input,
          targetId,
          owned.id,
          year,
          month,
          [],
        );
        const holdingId =
          linkedLoans.length === 0
            ? owned.id
            : coverageOwnedHoldingLineId(owned.id);
        const holdingSum = sumHousingExpenseDetail(holdingOrig);
        const holdingScaled =
          linkedLoans.length > 0
            ? scaleHousingHoldingCoverageParts(holdingOrig, (partKey) =>
                coverageLineFactor(
                  design.housing,
                  coverageOwnedHoldingPartLineId(holdingId, partKey),
                  targetId,
                  holdingId,
                  '所有',
                ),
              )
            : scaleHousingDetail(
                holdingOrig,
                coverageLineFactor(
                  design.housing,
                  holdingId,
                  targetId,
                  undefined,
                  '所有',
                ),
              );
        const holdingDesigned = sumHousingExpenseDetail(holdingScaled);
        addByItem(baselineByItem, holdingId, holdingSum);
        addByItem(byItem, holdingId, holdingDesigned);
        baseline.housing += holdingSum;
        addHousingExpenseDetail(annualHousingDetail, holdingScaled);
        yearFlow.housing += holdingDesigned;
        if (linkedLoans.length > 0) {
          addHousingExpenseDetail(
            ensureHoldingDetail(baselineHoldingDetailByItem, holdingId),
            holdingOrig,
          );
          addHousingExpenseDetail(
            ensureHoldingDetail(holdingDetailByItem, holdingId),
            holdingScaled,
          );
        }

        const skipLoanPrincipal =
          owned.usage === 'current' && owned.currentExpenseMode === 'simple';

        if (!skipLoanPrincipal) {
          if (linkedLoans.length === 0) {
            // リンクなしは支出タブと同じく団信判定しない（カタログ上も「団信なし」）
            const factor = coverageLineFactor(
              design.housing,
              owned.id,
              targetId,
              undefined,
              '所有',
            );
            yearFlow.housing +=
              calcOwnedLoanCashMonthMan(
                input,
                targetId,
                owned.id,
                year,
                month,
                holdingSum,
              ) * factor;
          } else {
            for (const loan of linkedLoans) {
              const factor = coverageOwnedLinkedLoanFactor(
                design,
                loan,
                owned,
                targetId,
                subject,
              );
              if (factor === 0) continue;
              yearFlow.housing +=
                calcOwnedLoanCashMonthMan(
                  input,
                  targetId,
                  owned.id,
                  year,
                  month,
                  holdingSum,
                  [loan.entry.id],
                ) * factor;
            }
          }
        }

        if (linkedLoans.length === 0) {
          if (
            !skipLoanPrincipal &&
            (isCoverageStartMonth || isPrincipalSnapshotMonth)
          ) {
            const principal = calcUnlinkedOwnedLoanCoveragePrincipalMan(
              input,
              targetId,
              owned,
              at,
              end,
            );
            const factor = coverageLineFactor(
              design.housing,
              owned.id,
              targetId,
              undefined,
              '所有',
            );
            if (isCoverageStartMonth) {
              addByItem(baselineByItem, owned.id, principal);
              addByItem(byItem, owned.id, principal * factor);
              baseline.housing += principal;
              annualHousingDetail.loanRepaymentDetail.principal +=
                principal * factor;
            }
            if (isPrincipalSnapshotMonth) {
              yearFlow.housingPrincipal += principal * factor;
            }
          }
          continue;
        }

        if (
          !skipLoanPrincipal &&
          (isCoverageStartMonth || isPrincipalSnapshotMonth)
        ) {
          for (const loan of linkedLoans) {
            const principal = calcHousingLinkedLoanCoveragePrincipalMan(
              input,
              targetId,
              owned,
              loan.entry,
              at,
              end,
            );
            const factor = coverageOwnedLinkedLoanFactor(
              design,
              loan,
              owned,
              targetId,
              subject,
            );
            if (isCoverageStartMonth) {
              addByItem(baselineByItem, loan.entry.id, principal);
              addByItem(byItem, loan.entry.id, principal * factor);
              baseline.housing += principal;
              annualHousingDetail.loanRepaymentDetail.principal +=
                principal * factor;
            }
            if (isPrincipalSnapshotMonth) {
              yearFlow.housingPrincipal += principal * factor;
            }
          }
        }
      }
    }

    for (const [memberId, entries] of Object.entries(
      input.loanState?.byMember ?? {},
    )) {
      const targetId =
        memberId === '__legacy__' ? (head?.id ?? memberId) : memberId;
      for (const entry of entries) {
        if (!isOtherLoanForCashFlow(entry)) continue;
        const orig = calcLoanEntryMonthlyRepaymentMan(
          entry,
          input.referenceDate,
          year,
          month,
        );
        const factor = coverageLineFactor(
          design.loanRepayment,
          entry.id,
          targetId,
        );
        addByItem(baselineByItem, entry.id, orig);
        addByItem(byItem, entry.id, orig * factor);
        baseline.loanRepayment += orig;
        annualOtherLoanDetail[entry.category] += orig * factor;
        yearFlow.loan += orig * factor;
      }
    }

    for (const [memberId, entries] of Object.entries(
      input.insuranceState?.byMember ?? {},
    )) {
      const member =
        displayMembers.find((item) => item.id === memberId) ??
        input.familyMembers.find((item) => item.id === memberId);
      if (!member) continue;
      for (const entry of entries) {
        const orig = calcMemberMonthlyInsuranceDetailMan(
          member,
          [entry],
          input.insuranceState ?? { byMember: {} },
          input.housingState,
          input.vehicleState ?? { byMember: {} },
          input.referenceDate,
          year,
          month,
        );
        const housingIns =
          orig.rentalInsurancePremium + orig.ownedInsurancePremium;
        const vehicleIns = orig.vehicleInsurance;
        const otherIns = sumOtherInsurancePremiumDetail(
          orig.insuranceOtherDetail,
        );
        const lineAmount = housingIns + vehicleIns + otherIns;
        const factor = coverageLineFactor(
          design.insuranceOther,
          entry.id,
          memberId,
        );
        addByItem(baselineByItem, entry.id, lineAmount);
        addByItem(byItem, entry.id, lineAmount * factor);
        baseline.housing += housingIns;
        baseline.vehicle += vehicleIns;
        baseline.insuranceOther += otherIns;
        annualHousingDetail.rentalInsurancePremium +=
          orig.rentalInsurancePremium * factor;
        annualHousingDetail.ownedInsurancePremium +=
          orig.ownedInsurancePremium * factor;
        annualVehicleDetail.insurance += vehicleIns * factor;
        addOtherInsurancePremiumDetail(
          expenseBreakdown.insuranceOtherDetail,
          scaleOtherInsuranceDetail(orig.insuranceOtherDetail, factor),
        );
        yearFlow.housing += housingIns * factor;
        yearFlow.vehicle += vehicleIns * factor;
        yearFlow.insurance += otherIns * factor;
      }
    }

    yearFlowMap.set(year, yearFlow);
  }

  const roundedLivingByLabel = roundLivingByLabel(livingByLabel);
  const roundedBaselineLiving = roundLivingByLabel(baselineLivingByLabel);
  expenseBreakdown.livingByLabel = roundedLivingByLabel;
  expenseBreakdown.living = roundMan(
    Object.values(roundedLivingByLabel).reduce((sum, value) => sum + value, 0),
  );
  expenseBreakdown.housingDetail = annualHousingDetail;
  expenseBreakdown.housing = roundMan(
    sumHousingExpenseDetail(annualHousingDetail),
  );
  expenseBreakdown.vehicleDetail = annualVehicleDetail;
  expenseBreakdown.vehicle = roundMan(
    sumVehicleExpenseDetail(annualVehicleDetail),
  );
  expenseBreakdown.lifeEventDetail = annualLifeEventDetail;
  expenseBreakdown.lifeEvent = roundMan(
    sumLifeEventExpenseDetail(annualLifeEventDetail),
  );
  expenseBreakdown.medicalCare = roundMan(expenseBreakdown.medicalCare);
  expenseBreakdown.loanRepaymentDetail = annualOtherLoanDetail;
  expenseBreakdown.loanRepayment = roundMan(
    sumOtherLoanRepaymentDetail(annualOtherLoanDetail),
  );
  expenseBreakdown.insuranceOther = roundMan(
    sumOtherInsurancePremiumDetail(expenseBreakdown.insuranceOtherDetail),
  );
  for (const memberId of expenseMemberIds) {
    expenseBreakdown.educationByMember[memberId] = roundMan(
      expenseBreakdown.educationByMember[memberId],
    );
  }
  const yearFlows = [...yearFlowMap.values()].sort(
    (left, right) => left.calendarYear - right.calendarYear,
  );
  const baselineLiving = roundMan(
    Object.values(roundedBaselineLiving).reduce((sum, value) => sum + value, 0),
  );
  const baselineExpenses: RequiredCoverageExpenseTotals = {
    living: baselineLiving,
    education: roundMan(baseline.education),
    housing: roundMan(baseline.housing),
    lifeEvent: roundMan(baseline.lifeEvent),
    vehicle: roundMan(baseline.vehicle),
    loanRepayment: roundMan(baseline.loanRepayment),
    insuranceOther: roundMan(baseline.insuranceOther),
    total: 0,
    livingByLabel: roundedBaselineLiving,
    livingByItem: roundLivingByLabel(baselineLivingByItem),
    byItem: roundLivingByLabel(baselineByItem),
    holdingDetailByItem: baselineHoldingDetailByItem,
    educationByMember: [],
  };
  baselineExpenses.total = roundMan(
    baselineExpenses.living +
      baselineExpenses.education +
      baselineExpenses.housing +
      baselineExpenses.lifeEvent +
      baselineExpenses.vehicle +
      baselineExpenses.loanRepayment +
      baselineExpenses.insuranceOther,
  );
  return {
    breakdown: expenseBreakdown,
    yearFlows,
    baselineExpenses,
    livingByItem: roundLivingByLabel(livingByItem),
    baselineLivingByItem: roundLivingByLabel(baselineLivingByItem),
    byItem: roundLivingByLabel(byItem),
    baselineByItem: roundLivingByLabel(baselineByItem),
    holdingDetailByItem,
    baselineHoldingDetailByItem,
  };
}

function buildCoverageChartPoints(
  input: CashFlowInput,
  yearFlows: CoverageYearFlow[],
  yearlyCashFlow: RequiredCoverageYearlyCashFlow[],
  cashFlowYears: CashFlowTableData['years'],
  openingBalances: { deposit: number; financialAssets: number },
): RequiredCoverageChartPoint[] {
  const head = input.familyMembers.find((member) => member.role === 'head');
  const spouse = input.familyMembers.find((member) => member.role === 'spouse');
  let remainingLiving = 0;
  let remainingHousing = 0;
  let remainingVehicle = 0;
  let remainingEducation = 0;
  let remainingLifeEvent = 0;
  let remainingLoan = 0;
  let remainingInsurance = 0;
  let remainingTaxSocial = 0;
  let remainingEarned = 0;
  let remainingSurvivorBasic = 0;
  let remainingSurvivorEmployees = 0;
  let remainingMiddleAgedWidowAdd = 0;
  let remainingChildAllowance = 0;
  let remainingOldAgeBasic = 0;
  let remainingOldAgeEmployees = 0;
  const minBalanceFromHere: number[] = new Array(yearlyCashFlow.length);
  let minFromHere = Infinity;
  for (let index = yearlyCashFlow.length - 1; index >= 0; index -= 1) {
    minFromHere = Math.min(minFromHere, yearlyCashFlow[index].savingsBalance);
    minBalanceFromHere[index] = minFromHere;
  }
  const points: RequiredCoverageChartPoint[] = [];

  for (let index = yearFlows.length - 1; index >= 0; index -= 1) {
    const flow = yearFlows[index];
    const yearRow = yearlyCashFlow[index];
    remainingLiving += flow.living;
    remainingHousing += flow.housing;
    remainingVehicle += flow.vehicle;
    remainingEducation += flow.education;
    remainingLifeEvent += flow.lifeEvent;
    remainingLoan += flow.loan;
    remainingInsurance += flow.insurance;
    remainingTaxSocial += flow.taxSocial;
    remainingEarned += flow.earned;
    remainingSurvivorBasic += flow.survivorBasic;
    remainingSurvivorEmployees += flow.survivorEmployees;
    remainingMiddleAgedWidowAdd += flow.middleAgedWidowAdd;
    remainingChildAllowance += flow.childAllowance;
    remainingOldAgeBasic += flow.oldAgeBasic;
    remainingOldAgeEmployees += flow.oldAgeEmployees;
    const living = roundMan(remainingLiving);
    const housing = roundMan(remainingHousing + flow.housingPrincipal);
    const vehicle = roundMan(remainingVehicle);
    const education = roundMan(remainingEducation);
    const lifeEvent = roundMan(remainingLifeEvent);
    const loan = roundMan(remainingLoan);
    const insurance = roundMan(remainingInsurance);
    const taxSocialRem = roundMan(remainingTaxSocial);
    const earnedRem = roundMan(remainingEarned);
    const survivorBasicRem = roundMan(remainingSurvivorBasic);
    const survivorEmployeesRem = roundMan(remainingSurvivorEmployees);
    const middleAgedWidowRem = roundMan(remainingMiddleAgedWidowAdd);
    const childAllowanceRem = roundMan(remainingChildAllowance);
    const oldAgeBasicRem = roundMan(remainingOldAgeBasic);
    const oldAgeEmployeesRem = roundMan(remainingOldAgeEmployees);
    const remainingIncome = roundMan(
      earnedRem +
        survivorBasicRem +
        survivorEmployeesRem +
        middleAgedWidowRem +
        childAllowanceRem +
        oldAgeBasicRem +
        oldAgeEmployeesRem,
    );
    const remainingExpenseTotal = roundMan(
      living +
        housing +
        vehicle +
        education +
        lifeEvent +
        loan +
        insurance +
        taxSocialRem,
    );
    const headAgeMonth = head
      ? getMemberAgeMonth(
          head,
          input.referenceDate,
          flow.calendarYear,
          12,
        )
      : null;
    const spouseAgeMonth = spouse
      ? getMemberAgeMonth(
          spouse,
          input.referenceDate,
          flow.calendarYear,
          12,
        )
      : null;
    const deathTime = resolveDeathTimeBalancesMan(
      flow.calendarYear,
      cashFlowYears,
      openingBalances,
    );
    points.push({
      calendarYear: flow.calendarYear,
      headAge: headAgeMonth?.age ?? 0,
      spouseAge: spouseAgeMonth?.age ?? null,
      living,
      housing,
      vehicle,
      education,
      lifeEvent,
      loan,
      insurance,
      taxSocial: taxSocialRem,
      yearLiving: roundMan(flow.living),
      yearHousing: roundMan(flow.housing),
      yearVehicle: roundMan(flow.vehicle),
      yearEducation: roundMan(flow.education),
      yearLifeEvent: roundMan(flow.lifeEvent),
      yearLoan: roundMan(flow.loan),
      yearInsurance: roundMan(flow.insurance),
      yearTaxSocial: roundMan(flow.taxSocial),
      yearEarned: roundMan(flow.earned),
      yearSurvivorBasic: roundMan(flow.survivorBasic),
      yearSurvivorEmployees: roundMan(flow.survivorEmployees),
      yearMiddleAgedWidowAdd: roundMan(flow.middleAgedWidowAdd),
      yearChildAllowance: roundMan(flow.childAllowance),
      yearOldAgeBasic: roundMan(flow.oldAgeBasic),
      yearOldAgeEmployees: roundMan(flow.oldAgeEmployees),
      yearIncome: yearRow?.income ?? roundMan(flow.income),
      yearExpense: yearRow?.expense ?? 0,
      yearNet: yearRow?.net ?? 0,
      yearHousingPrincipal: yearRow?.housingPrincipal ?? 0,
      savingsBalance: yearRow?.savingsBalance ?? 0,
      deathTimeDepositMan: deathTime.deposit,
      deathTimeFinancialAssetsMan: deathTime.financialAssets,
      remainingExpenseTotal,
      remainingEarned: earnedRem,
      remainingSurvivorBasic: survivorBasicRem,
      remainingSurvivorEmployees: survivorEmployeesRem,
      remainingMiddleAgedWidowAdd: middleAgedWidowRem,
      remainingChildAllowance: childAllowanceRem,
      remainingOldAgeBasic: oldAgeBasicRem,
      remainingOldAgeEmployees: oldAgeEmployeesRem,
      remainingTaxSocial: taxSocialRem,
      remainingIncome,
      remainingTotal: Math.max(0, -(minBalanceFromHere[index] ?? 0)),
    });
  }

  points.reverse();
  return points;
}

function toExpenseTotals(
  breakdown: ExpenseBreakdown,
  familyMembers: FamilyMember[],
): RequiredCoverageExpenseTotals {
  const educationByMember = familyMembers
    .filter((m) => m.role !== 'pet')
    .map((member) => ({
      memberId: member.id,
      label: getMemberTabLabel(member),
      amount: breakdown.educationByMember[member.id] ?? 0,
    }))
    .filter((row) => row.amount !== 0);

  return {
    living: breakdown.living,
    education: roundMan(sumEducationExpense(breakdown)),
    housing: breakdown.housing,
    lifeEvent: breakdown.lifeEvent,
    vehicle: breakdown.vehicle,
    loanRepayment: breakdown.loanRepayment,
    insuranceOther: breakdown.insuranceOther,
    total: roundMan(sumExpenseBreakdown(breakdown)),
    livingByLabel: breakdown.livingByLabel,
    livingByItem: {},
    byItem: {},
    holdingDetailByItem: {},
    educationByMember,
  };
}

export function buildRequiredCoverageResult(
  input: CashFlowInput,
  state: RequiredCoverageState,
  options?: {
    designStage?: RequiredCoverageDesignStage;
    cashFlowData?: CashFlowTableData;
  },
): RequiredCoverageResult {
  const designStage = options?.designStage ?? 'detail';
  const head = input.familyMembers.find((m) => m.role === 'head');
  const startMonth = head
    ? resolveSimulationMonthStart(
        head,
        input.incomeByMember,
        input.referenceDate,
      )
    : input.referenceDate.getMonth() + 1;
  const coverageStart: CalendarYearMonth = {
    year: input.referenceDate.getFullYear(),
    month: startMonth,
  };
  if (coverageStart.month < 1 || coverageStart.month > 12) {
    coverageStart.month = 1;
  }

  const subject = resolveCoverageSubject(state.subject, input.familyMembers);
  const horizons = resolveRequiredCoverageHorizons(input, subject);
  const coverageEnd = resolveCoverageEnd(
    state.kind,
    horizons,
    state.customEndYear,
    state.customEndMonth,
  );
  if (!coverageEnd) {
    const empty = toExpenseTotals(
      createEmptyExpenseBreakdown(
        input.familyMembers.filter((m) => m.role !== 'pet').map((m) => m.id),
      ),
      input.familyMembers,
    );
    return {
      horizons,
      coverageStart,
      coverageEnd: null,
      durationMonths: 0,
      expenses: empty,
      baselineExpenses: emptyCoverageTotals(),
      income: emptyCoverageIncomeTotals(),
      initialSavings: 0,
      initialFinancialAssets: 0,
      yearlyCashFlow: [],
      minSavingsBalance: 0,
      requiredAmount: 0,
      chartPoints: [],
    };
  }

  const durationMonths = Math.max(
    0,
    calendarIndex(coverageEnd.year, coverageEnd.month) -
      calendarIndex(coverageStart.year, coverageStart.month) +
      1,
  );
  const {
    breakdown,
    yearFlows,
    baselineExpenses,
    livingByItem,
    baselineLivingByItem,
    byItem,
    baselineByItem,
    holdingDetailByItem,
    baselineHoldingDetailByItem,
  } = accumulateExpensesThrough(
    input,
    coverageStart,
    coverageEnd,
    getCoverageDesign(state, subject, designStage),
    subject,
  );

  const coverageIncomeByMember = resolveCoverageIncomeByMember(
    input,
    state,
    subject,
    designStage,
  );
  const income = accumulateCoverageIncome(
    input,
    coverageIncomeByMember,
    state,
    subject,
    coverageStart,
    coverageEnd,
  );
  for (const flow of yearFlows) {
    flow.earned = income.byYearEarned[flow.calendarYear] ?? 0;
    flow.survivorBasic = income.byYearSurvivorBasic[flow.calendarYear] ?? 0;
    flow.survivorEmployees =
      income.byYearSurvivorEmployeesBasic[flow.calendarYear] ?? 0;
    flow.middleAgedWidowAdd =
      income.byYearMiddleAgedWidowAdd[flow.calendarYear] ?? 0;
    flow.childAllowance = income.byYearChildAllowance[flow.calendarYear] ?? 0;
    flow.oldAgeBasic = income.byYearOldAgeBasic[flow.calendarYear] ?? 0;
    flow.oldAgeEmployees = income.byYearOldAgeEmployees[flow.calendarYear] ?? 0;
    flow.taxSocial = income.byYearTaxSocial[flow.calendarYear] ?? 0;
    flow.income = income.byYear[flow.calendarYear] ?? 0;
  }

  const expenseTotals = {
    ...toExpenseTotals(breakdown, input.familyMembers),
    livingByItem,
    byItem,
    holdingDetailByItem,
  };
  const openingBalances = calcCoverageOpeningBalancesMan(input);
  const initialSavings = openingBalances.deposit;
  const { yearlyCashFlow, minSavingsBalance, requiredAmount } =
    buildRequiredCoverageYearlyCashFlow(yearFlows, initialSavings);
  const cashFlowYears = (
    options?.cashFlowData ?? buildCashFlowTable(input)
  ).years;

  return {
    horizons,
    coverageStart,
    coverageEnd,
    durationMonths,
    expenses: expenseTotals,
    baselineExpenses: {
      ...baselineExpenses,
      livingByItem: baselineLivingByItem,
      byItem: baselineByItem,
      holdingDetailByItem: baselineHoldingDetailByItem,
    },
    income,
    initialSavings,
    initialFinancialAssets: openingBalances.financialAssets,
    yearlyCashFlow,
    minSavingsBalance,
    requiredAmount,
    chartPoints: buildCoverageChartPoints(
      input,
      yearFlows,
      yearlyCashFlow,
      cashFlowYears,
      openingBalances,
    ),
  };
}

export interface DeathTimingCoverageRow {
  expenseBase: number;
  preparedSavings: number;
  preparedEarned: number;
  preparedSurvivorBasic: number;
  preparedSurvivorEmployees: number;
  preparedChildAllowance: number;
  preparedOldAgeBasic: number;
  preparedOldAgeEmployees: number;
  preparedTotal: number;
  shortfall: number;
  /** 準備済 / 支出累計。支出が0なら100 */
  sufficiencyPct: number;
}

/** 必要保障額＝不足額＝max(0, 支出累計 − 準備済) */
export function calcDeathTimingCoverageRow(input: {
  remainingExpenseTotal: number;
  remainingEarned: number;
  remainingSurvivorBasic: number;
  remainingSurvivorEmployees?: number;
  remainingMiddleAgedWidowAdd?: number;
  remainingChildAllowance: number;
  remainingOldAgeBasic?: number;
  remainingOldAgeEmployees?: number;
  initialSavings: number;
  includeSavings?: boolean;
  includeEarned?: boolean;
  includeSurvivor?: boolean;
  includeSurvivorEmployees?: boolean;
  includeChild?: boolean;
  includeOldAgeBasic?: boolean;
  includeOldAgeEmployees?: boolean;
}): DeathTimingCoverageRow {
  const expenseBase = roundMan(Math.max(0, input.remainingExpenseTotal));
  const preparedSavings =
    input.includeSavings === false ? 0 : roundMan(Math.max(0, input.initialSavings));
  const preparedEarned =
    input.includeEarned === false ? 0 : roundMan(Math.max(0, input.remainingEarned));
  const preparedSurvivorBasic =
    input.includeSurvivor === false
      ? 0
      : roundMan(Math.max(0, input.remainingSurvivorBasic));
  const preparedSurvivorEmployees =
    input.includeSurvivorEmployees === false
      ? 0
      : roundMan(
          Math.max(0, input.remainingSurvivorEmployees ?? 0) +
            Math.max(0, input.remainingMiddleAgedWidowAdd ?? 0),
        );
  const preparedChildAllowance =
    input.includeChild === false
      ? 0
      : roundMan(Math.max(0, input.remainingChildAllowance));
  const preparedOldAgeBasic =
    input.includeOldAgeBasic === false
      ? 0
      : roundMan(Math.max(0, input.remainingOldAgeBasic ?? 0));
  const preparedOldAgeEmployees =
    input.includeOldAgeEmployees === false
      ? 0
      : roundMan(Math.max(0, input.remainingOldAgeEmployees ?? 0));
  const preparedTotal = roundMan(
    preparedSavings +
      preparedEarned +
      preparedSurvivorBasic +
      preparedSurvivorEmployees +
      preparedChildAllowance +
      preparedOldAgeBasic +
      preparedOldAgeEmployees,
  );
  const shortfall = roundMan(Math.max(0, expenseBase - preparedTotal));
  const sufficiencyPct =
    expenseBase <= 0 ? 100 : Math.round((preparedTotal / expenseBase) * 100);
  return {
    expenseBase,
    preparedSavings,
    preparedEarned,
    preparedSurvivorBasic,
    preparedSurvivorEmployees,
    preparedChildAllowance,
    preparedOldAgeBasic,
    preparedOldAgeEmployees,
    preparedTotal,
    shortfall,
    sufficiencyPct,
  };
}

export function pickDeathTimingMilestoneAges(ages: number[]): number[] {
  if (ages.length === 0) return [];
  const first = ages[0];
  const last = ages[ages.length - 1];
  const wanted = [first];
  for (const mark of [45, 55, 65, 75]) {
    if (mark > first && mark < last) wanted.push(mark);
  }
  if (last !== first) wanted.push(last);

  const picked: number[] = [];
  for (const target of wanted) {
    let best = ages[0];
    for (const age of ages) {
      if (Math.abs(age - target) < Math.abs(best - target)) best = age;
    }
    if (!picked.includes(best)) picked.push(best);
  }
  return picked;
}

export function formatCoverageYearMonth(end: CalendarYearMonth): string {
  return formatYearMonth(end);
}

export function formatCoverageDurationMonths(months: number): string {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) return `${years}年${rem}か月`;
  if (years > 0) return `${years}年`;
  return `${rem}か月`;
}
