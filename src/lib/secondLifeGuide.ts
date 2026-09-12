import { getMemberAgeMonth } from './birthDate';
import { getHousingTargetData } from './housingDefaults';
import { getLivingScheduleBillableItems } from './livingDefaults';
import {
  getSecondLifeManagedLifeEventSource,
  THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL,
  THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL,
} from './lifeEventSource';
import { getMemberTabLabel } from './memberDisplay';
import {
  getCalendarYearAtHeadAge,
} from './secondLifeEstimates';
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
import type {
  SecondLifeNursingTarget,
  SecondLifeState,
} from '../types/secondLife';
import type { StepId } from '../types/steps';
import {
  formatThirdLifeCareDuration,
  getThirdLifeAnnualAdditionalCostMan,
  getThirdLifeCareEndAge,
  getThirdLifeCareStartAge,
  THIRD_LIFE_CARE_SCENARIO_LABELS,
} from './thirdLifeCare';

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

function collectHouseholdHousingItems(
  housingState: HousingState,
  headId?: string,
) {
  const primaryId = headId ?? HOUSEHOLD_HOUSING_KEY;
  const primary = getHousingTargetData(housingState, primaryId);
  const household = getHousingTargetData(housingState, HOUSEHOLD_HOUSING_KEY);
  const rentals = [...primary.rentals];
  const owned = [...primary.owned];
  for (const rental of household.rentals) {
    if (!rentals.some((item) => item.id === rental.id)) rentals.push(rental);
  }
  for (const property of household.owned) {
    if (!owned.some((item) => item.id === property.id)) owned.push(property);
  }
  for (const [targetId, data] of Object.entries(housingState.byTarget)) {
    if (targetId === primaryId || targetId === HOUSEHOLD_HOUSING_KEY) continue;
    for (const rental of data.rentals) {
      if (!rentals.some((item) => item.id === rental.id)) rentals.push(rental);
    }
    for (const property of data.owned) {
      if (!owned.some((item) => item.id === property.id)) owned.push(property);
    }
  }
  return { rentals, owned };
}

