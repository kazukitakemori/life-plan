import { resolveMemberBirthMonth } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type {
  HousingState,
  HousingTargetData,
  OwnedImprovementEntry,
  OwnedMonthlyFeeEntry,
  OwnedProperty,
  OwnedPropertyLoan,
  OwnedPropertyLoanSettings,
  OwnedPropertyMaintenance,
  OwnedPropertyType,
  OwnedPropertyUsage,
  RentalEndMode,
  RentalOccupancy,
  RentalProperty,
} from '../types/housing';
import {
  createLoanInterestRatePeriod,
  normalizeOwnedPropertyLoanSettings,
} from './loanInterestRatePeriod';
import {
  createEmptyHousingTargetData,
  HOUSEHOLD_HOUSING_KEY,
  OWNED_PERIOD_LIFETIME,
} from '../types/housing';
import { calcBirthYear, calcYearAtAge } from './birthDate';
import { getOwnedPropertyDefaultName } from './housingLabels';
import { resolveNextHousingStartPeriod } from './housingPeriodChain';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

function createId(): string {
  return crypto.randomUUID();
}

function migrateOwnedPropertyUsage(
  value: OwnedPropertyUsage | 'residential' | 'business' | 'other' | undefined,
): OwnedPropertyUsage {
  if (value === 'current' || value === 'upcoming') return value;
  return 'current';
}

export function createRentalProperty(
  member: FamilyMember,
  referenceMonth: number,
  referenceYear?: number,
  overrides: Partial<RentalProperty> = {},
  chainFrom?: {
    rentals: RentalProperty[];
    owned: OwnedProperty[];
  },
): RentalProperty {
  const occupancy: RentalOccupancy = overrides.occupancy ?? 'current';
  const year = referenceYear ?? new Date().getFullYear();
  const chainedStart = chainFrom
    ? resolveNextHousingStartPeriod(member, chainFrom.rentals, chainFrom.owned)
    : null;
  const defaultStart = resolveDefaultStartAgeMonth(member.age, referenceMonth);
  const startAge =
    overrides.startAge ??
    chainedStart?.age ??
    (occupancy === 'current' ? defaultStart.startAge : (member.age ?? 0) + 1);
  const startMonth =
    overrides.startMonth ??
    chainedStart?.month ??
    (occupancy === 'current' ? defaultStart.startMonth : referenceMonth);

  return {
    id: createId(),
    name: '賃貸物件',
    occupancy,
    startAge,
    startMonth,
    endMode: 'lifetime',
    endAge: Math.max(startAge + 1, member.expectedLifespan ?? 90),
    endMonth: referenceMonth,
    monthlyRentMan: 0,
    securityDepositMan: 0,
    keyMoneyMan: 0,
    brokerageFeeMan: 0,
    movingCostMan: 0,
    moveOutCostMan: 0,
    securityDepositRefundMan: 0,
    renewalFeeMan: 0,
    renewalNextYear: year + 1,
    renewalNextMonth: referenceMonth,
    renewalIntervalYears: 1,
    ...overrides,
  };
}

export function createCurrentRentalProperty(
  member: FamilyMember,
  referenceMonth: number,
  referenceYear?: number,
): RentalProperty {
  const defaultStart = resolveDefaultStartAgeMonth(member.age, referenceMonth);
  return createRentalProperty(member, referenceMonth, referenceYear, {
    occupancy: 'current',
    name: '現在の住まい',
    startAge: defaultStart.startAge,
    startMonth: defaultStart.startMonth,
  });
}

export function createUpcomingRentalProperty(
  member: FamilyMember,
  referenceMonth: number,
  referenceYear?: number,
): RentalProperty {
  const year = referenceYear ?? new Date().getFullYear();
  return createRentalProperty(member, referenceMonth, referenceYear, {
    occupancy: 'upcoming',
    name: '入居予定物件',
    startAge: (member.age ?? 0) + 1,
    startMonth: referenceMonth,
    renewalNextYear: year + 2,
  });
}

export function createOwnedPropertyLoan(
  propertyName: string,
  overrides: Partial<OwnedPropertyLoan> = {},
): OwnedPropertyLoan {
  return {
    id: createId(),
    name: `${propertyName}用ローン`,
    paymentType: 'loan',
    note: '',
    ...overrides,
  };
}

