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
  LifeInsuranceDeductionSystem,
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

interface LifeInsurancePremiumBySystemMan {
  new: LifeInsurancePremiumByKindMan;
  old: LifeInsurancePremiumByKindMan;
}

export interface LifeInsuranceDeductionYen {
  incomeTaxYen: number;
  residentTaxYen: number;
}

function createEmptyPremiumByKindMan(): LifeInsurancePremiumByKindMan {
  return { general: 0, nursing: 0, pension: 0 };
}

function createEmptyPremiumBySystemMan(): LifeInsurancePremiumBySystemMan {
  return {
    new: createEmptyPremiumByKindMan(),
    old: createEmptyPremiumByKindMan(),
  };
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
  return Math.max(0, Number(entry.premiumMan) || 0);
}

function calcEntryPremiumManForMonths(input: {
  entry: InsuranceEntry;
  contractor: FamilyMember;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): number {
  let total = 0;
  for (let month = input.monthStart; month <= input.monthEnd; month += 1) {
    total += calcMonthlyPremiumMan(
      input.entry,
      input.contractor,
      input.housingState,
      input.vehicleState,
      input.referenceDate,
      input.calendarYear,
      month,
    );
  }
  return total;
}

function isDeductibleKind(
  kind: LifeInsuranceDeductionKind,
): kind is DeductibleKind {
  return kind === 'general' || kind === 'nursing' || kind === 'pension';
}

function normalizeDeductionKind(
  system: LifeInsuranceDeductionSystem,
  kind: DeductibleKind,
): DeductibleKind {
  // 旧契約には介護医療区分がない。第三分野は旧一般生命保険料として扱う。
  if (system === 'old' && kind === 'nursing') return 'general';
  return kind;
}

/**
 * 契約者配下の生命保険料を区分別に集計する。
 * 受取時の必要経費計算等でも使うため、控除のON/OFFは見ない。
 */
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
    premiums[kind] += calcEntryPremiumManForMonths({
      entry,
      contractor: input.member,
      housingState: input.housingState,
      vehicleState: input.vehicleState,
      referenceDate: input.referenceDate,
      calendarYear: input.calendarYear,
      monthStart: input.monthStart,
      monthEnd: input.monthEnd,
    });
  }
  return premiums;
}

