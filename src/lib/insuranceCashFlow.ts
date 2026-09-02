import {
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
  isSamePeriodAgeMonth,
} from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcEducationAnnuityEndAge,
  hasReturnValueInput,
  resolveEducationAnnuityYears,
  resolveInsuranceBenefitPayoutMode,
  resolveInsurancePremiumPaymentMode,
  resolvePersonalPensionAnnuityKind,
  resolvePersonalPensionAnnuityYears,
} from './insuranceLabels';
import {
  resolveInsuranceBenefitPaymentMonth,
  resolveInsurancePremiumPeriod,
} from './insurancePeriod';
import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type { InsuranceEntry, InsuranceState } from '../types/insurance';
import type { VehicleState } from '../types/vehicle';
import {
  addOtherInsurancePremiumDetail,
  createEmptyOtherInsurancePremiumDetail,
  sumOtherInsurancePremiumDetail,
  type OtherInsurancePremiumDetail,
} from '../types/cashFlow';

export interface InsuranceCashFlowDetail {
  rentalInsurancePremium: number;
  ownedInsurancePremium: number;
  vehicleInsurance: number;
  insuranceOther: number;
  insuranceOtherDetail: OtherInsurancePremiumDetail;
}

export function createEmptyInsuranceCashFlowDetail(): InsuranceCashFlowDetail {
  return {
    rentalInsurancePremium: 0,
    ownedInsurancePremium: 0,
    vehicleInsurance: 0,
    insuranceOther: 0,
    insuranceOtherDetail: createEmptyOtherInsurancePremiumDetail(),
  };
}