function buildHousingChecklistItem(
  housingState: HousingState,
  startAge: number,
  headId?: string,
): SecondLifeChecklistItem {
  const { rentals, owned } = collectHouseholdHousingItems(housingState, headId);
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
    stepLabel: '5',
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

  const payerSchedules =
    (head ? input.livingState.byTarget[head.id] : undefined) ??
    input.livingState.byTarget[HOUSEHOLD_LIVING_KEY] ??
    [];
  const secondLifeSchedules = payerSchedules.filter(
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
    payerSchedules.some((schedule) =>
      schedule.endMode === 'until'
        ? schedule.endAge < input.startAge
        : schedule.startAge < input.startAge,
    ) && secondLifeSchedules.length === 0;

  let status: SecondLifeChecklistStatus = 'missing';
  if (secondLifeSchedules.length > 0 || atSecondLife > 0) {
    status = 'done';
  } else if (hasPreSecondLifeOnly || payerSchedules.length > 0) {
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
    stepLabel: '4',
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

function findNursingProjections(entries: LifeEventEntry[]) {
  const managed = entries.filter(
    (entry) =>
      getSecondLifeManagedLifeEventSource(entry) === 'second_life_nursing',
  );
  return {
    all: managed,
    recurring: managed.find(
      (entry) =>
        entry.label === THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL ||
        entry.endMode !== 'once',
    ),
    initial: managed.find(
      (entry) =>
        entry.label === THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL ||
        entry.endMode === 'once',
    ),
  };
}

function buildNursingChecklistItem(
  lifeEventState: LifeEventState,
  members: FamilyMember[],
  secondLifeState?: SecondLifeState,
): SecondLifeChecklistItem {
  const targets = ([
    ['head', 'head'],
    ['spouse', 'spouse'],
  ] as const)
    .map(([key, role]) => ({
      key,
      member: members.find((member) => member.role === role),
    }))
    .filter(
      (
        item,
      ): item is {
        key: SecondLifeNursingTarget;
        member: FamilyMember;
      } => Boolean(item.member),
    );

  const detailLines: string[] = [];

  if (!secondLifeState) {
    let configured = 0;
    for (const { member } of targets) {
      const projection = findNursingProjections(
        lifeEventState.byMember[member.id] ?? [],
      );
      if (projection.all.length === 0) continue;
      configured += 1;
      detailLines.push(`${getMemberTabLabel(member)}：介護費の連動データあり`);
    }
    return {
      id: 'nursing',
      stepId: 'life-event',
      stepLabel: '3',
      title: '介護・サードライフ',
      status:
        configured === targets.length && targets.length > 0
          ? 'done'
          : configured > 0
            ? 'partial'
            : 'missing',
      summary:
        configured > 0
          ? `介護費 ${configured}/${targets.length}人 反映済み`
          : '介護費が未反映です',
      detailLines,
    };
  }

  let activeDesigns = 0;
  let applied = 0;
  let needsRefresh = 0;
  let needsCost = 0;

  for (const { key, member } of targets) {
    const design = secondLifeState.nursingByTarget[key];
    const projections = findNursingProjections(
      lifeEventState.byMember[member.id] ?? [],
    );

    if (design.skip) {
      if (projections.all.length > 0) {
        needsRefresh += 1;
        detailLines.push(
          `${getMemberTabLabel(member)}：介護費を見込まない / 既存の連動データ削除の反映が必要`,
        );
      } else {
        detailLines.push(`${getMemberTabLabel(member)}：介護費を見込まない`);
      }
      continue;
    }

    activeDesigns += 1;
    const annualCost = getThirdLifeAnnualAdditionalCostMan(design);
    const initialCost = Math.max(0, design.initialCostMan);
    if (annualCost <= 0 && initialCost <= 0) {
      needsCost += 1;
      detailLines.push(
        `${getMemberTabLabel(member)}：${design.startAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]} / 費用未入力`,
      );
      continue;
    }

    const expectedStartAge = getThirdLifeCareStartAge(
      design,
      member.expectedLifespan,
    );
    const expectedEndAge = getThirdLifeCareEndAge(
      design,
      member.expectedLifespan,
    );
    const recurringApplied =
      annualCost <= 0
        ? projections.recurring == null
        : projections.recurring != null &&
          projections.recurring.startAge === expectedStartAge &&
          projections.recurring.amountMan === annualCost &&
          projections.recurring.endMode ===
            (design.durationMode === 'years' ? 'until' : 'lifetime') &&
          (design.durationMode === 'lifetime' ||
            projections.recurring.endAge === expectedEndAge);
    const initialApplied =
      initialCost <= 0
        ? projections.initial == null
        : projections.initial != null &&
          projections.initial.startAge === expectedStartAge &&
          projections.initial.amountMan === initialCost &&
          projections.initial.endMode === 'once';
    const isApplied = recurringApplied && initialApplied;

    if (isApplied) {
      applied += 1;
    } else if (projections.all.length > 0) {
      needsRefresh += 1;
    }

    detailLines.push(
      `${getMemberTabLabel(member)}：${expectedStartAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]}・月${design.monthlyCostMan}万円＋開始時${initialCost}万円（${formatThirdLifeCareDuration(design)}） / ${
        isApplied ? '反映済み' : projections.all.length > 0 ? '再反映が必要' : '未反映'
      }`,
    );
  }

  const allSkipped = activeDesigns === 0;
  const allApplied =
    activeDesigns > 0 &&
    applied === activeDesigns &&
    needsRefresh === 0 &&
    needsCost === 0;
  const status: SecondLifeChecklistStatus =
    (allSkipped && needsRefresh === 0) || allApplied ? 'done' : 'partial';

  return {
    id: 'nursing',
    stepId: 'life-event',
    stepLabel: '3',
    title: '介護・サードライフ',
    status,
    summary: allSkipped
      ? needsRefresh > 0
        ? '介護費を見込まない設定へ変更したため、既存の連動データ削除の反映が必要です'
        : '介護費は見込まない設定です'
      : needsCost > 0
        ? '介護の想定はありますが、追加費用が未入力です'
        : allApplied
          ? `サードライフ設計 ${applied}/${activeDesigns}人 反映済み`
          : needsRefresh > 0
            ? 'サードライフ設計を変更したため、最新内容の再反映が必要です'
            : 'サードライフ設計はありますが、まだ反映されていません',
    detailLines,
  };
}

export function buildSecondLifeGuide(input: {
  startAge: number;
  secondLifeState?: SecondLifeState;
  familyMembers: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  referenceDate: Date;
}): SecondLifeGuide {
  const startAge = input.startAge;
  const headId = input.familyMembers.find((m) => m.role === 'head')?.id;
  const design = input.secondLifeState;

  const housingItem: SecondLifeChecklistItem = design
    ? {
        id: 'housing',
        stepId: 'housing',
        stepLabel: '5',
        title: '住まい',
        status: 'done',
        summary: design.housingSkip
          ? '今の住まい計画をそのまま使います'
          : design.housingScenario === 'stay' && design.stayOption === 'continue'
            ? '今の住まいをそのまま継続します'
            : `${design.housingActionAge}歳から、見直した住まい方で計算します`,
        detailLines: design.housingSkip
          ? ['現在入力している住まいの期間・費用をそのまま使います。']
          : ['元の住まい入力は残したまま試算します。'],
      }
    : buildHousingChecklistItem(input.housingState, startAge, headId);

  const livingItem: SecondLifeChecklistItem = design
    ? {
        id: 'living',
        stepId: 'living',
        stepLabel: '4',
        title: '生活水準',
        status: 'done',
        summary: design.livingSkip
          ? '今の生活費計画をそのまま使います'
          : `${design.startAge}歳から、選んだ生活費で計算します`,
        detailLines: design.livingSkip
          ? ['現在入力している生活費計画をそのまま使います。']
          : ['元の生活費入力は残したまま試算します。'],
      }
    : buildLivingChecklistItem({
        livingState: input.livingState,
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        startAge,
      });

  return {
    startAge,
    items: [
      housingItem,
      livingItem,
      buildNursingChecklistItem(
        input.lifeEventState,
        input.familyMembers,
        design,
      ),
    ],
  };
}

export function getSecondLifeChecklistStatusLabel(
  status: SecondLifeChecklistStatus,
): string {
  switch (status) {
    case 'done':
      return '設定済み';
    case 'partial':
      return '要確認';
    default:
      return '未入力';
  }
}
