import {
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import { isCelebrationGiftLifeEventType, getLifeEventExpenseCategory } from './lifeEventLabels';
import type { FamilyMember } from '../types/family';
import type { LifeEventEntry, LifeEventState } from '../types/lifeEvent';
import {
  createEmptyLifeEventExpenseDetail,
  type LifeEventExpenseDetail,
} from '../types/cashFlow';

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function yearsElapsedSince(
  birthYear: number,
  birthMonth: number | null | undefined,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  let fromCalYear = birthYear + fromAge;
  if (fromMonth < (birthMonth ?? 1)) {
    fromCalYear -= 1;
  }
  const months = (toYear - fromCalYear) * 12 + (toMonth - fromMonth);
  return Math.max(0, Math.floor(months / 12));
}

function getEntryEnd(
  entry: LifeEventEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (entry.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  if (entry.endMode === 'once') {
    return { endAge: entry.startAge, endMonth: entry.startMonth };
  }
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

function cycleMonthsPerPayment(entry: LifeEventEntry): number {
  if (entry.cycleInterval <= 0) return 0;
  return entry.cycleUnit === 'year'
    ? entry.cycleInterval * 12
    : entry.cycleInterval;
}

function resolveInflationFactor(
  increaseRate: number | null | undefined,
  yearsElapsed: number,
): number {
  if (increaseRate == null) return 1;
  return Math.pow(1 + increaseRate / 100, yearsElapsed);
}

function calcCelebrationGiftMonthlyMan(
  entry: LifeEventEntry,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (
    !isCelebrationGiftLifeEventType(entry.type) ||
    !entry.celebrationBeneficiaries?.length
  ) {
    return 0;
  }

  let total = 0;

  for (const beneficiary of entry.celebrationBeneficiaries) {
    const child = familyMembers.find((m) => m.id === beneficiary.memberId);
    if (!child || beneficiary.amountMan <= 0) continue;

    const childAgeMonth = getMemberAgeMonth(
      child,
      referenceDate,
      calendarYear,
      calendarMonth,
    );
    if (!childAgeMonth) continue;

    if (
      childAgeMonth.age !== beneficiary.targetAge ||
      childAgeMonth.month !== child.birthMonth
    ) {
      continue;
    }

    total += beneficiary.amountMan;
  }

  return total;
}

function calcEntryMonthlyMan(
  entry: LifeEventEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  if (entry.endMode === 'once') {
    if (
      ageMonth.age !== entry.startAge ||
      ageMonth.month !== entry.startMonth
    ) {
      return 0;
    }
  } else {
    const { endAge, endMonth } = getEntryEnd(entry, member);
    if (
      !isAgeCalendarMonthInRange(
        ageMonth.age,
        ageMonth.month,
        entry.startAge,
        entry.startMonth,
        endAge,
        endMonth,
        birthYear,
        resolveMemberBirthMonth(member),
      )
    ) {
      return 0;
    }

    const cycleMonths = cycleMonthsPerPayment(entry);
    if (cycleMonths <= 0) return 0;

    const monthsFromStart =
      ageMonthIndex(ageMonth.age, ageMonth.month) -
      ageMonthIndex(entry.startAge, entry.startMonth);
    if (monthsFromStart < 0 || monthsFromStart % cycleMonths !== 0) {
      return 0;
    }
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    entry.startAge,
    entry.startMonth,
    calendarYear,
    calendarMonth,
  );
  const inflationFactor = resolveInflationFactor(
    entry.increaseRate,
    yearsElapsed,
  );
  return entry.amountMan * inflationFactor;
}

export interface LifeEventMonthlyBreakdown {
  lifeEvent: number;
  medicalCare: number;
  detail: LifeEventExpenseDetail;
}

export function calcMemberMonthlyLifeEventBreakdownMan(
  member: FamilyMember,
  entries: LifeEventEntry[],
  _state: LifeEventState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  familyMembers: FamilyMember[] = [],
): LifeEventMonthlyBreakdown {
  const result: LifeEventMonthlyBreakdown = {
    lifeEvent: 0,
    medicalCare: 0,
    detail: createEmptyLifeEventExpenseDetail(),
  };

  for (const entry of entries) {
    const monthly = isCelebrationGiftLifeEventType(entry.type)
      ? calcCelebrationGiftMonthlyMan(
          entry,
          familyMembers,
          referenceDate,
          calendarYear,
          calendarMonth,
        )
      : calcEntryMonthlyMan(
          entry,
          member,
          referenceDate,
          calendarYear,
          calendarMonth,
        );
    if (monthly <= 0) continue;

    const category = getLifeEventExpenseCategory(entry.type);
    result.lifeEvent += monthly;
    result.detail[category] += monthly;
    if (category === 'medical' || category === 'nursing') {
      result.medicalCare += monthly;
    }
  }

  return result;
}

export function calcHouseholdMonthlyLifeEventBreakdownMan(
  familyMembers: FamilyMember[],
  state: LifeEventState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): LifeEventMonthlyBreakdown {
  const result: LifeEventMonthlyBreakdown = {
    lifeEvent: 0,
    medicalCare: 0,
    detail: createEmptyLifeEventExpenseDetail(),
  };

  for (const member of familyMembers) {
    if (member.role === 'pet') continue;
    const entries = state.byMember[member.id] ?? [];
    const breakdown = calcMemberMonthlyLifeEventBreakdownMan(
      member,
      entries,
      state,
      referenceDate,
      calendarYear,
      calendarMonth,
      familyMembers,
    );
    result.lifeEvent += breakdown.lifeEvent;
    result.medicalCare += breakdown.medicalCare;
    result.detail.travel += breakdown.detail.travel;
    result.detail.appliance += breakdown.detail.appliance;
    result.detail.celebration += breakdown.detail.celebration;
    result.detail.medical += breakdown.detail.medical;
    result.detail.nursing += breakdown.detail.nursing;
    result.detail.other += breakdown.detail.other;
  }

  return result;
}