export function createOwnedMonthlyFeeEntry(
  overrides: Partial<OwnedPropertyMaintenance['managementFees'][number]> = {},
): OwnedPropertyMaintenance['managementFees'][number] {
  return {
    id: createId(),
    startOffsetYears: 0,
    endOffsetYears: OWNED_PERIOD_LIFETIME,
    amountManPerMonth: 0,
    ...overrides,
  };
}

export function createOwnedImprovementEntry(
  referenceYear: number,
  referenceMonth: number,
  overrides: Partial<OwnedPropertyMaintenance['improvements'][number]> = {},
): OwnedPropertyMaintenance['improvements'][number] {
  return {
    id: createId(),
    year: referenceYear,
    month: referenceMonth,
    amountMan: 0,
    ...overrides,
  };
}

export function createOwnedAnnualTaxEntry(
  overrides: Partial<OwnedPropertyMaintenance['landTaxes'][number]> = {},
): OwnedPropertyMaintenance['landTaxes'][number] {
  return {
    id: createId(),
    startYear: null,
    fixedAssetTaxMan: 0,
    cityPlanningTaxMan: 0,
    ...overrides,
  };
}

export function createOwnedPropertyMaintenance(
  referenceYear: number,
  referenceMonth: number,
  overrides: Partial<OwnedPropertyMaintenance> = {},
): OwnedPropertyMaintenance {
  return {
    managementFees: [createOwnedMonthlyFeeEntry()],
    repairReserveFees: [createOwnedMonthlyFeeEntry()],
    selfRepair: {
      costMan: 0,
      nextYear: referenceYear + 5,
      nextMonth: referenceMonth,
      intervalYears: 5,
    },
    improvements: [createOwnedImprovementEntry(referenceYear, referenceMonth)],
    landTaxes: [createOwnedAnnualTaxEntry()],
    buildingTaxes: [createOwnedAnnualTaxEntry()],
    ...overrides,
  };
}

export function createOwnedProperty(
  type: OwnedPropertyType,
  member?: FamilyMember,
  referenceMonth = 1,
  referenceYear?: number,
  overrides: Partial<OwnedProperty> = {},
  chainFrom?: {
    rentals: RentalProperty[];
    owned: OwnedProperty[];
  },
): OwnedProperty {
  const year = referenceYear ?? new Date().getFullYear();
  const name = overrides.name ?? getOwnedPropertyDefaultName(type);
  const chainedStart =
    member && chainFrom
      ? resolveNextHousingStartPeriod(
          member,
          chainFrom.rentals,
          chainFrom.owned,
        )
      : null;
  const defaultStart = resolveDefaultStartAgeMonth(
    member?.age ?? 40,
    referenceMonth,
  );
  const startAge =
    overrides.startAge ?? chainedStart?.age ?? defaultStart.startAge;
  const startMonth =
    overrides.startMonth ?? chainedStart?.month ?? defaultStart.startMonth;
  const refDate = new Date(year, referenceMonth - 1, 1);
  const acquisitionTaxYear =
    overrides.acquisitionTaxYear ??
    (member && chainedStart
      ? calcYearAtAge(
          calcBirthYear(member.age, member.birthMonth, refDate),
          resolveMemberBirthMonth(member),
          startAge,
          startMonth,
        )
      : year);
  const acquisitionTaxMonth = overrides.acquisitionTaxMonth ?? startMonth;

  return {
    id: createId(),
    type,
    name,
    usage: 'current',
    currentExpenseMode: 'simple',
    simpleMonthlyExpenseMan: 0,
    startAge,
    startMonth,
    endMode: 'lifetime',
    endAge: Math.max(startAge + 1, member?.expectedLifespan ?? 90),
    endMonth: startMonth,
    buildingMan: 0,
    landMan: 0,
    brokerageFeeMan: 0,
    registrationFeeMan: 0,
    acquisitionTaxMan: 0,
    acquisitionTaxYear,
    acquisitionTaxMonth,
    isManualArea: false,
    landAreaSqm: 0,
    buildingAreaSqm: 0,
    usedBuildingConstructionEra: 'after_1997_apr',
    paymentMethod: 'loan',
    loan: createOwnedPropertyLoanSettings(),
    maintenance: createOwnedPropertyMaintenance(year, referenceMonth),
    ...overrides,
  };
}

