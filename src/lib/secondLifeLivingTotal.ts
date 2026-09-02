import {
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import { calcMonthlyLivingItemsMan, type CashFlowInput } from './cashFlow';
import { resolveMemberBirthMonth } from './familyDefaults';
import { getIncomeEligibleMembers } from './memberDisplay';
import { calcMonthlyEquivalentMan } from './livingAmount';
import { getLivingScheduleBillableItems } from './livingDefaults';
import type { FamilyMember } from '../types/family';
import type { LivingExpenseItem } from '../types/living';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseSchedule,
  type LivingExpenseState,
} from '../types/living';
import type { SecondLifeLivingBreakdownItem } from '../types/secondLife';

function createLivingCalcInput(
  familyMembers: FamilyMember[],
  livingState: LivingExpenseState,
  referenceDate: Date,
): CashFlowInput {
  return {
    familyMembers,
    livingState,
    referenceDate,
  } as CashFlowInput;
}

/** ご家族タブ＋各メンバータブ（Q4 と同じ対象） */
export function collectLivingTargetIds(
  familyMembers: FamilyMember[],
  livingState: LivingExpenseState,
): string[] {
  const ids: string[] = [HOUSEHOLD_LIVING_KEY];
  for (const member of getIncomeEligibleMembers(familyMembers)) {
    if (!ids.includes(member.id)) {
      ids.push(member.id);
    }
  }
  for (const targetId of Object.keys(livingState.byTarget)) {
    if (!ids.includes(targetId)) {
      ids.push(targetId);
    }
  }
  return ids;
}

export function resolveLivingTargetMember(
  targetId: string,
  familyMembers: FamilyMember[],
): FamilyMember | null {
  if (targetId === HOUSEHOLD_LIVING_KEY) {
    return familyMembers.find((member) => member.role === 'head') ?? null;
  }
  return familyMembers.find((member) => member.id === targetId) ?? null;
}

/** 詳細入力の内訳行を含む、スケジュール1件の月額（万円） */
export function getLivingScheduleMonthlyMan(
  schedule: LivingExpenseSchedule,
): number {
  if (schedule.inputMode === 'simple') {
    return schedule.simpleMonthlyExpenseMan;
  }
  return calcMonthlyEquivalentMan(getLivingScheduleBillableItems(schedule));
}

function livingItemMonthlyMan(item: LivingExpenseItem): number {
  if (item.cycleInterval <= 0) return 0;
  const months =
    item.cycleUnit === 'year' ? item.cycleInterval * 12 : item.cycleInterval;
  if (months <= 0) return 0;
  return item.amountMan / months;
}

function roundLivingMan(value: number): number {
  return Math.round(value * 10) / 10;
}

function getTargetLivingSchedulesAtMonth(
  schedules: LivingExpenseSchedule[],
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): LivingExpenseSchedule[] {
  return schedules.filter((schedule) =>
    isLivingScheduleActiveInMonth(
      schedule,
      member,
      referenceDate,
      calendarYear,
      calendarMonth,
    ),
  );
}

