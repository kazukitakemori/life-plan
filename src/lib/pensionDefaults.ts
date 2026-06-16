import type { FamilyMember } from '../types/family';
import {
  TEIKIBIN_UNDER50_MONTHLY_ROW_COUNT,
  type NenkinTeikibinMonthlyRow,
  type BenefitSettings,
  type DependentSpousePensionSettings,
  type NenkinTeikibinOver50Form,
  type NenkinTeikibinParticipationFields,
  type NenkinTeikibinUnder50Form,
  type OldAgeBenefitRowSettings,
  type PensionByMember,
  type PensionMemberState,
  type TeikibinOver50AmountPair,
  type TeikibinOver50AmountTriple,
  type TeikibinOver50OldAgePair,
  type TeikibinRecentMonthlyInputRow,
  type TeikibinOver50OldAgeTriple,
} from '../types/pension';
import { getIncomeEligibleMembers } from './memberDisplay';

export function createDefaultTeikibinMonthlyRow(): NenkinTeikibinMonthlyRow {
  return {
    nationalPensionStatus: '',
    employeesPensionCategory: '',
    standardRemuneration: '',
    standardBonus: '',
    premiumPayment: '',
  };
}

function createDefaultParticipationFields(): NenkinTeikibinParticipationFields {
  return {
    nationalPensionType1Months: null,
    nationalPensionType3Months: null,
    additionalPremiumMonths: null,
    seamenInsuranceMonths: null,
    employeesPensionGeneralMonths: null,
    employeesPensionPublicServantMonths: null,
    employeesPensionPrivateSchoolMonths: null,
    consolidationPeriodMonths: null,
  };
}

function createDefaultAmountPair(): TeikibinOver50AmountPair {
  return { proportional: null, fixed: null };
}

function createDefaultAmountTriple(): TeikibinOver50AmountTriple {
  return {
    proportional: null,
    fixed: null,
    transitionalOccupational: null,
  };
}

function createDefaultOldAgePair(): TeikibinOver50OldAgePair {
  return { proportional: null, transitionalAddition: null };
}

function createDefaultOldAgeTriple(): TeikibinOver50OldAgeTriple {
  return {
    proportional: null,
    transitionalAddition: null,
    transitionalOccupational: null,
  };
}

function createDefaultRecentMonthlyInputRow(): TeikibinRecentMonthlyInputRow {
  return {
    nationalPensionStatus: '',
    employeesPensionCategory: '',
    standardRemuneration: '',
    standardBonus: '',
  };
}

function createDefaultOldAgeBenefitRow(): OldAgeBenefitRowSettings {
  return {
    startAge: 65,
    startMonth: 0,
    amountMode: 'auto',
    manualAmountPerYear: null,
  };
}

function createDefaultDependentSpousePension(): DependentSpousePensionSettings {
  return {
    amountMode: 'auto',
    manualAmountPerYear: null,
  };
}

export function createDefaultBenefitSettings(): BenefitSettings {
  return {
    oldAgeBasic: createDefaultOldAgeBenefitRow(),
    oldAgeGeneralEmployees: createDefaultOldAgeBenefitRow(),
    oldAgePublicPrivate: createDefaultOldAgeBenefitRow(),
    survivorDeathYear: 2024,
    survivorDeathMonth: 1,
    survivorBasicPerYear: null,
    survivorEmployeesMutualPerYear: null,
    dependentSpousePension: createDefaultDependentSpousePension(),
  };
}

export function createDefaultTeikibinUnder50Form(): NenkinTeikibinUnder50Form {
  return {
    ...createDefaultParticipationFields(),
    oldAgeBasicPensionYen: null,
    oldAgeEmployeesGeneralYen: null,
    oldAgeEmployeesPublicServantYen: null,
    oldAgeEmployeesPrivateSchoolYen: null,
    recentMonthlyYear: 2024,
    recentMonthlyMonth: 1,
    monthlyRows: Array.from(
      { length: TEIKIBIN_UNDER50_MONTHLY_ROW_COUNT },
      () => createDefaultTeikibinMonthlyRow(),
    ),
  };
}

export function migrateTeikibinOver50Form(
  form: Partial<NenkinTeikibinOver50Form>,
): NenkinTeikibinOver50Form {
  const defaults = createDefaultTeikibinOver50Form();
  return {
    ...defaults,
    ...form,
    recentMonthlyInputRow: {
      ...defaults.recentMonthlyInputRow,
      ...form.recentMonthlyInputRow,
    },
    monthlyRows:
      form.monthlyRows?.length === TEIKIBIN_UNDER50_MONTHLY_ROW_COUNT
        ? form.monthlyRows
        : defaults.monthlyRows,
    general: { ...defaults.general, ...form.general },
    publicServant: { ...defaults.publicServant, ...form.publicServant },
    privateSchool: { ...defaults.privateSchool, ...form.privateSchool },
  };
}

export function createDefaultTeikibinOver50Form(): NenkinTeikibinOver50Form {
  return {
    ...createDefaultParticipationFields(),
    basicPension65: null,
    general: {
      specialCol3: createDefaultAmountPair(),
      specialCol4: createDefaultAmountPair(),
      oldAge65: createDefaultOldAgePair(),
    },
    publicServant: {
      specialCol2: createDefaultAmountTriple(),
      specialCol3: createDefaultAmountTriple(),
      specialCol4: createDefaultAmountTriple(),
      oldAge65: createDefaultOldAgeTriple(),
    },
    privateSchool: {
      specialCol2: createDefaultAmountTriple(),
      specialCol3: createDefaultAmountTriple(),
      specialCol4: createDefaultAmountTriple(),
      oldAge65: createDefaultOldAgeTriple(),
    },
    recentMonthlyYear: 2024,
    recentMonthlyMonth: 1,
    monthlyRows: Array.from(
      { length: TEIKIBIN_UNDER50_MONTHLY_ROW_COUNT },
      () => createDefaultTeikibinMonthlyRow(),
    ),
    recentMonthlyInputRow: createDefaultRecentMonthlyInputRow(),
  };
}

export function createDefaultPensionMemberState(): PensionMemberState {
  return {
    pastEnrollment: 'none',
    teikibinUnder50: createDefaultTeikibinUnder50Form(),
    teikibinOver50: createDefaultTeikibinOver50Form(),
    benefitSettings: createDefaultBenefitSettings(),
  };
}

export function createDefaultPensionByMember(
  members: FamilyMember[],
): PensionByMember {
  const result: PensionByMember = {};
  for (const member of getIncomeEligibleMembers(members)) {
    result[member.id] = createDefaultPensionMemberState();
  }
  return result;
}

export function sumNullable(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
