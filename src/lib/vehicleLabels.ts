import type {
  CarVehicleKind,
  MotorcycleVehicleKind,
  VehicleCondition,
  VehicleEntry,
  VehicleKind,
  VehiclePaymentMode,
  VehicleReplacementCondition,
  VehicleType,
} from '../types/vehicle';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: '自動車',
  motorcycle: 'バイク・原付',
  bicycle: '自転車',
  other: 'その他',
};

export const VEHICLE_TYPE_OPTIONS: VehicleType[] = [
  'car',
  'motorcycle',
  'bicycle',
  'other',
];

export const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
  car: '🚗',
  motorcycle: '🏍️',
  bicycle: '🚲',
  other: '✨',
};

export const VEHICLE_CONDITION_LABELS: Record<VehicleCondition, string> = {
  new: '新車',
  used: '中古車',
  owned: '既に保有',
};

export const VEHICLE_CONDITION_OPTIONS: VehicleCondition[] = [
  'new',
  'used',
  'owned',
];

export const VEHICLE_REPLACEMENT_CONDITION_LABELS: Record<
  VehicleReplacementCondition,
  string
> = {
  new: '新車で買い替え',
  used: '中古車で買い替え',
};

export const VEHICLE_REPLACEMENT_CONDITION_OPTIONS: VehicleReplacementCondition[] =
  ['new', 'used'];

export const VEHICLE_PAYMENT_MODE_LABELS: Record<VehiclePaymentMode, string> = {
  purchaseAmount: '購入費用とローンを入力',
  monthlyRepayment: '月々の返済額を入力',
  alreadyOwned: '残債なし',
};

export const VEHICLE_PAYMENT_MODE_OPTIONS: VehiclePaymentMode[] = [
  'purchaseAmount',
  'monthlyRepayment',
  'alreadyOwned',
];

export const CAR_VEHICLE_KIND_LABELS: Record<CarVehicleKind, string> = {
  new: '新車',
  used: '中古車',
  owned: '既に保有',
};

export const CAR_VEHICLE_KIND_OPTIONS: CarVehicleKind[] = [
  'new',
  'used',
  'owned',
];

export const MOTORCYCLE_VEHICLE_KIND_LABELS: Record<
  MotorcycleVehicleKind,
  string
> = {
  over_250cc: '250cc超',
  under_250cc: '250cc以下',
};

export const MOTORCYCLE_VEHICLE_KIND_OPTIONS: MotorcycleVehicleKind[] = [
  'over_250cc',
  'under_250cc',
];

export function vehicleTypeHasKind(
  type: VehicleType,
): type is 'car' | 'motorcycle' {
  return type === 'car' || type === 'motorcycle';
}

export function getVehicleMonthlyMaintCostMan(entry: VehicleEntry): number {
  if (vehicleTypeHasKind(entry.type)) {
    const gasoline = entry.gasolineCostMan ?? entry.monthlyCostMan ?? 0;
    const parking = entry.parkingCostMan ?? 0;
    return gasoline + parking;
  }
  return entry.monthlyCostMan;
}

export function getVehicleGasolineCostMan(entry: VehicleEntry): number {
  if (!vehicleTypeHasKind(entry.type)) return 0;
  return entry.gasolineCostMan ?? entry.monthlyCostMan ?? 0;
}

export function getVehicleParkingCostMan(entry: VehicleEntry): number {
  if (!vehicleTypeHasKind(entry.type)) return 0;
  return entry.parkingCostMan ?? 0;
}

/** 税金・メンテナンス費の計上周期（1〜6年）。未設定時は1年 */
export const ANNUAL_COST_CYCLE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function resolveAnnualCostCycleYears(entry: VehicleEntry): number {
  const cycle = entry.annualCostCycleYears ?? 1;
  if (cycle >= 1 && cycle <= 6) return cycle;
  return 1;
}

export function formatAnnualCostCycleLabel(cycleYears: number): string {
  return cycleYears === 1 ? '毎年' : `${cycleYears}年毎`;
}

/** 利用期間が生涯のときの補足。until は西暦ラベル側で示す */
export function formatVehicleUsagePeriodHint(
  entry: Pick<VehicleEntry, 'endMode'>,
): string | null {
  if (entry.endMode !== 'lifetime') return null;
  return '亡くなるまで使う';
}

export function getDefaultVehicleKind(
  type: VehicleType,
): VehicleKind | undefined {
  if (type === 'car') return 'new';
  if (type === 'motorcycle') return 'under_250cc';
  return undefined;
}

export function getDefaultVehicleCondition(
  _type: VehicleType,
): VehicleCondition {
  return 'new';
}

export function parseVehicleCondition(value: string): VehicleCondition {
  if (value === 'owned') return 'owned';
  if (value === 'used') return 'used';
  return 'new';
}

export function resolveVehicleKind(
  type: VehicleType,
  kind: VehicleKind | undefined,
): VehicleKind | undefined {
  if (!vehicleTypeHasKind(type)) return undefined;
  if (type === 'car') {
    if (kind === 'owned') return 'owned';
    if (kind === 'used') return 'used';
    return 'new';
  }
  return kind && kind in MOTORCYCLE_VEHICLE_KIND_LABELS
    ? (kind as MotorcycleVehicleKind)
    : 'under_250cc';
}

export function resolveVehicleCondition(
  entry: Pick<VehicleEntry, 'type' | 'kind' | 'condition'>,
): VehicleCondition {
  if (entry.type === 'car') {
    const kind = resolveVehicleKind(entry.type, entry.kind);
    if (kind === 'owned') return 'owned';
    if (kind === 'used') return 'used';
    return 'new';
  }
  if (entry.type === 'motorcycle') {
    return parseVehicleCondition(entry.condition ?? 'new');
  }
  return parseVehicleCondition(entry.condition ?? 'new');
}

/** 既に保有（購入費をCFに計上しない）か */
export function isVehicleAlreadyOwned(
  entry: Pick<VehicleEntry, 'paymentMode'>,
): boolean {
  return entry.paymentMode === 'alreadyOwned';
}

export function formatVehicleKindLabel(
  type: VehicleType,
  kind: VehicleKind | undefined,
): string | undefined {
  const resolved = resolveVehicleKind(type, kind);
  if (!resolved) return undefined;
  if (type === 'car') {
    return CAR_VEHICLE_KIND_LABELS[resolved as CarVehicleKind];
  }
  return MOTORCYCLE_VEHICLE_KIND_LABELS[resolved as MotorcycleVehicleKind];
}
