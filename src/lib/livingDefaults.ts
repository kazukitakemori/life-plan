import type { FamilyMember } from '../types/family';
import type {
  LivingCycleUnit,
  LivingExpenseInputMode,
  LivingExpenseItem,
  LivingExpenseSchedule,
  LivingExpenseState,
} from '../types/living';
import { HOUSEHOLD_LIVING_KEY } from '../types/living';
import { calcMonthlyEquivalentMan } from './livingAmount';
import { nextPeriodStart } from './incomePeriod';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

type LegacyLivingExpenseItem = LivingExpenseItem & {
  cycleMonths?: number;
};

type LegacyLivingExpenseSchedule = Omit<
  Partial<LivingExpenseSchedule>,
  'items'
> & {
  id: string;
  items?: LegacyLivingExpenseItem[];
};

export function migrateLivingExpenseItem(
  item: LegacyLivingExpenseItem,
): LivingExpenseItem {
  const cycleInterval = item.cycleInterval ?? item.cycleMonths ?? 1;
  const cycleUnit: LivingCycleUnit = item.cycleUnit ?? 'month';

  return {
    ...item,
    cycleInterval: cycleInterval > 0 ? cycleInterval : 1,
    cycleUnit,
    sameIncreaseRateAsFirst: item.sameIncreaseRateAsFirst ?? false,
  };
}

export function migrateLivingExpenseSchedule(
  schedule: LegacyLivingExpenseSchedule,
): LivingExpenseSchedule {
  let items = (schedule.items ?? []).map(migrateLivingExpenseItem);
  const simpleMonthlyExpenseMan =
    schedule.simpleMonthlyExpenseMan ??
    (items.length > 0 ? calcMonthlyEquivalentMan(items) : 30);
  const simpleIncreaseRate =
    schedule.simpleIncreaseRate !== undefined
      ? schedule.simpleIncreaseRate
      : (items[0]?.increaseRate ?? null);

  // 旧・簡単入力は詳細UI（生活費1行）へ統合
  let inputMode: LivingExpenseInputMode = schedule.inputMode ?? 'detail';
  if (inputMode === 'simple') {
    items = [
      createLivingExpenseItem({
        amountMan: simpleMonthlyExpenseMan,
        increaseRate: simpleIncreaseRate,
      }),
    ];
    inputMode = 'detail';
  }
  if (items.length === 0) {
    items = [createLivingExpenseItem()];
  }

  return syncLivingDetailSummary({
    id: schedule.id,
    startAge: schedule.startAge ?? 40,
    startMonth: schedule.startMonth ?? 1,
    endMode: schedule.endMode ?? 'lifetime',
    endAge: schedule.endAge ?? 90,
    endMonth: schedule.endMonth ?? 12,
    inputMode,
    simpleMonthlyExpenseMan,
    simpleIncreaseRate,
    items,
  });
}

export function migrateLivingExpenseState(
  state: LivingExpenseState & { inflationRate?: number },
): LivingExpenseState {
  const byTarget: LivingExpenseState['byTarget'] = {};
  for (const [targetId, schedules] of Object.entries(state.byTarget ?? {})) {
    byTarget[targetId] = schedules.map((schedule) =>
      migrateLivingExpenseSchedule(schedule),
    );
  }
  // 旧・全体物価上昇率は行の上昇率と二重適用になるため破棄する
  return { byTarget };
}

function createId(): string {
  return crypto.randomUUID();
}

export function createLivingExpenseItem(
  overrides: Partial<LivingExpenseItem> = {},
): LivingExpenseItem {
  return {
    id: createId(),
    label: '生活費',
    cycleInterval: 1,
    cycleUnit: 'month',
    amountMan: 30,
    increaseRate: null,
    sameIncreaseRateAsFirst: false,
    ...overrides,
  };
}

