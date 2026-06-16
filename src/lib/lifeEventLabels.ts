import type { LifeEventCycleUnit, LifeEventType } from '../types/lifeEvent';

export const LIFE_EVENT_TYPE_LABELS: Record<LifeEventType, string> = {
  event: 'イベント',
  travel: '旅行・レジャー',
  appliance: '家電・家具',
  medical: '医療費',
  nursing: '介護費',
  hometown_tax: 'ふるさと納税',
  celebration_gift: '子・孫の祝い金',
  other: 'その他',
};

export const LIFE_EVENT_TYPE_OPTIONS: LifeEventType[] = [
  'event',
  'travel',
  'appliance',
  'medical',
  'nursing',
  'hometown_tax',
  'other',
];

export const LIFE_EVENT_CYCLE_UNIT_LABELS: Record<LifeEventCycleUnit, string> = {
  month: 'ヶ月ごと',
  year: '年ごと',
};

export function isCelebrationGiftLifeEventType(type: LifeEventType): boolean {
  return type === 'celebration_gift';
}

export function isMedicalCareLifeEventType(type: LifeEventType): boolean {
  return type === 'medical' || type === 'nursing';
}

export type LifeEventExpenseCategory =
  | 'travel'
  | 'appliance'
  | 'celebration'
  | 'other';

export function getLifeEventExpenseCategory(
  type: LifeEventType,
): LifeEventExpenseCategory | 'medical' {
  if (isMedicalCareLifeEventType(type)) return 'medical';
  if (type === 'travel') return 'travel';
  if (type === 'appliance') return 'appliance';
  if (type === 'celebration_gift') return 'celebration';
  return 'other';
}