export function addInsuranceCashFlowDetail(
  target: InsuranceCashFlowDetail,
  source: InsuranceCashFlowDetail,
): void {
  target.rentalInsurancePremium += source.rentalInsurancePremium;
  target.ownedInsurancePremium += source.ownedInsurancePremium;
  target.vehicleInsurance += source.vehicleInsurance;
  target.insuranceOther += source.insuranceOther;
  addOtherInsurancePremiumDetail(
    target.insuranceOtherDetail,
    source.insuranceOtherDetail,
  );
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
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  const { age, month } = ageMonth;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  if (
    !isAgeCalendarMonthInRange(
      age,
      month,
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

  if (paymentMode === 'monthly') {
    return true;
  }

  if (paymentMode === 'lump_sum') {
    return isSamePeriodAgeMonth(
      age,
      month,
      period.startAge,
      period.startMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    );
  }

  // annual: 払込開始月と同月に毎年計上
  return calendarMonth === period.startMonth;
}

function calcPremiumMan(
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

function allocatePremium(
  detail: InsuranceCashFlowDetail,
  entry: InsuranceEntry,
  premium: number,
): void {
  if (premium === 0) return;

  if (entry.category === 'fire') {
    if (entry.housingLink?.propertyKind === 'rental') {
      detail.rentalInsurancePremium += premium;
    } else {
      detail.ownedInsurancePremium += premium;
    }
    return;
  }

  if (entry.category === 'auto') {
    detail.vehicleInsurance += premium;
    return;
  }

  if (entry.category in detail.insuranceOtherDetail) {
    detail.insuranceOtherDetail[
      entry.category as keyof OtherInsurancePremiumDetail
    ] += premium;
  } else {
    detail.insuranceOtherDetail.life_other += premium;
  }
  detail.insuranceOther = sumOtherInsurancePremiumDetail(
    detail.insuranceOtherDetail,
  );
}

export interface InsuranceIncomeDetail {
  education: number;
  personalPension: number;
  returnValue: number;
}

export function createEmptyInsuranceIncomeDetail(): InsuranceIncomeDetail {
  return {
    education: 0,
    personalPension: 0,
    returnValue: 0,
  };
}

export function addInsuranceIncomeDetail(
  target: InsuranceIncomeDetail,
  source: InsuranceIncomeDetail,
): void {
  target.education += source.education;
  target.personalPension += source.personalPension;
  target.returnValue += source.returnValue;
}

function isBenefitPaymentMonth(
  calendarMonth: number,
  member: Pick<FamilyMember, 'birthMonth'>,
): boolean {
  return calendarMonth === resolveInsuranceBenefitPaymentMonth(member);
}

function isMemberAliveAt(member: FamilyMember, age: number): boolean {
  return age <= member.expectedLifespan;
}

function getReceiveMemberAge(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number | null {
  const receiveMember =
    familyMembers.find((m) => m.id === entry.benefitReceiveMemberId) ??
    contractor;
  const ageMonth = getMemberAgeMonth(
    receiveMember,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  return ageMonth?.age ?? null;
}

function getBeneficiaryAge(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number | null {
  const beneficiary =
    familyMembers.find((m) => m.id === entry.beneficiaryMemberId) ?? contractor;
  const ageMonth = getMemberAgeMonth(
    beneficiary,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  return ageMonth?.age ?? null;
}

function isWithinAnnuityPeriod(
  age: number,
  startAge: number,
  years: number,
): boolean {
  const endAge = startAge + Math.max(1, years) - 1;
  return age >= startAge && age <= endAge;
}

function calcEducationBenefitMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (entry.category !== 'education' || entry.benefitAmountMan <= 0) {
    return 0;
  }
  const receiveMember =
    familyMembers.find((m) => m.id === entry.benefitReceiveMemberId) ??
    contractor;
  if (!isBenefitPaymentMonth(calendarMonth, receiveMember)) return 0;

  const age = getReceiveMemberAge(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (age == null) return 0;

  const mode = resolveInsuranceBenefitPayoutMode(entry.benefitPayoutMode);
  if (mode === 'lump_sum') {
    return age === entry.benefitReceiveAge ? entry.benefitAmountMan : 0;
  }

  const years = resolveEducationAnnuityYears(entry.educationAnnuityYears);
  const endAge = calcEducationAnnuityEndAge(entry.benefitReceiveAge, years);
  return age >= entry.benefitReceiveAge && age <= endAge
    ? entry.benefitAmountMan
    : 0;
}

function calcPersonalPensionBenefitMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (entry.category !== 'personal_pension' || entry.benefitAmountMan <= 0) {
    return 0;
  }
  const receiveMember =
    familyMembers.find((m) => m.id === entry.benefitReceiveMemberId) ??
    contractor;
  if (!isBenefitPaymentMonth(calendarMonth, receiveMember)) return 0;

  const receiveAge = getReceiveMemberAge(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (receiveAge == null) return 0;

  const beneficiary =
    familyMembers.find((m) => m.id === entry.beneficiaryMemberId) ?? contractor;
  const beneficiaryAge = getBeneficiaryAge(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (beneficiaryAge == null) return 0;

  const mode = resolveInsuranceBenefitPayoutMode(entry.benefitPayoutMode);
  if (mode === 'lump_sum') {
    return receiveAge === entry.benefitReceiveAge ? entry.benefitAmountMan : 0;
  }

  if (receiveAge < entry.benefitReceiveAge) return 0;

  const annuityKind = resolvePersonalPensionAnnuityKind(
    entry.personalPensionAnnuityKind,
  );
  const annuityYears = resolvePersonalPensionAnnuityYears(
    entry.personalPensionAnnuityYears,
  );

  if (annuityKind === 'certain') {
    return isWithinAnnuityPeriod(
      receiveAge,
      entry.benefitReceiveAge,
      annuityYears,
    )
      ? entry.benefitAmountMan
      : 0;
  }

  if (!isMemberAliveAt(beneficiary, beneficiaryAge)) return 0;

  if (annuityKind === 'term') {
    return isWithinAnnuityPeriod(
      receiveAge,
      entry.benefitReceiveAge,
      annuityYears,
    )
      ? entry.benefitAmountMan
      : 0;
  }

  // lifetime
  return entry.benefitAmountMan;
}

function calcReturnValueBenefitMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (!hasReturnValueInput(entry.category)) return 0;
  if (!entry.hasReturnValue || entry.returnValueMan <= 0) return 0;
  if (!isBenefitPaymentMonth(calendarMonth, contractor)) return 0;

  const ageMonth = getMemberAgeMonth(
    contractor,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  return ageMonth.age === entry.returnValueAge ? entry.returnValueMan : 0;
}

export function calcEntryInsuranceIncomeMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): InsuranceIncomeDetail {
  const detail = createEmptyInsuranceIncomeDetail();
  detail.education = calcEducationBenefitMan(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  detail.personalPension = calcPersonalPensionBenefitMan(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  detail.returnValue = calcReturnValueBenefitMan(
    entry,
    contractor,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  return detail;
}

export function calcMemberMonthlyInsuranceIncomeDetailMan(
  member: FamilyMember,
  entries: InsuranceEntry[],
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): InsuranceIncomeDetail {
  const detail = createEmptyInsuranceIncomeDetail();
  for (const entry of entries) {
    addInsuranceIncomeDetail(
      detail,
      calcEntryInsuranceIncomeMan(
        entry,
        member,
        familyMembers,
        referenceDate,
        calendarYear,
        calendarMonth,
      ),
    );
  }
  return detail;
}

export function calcHouseholdMonthlyInsuranceIncomeDetailMan(
  familyMembers: FamilyMember[],
  state: InsuranceState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): InsuranceIncomeDetail {
  const detail = createEmptyInsuranceIncomeDetail();
  for (const [memberId, entries] of Object.entries(state.byMember ?? {})) {
    const member = familyMembers.find((m) => m.id === memberId);
    if (!member || entries.length === 0) continue;
    addInsuranceIncomeDetail(
      detail,
      calcMemberMonthlyInsuranceIncomeDetailMan(
        member,
        entries,
        familyMembers,
        referenceDate,
        calendarYear,
        calendarMonth,
      ),
    );
  }
  return detail;
}

export function calcMemberMonthlyInsuranceDetailMan(
  member: FamilyMember,
  entries: InsuranceEntry[],
  _state: InsuranceState,
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): InsuranceCashFlowDetail {
  const detail = createEmptyInsuranceCashFlowDetail();
  for (const entry of entries) {
    const premium = calcPremiumMan(
      entry,
      member,
      housingState,
      vehicleState,
      referenceDate,
      calendarYear,
      calendarMonth,
    );
    allocatePremium(detail, entry, premium);
  }
  return detail;
}

export function calcHouseholdMonthlyInsuranceDetailMan(
  familyMembers: FamilyMember[],
  state: InsuranceState,
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): InsuranceCashFlowDetail {
  const detail = createEmptyInsuranceCashFlowDetail();
  for (const [memberId, entries] of Object.entries(state.byMember ?? {})) {
    const member = familyMembers.find((m) => m.id === memberId);
    if (!member || entries.length === 0) continue;
    addInsuranceCashFlowDetail(
      detail,
      calcMemberMonthlyInsuranceDetailMan(
        member,
        entries,
        state,
        housingState,
        vehicleState,
        referenceDate,
        calendarYear,
        calendarMonth,
      ),
    );
  }
  return detail;
}

export function calcEntryAnnualInsuranceBenefitMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
): InsuranceIncomeDetail {
  const detail = createEmptyInsuranceIncomeDetail();
  for (let month = monthStart; month <= monthEnd; month += 1) {
    addInsuranceIncomeDetail(
      detail,
      calcEntryInsuranceIncomeMan(
        entry,
        contractor,
        familyMembers,
        referenceDate,
        calendarYear,
        month,
      ),
    );
  }
  return detail;
}
