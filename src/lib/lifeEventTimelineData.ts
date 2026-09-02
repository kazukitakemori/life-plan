import { resolveMemberAge } from './familyDefaults';
import { calcBirthYear } from './birthDate';
import { calcPeriodAnnualAmountFromMonthly } from './incomeAmount';
import { isTaxFreeIncome } from './incomeBreakdown';
import { createDefaultPensionMemberState } from './pensionDefaults';
import {
  calcMemberMonthlyPensionBreakdownMan,
  calcMonthlyPensionEntitlementBreakdownMan,
} from './pensionIncome';
import {
  sumPensionBreakdown,
  type CashFlowTableData,
  type MemberAgeRow,
} from '../types/cashFlow';
import type { EducationByMember } from '../types/education';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry, IncomePeriod } from '../types/income';
import type { LifeEventState } from '../types/lifeEvent';
import { HOUSEHOLD_LIVING_KEY, type LivingExpenseState } from '../types/living';
import type { PensionByMember } from '../types/pension';

export type TimelineItemStyle = 'income' | 'living' | 'pension' | 'housing' | 'education' | 'event';

/** 支出が発生する年（マーカー描画用） */
export interface TimelineOccurrence {
  headAge: number;
  calendarYear: number;
  amountMan: number;
}

export interface LifeEventTimelineItem {
  id: string;
  style: TimelineItemStyle;
  icon: string;
  title: string;
  detail?: string;
  startHeadAge: number;
  endHeadAge: number;
  lane: number;
  /** グラフの年次ポイントと横位置を揃えるための暦年（単発イベント） */
  calendarYear?: number;
  /** 期間イベントの開始・終了暦年（グラフ位置合わせ用） */
  startCalendarYear?: number;
  endCalendarYear?: number;
  /**
   * 実支出年。設定がある場合は期間バーではなく
   * 「支出がある年」のマーカー列として描画する。
   */
  occurrences?: TimelineOccurrence[];
}

export interface LifeEventTimelineCategory {
  id: string;
  label: string;
  tone: 'life' | 'housing' | 'education' | 'event';
  items: LifeEventTimelineItem[];
}

export interface LifeEventTimelineData {
  categories: LifeEventTimelineCategory[];
}

export interface BuildLifeEventTimelineInput {
  cashFlowData: CashFlowTableData;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  referenceDate: Date;
}

function memberAgeToHeadAge(
  member: FamilyMember,
  memberAge: number,
  head: FamilyMember,
  referenceDate: Date,
): number {
  const memberBirthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const headBirthYear = calcBirthYear(head.age, head.birthMonth, referenceDate);
  return Math.max(0, memberBirthYear + memberAge - headBirthYear);
}

function formatMan(value: number, monthly = false): string {
  const rounded = Math.round(value * 10) / 10;
  return monthly ? `月${rounded}万円` : `${rounded.toLocaleString('ja-JP')}万円`;
}

function formatTotalMan(value: number): string {
  return `総額 ${Math.round(value).toLocaleString('ja-JP')}万円`;
}

function getHeadMember(members: FamilyMember[]): FamilyMember | undefined {
  return members.find((member) => member.role === 'head');
}

function getHeadRow(data: CashFlowTableData): MemberAgeRow | undefined {
  return data.memberAgeRows.find((row) => row.label.includes('世帯主'));
}

