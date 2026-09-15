import type { LifeEventEntry, LifeEventType } from '../types/lifeEvent';

export type LifeEventSortMode = 'time' | 'genre';

const TYPE_ORDER: Record<LifeEventType, number> = {
  travel: 0,
  appliance: 1,
  event: 2,
  other: 3,
  medical: 4,
  nursing: 5,
  hometown_tax: 6,
  celebration_gift: 7,
};

function compareNumbers(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function getEndModeOrder(entry: LifeEventEntry): number {
  if (entry.endMode === 'once') return 0;
  if (entry.endMode === 'until') return 1;
  return 2;
}

function getEndAge(entry: LifeEventEntry): number {
  if (entry.endMode === 'once') return entry.startAge;
  if (entry.endMode === 'until') return entry.endAge;
  return Number.MAX_SAFE_INTEGER;
}

function getEndMonth(entry: LifeEventEntry): number {
  if (entry.endMode === 'once') return entry.startMonth;
  if (entry.endMode === 'until') return entry.endMonth;
  return 12;
}

function compareByTime(a: LifeEventEntry, b: LifeEventEntry): number {
  return (
    compareNumbers(a.startAge, b.startAge) ||
    compareNumbers(a.startMonth, b.startMonth) ||
    compareNumbers(getEndModeOrder(a), getEndModeOrder(b)) ||
    compareNumbers(getEndAge(a), getEndAge(b)) ||
    compareNumbers(getEndMonth(a), getEndMonth(b)) ||
    compareNumbers(TYPE_ORDER[a.type], TYPE_ORDER[b.type])
  );
}

function compareByGenre(a: LifeEventEntry, b: LifeEventEntry): number {
  return (
    compareNumbers(TYPE_ORDER[a.type], TYPE_ORDER[b.type]) ||
    compareNumbers(a.startAge, b.startAge) ||
    compareNumbers(a.startMonth, b.startMonth) ||
    compareNumbers(getEndModeOrder(a), getEndModeOrder(b)) ||
    compareNumbers(getEndAge(a), getEndAge(b)) ||
    compareNumbers(getEndMonth(a), getEndMonth(b))
  );
}

/**
 * Q3通常ライフイベントの表示順だけを整える。
 * 保存配列は変更せず、同条件では元の登録順を維持する。
 */
export function sortLifeEventEntries(
  entries: LifeEventEntry[],
  mode: LifeEventSortMode,
): LifeEventEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const compared =
        mode === 'genre'
          ? compareByGenre(a.entry, b.entry)
          : compareByTime(a.entry, b.entry);
      return compared || compareNumbers(a.index, b.index);
    })
    .map(({ entry }) => entry);
}
