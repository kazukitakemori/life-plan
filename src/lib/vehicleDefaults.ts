import { resolveMemberBirthMonth } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import { calcBirthYear, calcYearAtAge } from './birthDate';
import { getIncomeEligibleMembers } from './memberDisplay';
import {
  getDefaultNextInspection,
  vehicleRequiresInspection,
  withAutoNextInspection,
} from './vehicleInspection';
import {
  expandReplacementCycleEntry,
} from './vehicleDuplicate';
import {
  getDefaultVehicleCondition,
  getDefaultVehicleKind,
  resolveAnnualCostCycleYears,
  resolveVehicleCondition,
  resolveVehicleKind,
  vehicleTypeHasKind,
  VEHICLE_TYPE_ICONS,
  VEHICLE_TYPE_LABELS,
} from './vehicleLabels';
import { resolveDefaultStartAgeMonth } from './simulationTiming';
import type {
  VehicleByMember,
  VehicleEntry,
  VehicleInsurance,
  VehiclePresetId,
  VehicleState,
} from '../types/vehicle';

function createId(): string {
  return crypto.randomUUID();
}

export function createVehicleInsurance(
  overrides: Partial<VehicleInsurance> = {},
): VehicleInsurance {
  return {
    id: createId(),
    label: '任意保険',
    premiumMan: 0,
    ...overrides,
  };
}

function normalizeVehicleInsurances(
  insurances: VehicleInsurance[] | undefined,
): VehicleInsurance[] {
  if (!insurances) return [];
  return insurances.map((insurance) => ({
    id: insurance.id || createId(),
    label: insurance.label ?? '任意保険',
    premiumMan: insurance.premiumMan ?? 0,
  }));
}

const PRESET_DEFAULTS: Record<
  VehiclePresetId,
  Pick<
    VehicleEntry,
    | 'label'
    | 'type'
    | 'kind'
    | 'condition'
    | 'purchaseAmountMan'
    | 'repaymentEndYear'
    | 'repaymentEndMonth'
    | 'monthlyCostMan'
    | 'gasolineCostMan'
    | 'parkingCostMan'
    | 'annualCostMan'
    | 'annualCostCycleYears'
    | 'inspectionCostMan'
  >
> = {
  car: {
    label: '自動車',
    type: 'car',
    kind: 'new',
    condition: 'new',
    purchaseAmountMan: 250,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    monthlyCostMan: 0,
    gasolineCostMan: 2,
    parkingCostMan: 1,
    annualCostMan: 5,
    annualCostCycleYears: 1,
    inspectionCostMan: 10,
  },
  motorcycle: {
    label: 'バイク・原付',
    type: 'motorcycle',
    kind: 'under_250cc',
    condition: 'new',
    purchaseAmountMan: 50,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    monthlyCostMan: 0,
    gasolineCostMan: 1,
    parkingCostMan: 0,
    annualCostMan: 2,
    annualCostCycleYears: 1,
    inspectionCostMan: 0,
  },
  bicycle: {
    label: '自転車',
    type: 'bicycle',
    condition: 'new',
    purchaseAmountMan: 8,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    monthlyCostMan: 0,
    annualCostMan: 0.5,
    annualCostCycleYears: 1,
    inspectionCostMan: 0,
  },
  other: {
    label: 'その他',
    type: 'other',
    condition: 'new',
    purchaseAmountMan: 0,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    monthlyCostMan: 0,
    annualCostMan: 0,
    annualCostCycleYears: 1,
    inspectionCostMan: 0,
  },
};

export const VEHICLE_PRESETS: ReadonlyArray<{
  id: VehiclePresetId;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: 'car',
    icon: VEHICLE_TYPE_ICONS.car,
    title: VEHICLE_TYPE_LABELS.car,
    description: '乗用車の購入と維持',
  },
  {
    id: 'motorcycle',
    icon: VEHICLE_TYPE_ICONS.motorcycle,
    title: VEHICLE_TYPE_LABELS.motorcycle,
    description: '二輪車の購入と維持',
  },
  {
    id: 'bicycle',
    icon: VEHICLE_TYPE_ICONS.bicycle,
    title: VEHICLE_TYPE_LABELS.bicycle,
    description: '自転車・電動アシスト',
  },
  {
    id: 'other',
    icon: VEHICLE_TYPE_ICONS.other,
    title: VEHICLE_TYPE_LABELS.other,
    description: '船舶・キャンピングなど自由入力',
  },
];

export function getVehicleAgeOptions(member: FamilyMember): number[] {
  if (member.role === 'child') {
    return Array.from({ length: 126 }, (_, i) => i - 25);
  }
  return Array.from({ length: 101 }, (_, i) => i);
}