/** Q12 基準表示用。未開始でも入力済みスケジュールを1件拾う。 */
function getTargetLivingSchedulesForBaseline(
  schedules: LivingExpenseSchedule[],
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): LivingExpenseSchedule[] {
  const active = getTargetLivingSchedulesAtMonth(
    schedules,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (active.length > 0) {
    return active;
  }

  const entered = schedules.find(
    (schedule) => getLivingScheduleMonthlyMan(schedule) > 0,
  );
  return entered ? [entered] : [];
}

/**
 * Q12 の「現在」基準用。試算月に未開始でも、入力済みスケジュールを拾う。
 */
export function sumEnteredLivingMonthlyMan(input: {
  familyMembers: FamilyMember[];
  livingState: LivingExpenseState;
}): number {
  let total = 0;

  for (const targetId of collectLivingTargetIds(
    input.familyMembers,
    input.livingState,
  )) {
    const schedules = input.livingState.byTarget[targetId] ?? [];
    const schedule = schedules.find(
      (entry) => getLivingScheduleMonthlyMan(entry) > 0,
    );
    if (schedule) {
      total += getLivingScheduleMonthlyMan(schedule);
    }
  }

  return total;
}

function isLivingScheduleActiveInMonth(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;

  const endAge =
    schedule.endMode === 'lifetime' ? member.expectedLifespan : schedule.endAge;
  const endMonth = schedule.endMode === 'lifetime' ? 12 : schedule.endMonth;

  return isAgeCalendarMonthInRange(
    ageMonth.age,
    ageMonth.month,
    schedule.startAge,
    schedule.startMonth,
    endAge,
    endMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

/**
 * 1タブ分の生活費月額（試算月に有効なスケジュールのみ合算）。
 */
function getTargetLivingMonthlyManAtMonth(
  schedules: LivingExpenseSchedule[],
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  return getTargetLivingSchedulesAtMonth(
    schedules,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  ).reduce((sum, schedule) => sum + getLivingScheduleMonthlyMan(schedule), 0);
}

/**
 * Q4 の全タブ（ご家族＋世帯主・配偶者など）の生活費を合算。
 * 詳細入力の内訳行も含む。
 */
export function sumConfiguredLivingMonthlyMan(input: {
  familyMembers: FamilyMember[];
  livingState: LivingExpenseState;
  referenceDate: Date;
  calendarYear: number;
  calendarMonth: number;
}): number {
  let total = 0;
  for (const targetId of collectLivingTargetIds(
    input.familyMembers,
    input.livingState,
  )) {
    const schedules = input.livingState.byTarget[targetId] ?? [];
    if (schedules.length === 0) continue;

    const member = resolveLivingTargetMember(targetId, input.familyMembers);
    if (!member) continue;

    total += getTargetLivingMonthlyManAtMonth(
      schedules,
      member,
      input.referenceDate,
      input.calendarYear,
      input.calendarMonth,
    );
  }
  return total;
}

function sumCashFlowLivingMonthlyMan(
  familyMembers: FamilyMember[],
  livingState: LivingExpenseState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const items = calcMonthlyLivingItemsMan(
    createLivingCalcInput(familyMembers, livingState, referenceDate),
    calendarYear,
    calendarMonth,
  );
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * 世帯全体の生活費月額（万円）。
 * CF 試算と Q4 入力の両方を見て、大きい方を採用する。
 */
export function sumHouseholdLivingMonthlyMan(input: {
  familyMembers: FamilyMember[];
  livingState: LivingExpenseState;
  referenceDate: Date;
  calendarYear: number;
  calendarMonth: number;
}): number {
  const cashFlowTotal = sumCashFlowLivingMonthlyMan(
    input.familyMembers,
    input.livingState,
    input.referenceDate,
    input.calendarYear,
    input.calendarMonth,
  );
  const configuredTotal = sumConfiguredLivingMonthlyMan(input);
  return Math.max(cashFlowTotal, configuredTotal);
}

/** Q4 生活費の項目別内訳（ご家族＋各メンバータブを合算） */
export function buildQ4LivingBreakdown(input: {
  familyMembers: FamilyMember[];
  livingState: LivingExpenseState;
  referenceDate: Date;
  calendarYear: number;
  calendarMonth: number;
}): SecondLifeLivingBreakdownItem[] {
  const byLabel = new Map<string, number>();

  for (const targetId of collectLivingTargetIds(
    input.familyMembers,
    input.livingState,
  )) {
    const schedules = input.livingState.byTarget[targetId] ?? [];
    if (schedules.length === 0) continue;

    const member = resolveLivingTargetMember(targetId, input.familyMembers);
    if (!member) continue;

    for (const schedule of getTargetLivingSchedulesForBaseline(
      schedules,
      member,
      input.referenceDate,
      input.calendarYear,
      input.calendarMonth,
    )) {
      for (const item of getLivingScheduleBillableItems(schedule)) {
        const label = item.label.trim() || '（無題）';
        const monthly = livingItemMonthlyMan(item);
        if (monthly === 0) continue;
        byLabel.set(label, (byLabel.get(label) ?? 0) + monthly);
      }
    }
  }

  return [...byLabel.entries()]
    .map(([label, amountMan]) => ({
      label,
      amountMan: roundLivingMan(amountMan),
    }))
    .filter((item) => item.amountMan > 0)
    .sort((a, b) => b.amountMan - a.amountMan);
}

export function scaleLivingBreakdown(
  breakdown: SecondLifeLivingBreakdownItem[],
  factor: number,
): SecondLifeLivingBreakdownItem[] {
  return breakdown.map((item) => ({
    label: item.label,
    amountMan: roundLivingMan(item.amountMan * factor),
  }));
}
