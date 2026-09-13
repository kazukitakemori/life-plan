import type { LifeEventEntry, LifeEventSource } from '../types/lifeEvent';

export const SECOND_LIFE_HOUSING_EVENT_LABEL = 'セカンドライフ住まい';
export const SECOND_LIFE_NURSING_EVENT_LABEL = 'セカンドライフ介護'; // 旧データ互換
export const THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL = 'サードライフ介護（月額費用）';
export const THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL = 'サードライフ介護（開始時費用）';

export type SecondLifeManagedLifeEventSource = Extract<
  LifeEventSource,
  'second_life_housing' | 'second_life_nursing'
>;

/**
 * 旧データは source を持たないため、既存ラベルも後方互換として判定する。
 * 新しく生成するデータでは source を必ず付与する。
 */
export function getSecondLifeManagedLifeEventSource(
  entry: LifeEventEntry,
): SecondLifeManagedLifeEventSource | null {
  if (
    entry.source === 'second_life_housing' ||
    entry.source === 'second_life_nursing'
  ) {
    return entry.source;
  }

  if (entry.label === SECOND_LIFE_HOUSING_EVENT_LABEL) {
    return 'second_life_housing';
  }
  if (
    entry.label === SECOND_LIFE_NURSING_EVENT_LABEL ||
    entry.label === THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL ||
    entry.label === THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL
  ) {
    return 'second_life_nursing';
  }
  return null;
}

export function isSecondLifeManagedLifeEvent(entry: LifeEventEntry): boolean {
  return getSecondLifeManagedLifeEventSource(entry) != null;
}

export function getSecondLifeManagedLifeEventSourceLabel(
  source: SecondLifeManagedLifeEventSource,
): string {
  return source === 'second_life_housing' ? '住まい設計から連動' : '介護設計から連動';
}