export function createOwnedPropertyLoanSettings(
  overrides: Partial<OwnedPropertyLoanSettings> = {},
): OwnedPropertyLoanSettings {
  return normalizeOwnedPropertyLoanSettings({
    amountMan: 0,
    interestRatePeriods: [createLoanInterestRatePeriod()],
    years: 35,
    startYear: 0,
    startMonth: 0,
    deductionCategory: 'general',
    isNewConstruction: true,
    includeBrokerageFeeInLoan: true,
    includeRegistrationFeeInLoan: true,
    brokerageFeeSurchargeRatePct: 0,
    registrationFeeSurchargeRatePct: 0,
    financingFeeMan: 0,
    guaranteeFeeMan: 0,
    administrativeFeeMan: 0,
    bankFeePaymentTiming: 'loan',
    groupCreditLifePlan: 'general',
    groupCreditLifeSurchargeRatePct: 0,
    repaymentMethod: 'equal_payment',
    bonusRepaymentEnabled: false,
    bonusRepaymentAmountMan: 0,
    bonusRepaymentType: 'period_shortening',
    prepaymentEnabled: false,
    prepayments: [],
    lumpSumRepaymentEnabled: false,
    lumpSumRepaymentOffsetYears: 0,
    ...overrides,
  });
}
export function createDefaultHousingState(
  _head?: FamilyMember,
  _referenceMonth = 1,
): HousingState {
  return {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: {
        rentals: [],
        owned: [],
      },
    },
  };
}

export function migrateRentalProperty(
  rental: RentalProperty & {
    endMode?: RentalEndMode;
    occupancy?: RentalOccupancy;
    insurances?: unknown;
  },
): RentalProperty {
  const { insurances: _legacy, ...rest } = rental;
  return {
    ...rest,
    occupancy: rental.occupancy ?? 'current',
    movingCostMan: rental.movingCostMan ?? 0,
    moveOutCostMan: rental.moveOutCostMan ?? 0,
    securityDepositRefundMan: rental.securityDepositRefundMan ?? 0,
    endMode: rental.endMode ?? 'lifetime',
  };
}

export function migrateOwnedProperty(
  property: Partial<OwnedProperty> & Pick<OwnedProperty, 'id' | 'type' | 'name'>,
  member?: FamilyMember,
  referenceMonth = 1,
  referenceYear?: number,
): OwnedProperty {
  const year = referenceYear ?? new Date().getFullYear();
  const startAge = property.startAge ?? member?.age ?? 40;
  const legacyLoans = (
    property as Partial<OwnedProperty> & { loans?: OwnedPropertyLoan[] }
  ).loans;

  const paymentMethod =
    property.paymentMethod ??
    (legacyLoans?.some((loan) => loan.paymentType === 'loan')
      ? 'loan'
      : legacyLoans?.length
        ? 'cash'
        : 'loan');

  return {
    id: property.id,
    type: property.type,
    name: property.name,
    usage: migrateOwnedPropertyUsage(property.usage),
    currentExpenseMode: property.currentExpenseMode ?? 'simple',
    simpleMonthlyExpenseMan: property.simpleMonthlyExpenseMan ?? 0,
    startAge,
    startMonth: property.startMonth ?? referenceMonth,
    endMode: property.endMode ?? 'lifetime',
    endAge:
      property.endAge ?? Math.max(startAge + 1, member?.expectedLifespan ?? 90),
    endMonth: property.endMonth ?? referenceMonth,
    buildingMan: property.buildingMan ?? 0,
    landMan: property.landMan ?? 0,
    brokerageFeeMan: property.brokerageFeeMan ?? 0,
    registrationFeeMan: property.registrationFeeMan ?? 0,
    acquisitionTaxMan: property.acquisitionTaxMan ?? 0,
    acquisitionTaxYear: property.acquisitionTaxYear ?? year,
    acquisitionTaxMonth: property.acquisitionTaxMonth ?? referenceMonth,
    isManualArea: property.isManualArea ?? false,
    landAreaSqm: property.landAreaSqm ?? 0,
    buildingAreaSqm: property.buildingAreaSqm ?? 0,
    usedBuildingConstructionEra:
      property.usedBuildingConstructionEra ?? 'after_1997_apr',
    paymentMethod,
    loan: normalizeOwnedPropertyLoanSettings({
      ...createOwnedPropertyLoanSettings(),
      ...(property.loan as Parameters<typeof normalizeOwnedPropertyLoanSettings>[0]),
      includeBrokerageFeeInLoan:
        property.loan?.includeBrokerageFeeInLoan ?? true,
      includeRegistrationFeeInLoan:
        property.loan?.includeRegistrationFeeInLoan ?? true,
      brokerageFeeSurchargeRatePct:
        property.loan?.brokerageFeeSurchargeRatePct ?? 0,
      registrationFeeSurchargeRatePct:
        property.loan?.registrationFeeSurchargeRatePct ?? 0,
      financingFeeMan: property.loan?.financingFeeMan ?? 0,
      guaranteeFeeMan: property.loan?.guaranteeFeeMan ?? 0,
      administrativeFeeMan: property.loan?.administrativeFeeMan ?? 0,
      bankFeePaymentTiming: property.loan?.bankFeePaymentTiming ?? 'loan',
    }),
    maintenance: migrateOwnedPropertyMaintenance(
      property.maintenance,
      year,
      referenceMonth,
    ),
  };
}