function getIncomeRoleLabel(role: FamilyMember['role']): string {
  if (role === 'head') return '世帯主年収';
  if (role === 'spouse') return '配偶者年収';
  return '年収';
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isPeriodActiveAtAgeMonth(
  period: IncomePeriod,
  age: number,
  month: number,
): boolean {
  const current = ageMonthIndex(age, month);
  const start = ageMonthIndex(period.startAge, period.startMonth);
  const end = ageMonthIndex(period.endAge, period.endMonth);
  return current >= start && current <= end;
}

function periodDurationMonths(period: IncomePeriod): number {
  return Math.max(
    1,
    ageMonthIndex(period.endAge, period.endMonth) -
      ageMonthIndex(period.startAge, period.startMonth) +
      1,
  );
}

/** タイムライン表示用の額面年収（経費控除前・試算の年途中開始の影響を受けない） */
function calcFaceAnnualIncomeMan(
  entries: IncomeEntry[],
  member: FamilyMember,
  referenceDate: Date,
): number {
  const currentMonth = referenceDate.getMonth() + 1;
  let currentSum = 0;
  let weightedSum = 0;
  let weightedMonths = 0;

  for (const entry of entries) {
    for (const period of entry.periods) {
      if (isTaxFreeIncome(entry.category, period.streamType)) continue;
      const faceAnnual = calcPeriodAnnualAmountFromMonthly(period);
      if (faceAnnual <= 0) continue;

      const months = periodDurationMonths(period);
      weightedSum += faceAnnual * months;
      weightedMonths += months;

      if (isPeriodActiveAtAgeMonth(period, resolveMemberAge(member), currentMonth)) {
        currentSum += faceAnnual;
      }
    }
  }

  if (currentSum > 0) return currentSum;
  if (weightedMonths <= 0) return 0;
  return weightedSum / weightedMonths;
}

function getPensionRoleLabel(role: FamilyMember['role']): string {
  if (role === 'head') return '世帯主の公的年金等';
  if (role === 'spouse') return '配偶者の公的年金等';
  return '公的年金等';
}

function getYearMonthRange(
  calendarYear: number,
  cashFlowData: CashFlowTableData,
): { monthStart: number; monthEnd: number } {
  return {
    monthStart:
      calendarYear === cashFlowData.startYear
        ? cashFlowData.simulationMonthStart
        : 1,
    monthEnd: 12,
  };
}

function extractMemberIdFromTimelineItemId(id: string): string | null {
  const match = id.match(/^(?:income|pension)-(.+)$/);
  return match?.[1] ?? null;
}

/** 生活全般: 世帯主・配偶者ごとに年収と年金を同じ行へ */
function assignLifeCategoryLanes(
  items: LifeEventTimelineItem[],
  members: FamilyMember[],
): LifeEventTimelineItem[] {
  const memberById = new Map(members.map((member) => [member.id, member]));

  const memberRole = (item: LifeEventTimelineItem) => {
    const memberId = extractMemberIdFromTimelineItemId(item.id);
    return memberId != null ? memberById.get(memberId)?.role : undefined;
  };

  const hasSpouseIncome = items.some(
    (item) => item.style === 'income' && memberRole(item) === 'spouse',
  );
  const hasHeadPension = items.some(
    (item) => item.style === 'pension' && memberRole(item) === 'head',
  );
  const hasSpousePension = items.some(
    (item) => item.style === 'pension' && memberRole(item) === 'spouse',
  );

  const headIncomeLane = 0;
  const spouseIncomeLane = 1;
  const pensionBaseLane = hasSpouseIncome ? 2 : 1;
  const headPensionLane = pensionBaseLane;
  const spousePensionLane = hasHeadPension ? pensionBaseLane + 1 : pensionBaseLane;
  const livingLane =
    pensionBaseLane +
    (hasHeadPension ? 1 : 0) +
    (hasSpousePension ? 1 : 0);

  return items.map((item) => {
    if (item.style === 'living') {
      return { ...item, lane: livingLane };
    }

    const role = memberRole(item);

    if (item.style === 'income') {
      if (role === 'spouse') return { ...item, lane: spouseIncomeLane };
      return { ...item, lane: headIncomeLane };
    }

    if (item.style === 'pension') {
      if (role === 'spouse') return { ...item, lane: spousePensionLane };
      return { ...item, lane: headPensionLane };
    }

    return { ...item, lane: livingLane };
  });
}

function buildIncomeItems(
  members: FamilyMember[],
  incomeByMember: IncomeByMember,
  head: FamilyMember,
  referenceDate: Date,
): LifeEventTimelineItem[] {
  const items: LifeEventTimelineItem[] = [];

  for (const member of members) {
    if (member.role !== 'head' && member.role !== 'spouse') continue;

    const entries = incomeByMember[member.id] ?? [];
    let periodStartHeadAge: number | null = null;
    let periodEndHeadAge: number | null = null;

    for (const entry of entries) {
      for (const period of entry.periods) {
        if (isTaxFreeIncome(entry.category, period.streamType)) continue;
        if (calcPeriodAnnualAmountFromMonthly(period) <= 0) continue;

        const startHeadAge = memberAgeToHeadAge(
          member,
          period.startAge,
          head,
          referenceDate,
        );
        const endHeadAge = memberAgeToHeadAge(
          member,
          period.endAge,
          head,
          referenceDate,
        );
        periodStartHeadAge =
          periodStartHeadAge == null
            ? startHeadAge
            : Math.min(periodStartHeadAge, startHeadAge);
        periodEndHeadAge =
          periodEndHeadAge == null
            ? endHeadAge
            : Math.max(periodEndHeadAge, endHeadAge);
      }
    }

    const faceAnnualMan = calcFaceAnnualIncomeMan(
      entries,
      member,
      referenceDate,
    );

    if (
      periodStartHeadAge == null ||
      periodEndHeadAge == null ||
      faceAnnualMan <= 0
    ) {
      continue;
    }

    items.push({
      id: `income-${member.id}`,
      style: 'income',
      icon: '💼',
      title: getIncomeRoleLabel(member.role),
      detail: formatMan(faceAnnualMan),
      startHeadAge: periodStartHeadAge,
      endHeadAge: periodEndHeadAge,
      lane: 0,
    });
  }

  return items;
}

function buildLivingItems(
  livingState: LivingExpenseState,
  head: FamilyMember,
  referenceDate: Date,
): LifeEventTimelineItem[] {
  const schedules = livingState.byTarget[HOUSEHOLD_LIVING_KEY] ?? [];

  return schedules.map((schedule, index) => {
    const monthlyTotal = schedule.items.reduce(
      (sum, item) => sum + item.amountMan,
      0,
    );
    const startHeadAge = memberAgeToHeadAge(
      head,
      schedule.startAge,
      head,
      referenceDate,
    );
    const endHeadAge = memberAgeToHeadAge(head, schedule.endAge, head, referenceDate);

    return {
      id: `living-${schedule.id}`,
      style: 'living',
      icon: '🏠',
      title: index === 0 ? '現在生活費' : '生活費',
      detail: formatMan(monthlyTotal, true),
      startHeadAge,
      endHeadAge: Math.max(startHeadAge, endHeadAge),
      lane: 0,
    };
  });
}

function buildMemberPensionItem(
  member: FamilyMember,
  input: BuildLifeEventTimelineInput,
  headRow: MemberAgeRow,
  head: FamilyMember,
): LifeEventTimelineItem | null {
  const memberState =
    input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
  const incomeEntries = input.incomeByMember[member.id] ?? [];

  let lastHeadAge: number | null = null;
  let totalPension = 0;
  let activeYears = 0;

  for (const year of input.cashFlowData.years) {
    const headAge = headRow.agesByYear[year.calendarYear];
    if (headAge == null) continue;

    const { monthStart, monthEnd } = getYearMonthRange(
      year.calendarYear,
      input.cashFlowData,
    );

    let yearPension = 0;
    for (let month = monthStart; month <= monthEnd; month++) {
      yearPension += sumPensionBreakdown(
        calcMemberMonthlyPensionBreakdownMan(
          member,
          memberState,
          incomeEntries,
          input.referenceDate,
          year.calendarYear,
          month,
        ),
      );
    }

    if (member.role === 'head') {
      const householdTotal = Array.from(
        { length: monthEnd - monthStart + 1 },
        (_, index) => monthStart + index,
      ).reduce((sum, month) => {
        return (
          sum +
          sumPensionBreakdown(
            calcMonthlyPensionEntitlementBreakdownMan(
              input.familyMembers,
              input.pensionByMember,
              input.incomeByMember,
              input.referenceDate,
              year.calendarYear,
              month,
            ),
          )
        );
      }, 0);

      let memberTotalExceptHead = 0;
      for (const other of input.familyMembers) {
        if (other.role === 'pet' || other.id === head.id) continue;
        const otherState =
          input.pensionByMember[other.id] ?? createDefaultPensionMemberState();
        for (let month = monthStart; month <= monthEnd; month++) {
          memberTotalExceptHead += sumPensionBreakdown(
            calcMemberMonthlyPensionBreakdownMan(
              other,
              otherState,
              input.incomeByMember[other.id] ?? [],
              input.referenceDate,
              year.calendarYear,
              month,
            ),
          );
        }
      }

      yearPension += Math.max(0, householdTotal - memberTotalExceptHead - yearPension);
    }

    if (yearPension <= 0) continue;

    lastHeadAge = headAge;
    totalPension += yearPension;
    activeYears += 1;
  }

  if (lastHeadAge == null || activeYears === 0) return null;

  const configuredStartHeadAge = memberAgeToHeadAge(
    member,
    memberState.benefitSettings.oldAgeBasic.startAge,
    head,
    input.referenceDate,
  );

  return {
    id: `pension-${member.id}`,
    style: 'pension',
    icon: '📋',
    title: getPensionRoleLabel(member.role),
    detail: formatMan(totalPension / activeYears / 12, true),
    startHeadAge: configuredStartHeadAge,
    endHeadAge: lastHeadAge,
    lane: 0,
  };
}

function buildPensionItems(
  members: FamilyMember[],
  input: BuildLifeEventTimelineInput,
  headRow: MemberAgeRow,
  head: FamilyMember,
): LifeEventTimelineItem[] {
  const items: LifeEventTimelineItem[] = [];

  for (const member of members) {
    if (member.role !== 'head' && member.role !== 'spouse') continue;
    const item = buildMemberPensionItem(member, input, headRow, head);
    if (item) items.push(item);
  }

  return items;
}

function buildEducationItems(
  members: FamilyMember[],
  educationByMember: EducationByMember,
  cashFlowData: CashFlowTableData,
  head: FamilyMember,
  referenceDate: Date,
): LifeEventTimelineItem[] {
  const items: LifeEventTimelineItem[] = [];

  for (const member of members) {
    if (member.role !== 'child') continue;

    const entries = educationByMember[member.id] ?? [];
    if (entries.length === 0) continue;

    const startHeadAge = Math.min(
      ...entries.map((entry) =>
        memberAgeToHeadAge(member, entry.startAge, head, referenceDate),
      ),
    );
    const endHeadAge = Math.max(
      ...entries.map((entry) =>
        memberAgeToHeadAge(member, entry.endAge, head, referenceDate),
      ),
    );

    const totalEducation = cashFlowData.years.reduce((sum, year) => {
      return sum + (year.expenseBreakdown.educationByMember[member.id] ?? 0);
    }, 0);

    const label =
      member.nickname.trim() !== ''
        ? `${member.nickname}さんの教育`
        : '教育費';

    items.push({
      id: `education-${member.id}`,
      style: 'education',
      icon: '🎓',
      title: label,
      detail: formatTotalMan(totalEducation),
      startHeadAge,
      endHeadAge: Math.max(startHeadAge, endHeadAge),
      lane: items.length,
    });
  }

  return items;
}

function buildCelebrationGiftItems(
  cashFlowData: CashFlowTableData,
  headRow: MemberAgeRow,
): LifeEventTimelineItem[] {
  const occurrences: TimelineOccurrence[] = [];
  let total = 0;

  for (const year of cashFlowData.years) {
    const amount = year.expenseBreakdown.lifeEventDetail.celebration;
    if (amount <= 0) continue;

    const headAge = headRow.agesByYear[year.calendarYear];
    if (headAge == null) continue;

    occurrences.push({
      headAge,
      calendarYear: year.calendarYear,
      amountMan: amount,
    });
    total += amount;
  }

  if (occurrences.length === 0) return [];

  return [
    {
      id: 'celebration-cost',
      style: 'event',
      icon: '🎉',
      title: '子・孫の祝い金',
      detail: formatTotalMan(total),
      startHeadAge: occurrences[0].headAge,
      endHeadAge: occurrences[occurrences.length - 1].headAge,
      startCalendarYear: occurrences[0].calendarYear,
      endCalendarYear: occurrences[occurrences.length - 1].calendarYear,
      lane: 2,
      occurrences,
    },
  ];
}

function buildSpanFromExpenseKey(
  cashFlowData: CashFlowTableData,
  headRow: MemberAgeRow,
  id: string,
  style: TimelineItemStyle,
  icon: string,
  title: string,
  getAmount: (year: (typeof cashFlowData.years)[number]) => number,
  options?: { includeOccurrences?: boolean },
): LifeEventTimelineItem | null {
  let startHeadAge: number | null = null;
  let endHeadAge: number | null = null;
  let startCalendarYear: number | null = null;
  let endCalendarYear: number | null = null;
  let total = 0;
  const occurrences: TimelineOccurrence[] = [];

  for (const year of cashFlowData.years) {
    const amount = getAmount(year);
    if (amount <= 0) continue;

    const headAge = headRow.agesByYear[year.calendarYear];
    if (headAge == null) continue;

    if (startHeadAge == null) {
      startHeadAge = headAge;
      startCalendarYear = year.calendarYear;
    }
    endHeadAge = headAge;
    endCalendarYear = year.calendarYear;
    total += amount;

    if (options?.includeOccurrences) {
      occurrences.push({
        headAge,
        calendarYear: year.calendarYear,
        amountMan: amount,
      });
    }
  }

  if (
    startHeadAge == null ||
    endHeadAge == null ||
    startCalendarYear == null ||
    endCalendarYear == null
  ) {
    return null;
  }

  return {
    id,
    style,
    icon,
    title,
    detail: formatTotalMan(total),
    startHeadAge,
    endHeadAge,
    startCalendarYear,
    endCalendarYear,
    lane: 0,
    ...(options?.includeOccurrences ? { occurrences } : {}),
  };
}

export function clipTimelineItemToRange(
  item: LifeEventTimelineItem,
  minHeadAge: number,
  maxHeadAge: number,
): LifeEventTimelineItem | null {
  const startHeadAge = Math.max(item.startHeadAge, minHeadAge);
  const endHeadAge = Math.min(item.endHeadAge, maxHeadAge);

  if (endHeadAge < minHeadAge || startHeadAge > maxHeadAge) {
    return null;
  }

  const occurrences = item.occurrences?.filter(
    (occurrence) =>
      occurrence.headAge >= minHeadAge && occurrence.headAge <= maxHeadAge,
  );

  if (item.occurrences && (occurrences?.length ?? 0) === 0) {
    return null;
  }

  return {
    ...item,
    startHeadAge,
    endHeadAge: Math.max(startHeadAge, endHeadAge),
    ...(occurrences ? { occurrences } : {}),
  };
}

export function buildLifeEventTimelineData(
  input: BuildLifeEventTimelineInput,
): LifeEventTimelineData {
  const head = getHeadMember(input.familyMembers);
  const headRow = getHeadRow(input.cashFlowData);

  const lifeItems =
    headRow && head
      ? assignLifeCategoryLanes(
          [
            ...buildIncomeItems(
              input.familyMembers,
              input.incomeByMember,
              head,
              input.referenceDate,
            ),
            ...buildLivingItems(input.livingState, head, input.referenceDate),
            ...buildPensionItems(
              input.familyMembers,
              input,
              headRow,
              head,
            ),
          ],
          input.familyMembers,
        )
      : [];

  const housingItem =
    headRow &&
    buildSpanFromExpenseKey(
      input.cashFlowData,
      headRow,
      'housing-cost',
      'housing',
      '🏡',
      '住居関連',
      (year) => year.expenseBreakdown.housing,
    );

  const educationItems = head
    ? buildEducationItems(
        input.familyMembers,
        input.educationByMember,
        input.cashFlowData,
        head,
        input.referenceDate,
      )
    : [];

  const eventItems: LifeEventTimelineItem[] = [];

  if (headRow) {
    const travelItem = buildSpanFromExpenseKey(
      input.cashFlowData,
      headRow,
      'travel-cost',
      'event',
      '🧳',
      '旅行',
      (year) => year.expenseBreakdown.lifeEventDetail.travel,
      { includeOccurrences: true },
    );
    if (travelItem) {
      travelItem.lane = 0;
      eventItems.push(travelItem);
    }

    const applianceItem = buildSpanFromExpenseKey(
      input.cashFlowData,
      headRow,
      'appliance-cost',
      'event',
      '🎁',
      '家電・家具',
      (year) => year.expenseBreakdown.lifeEventDetail.appliance,
      { includeOccurrences: true },
    );
    if (applianceItem) {
      applianceItem.lane = 1;
      eventItems.push(applianceItem);
    }

    if (head) {
      eventItems.push(...buildCelebrationGiftItems(input.cashFlowData, headRow));
    }

    const otherLifeEventItem = buildSpanFromExpenseKey(
      input.cashFlowData,
      headRow,
      'other-life-event-cost',
      'event',
      '✨',
      'その他',
      (year) => year.expenseBreakdown.lifeEventDetail.other,
      { includeOccurrences: true },
    );
    if (otherLifeEventItem) {
      otherLifeEventItem.lane = 3;
      eventItems.push(otherLifeEventItem);
    }

    const careItem = buildSpanFromExpenseKey(
      input.cashFlowData,
      headRow,
      'care-cost',
      'event',
      '🩺',
      '医療・介護費',
      (year) =>
        year.expenseBreakdown.lifeEventDetail.medical +
        year.expenseBreakdown.lifeEventDetail.nursing,
      { includeOccurrences: true },
    );
    if (careItem) {
      careItem.lane = 4;
      eventItems.push(careItem);
    }
  }

  return {
    categories: [
      {
        id: 'life',
        label: '生活\n全般',
        tone: 'life',
        items: lifeItems,
      },
      {
        id: 'housing',
        label: '住宅',
        tone: 'housing',
        items: housingItem ? [housingItem] : [],
      },
      {
        id: 'education',
        label: '教育',
        tone: 'education',
        items: educationItems,
      },
      {
        id: 'events',
        label: 'ライフ\nイベント',
        tone: 'event',
        items: eventItems,
      },
    ],
  };
}

export {
  getTimelineSpanPercent,
  headAgeToPlotPercent as headAgeToPercent,
} from './simulationLayout';