export function createLivingExpenseSchedule(
  memberAge: number | null | undefined,
  referenceMonth: number,
  overrides: Partial<LivingExpenseSchedule> = {},
): LivingExpenseSchedule {
  const defaultStart = resolveDefaultStartAgeMonth(memberAge, referenceMonth);
  return {
    id: createId(),
    startAge: defaultStart.startAge,
    startMonth: defaultStart.startMonth,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
    inputMode: 'detail',
    simpleMonthlyExpenseMan: 30,
    simpleIncreaseRate: null,
    items: [createLivingExpenseItem()],
    ...overrides,
  };
}

/** 詳細入力で項目が2件以上あるとき、先頭「生活費」は下位項目の合計行 */
export function hasLivingDetailSummary(
  schedule: LivingExpenseSchedule,
): boolean {
  return (
    schedule.items.length > 1 && schedule.items[0]?.label.trim() === '生活費'
  );
}

/** CF・合計に使う実項目（合計行の先頭生活費は除く） */
export function getLivingScheduleBillableItems(
  schedule: LivingExpenseSchedule,
): LivingExpenseItem[] {
  if (hasLivingDetailSummary(schedule)) {
    return schedule.items.slice(1);
  }
  return schedule.items;
}

/**
 * 詳細入力かつ項目が複数のとき、先頭「生活費」に下位項目の月額換算合計を反映する。
 * 先頭が生活費でない場合は合計行を先頭に追加する。
 */
export function syncLivingDetailSummary(
  schedule: LivingExpenseSchedule,
): LivingExpenseSchedule {
  if (schedule.items.length <= 1) {
    return schedule;
  }

  let workingItems = schedule.items;
  if (workingItems[0]?.label.trim() !== '生活費') {
    workingItems = [
      createLivingExpenseItem({
        label: '生活費',
        amountMan: 0,
        increaseRate: workingItems[0]?.increaseRate ?? null,
      }),
      ...workingItems,
    ];
  }

  const detailItems = workingItems.slice(1);
  const monthly = calcMonthlyEquivalentMan(detailItems);
  const first = workingItems[0];
  if (
    schedule.items === workingItems &&
    first.label === '生活費' &&
    first.amountMan === monthly &&
    first.cycleInterval === 1 &&
    first.cycleUnit === 'month'
  ) {
    return schedule;
  }

  return {
    ...schedule,
    inputMode: 'detail',
    items: [
      {
        ...first,
        label: '生活費',
        amountMan: monthly,
        cycleInterval: 1,
        cycleUnit: 'month',
        sameIncreaseRateAsFirst: false,
      },
      ...detailItems,
    ],
  };
}

export function createFollowUpLivingSchedule(
  prev: LivingExpenseSchedule,
  memberAge: number | null | undefined,
  referenceMonth: number,
  maxEndAge = 90,
): LivingExpenseSchedule {
  if (prev.endMode !== 'until') {
    return createLivingExpenseSchedule(memberAge, referenceMonth, {
      inputMode: 'detail',
      simpleMonthlyExpenseMan: prev.simpleMonthlyExpenseMan,
      simpleIncreaseRate: prev.simpleIncreaseRate,
    });
  }

  const start = nextPeriodStart({
    endAge: prev.endAge,
    endMonth: prev.endMonth,
  });

  return createLivingExpenseSchedule(memberAge, referenceMonth, {
    startAge: start.startAge,
    startMonth: start.startMonth,
    endMode: 'lifetime',
    endAge: maxEndAge,
    endMonth: 12,
    inputMode: 'detail',
    simpleMonthlyExpenseMan: prev.simpleMonthlyExpenseMan,
    simpleIncreaseRate: prev.simpleIncreaseRate,
    items: prev.items.map((item) => ({
      ...item,
      id: createId(),
    })),
  });
}

export function createDefaultLivingState(
  _head?: FamilyMember,
  _referenceMonth = 1,
): LivingExpenseState {
  // 新規入力はスケジュール未登録（追加ボタンから開始）
  return {
    byTarget: {
      [HOUSEHOLD_LIVING_KEY]: [],
    },
  };
}

export function getLivingAgeOptions(member: FamilyMember): number[] {
  if (member.role === 'child') {
    return Array.from({ length: 126 }, (_, i) => i - 25);
  }
  return Array.from({ length: 101 }, (_, i) => i);
}
