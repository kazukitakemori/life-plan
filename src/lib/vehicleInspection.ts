import { calcYearAtAge } from './birthDate';
import type { VehicleCondition, VehicleEntry } from '../types/vehicle';
import {
  resolveVehicleCondition,
  resolveVehicleKind,
} from './vehicleLabels';

/** 継続車検の周期（年） */
export const VEHICLE_INSPECTION_RECURRING_YEARS = 2;

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * 車検が必要な乗り物か。
 * 自動車すべて、およびバイク・原付の 250cc 超が対象。
 */
export function vehicleRequiresInspection(
  entry: Pick<VehicleEntry, 'type' | 'kind'>,
): boolean {
  if (entry.type === 'car') return true;
  if (entry.type === 'motorcycle') {
    return resolveVehicleKind(entry.type, entry.kind) === 'over_250cc';
  }
  return false;
}

/**
 * 指定した車両区分での初回車検までの年数。
 * - 自動車の新車: 3 年
 * - 自動車の中古・既保有、および 250cc 超バイク: 2 年
 */
export function getInspectionValidityYearsForCondition(
  entry: Pick<VehicleEntry, 'type' | 'kind'>,
  condition: VehicleCondition,
): number {
  if (!vehicleRequiresInspection(entry)) return 0;
  if (entry.type === 'motorcycle') return 2;
  if (condition === 'used' || condition === 'owned') return 2;
  return 3;
}

/**
 * いまの車の、保有開始時点の車検有効期間（年）の目安。
 */
export function getInitialInspectionValidityYears(
  entry: Pick<VehicleEntry, 'type' | 'kind' | 'condition'>,
): number {
  return getInspectionValidityYearsForCondition(
    entry,
    resolveVehicleCondition(entry),
  );
}

export function getInspectionPeriodHint(
  entry: Pick<VehicleEntry, 'type' | 'kind' | 'condition'>,
): string | undefined {
  if (!vehicleRequiresInspection(entry)) return undefined;
  const years = getInitialInspectionValidityYears(entry);
  const condition = resolveVehicleCondition(entry);
  if (condition === 'used' || condition === 'owned') {
    return `初回の目安 ${years} 年（以後 ${VEHICLE_INSPECTION_RECURRING_YEARS} 年ごと）`;
  }
  return `初回 ${years} 年（以後 ${VEHICLE_INSPECTION_RECURRING_YEARS} 年ごと）`;
}

export function getDefaultNextInspection(
  startAge: number,
  startMonth: number,
  birthYear: number,
  birthMonth: number,
  entry: Pick<VehicleEntry, 'type' | 'kind' | 'condition'>,
): { nextInspectionYear: number; nextInspectionMonth: number } | undefined {
  if (!vehicleRequiresInspection(entry)) return undefined;
  const years = getInitialInspectionValidityYears(entry);
  const startYear = calcYearAtAge(
    birthYear,
    birthMonth,
    startAge,
    startMonth,
  );
  return {
    nextInspectionYear: startYear + years,
    nextInspectionMonth: startMonth,
  };
}

export function resolveNextInspection(
  entry: VehicleEntry,
  birthYear: number,
  birthMonth: number,
): { year: number; month: number } | undefined {
  if (!vehicleRequiresInspection(entry)) return undefined;
  if (
    entry.nextInspectionYear != null &&
    entry.nextInspectionMonth != null
  ) {
    return {
      year: entry.nextInspectionYear,
      month: entry.nextInspectionMonth,
    };
  }
  const fallback = getDefaultNextInspection(
    entry.startAge,
    entry.startMonth,
    birthYear,
    birthMonth,
    entry,
  );
  if (!fallback) return undefined;
  return {
    year: fallback.nextInspectionYear,
    month: fallback.nextInspectionMonth,
  };
}

/**
 * 当該月に車検費用を計上するか。
 * 次回車検月から初回、以後 2 年ごと。
 */
export function isVehicleInspectionDueMonth(
  entry: VehicleEntry,
  calendarYear: number,
  calendarMonth: number,
  birthYear: number,
  birthMonth: number,
): boolean {
  if ((entry.inspectionCostMan ?? 0) <= 0) return false;
  if (!vehicleRequiresInspection(entry)) return false;

  const startYear = calcYearAtAge(
    birthYear,
    birthMonth,
    entry.startAge,
    entry.startMonth,
  );
  const startIdx = calendarIndex(startYear, entry.startMonth);
  const currentIdx = calendarIndex(calendarYear, calendarMonth);
  if (currentIdx < startIdx) return false;

  const next = resolveNextInspection(entry, birthYear, birthMonth);
  if (!next) return false;

  const firstInspectionIdx = calendarIndex(next.year, next.month);
  if (currentIdx < firstInspectionIdx) return false;
  if (currentIdx === firstInspectionIdx) return true;

  const monthsAfter = currentIdx - firstInspectionIdx;
  const recurringMonths = VEHICLE_INSPECTION_RECURRING_YEARS * 12;
  return monthsAfter % recurringMonths === 0;
}

/** 種類・保有開始変更時に、次の車検を自動再設定した entry を返す */
export function withAutoNextInspection(
  entry: VehicleEntry,
  birthYear: number,
  birthMonth: number,
): VehicleEntry {
  if (!vehicleRequiresInspection(entry)) {
    const cleared: VehicleEntry = {
      ...entry,
      nextInspectionYear: undefined,
      nextInspectionMonth: undefined,
    };
    if (entry.type === 'motorcycle') {
      return { ...cleared, inspectionCostMan: 0 };
    }
    return cleared;
  }
  const next = getDefaultNextInspection(
    entry.startAge,
    entry.startMonth,
    birthYear,
    birthMonth,
    entry,
  );
  if (!next) return entry;

  let result: VehicleEntry = { ...entry, ...next };
  if (
    entry.type === 'motorcycle' &&
    (result.inspectionCostMan ?? 0) === 0
  ) {
    result = { ...result, inspectionCostMan: 3 };
  }
  return result;
}

export function buildInspectionYearOptions(startYear: number): number[] {
  const end = startYear + 60;
  return Array.from({ length: end - startYear + 1 }, (_, i) => startYear + i);
}