function normalizeVehicleEntry(
  entry: VehicleEntry,
  birthYear: number,
  birthMonth: number,
): VehicleEntry {
  const legacy = entry as VehicleEntry & {
    ownedPaymentMode?: string;
  };
  const rawPaymentMode: string =
    (entry as { paymentMode?: string }).paymentMode ??
    legacy.ownedPaymentMode ??
    'purchaseAmount';
  const paymentMode: VehicleEntry['paymentMode'] =
    rawPaymentMode === 'monthlyRepayment'
      ? 'monthlyRepayment'
      : rawPaymentMode === 'alreadyOwned'
        ? 'alreadyOwned'
        : 'purchaseAmount';

  let next: VehicleEntry = {
    ...entry,
    kind: resolveVehicleKind(entry.type, entry.kind),
    paymentMode,
    monthlyRepaymentMan: entry.monthlyRepaymentMan ?? 0,
    repaymentEndYear: entry.repaymentEndYear ?? 0,
    repaymentEndMonth: entry.repaymentEndMonth ?? 0,
    insurances: normalizeVehicleInsurances(entry.insurances),
  };

  if (vehicleTypeHasKind(entry.type)) {
    next = {
      ...next,
      condition: resolveVehicleCondition(next),
      gasolineCostMan: entry.gasolineCostMan ?? entry.monthlyCostMan ?? 0,
      parkingCostMan: entry.parkingCostMan ?? 0,
      monthlyCostMan: 0,
      annualCostCycleYears: resolveAnnualCostCycleYears(entry),
      inspectionCostMan: entry.inspectionCostMan ?? 0,
    };
  } else {
    next = {
      ...next,
      kind: undefined,
      condition: resolveVehicleCondition(next),
      annualCostCycleYears: resolveAnnualCostCycleYears(entry),
      inspectionCostMan: entry.inspectionCostMan ?? 0,
    };
  }

  if (!vehicleRequiresInspection(next)) {
    return {
      ...next,
      nextInspectionYear: undefined,
      nextInspectionMonth: undefined,
    };
  }

  // 旧データの年齢ベース日付を西暦へ移行
  const legacyAge = (entry as VehicleEntry & { nextInspectionAge?: number })
    .nextInspectionAge;
  if (
    next.nextInspectionYear == null &&
    legacyAge != null &&
    next.nextInspectionMonth != null
  ) {
    next = {
      ...next,
      nextInspectionYear: calcYearAtAge(
        birthYear,
        birthMonth,
        legacyAge,
        next.nextInspectionMonth,
      ),
    };
  }

  if (next.nextInspectionYear == null || next.nextInspectionMonth == null) {
    const defaults = getDefaultNextInspection(
      next.startAge,
      next.startMonth,
      birthYear,
      birthMonth,
      next,
    );
    if (defaults) {
      next = { ...next, ...defaults };
    }
  }

  return next;
}

export function createVehicleEntry(
  member: FamilyMember,
  referenceDate: Date,
  overrides: Partial<VehicleEntry> = {},
): VehicleEntry {
  const referenceMonth = referenceDate.getMonth() + 1;
  const defaultStart = resolveDefaultStartAgeMonth(member.age, referenceMonth);
  const type = overrides.type ?? 'other';
  const kind =
    overrides.kind !== undefined
      ? resolveVehicleKind(type, overrides.kind)
      : getDefaultVehicleKind(type);
  const condition =
    overrides.condition ??
    getDefaultVehicleCondition(type);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);

  const entry: VehicleEntry = {
    id: createId(),
    label: '乗り物',
    type,
    condition,
    paymentMode: 'purchaseAmount',
    monthlyRepaymentMan: 0,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    startAge: defaultStart.startAge,
    startMonth: defaultStart.startMonth,
    endMode: 'lifetime',
    endAge: member.expectedLifespan,
    endMonth: 12,
    purchaseAmountMan: 0,
    monthlyCostMan: 0,
    annualCostMan: 0,
    annualCostCycleYears: 1,
    inspectionCostMan: 0,
    insurances: [],
    ...overrides,
    kind: resolveVehicleKind(overrides.type ?? type, overrides.kind ?? kind),
  };
  return normalizeVehicleEntry(
    withAutoNextInspection(entry, birthYear, resolveMemberBirthMonth(member)),
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

export function createVehicleEntryFromPreset(
  presetId: VehiclePresetId,
  member: FamilyMember,
  referenceDate: Date,
): VehicleEntry {
  return createVehicleEntry(member, referenceDate, PRESET_DEFAULTS[presetId]);
}

export function createDefaultVehicleState(): VehicleState {
  return { byMember: {} };
}

export function migrateVehicleState(
  state: VehicleState & { inflationRate?: number },
): VehicleState {
  // 旧・全体物価上昇率は破棄する
  return { byMember: state.byMember ?? {} };
}

export function syncVehiclesWithFamily(
  members: FamilyMember[],
  state: VehicleState,
  referenceDate: Date = new Date(),
): VehicleState {
  const eligible = getIncomeEligibleMembers(members);
  const eligibleIds = new Set(eligible.map((m) => m.id));
  const byMember: VehicleByMember = {};

  for (const [memberId, entries] of Object.entries(state.byMember)) {
    if (!eligibleIds.has(memberId)) continue;
    const member = eligible.find((m) => m.id === memberId);
    if (!member) continue;
    const birthYear = calcBirthYear(
      member.age,
      member.birthMonth,
      referenceDate,
    );
    byMember[memberId] = entries.flatMap((entry) =>
      expandReplacementCycleEntry(entry, member, referenceDate).map((expanded) =>
        normalizeVehicleEntry(expanded, birthYear, resolveMemberBirthMonth(member)),
      ),
    );
  }

  return migrateVehicleState({ ...state, byMember });
}
