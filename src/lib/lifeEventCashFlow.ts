import {
  calcBirthYear,
  getMemberAgeMonth,
} from './birthDate';
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

function isInAgeMonthRange(
  age: number,
  month: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): boolean {
  const current = ageMonthIndex(age, month);
  const start = ageMonthIndex(startAge, startMonth);
  const end = ageMonthIndex(endAge, endMonth);
  return current >= start && current <= end;
}

function yearsElapsedSince(
  birthYear: number,
  birthMonth: number,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  let fromCalYear = birthYear + fromAge;
  if (fromMonth < birthMonth) {
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
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

function cycleMonthsPerPayment(entry: LifeEventEntry): number {
  if (entry.cycleInterval <= 0) return 0;
  return entry.cycleUnit === 'year'
    ? entry.cycleInterval * 12
    : entry.cycleInterval;
}

function calcCelebrationGiftMonthlyMan(
  entry: LifeEventEntry,
  payerMember: FamilyMember,
  familyMembers: FamilyMember[],
  inflationRate: number,
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

  const payerBirthYear = calcBirthYear(
    payerMember.age,
    payerMember.birthMonth,
    referenceDate,
  );
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

    const yearsElapsed = yearsElapsedSince(
      payerBirthYear,
      payerMember.birthMonth,
      entry.startAge,
      entry.startMonth,
      calendarYear,
      calendarMonth,
    );
    const inflationFactor = Math.pow(1 + inflationRate / 100, yearsElapsed);
    total += beneficiary.amountMan * inflationFactor;
  }

  return total;
}

function calcEntryMonthlyMan(
  entry: LifeEventEntry,
  member: FamilyMember,
  inflationRate: number,
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

  const { endAge, endMonth } = getEntryEnd(entry, member);
  if (
    !isInAgeMonthRange(
      ageMonth.age,
      ageMonth.month,
      entry.startAge,
      entry.startMonth,
      endAge,
      endMonth,
    )
  ) {
    return 0;
  }

  const cycleMonths = cycleMonthsPerPayment(entry);
  if (cycleMonths <= 0) return 0;

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    entry.startAge,
    entry.startMonth,
    calendarYear,
    calendarMonth,
  );
  const inflationFactor = Math.pow(1 + inflationRate / 100, yearsElapsed);
  const monthlyAmount =
    ((entry.amountMan + entry.emergencyAmountMan) / cycleMonths) * inflationFactor;

  return monthlyAmount;
}

export interface LifeEventMonthlyBreakdown {
  lifeEvent: number;
  medicalCare: number;
  detail: LifeEventExpenseDetail;
}

export function calcMemberMonthlyLifeEventBreakdownMan(
  member: FamilyMember,
  entries: LifeEventEntry[],
  state: LifeEventState,
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
          member,
          familyMembers,
          state.inflationRate,
          referenceDate,
          calendarYear,
          calendarMonth,
        )
      : calcEntryMonthlyMan(
          entry,
          member,
          state.inflationRate,
          referenceDate,
          calendarYear,
          calendarMonth,
        );
    if (monthly <= 0) continue;

    const category = getLifeEventExpenseCategory(entry.type);
    if (category === 'medical') {
      result.medicalCare += monthly;
    } else {
      result.lifeEvent += monthly;
      result.detail[category] += monthly;
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
    result.detail.other += breakdown.detail.other;
  }

  return result;
}
