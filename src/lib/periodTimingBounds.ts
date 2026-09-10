import type { FamilyMember } from '../types/family';
import {
  periodAgeMonthFromCalendar,
  resolveSimulationStartCalendar,
} from './simulationTiming';

export type AgeMonth = { age: number; month: number };

export function ageMonthIndex(age: number, month: number): number {
  return age * 12 + (month - 1);
}

export function compareAgeMonth(a: AgeMonth, b: AgeMonth): number {
  return ageMonthIndex(a.age, a.month) - ageMonthIndex(b.age, b.month);
}

export function clampMonth(month: number | null | undefined): number {
  const n = Number(month);
  if (!Number.isFinite(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

/** 翌月（12月→年齢+1・1月） */
export function nextAgeMonth(age: number, month: number): AgeMonth {
  let nextAge = age;
  let nextMonth = clampMonth(month) + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextAge += 1;
  }
  return { age: nextAge, month: nextMonth };
}

/**
 * 基準月＝今月（期間ラベルの年齢・月）。
 * 暦の基準年月に対応する「A歳になる年のM月」へ変換する。
 */
export function resolveReferenceNowAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
): AgeMonth {
  return periodAgeMonthFromCalendar(
    member,
    referenceDate,
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
  );
}

/**
 * 試算開始＝来月（期間ラベルの年齢・月）。
 * 暦の試算開始年月に対応する「A歳になる年のM月」へ変換する。
 */
export function resolveSimulationStartAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
): AgeMonth {
  const start = resolveSimulationStartCalendar(referenceDate);
  return periodAgeMonthFromCalendar(
    member,
    referenceDate,
    start.year,
    start.month,
  );
}

/** これからの開始を試算開始以上へ */
export function clampFuturePeriodStart(
  start: AgeMonth,
  floor: AgeMonth,
): AgeMonth {
  if (compareAgeMonth(start, floor) < 0) {
    return { age: floor.age, month: floor.month };
  }
  return {
    age: Math.max(0, Number(start.age) || 0),
    month: clampMonth(start.month),
  };
}

/** 開始を基準月以前に揃える（現状・既保有の過去開始用） */
export function clampStartAtOrBefore(
  start: AgeMonth,
  ceiling: AgeMonth,
): AgeMonth {
  if (compareAgeMonth(start, ceiling) > 0) {
    return { age: ceiling.age, month: ceiling.month };
  }
  return {
    age: Math.max(0, Number(start.age) || 0),
    month: clampMonth(start.month),
  };
}

/** 開始を指定の年齢月に固定 */
export function pinStartToAgeMonth<
  T extends { startAge: number; startMonth: number },
>(entry: T, pinned: AgeMonth): T {
  return {
    ...entry,
    startAge: pinned.age,
    startMonth: pinned.month,
  };
}

/**
 * 現状・既保有など「開始 ≤ 基準月」の期間フィールドを揃える。
 * endMode が until のとき end も開始以降に保つ。
 */
export function clampPastInclusiveStartFields<
  T extends {
    startAge: number;
    startMonth: number;
    endAge?: number;
    endMonth?: number;
    endMode?: string;
  },
>(entry: T, ceiling: AgeMonth): T {
  const start = clampStartAtOrBefore(
    { age: entry.startAge, month: entry.startMonth },
    ceiling,
  );
  let next: T = {
    ...entry,
    startAge: start.age,
    startMonth: start.month,
  };

  if (
    entry.endMode === 'until' &&
    entry.endAge != null &&
    entry.endMonth != null
  ) {
    const end = ensurePeriodEndAtOrAfterStart(start, {
      age: entry.endAge,
      month: entry.endMonth,
    });
    next = { ...next, endAge: end.age, endMonth: end.month };
  }

  return next;
}

/** 過去の終了を基準月以下へ */
export function clampPastPeriodEnd(end: AgeMonth, ceiling: AgeMonth): AgeMonth {
  if (compareAgeMonth(end, ceiling) > 0) {
    return { age: ceiling.age, month: ceiling.month };
  }
  return {
    age: Math.max(0, Number(end.age) || 0),
    month: clampMonth(end.month),
  };
}

/** 終了が開始より前なら開始に揃える */
export function ensurePeriodEndAtOrAfterStart(
  start: AgeMonth,
  end: AgeMonth,
): AgeMonth {
  if (compareAgeMonth(end, start) < 0) {
    return { age: start.age, month: start.month };
  }
  return {
    age: Math.max(0, Number(end.age) || 0),
    month: clampMonth(end.month),
  };
}

/**
 * これからの期間フィールドを試算開始下限で揃える。
 * endMode が until / once のとき end も整合させる。
 */
export function clampFutureStartFields<
  T extends {
    startAge: number;
    startMonth: number;
    endAge?: number;
    endMonth?: number;
    endMode?: string;
  },
>(entry: T, floor: AgeMonth): T {
  const start = clampFuturePeriodStart(
    { age: entry.startAge, month: entry.startMonth },
    floor,
  );
  let next: T = {
    ...entry,
    startAge: start.age,
    startMonth: start.month,
  };

  if (entry.endMode === 'once') {
    return {
      ...next,
      endAge: start.age,
      endMonth: start.month,
    };
  }

  if (
    entry.endMode === 'until' &&
    entry.endAge != null &&
    entry.endMonth != null
  ) {
    const end = ensurePeriodEndAtOrAfterStart(start, {
      age: entry.endAge,
      month: entry.endMonth,
    });
    next = { ...next, endAge: end.age, endMonth: end.month };
  }

  return next;
}

/** ピッカー: 試算開始以降の年齢 */
export function filterAgesAtOrAfter(
  ages: number[],
  floor: AgeMonth,
): number[] {
  return ages.filter((age) => age >= floor.age);
}

/** ピッカー: 選んだ年齢が下限年齢のとき、下限月以降 */
export function filterMonthsAtOrAfter(
  selectedAge: number,
  floor: AgeMonth,
  months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
): number[] {
  if (selectedAge > floor.age) return months;
  if (selectedAge < floor.age) return [];
  return months.filter((month) => month >= floor.month);
}

/** ピッカー: 基準月以前の年齢 */
export function filterAgesAtOrBefore(
  ages: number[],
  ceiling: AgeMonth,
): number[] {
  return ages.filter((age) => age <= ceiling.age);
}

/** ピッカー: 選んだ年齢が上限年齢のとき、上限月以前 */
export function filterMonthsAtOrBefore(
  selectedAge: number,
  ceiling: AgeMonth,
  months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
): number[] {
  if (selectedAge < ceiling.age) return months;
  if (selectedAge > ceiling.age) return [];
  return months.filter((month) => month <= ceiling.month);
}
