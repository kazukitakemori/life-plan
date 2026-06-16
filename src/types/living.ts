export const HOUSEHOLD_LIVING_KEY = '__household__';

export type LivingCycleUnit = 'month' | 'year';

export interface LivingExpenseItem {
  id: string;
  label: string;
  cycleInterval: number;
  cycleUnit: LivingCycleUnit;
  amountMan: number;
  emergencyAmountMan: number;
  increaseRate: number | null;
  /** 先頭項目と同じ上昇率を使う（2行目以降） */
  sameIncreaseRateAsFirst: boolean;
}

export type LivingScheduleEndMode = 'lifetime' | 'until';

export interface LivingExpenseSchedule {
  id: string;
  startAge: number;
  startMonth: number;
  endMode: LivingScheduleEndMode;
  endAge: number;
  endMonth: number;
  items: LivingExpenseItem[];
}

export type LivingByTarget = Record<string, LivingExpenseSchedule[]>;

export interface LivingExpenseState {
  inflationRate: number;
  byTarget: LivingByTarget;
}
