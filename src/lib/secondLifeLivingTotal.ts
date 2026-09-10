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

/** ご家族タブ＋各メンバータブ（Q4 と同じ対象）。旧 __household__ も互換で残す */
export function collectLivingTargetIds(
  familyMembers: FamilyMember[],
  livingState: LivingExpenseState,
): string[] {
  const ids: string[] = [];
  for (const member of getIncomeEligibleMembers(familyMembers)) {
    ids.push(member.id);
  }
  // 未 migrate のご家族キー（世帯主へ寄せる前）も読む
  if (
    livingState.byTarget[HOUSEHOLD_LIVING_KEY] != null &&
    !ids.includes(HOUSEHOLD_LIVING_KEY)
  ) {
    ids.push(HOUSEHOLD_LIVING_KEY);
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

/** Q12 基準表示用。未開始でも入力済みスケジュールを1件拾う（セカンドライフ開始以降は除外）。 */
function getTargetLivingSchedulesForBaseline(
  schedules: LivingExpenseSchedule[],
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  secondLifeStartAge?: number,
): LivingExpenseSchedule[] {
  const active = getTargetLivingSchedulesAtMonth(
    schedules,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  ).filter((schedule) =>
    isPreSecondLifeLivingSchedule(schedule, secondLifeStartAge),
  );
  if (active.length > 0) {
    return active;
  }

  const entered = schedules.find(
    (schedule) =>
      isPreSecondLifeLivingSchedule(schedule, secondLifeStartAge) &&
      getLivingScheduleMonthlyMan(schedule) > 0,
  );
  return entered ? [entered] : [];
}

/**
 * セカンドライフ開始以降に始まるスケジュールは「現在」基準に含めない。
 * （反映後のご家族タブへ書いた開始年齢〜の行が基準を膨らませないようにする）
 */
export function isPreSecondLifeLivingSchedule(
  schedule: LivingExpenseSchedule,
  secondLifeStartAge?: number,
): boolean {
  if (secondLifeStartAge == null || !Number.isFinite(secondLifeStartAge)) {
    return true;
  }
  if (schedule.startAge < secondLifeStartAge) return true;
  if (schedule.startAge > secondLifeStartAge) return false;
  // startAge === secondLifeStartAge: 1月開始は SL 反映行として除外
  return schedule.startMonth > 1;
}

/**
 * Q12 の「現在」基準用。試算月に未開始でも、入力済みスケジュールを拾う。
 * secondLifeStartAge 以降に始まる行（反映後の合算スケジュール等）は除外する。
 */
export function sumEnteredLivingMonthlyMan(input: {
  familyMembers: FamilyMember[];
  livingState: LivingExpenseState;
  secondLifeStartAge?: number;
}): number {
  let total = 0;

  for (const targetId of collectLivingTargetIds(
    input.familyMembers,
    input.livingState,
  )) {
    const schedules = input.livingState.byTarget[targetId] ?? [];
    const schedule = schedules.find(
      (entry) =>
        isPreSecondLifeLivingSchedule(entry, input.secondLifeStartAge) &&
        getLivingScheduleMonthlyMan(entry) > 0,
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
  secondLifeStartAge?: number;
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
      input.secondLifeStartAge,
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
