import {
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
  isSamePeriodAgeMonth,
} from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  resolveInsurancePremiumPaymentMode,
  resolveLifeDeductionKind,
} from './insuranceLabels';
import { resolveInsurancePremiumPeriod } from './insurancePeriod';
import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type {
  InsuranceEntry,
  InsuranceState,
  LifeInsuranceDeductionKind,
} from '../types/insurance';
import type { VehicleState } from '../types/vehicle';

const MAN_TO_YEN = 10_000;

const DEDUCTIBLE_KINDS = ['general', 'nursing', 'pension'] as const;
type DeductibleKind = (typeof DEDUCTIBLE_KINDS)[number];

export interface LifeInsurancePremiumByKindMan {
  general: number;
  nursing: number;
  pension: number;
}

export interface LifeInsuranceDeductionYen {
  incomeTaxYen: number;
  residentTaxYen: number;
}

function createEmptyPremiumByKindMan(): LifeInsurancePremiumByKindMan {
  return { general: 0, nursing: 0, pension: 0 };
}

function isPremiumDueMonth(
  entry: InsuranceEntry,
  member: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
  calendarYear: number,
  calendarMonth: number,
  referenceDate: Date,
): boolean {
  const period = resolveInsurancePremiumPeriod(
    entry,
    member,
    housingState,
    vehicleState,
  );
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return false;
  }

  const paymentMode = resolveInsurancePremiumPaymentMode(
    entry.premiumPaymentMode,
  );
  if (paymentMode === 'monthly') return true;
  if (paymentMode === 'lump_sum') {
    return isSamePeriodAgeMonth(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    );
  }
  return calendarMonth === period.startMonth;
}

function calcMonthlyPremiumMan(
  entry: InsuranceEntry,
  member: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (
    !isPremiumDueMonth(
      entry,
      member,
      housingState,
      vehicleState,
      calendarYear,
      calendarMonth,
      referenceDate,
    )
  ) {
    return 0;
  }
  return entry.premiumMan ?? 0;
}

function isDeductibleKind(
  kind: LifeInsuranceDeductionKind,
): kind is DeductibleKind {
  return kind === 'general' || kind === 'nursing' || kind === 'pension';
}

export function calcMemberAnnualLifeInsurancePremiumManByKind(input: {
  member: FamilyMember;
  entries: InsuranceEntry[];
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): LifeInsurancePremiumByKindMan {
  const premiums = createEmptyPremiumByKindMan();
  for (const entry of input.entries) {
    const kind = resolveLifeDeductionKind(
      entry.category,
      entry.lifeDeductionKind,
    );
    if (!isDeductibleKind(kind)) continue;

    for (
      let month = input.monthStart;
      month <= input.monthEnd;
      month += 1
    ) {
      premiums[kind] += calcMonthlyPremiumMan(
        entry,
        input.member,
        input.housingState,
        input.vehicleState,
        input.referenceDate,
        input.calendarYear,
        month,
      );
    }
  }
  return premiums;
}

/** 新制度（平成24年1月1日以降契約）の区分ごとの生命保険料控除額（円） */
export function calcNewSystemLifeInsuranceDeductionForCategoryYen(
  premiumYen: number,
  taxType: 'income' | 'resident',
): number {
  if (premiumYen <= 0) return 0;

  const categoryCap = taxType === 'income' ? 40_000 : 28_000;
  let deduction: number;
  if (premiumYen <= 20_000) {
    deduction = premiumYen;
  } else if (premiumYen <= 40_000) {
    deduction =
      Math.floor(premiumYen / 2) + (taxType === 'income' ? 10_000 : 7_000);
  } else if (premiumYen <= 80_000) {
    deduction =
      Math.floor(premiumYen / 4) + (taxType === 'income' ? 20_000 : 14_000);
  } else {
    deduction = categoryCap;
  }
  return Math.min(deduction, categoryCap);
}

export function calcNewSystemLifeInsuranceDeductionYen(
  premiumsByKind: LifeInsurancePremiumByKindMan,
  taxType: 'income' | 'resident',
): number {
  const totalCap = taxType === 'income' ? 120_000 : 84_000;
  let total = 0;
  for (const kind of DEDUCTIBLE_KINDS) {
    const premiumYen = Math.round(premiumsByKind[kind] * MAN_TO_YEN);
    total += calcNewSystemLifeInsuranceDeductionForCategoryYen(
      premiumYen,
      taxType,
    );
  }
  return Math.min(total, totalCap);
}

export function calcMemberLifeInsuranceDeductionYen(input: {
  member: FamilyMember;
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyCalendarYear: number;
  levyMonthStart: number;
  levyMonthEnd: number;
}): LifeInsuranceDeductionYen {
  const entries = input.insuranceState.byMember[input.member.id] ?? [];
  if (entries.length === 0) {
    return { incomeTaxYen: 0, residentTaxYen: 0 };
  }

  const incomePremiums = calcMemberAnnualLifeInsurancePremiumManByKind({
    member: input.member,
    entries,
    housingState: input.housingState,
    vehicleState: input.vehicleState,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
  });
  const levyPremiums = calcMemberAnnualLifeInsurancePremiumManByKind({
    member: input.member,
    entries,
    housingState: input.housingState,
    vehicleState: input.vehicleState,
    referenceDate: input.referenceDate,
    calendarYear: input.levyCalendarYear,
    monthStart: input.levyMonthStart,
    monthEnd: input.levyMonthEnd,
  });

  return {
    incomeTaxYen: calcNewSystemLifeInsuranceDeductionYen(
      incomePremiums,
      'income',
    ),
    residentTaxYen: calcNewSystemLifeInsuranceDeductionYen(
      levyPremiums,
      'resident',
    ),
  };
}
