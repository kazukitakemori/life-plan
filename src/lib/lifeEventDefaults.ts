import type { FamilyMember } from '../types/family';
import type {
  LifeEventByMember,
  LifeEventCelebrationBeneficiary,
  LifeEventEntry,
  LifeEventPresetId,
  LifeEventState,
  LifeEventType,
} from '../types/lifeEvent';
import { getIncomeEligibleMembers } from './memberDisplay';

const DEFAULT_CELEBRATION_TARGET_AGE = 30;

export function isCelebrationGiftBeneficiary(member: FamilyMember): boolean {
  return (
    member.role === 'child' ||
    (member.role === 'other' && member.otherRelationship === 'grandchild')
  );
}

function getCelebrationGiftBeneficiaryMembers(
  members: FamilyMember[],
): FamilyMember[] {
  return members.filter(isCelebrationGiftBeneficiary);
}

export function syncCelebrationBeneficiaries(
  members: FamilyMember[],
  existing: LifeEventCelebrationBeneficiary[] = [],
): LifeEventCelebrationBeneficiary[] {
  const byId = new Map(existing.map((b) => [b.memberId, b]));
  return getCelebrationGiftBeneficiaryMembers(members).map((member) => ({
    memberId: member.id,
    targetAge: byId.get(member.id)?.targetAge ?? DEFAULT_CELEBRATION_TARGET_AGE,
    amountMan: byId.get(member.id)?.amountMan ?? 0,
  }));
}

function createId(): string {
  return crypto.randomUUID();
}

const PRESET_DEFAULTS: Record<
  LifeEventPresetId,
  Pick<LifeEventEntry, 'label' | 'type' | 'cycleInterval' | 'cycleUnit' | 'amountMan' | 'emergencyAmountMan'>
> = {
  travel: {
    label: '旅行',
    type: 'travel',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 30,
    emergencyAmountMan: 0,
  },
  appliance: {
    label: '家電・家具',
    type: 'appliance',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 20,
    emergencyAmountMan: 0,
  },
  medical: {
    label: '医療費',
    type: 'medical',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 10,
    emergencyAmountMan: 0,
  },
  nursing: {
    label: '介護費',
    type: 'nursing',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 50,
    emergencyAmountMan: 0,
  },
  hometown_tax: {
    label: 'ふるさと納税',
    type: 'hometown_tax',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 5,
    emergencyAmountMan: 0,
  },
  celebration_gift: {
    label: '子・孫の祝い金',
    type: 'celebration_gift',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 0,
    emergencyAmountMan: 0,
  },
  other: {
    label: 'その他',
    type: 'other',
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 0,
    emergencyAmountMan: 0,
  },
};

export const LIFE_EVENT_PRESETS: ReadonlyArray<{
  id: LifeEventPresetId;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: 'travel',
    icon: '✈️',
    title: '旅行・レジャー',
    description: '旅行や趣味などの支出',
  },
  {
    id: 'appliance',
    icon: '🎁',
    title: '家電・家具',
    description: '買い替えや大型購入',
  },
  {
    id: 'medical',
    icon: '💓',
    title: '医療費',
    description: '通院や治療費など',
  },
  {
    id: 'nursing',
    icon: '🤲',
    title: '介護費',
    description: '在宅・施設介護など',
  },
  {
    id: 'hometown_tax',
    icon: '🏛️',
    title: 'ふるさと納税',
    description: '寄付金控除の見込み',
  },
  {
    id: 'celebration_gift',
    icon: '🎉',
    title: '子・孫の祝い金',
    description: '結婚や出産の援助金',
  },
  {
    id: 'other',
    icon: '✨',
    title: 'その他',
    description: '結婚や夢など自由入力',
  },
];

export function getCelebrationGiftAgeOptions(): number[] {
  return Array.from({ length: 43 }, (_, i) => i + 18);
}

export function getLifeEventAgeOptions(member: FamilyMember): number[] {
  if (member.role === 'child') {
    return Array.from({ length: 126 }, (_, i) => i - 25);
  }
  return Array.from({ length: 101 }, (_, i) => i);
}

export function createLifeEventEntry(
  member: FamilyMember,
  referenceMonth: number,
  overrides: Partial<LifeEventEntry> = {},
): LifeEventEntry {
  return {
    id: createId(),
    label: 'イベント',
    type: 'event',
    startAge: member.age,
    startMonth: referenceMonth,
    endMode: 'lifetime',
    endAge: member.expectedLifespan,
    endMonth: 12,
    cycleInterval: 1,
    cycleUnit: 'year',
    amountMan: 0,
    emergencyAmountMan: 0,
    ...overrides,
  };
}

export function createLifeEventEntryFromPreset(
  presetId: LifeEventPresetId,
  member: FamilyMember,
  referenceMonth: number,
  familyMembers: FamilyMember[] = [],
): LifeEventEntry {
  if (presetId === 'celebration_gift') {
    return createCelebrationGiftEntry(member, referenceMonth, familyMembers);
  }
  const preset = PRESET_DEFAULTS[presetId];
  return createLifeEventEntry(member, referenceMonth, preset);
}

export function createCelebrationGiftEntry(
  payerMember: FamilyMember,
  referenceMonth: number,
  familyMembers: FamilyMember[],
): LifeEventEntry {
  return createLifeEventEntry(payerMember, referenceMonth, {
    label: '子・孫の祝い金',
    type: 'celebration_gift',
    amountMan: 0,
    emergencyAmountMan: 0,
    celebrationBeneficiaries: syncCelebrationBeneficiaries(familyMembers),
  });
}

export function canAddCelebrationGift(member: FamilyMember): boolean {
  return member.role === 'head' || member.role === 'spouse';
}

export function createDefaultLifeEventState(): LifeEventState {
  return {
    inflationRate: 2,
    byMember: {},
  };
}

export function syncLifeEventsWithFamily(
  members: FamilyMember[],
  state: LifeEventState,
): LifeEventState {
  const eligibleIds = new Set(getIncomeEligibleMembers(members).map((m) => m.id));
  const byMember: LifeEventByMember = {};

  for (const [memberId, entries] of Object.entries(state.byMember)) {
    if (eligibleIds.has(memberId)) {
      byMember[memberId] = entries.map((entry) =>
        entry.type === 'celebration_gift'
          ? {
              ...entry,
              celebrationBeneficiaries: syncCelebrationBeneficiaries(
                members,
                entry.celebrationBeneficiaries,
              ),
            }
          : entry,
      );
    }
  }

  return { ...state, byMember };
}

export function getLifeEventTypeFromPreset(presetId: LifeEventPresetId): LifeEventType {
  return PRESET_DEFAULTS[presetId].type;
}