function migrateOwnedMonthlyFeeEntry(
  entry: Partial<OwnedMonthlyFeeEntry> & {
    amountYenPerMonth?: number;
  },
): OwnedMonthlyFeeEntry {
  const amountManPerMonth =
    entry.amountManPerMonth ??
    (entry.amountYenPerMonth != null
      ? entry.amountYenPerMonth / 10_000
      : 0);
  return {
    id: entry.id ?? createId(),
    startOffsetYears: entry.startOffsetYears ?? 0,
    endOffsetYears: entry.endOffsetYears ?? OWNED_PERIOD_LIFETIME,
    amountManPerMonth: Math.max(0, amountManPerMonth),
  };
}

function migrateOwnedImprovementEntry(
  entry: Partial<OwnedImprovementEntry> & {
    amountYen?: number;
  },
  referenceYear: number,
  referenceMonth: number,
): OwnedImprovementEntry {
  const amountMan =
    entry.amountMan ??
    (entry.amountYen != null ? entry.amountYen / 10_000 : 0);
  return {
    id: entry.id ?? createId(),
    year: entry.year ?? referenceYear,
    month: entry.month ?? referenceMonth,
    amountMan: Math.max(0, amountMan),
  };
}

function migrateOwnedPropertyMaintenance(
  maintenance: OwnedProperty['maintenance'] | undefined,
  referenceYear: number,
  referenceMonth: number,
): OwnedPropertyMaintenance {
  const base =
    maintenance ?? createOwnedPropertyMaintenance(referenceYear, referenceMonth);
  return {
    ...base,
    managementFees:
      (base.managementFees?.length ?? 0) > 0
        ? base.managementFees.map(migrateOwnedMonthlyFeeEntry)
        : [createOwnedMonthlyFeeEntry()],
    repairReserveFees:
      (base.repairReserveFees?.length ?? 0) > 0
        ? base.repairReserveFees.map(migrateOwnedMonthlyFeeEntry)
        : [createOwnedMonthlyFeeEntry()],
    improvements:
      (base.improvements?.length ?? 0) > 0
        ? base.improvements.map((entry) =>
            migrateOwnedImprovementEntry(entry, referenceYear, referenceMonth),
          )
        : [createOwnedImprovementEntry(referenceYear, referenceMonth)],
  };
}

export function migrateHousingState(
  state: HousingState,
  member?: FamilyMember,
  referenceMonth = 1,
  referenceYear?: number,
): HousingState {
  const byTarget: HousingState['byTarget'] = {};
  for (const [targetId, data] of Object.entries(state.byTarget)) {
    byTarget[targetId] = {
      ...data,
      rentals: data.rentals.map(migrateRentalProperty),
      owned: data.owned.map((property) =>
        migrateOwnedProperty(property, member, referenceMonth, referenceYear),
      ),
    };
  }
  return { ...state, byTarget };
}
export function getHousingTargetData(
  state: HousingState,
  targetId: string,
): HousingTargetData {
  return state.byTarget[targetId] ?? createEmptyHousingTargetData();
}

export function countHousingItems(data: HousingTargetData): number {
  return data.rentals.length + data.owned.length;
}
