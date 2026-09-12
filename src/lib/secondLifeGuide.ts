import { getMemberAgeMonth } from './birthDate';
import { getHousingTargetData } from './housingDefaults';
import { getLivingScheduleBillableItems } from './livingDefaults';
import {
  getSecondLifeManagedLifeEventSource,
} from './lifeEventSource';
import { getMemberTabLabel } from './memberDisplay';
import {
  getCalendarYearAtHeadAge,
  getDefaultNursingAnnualCostMan,
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
  SecondLifeNursingScenario,
  SecondLifeNursingTarget,
  SecondLifeState,
} from '../types/secondLife';
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

const NURSING_SCENARIO_LABELS: Record<SecondLifeNursingScenario, string> = {
  home: '在宅介護',
  day_service: '在宅＋デイサービス',
  facility: '施設介護',
};

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

function findNursingProjection(
  entries: LifeEventEntry[],
): LifeEventEntry | undefined {
  return entries.find(
    (entry) =>
      getSecondLifeManagedLifeEventSource(entry) === 'second_life_nursing',
  );
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
      const entry = findNursingProjection(lifeEventState.byMember[member.id] ?? []);
      if (!entry) continue;
      configured += 1;
      detailLines.push(
        `${getMemberTabLabel(member)}：${entry.startAge}歳〜 年${entry.amountMan}万円`,
      );
    }
    return {
      id: 'nursing',
      stepId: 'life-event',
      stepLabel: '3',
      title: '介護',
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

  for (const { key, member } of targets) {
    const design = secondLifeState.nursingByTarget[key];
    const projection = findNursingProjection(
      lifeEventState.byMember[member.id] ?? [],
    );
    if (design.skip) {
      if (projection) {
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
    const annualCost =
      design.annualCostMan > 0
        ? design.annualCostMan
        : getDefaultNursingAnnualCostMan(design.scenario);
    const isApplied =
      projection != null &&
      projection.startAge === design.startAge &&
      projection.amountMan === annualCost;

    if (isApplied) {
      applied += 1;
    } else if (projection) {
      needsRefresh += 1;
    }

    detailLines.push(
      `${getMemberTabLabel(member)}：${design.startAge}歳〜 年${annualCost}万円（${NURSING_SCENARIO_LABELS[design.scenario]}） / ${
        isApplied ? '反映済み' : projection ? '再反映が必要' : '未反映'
      }`,
    );
  }

  const allSkipped = activeDesigns === 0;
  const allApplied =
    activeDesigns > 0 && applied === activeDesigns && needsRefresh === 0;
  const status: SecondLifeChecklistStatus =
    (allSkipped && needsRefresh === 0) || allApplied ? 'done' : 'partial';

  return {
    id: 'nursing',
    stepId: 'life-event',
    stepLabel: '3',
    title: '介護',
    status,
    summary: allSkipped
      ? needsRefresh > 0
        ? '介護費を見込まない設定へ変更したため、既存の連動データ削除の反映が必要です'
        : '介護費は見込まない設定です'
      : allApplied
        ? `介護設計 ${applied}/${activeDesigns}人 反映済み`
        : needsRefresh > 0
          ? '介護設計を変更したため、最新内容の再反映が必要です'
          : '介護設計はありますが、まだ反映されていません',
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
          ? 'Q5「住まい」の現在入力をそのまま計算に使用します'
          : design.housingScenario === 'stay' && design.stayOption === 'continue'
            ? 'Q5の現在の住まいをそのまま継続します'
            : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,
        detailLines: design.housingSkip
          ? ['Q12による住まいの上書きは無効です。']
          : ['Q5の住まい入力自体は変更しません。'],
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
          ? 'Q4「生活費」の現在入力をそのまま計算に使用します'
          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,
        detailLines: design.livingSkip
          ? ['Q12による生活費の上書きは無効です。']
          : ['Q4の生活費入力自体は変更しません。'],
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
