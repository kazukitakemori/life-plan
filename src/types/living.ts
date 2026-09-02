export const HOUSEHOLD_LIVING_KEY = '__household__';

export type LivingCycleUnit = 'month' | 'year';

/** 簡単 = 月々一括 / 詳細 = 項目ごと */
export type LivingExpenseInputMode = 'simple' | 'detail';

export interface LivingExpenseItem {
  id: string;
  label: string;
  cycleInterval: number;
  cycleUnit: LivingCycleUnit;
  amountMan: number;
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
  /** 未設定時は詳細入力として扱う（既存データ互換） */
  inputMode: LivingExpenseInputMode;
  /** inputMode === 'simple' のときの月々の生活費（万円） */
  simpleMonthlyExpenseMan: number;
  /** 簡単入力時の上昇率（%/年）。null = なし */
  simpleIncreaseRate: number | null;
  items: LivingExpenseItem[];
}

export type LivingByTarget = Record<string, LivingExpenseSchedule[]>;

export interface LivingExpenseState {
  byTarget: LivingByTarget;
}
