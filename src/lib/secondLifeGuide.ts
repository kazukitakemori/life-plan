import { getMemberAgeMonth } from './birthDate';
import { getHousingTargetData } from './housingDefaults';
import { getLivingScheduleBillableItems } from './livingDefaults';
import { getMemberTabLabel } from './memberDisplay';
import { getCalendarYearAtHeadAge } from './secondLifeEstimates';
import {
  getLivingScheduleMonthlyMan,
  sumConfiguredLivingMonthlyMan,
} from './secondLifeLivingTotal';
import type { FamilyMember } from '../types/family';
import { HOUSEHOLD_HOUSING_KEY, type HousingState } from '../types/housing';
import type { LifeEventEntry, LifeEventState } from '../types/lifeEvent';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseSchedule,
  type LivingExpenseState,
} from '../types/living';
import type { StepId } from '../types/steps';

export type SecondLifeChecklistStatus = 'missing' | 'partial' | 'done';

export interface SecondLifeChecklistItem {
  id: 'housing' | 'living' | 'nursing';
  stepId: StepId;
  stepLabel: string;
  title: string;
  status: SecondLifeChecklistStatus;
  summary: string;
  detailLines: string[];
}

export interface SecondLifeGuide {
  startAge: number;
  items: SecondLifeChecklistItem[];
}

const SECOND_LIFE_NURSING_LABEL = 'セカンドライフ介護';