function calcMemberAnnualDeductiblePremiumManBySystem(input: {
  member: FamilyMember;
  familyMembers: FamilyMember[];
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): LifeInsurancePremiumBySystemMan {
  const premiums = createEmptyPremiumBySystemMan();

  for (const [contractorId, entries] of Object.entries(
    input.insuranceState.byMember ?? {},
  )) {
    const contractor = input.familyMembers.find(
      (item) => item.id === contractorId,
    );
    if (!contractor) continue;

    for (const entry of entries) {
      if (entry.lifeDeductionEnabled !== true) continue;
      const payerId = entry.lifeDeductionPayerMemberId ?? contractorId;
      if (payerId !== input.member.id) continue;

      const rawKind = resolveLifeDeductionKind(
        entry.category,
        entry.lifeDeductionKind,
      );
      if (!isDeductibleKind(rawKind)) continue;

      const system = entry.lifeDeductionSystem ?? 'new';
      const kind = normalizeDeductionKind(system, rawKind);
      premiums[system][kind] += calcEntryPremiumManForMonths({
        entry,
        contractor,
        housingState: input.housingState,
        vehicleState: input.vehicleState,
        referenceDate: input.referenceDate,
        calendarYear: input.calendarYear,
        monthStart: input.monthStart,
        monthEnd: input.monthEnd,
      });
    }
  }

  return premiums;
}

export function calcMemberAnnualDeductibleLifeInsurancePremiumManByKind(input: {
  member: FamilyMember;
  familyMembers: FamilyMember[];
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): LifeInsurancePremiumByKindMan {
  const premiums = calcMemberAnnualDeductiblePremiumManBySystem(input);
  return {
    general: premiums.new.general + premiums.old.general,
    nursing: premiums.new.nursing,
    pension: premiums.new.pension + premiums.old.pension,
  };
}

/** 新制度の区分ごとの生命保険料控除額（円） */
export function calcNewSystemLifeInsuranceDeductionForCategoryYen(
  premiumYen: number,
  taxType: 'income' | 'resident',
): number {
  if (premiumYen <= 0) return 0;

  if (taxType === 'income') {
    if (premiumYen <= 20_000) return premiumYen;
    if (premiumYen <= 40_000) return Math.floor(premiumYen / 2) + 10_000;
    if (premiumYen <= 80_000) return Math.floor(premiumYen / 4) + 20_000;
    return 40_000;
  }

  if (premiumYen <= 12_000) return premiumYen;
  if (premiumYen <= 32_000) return Math.floor(premiumYen / 2) + 6_000;
  if (premiumYen <= 56_000) return Math.floor(premiumYen / 4) + 14_000;
  return 28_000;
}

/** 旧制度の一般・個人年金の区分ごとの生命保険料控除額（円） */
export function calcOldSystemLifeInsuranceDeductionForCategoryYen(
  premiumYen: number,
  taxType: 'income' | 'resident',
): number {
  if (premiumYen <= 0) return 0;

  if (taxType === 'income') {
    if (premiumYen <= 25_000) return premiumYen;
    if (premiumYen <= 50_000) return Math.floor(premiumYen / 2) + 12_500;
    if (premiumYen <= 100_000) return Math.floor(premiumYen / 4) + 25_000;
    return 50_000;
  }

  if (premiumYen <= 15_000) return premiumYen;
  if (premiumYen <= 40_000) return Math.floor(premiumYen / 2) + 7_500;
  if (premiumYen <= 70_000) return Math.floor(premiumYen / 4) + 17_500;
  return 35_000;
}

export function calcNewSystemLifeInsuranceDeductionYen(
  premiumsByKind: LifeInsurancePremiumByKindMan,
  taxType: 'income' | 'resident',
): number {
  const totalCap = taxType === 'income' ? 120_000 : 70_000;
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

function calcCombinedCategoryDeductionYen(input: {
  newPremiumMan: number;
  oldPremiumMan: number;
  taxType: 'income' | 'resident';
}): number {
  const newDeduction = calcNewSystemLifeInsuranceDeductionForCategoryYen(
    Math.round(input.newPremiumMan * MAN_TO_YEN),
    input.taxType,
  );
  const oldDeduction = calcOldSystemLifeInsuranceDeductionForCategoryYen(
    Math.round(input.oldPremiumMan * MAN_TO_YEN),
    input.taxType,
  );
  const combinedCap = input.taxType === 'income' ? 40_000 : 28_000;
  return Math.max(
    newDeduction,
    oldDeduction,
    Math.min(combinedCap, newDeduction + oldDeduction),
  );
}

function calcDeductionFromPremiumsBySystem(
  premiums: LifeInsurancePremiumBySystemMan,
  taxType: 'income' | 'resident',
): number {
  const general = calcCombinedCategoryDeductionYen({
    newPremiumMan: premiums.new.general,
    oldPremiumMan: premiums.old.general,
    taxType,
  });
  const pension = calcCombinedCategoryDeductionYen({
    newPremiumMan: premiums.new.pension,
    oldPremiumMan: premiums.old.pension,
    taxType,
  });
  const nursing =
    calcNewSystemLifeInsuranceDeductionForCategoryYen(
      Math.round(premiums.new.nursing * MAN_TO_YEN),
      taxType,
    );
  const totalCap = taxType === 'income' ? 120_000 : 70_000;
  return Math.min(totalCap, general + pension + nursing);
}

export function calcMemberLifeInsuranceDeductionYen(input: {
  member: FamilyMember;
  familyMembers: FamilyMember[];
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
  const incomePremiums = calcMemberAnnualDeductiblePremiumManBySystem({
    member: input.member,
    familyMembers: input.familyMembers,
    insuranceState: input.insuranceState,
    housingState: input.housingState,
    vehicleState: input.vehicleState,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
  });
  const levyPremiums = calcMemberAnnualDeductiblePremiumManBySystem({
    member: input.member,
    familyMembers: input.familyMembers,
    insuranceState: input.insuranceState,
    housingState: input.housingState,
    vehicleState: input.vehicleState,
    referenceDate: input.referenceDate,
    calendarYear: input.levyCalendarYear,
    monthStart: input.levyMonthStart,
    monthEnd: input.levyMonthEnd,
  });

  return {
    incomeTaxYen: calcDeductionFromPremiumsBySystem(incomePremiums, 'income'),
    residentTaxYen: calcDeductionFromPremiumsBySystem(
      levyPremiums,
      'resident',
    ),
  };
}
