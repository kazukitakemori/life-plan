import type { FamilyMember } from '../types/family';
import type {
  LivingCycleUnit,
  LivingExpenseItem,
  LivingExpenseSchedule,
  LivingExpenseState,
} from '../types/living';
import { HOUSEHOLD_LIVING_KEY } from '../types/living';
import { nextPeriodStart } from './incomePeriod';

type LegacyLivingExpenseItem = LivingExpenseItem & {
  cycleMonths?: number;
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
  schedule: LivingExpenseSchedule,
): LivingExpenseSchedule {
  return {
    ...schedule,
    items: schedule.items.map(migrateLivingExpenseItem),
  };
}

export function migrateLivingExpenseState(
  state: LivingExpenseState,
): LivingExpenseState {
  const byTarget: LivingExpenseState['byTarget'] = {};
  for (const [targetId, schedules] of Object.entries(state.byTarget)) {
    byTarget[targetId] = schedules.map(migrateLivingExpenseSchedule);
  }
  return { ...state, byTarget };
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
    emergencyAmountMan: 30,
    increaseRate: null,
    sameIncreaseRateAsFirst: false,
    ...overrides,
  };
}

export function createLivingExpenseSchedule(
  memberAge: number,
  referenceMonth: number,
  overrides: Partial<LivingExpenseSchedule> = {},
): LivingExpenseSchedule {
  return {
    id: createId(),
    startAge: memberAge,
    startMonth: referenceMonth,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
    items: [createLivingExpenseItem()],
    ...overrides,
  };
}

export function createFollowUpLivingSchedule(
  prev: LivingExpenseSchedule,
  memberAge: number,
  referenceMonth: number,
  maxEndAge = 90,
): LivingExpenseSchedule {
  if (prev.endMode !== 'until') {
    return createLivingExpenseSchedule(memberAge, referenceMonth);
  }

  const start = nextPeriodStart({
    endAge: prev.endAge,
    endMonth: prev.endMonth,
  });

  return createLivingExpenseSchedule(start.startAge, start.startMonth, {
    endMode: 'lifetime',
    endAge: maxEndAge,
    endMonth: 12,
  });
}

export function createDefaultLivingState(
  head?: FamilyMember,
  referenceMonth = 1,
): LivingExpenseState {
  const memberAge = head?.age ?? 40;
  return {
    inflationRate: 2,
    byTarget: {
      [HOUSEHOLD_LIVING_KEY]: [
        createLivingExpenseSchedule(memberAge, referenceMonth),
      ],
    },
  };
}

export function getLivingAgeOptions(member: FamilyMember): number[] {
  if (member.role === 'child') {
    return Array.from({ length: 126 }, (_, i) => i - 25);
  }
  return Array.from({ length: 101 }, (_, i) => i);
}