function isLivingScheduleActiveAtHeadAge(
  schedule: LivingExpenseSchedule,
  head: FamilyMember,
  referenceDate: Date,
  headAge: number,
  calendarMonth = 1,
): boolean {
  const calendarYear = getCalendarYearAtHeadAge(head, referenceDate, headAge);
  const ageMonth = getMemberAgeMonth(
    head,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;

  const endAge =
    schedule.endMode === 'lifetime' ? head.expectedLifespan : schedule.endAge;
  const endMonth = schedule.endMode === 'lifetime' ? 12 : schedule.endMonth;

  if (ageMonth.age < schedule.startAge) return false;
  if (ageMonth.age === schedule.startAge && ageMonth.month < schedule.startMonth) {
    return false;
  }
  if (ageMonth.age > endAge) return false;
  if (ageMonth.age === endAge && ageMonth.month > endMonth) return false;
  return true;
}

function collectHouseholdHousingItems(housingState: HousingState) {
  const data = getHousingTargetData(housingState, HOUSEHOLD_HOUSING_KEY);
  return {
    rentals: data.rentals,
    owned: data.owned,
  };
}

function buildHousingChecklistItem(
  housingState: HousingState,
  startAge: number,
): SecondLifeChecklistItem {
  const { rentals, owned } = collectHouseholdHousingItems(housingState);
  const secondLifeRentals = rentals.filter((rental) => rental.startAge >= startAge);
  const secondLifeOwned = owned.filter((property) => property.startAge >= startAge);
  const hasCurrentOnly =
    (rentals.some((rental) => rental.startAge < startAge) ||
      owned.some((property) => property.startAge < startAge)) &&
    secondLifeRentals.length === 0 &&
    secondLifeOwned.length === 0;

  let status: SecondLifeChecklistStatus = 'missing';
  if (secondLifeRentals.length > 0 || secondLifeOwned.length > 0) {
    status = 'done';
  } else if (hasCurrentOnly || rentals.length > 0 || owned.length > 0) {
    status = 'partial';
  }

  const detailLines: string[] = [];
  for (const rental of secondLifeRentals) {
    detailLines.push(
      `${rental.name || '賃貸'}：${rental.startAge}歳〜 月${rental.monthlyRentMan}万円`,
    );
  }
  for (const property of secondLifeOwned) {
    detailLines.push(`${property.name || '所有'}：${property.startAge}歳〜`);
  }
  if (detailLines.length === 0 && hasCurrentOnly) {
    detailLines.push('現在の住まいのみ入力されています。');
  }

  const monthlyRent = secondLifeRentals.reduce(
    (sum, rental) => sum + rental.monthlyRentMan,
    0,
  );

  return {
    id: 'housing',
    stepId: 'housing',
    stepLabel: 'Q5',
    title: '住まい',
    status,
    summary:
      status === 'done'
        ? `セカンドライフ期の住まい ${secondLifeRentals.length + secondLifeOwned.length}件（家賃合計 月${monthlyRent}万円）`
        : status === 'partial'
          ? '現在の住まいはありますが、セカンドライフ期の住まいが未入力です'
          : 'セカンドライフ期の住まいが未入力です',
    detailLines,
  };
}

function buildLivingChecklistItem(input: {
  livingState: LivingExpenseState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  startAge: number;
}): SecondLifeChecklistItem {
  const head = input.familyMembers.find((member) => member.role === 'head');
  const calendarYear =
    head != null
      ? getCalendarYearAtHeadAge(head, input.referenceDate, input.startAge)
      : input.referenceDate.getFullYear();

  const atSecondLife = head
    ? sumConfiguredLivingMonthlyMan({
        familyMembers: input.familyMembers,
        livingState: input.livingState,
        referenceDate: input.referenceDate,
        calendarYear,
        calendarMonth: 1,
      })
    : 0;

  const householdSchedules =
    input.livingState.byTarget[HOUSEHOLD_LIVING_KEY] ?? [];
  const secondLifeSchedules = householdSchedules.filter(
    (schedule) =>
      schedule.startAge >= input.startAge &&
      head != null &&
      isLivingScheduleActiveAtHeadAge(
        schedule,
        head,
        input.referenceDate,
        input.startAge,
      ),
  );
  const hasPreSecondLifeOnly =
    householdSchedules.some(
      (schedule) =>
        schedule.endMode === 'until'
          ? schedule.endAge < input.startAge
          : schedule.startAge < input.startAge,
    ) && secondLifeSchedules.length === 0;

  let status: SecondLifeChecklistStatus = 'missing';
  if (secondLifeSchedules.length > 0 || atSecondLife > 0) {
    status = 'done';
  } else if (hasPreSecondLifeOnly || householdSchedules.length > 0) {
    status = 'partial';
  }

  const detailLines = secondLifeSchedules.map((schedule) => {
    const monthly = getLivingScheduleMonthlyMan(schedule);
    const labels = getLivingScheduleBillableItems(schedule)
      .map((item) => item.label.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('・');
    return `${schedule.startAge}歳〜 月${monthly}万円${labels ? `（${labels}）` : ''}`;
  });

  return {
    id: 'living',
    stepId: 'living',
    stepLabel: 'Q4',
    title: '生活水準',
    status,
    summary:
      status === 'done'
        ? `セカンドライフ期の生活費 月${atSecondLife}万円（世帯合計）`
        : status === 'partial'
          ? '現在の生活費はありますが、セカンドライフ期のスケジュールが未入力です'
          : 'セカンドライフ期の生活費が未入力です',
    detailLines,
  };
}

function findNursingEntry(
  entries: LifeEventEntry[],
): LifeEventEntry | undefined {
  return entries.find(
    (entry) =>
      entry.label === SECOND_LIFE_NURSING_LABEL || entry.type === 'nursing',
  );
}

function buildNursingChecklistItem(
  lifeEventState: LifeEventState,
  members: FamilyMember[],
  _startAge: number,
): SecondLifeChecklistItem {
  const targets = members.filter(
    (member) => member.role === 'head' || member.role === 'spouse',
  );
  const detailLines: string[] = [];
  let configured = 0;

  for (const member of targets) {
    const entry = findNursingEntry(lifeEventState.byMember[member.id] ?? []);
    if (entry) {
      configured += 1;
      detailLines.push(
        `${getMemberTabLabel(member)}：${entry.startAge}歳〜 年${entry.amountMan}万円`,
      );
    }
  }

  let status: SecondLifeChecklistStatus = 'missing';
  if (targets.length > 0 && configured === targets.length) {
    status = 'done';
  } else if (configured > 0) {
    status = 'partial';
  }

  return {
    id: 'nursing',
    stepId: 'life-event',
    stepLabel: 'Q3',
    title: '介護',
    status,
    summary:
      status === 'done'
        ? `介護費 ${configured}/${targets.length}人 入力済み`
        : status === 'partial'
          ? `介護費 ${configured}/${targets.length}人 のみ入力`
          : '介護費が未入力です',
    detailLines,
  };
}

export function buildSecondLifeGuide(input: {
  startAge: number;
  familyMembers: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  referenceDate: Date;
}): SecondLifeGuide {
  const startAge = input.startAge;
  return {
    startAge,
    items: [
      buildHousingChecklistItem(input.housingState, startAge),
      buildLivingChecklistItem({
        livingState: input.livingState,
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        startAge,
      }),
      buildNursingChecklistItem(
        input.lifeEventState,
        input.familyMembers,
        startAge,
      ),
    ],
  };
}

export function getSecondLifeChecklistStatusLabel(
  status: SecondLifeChecklistStatus,
): string {
  switch (status) {
    case 'done':
      return '入力済み';
    case 'partial':
      return '要確認';
    default:
      return '未入力';
  }
}
