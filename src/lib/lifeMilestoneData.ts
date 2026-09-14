import {
  calcBirthYear,
  calcYearAtAge,
  getMemberAgeMonth,
} from './birthDate';
import type { EducationExpenseEntry, SchoolCategory } from '../types/education';
import type { FamilyMember } from '../types/family';
import type { IncomeCategory, IncomeEntry } from '../types/income';
import type { LifeEventEntry } from '../types/lifeEvent';
import type { PlanAppState } from '../types/plan';
import type { SecondLifeState } from '../types/secondLife';

export type LifeMilestoneCategory =
  | 'family'
  | 'education'
  | 'life-event'
  | 'housing'
  | 'vehicle'
  | 'work'
  | 'pension'
  | 'loan'
  | 'insurance'
  | 'savings'
  | 'second-life';

export interface LifeMilestone {
  id: string;
  calendarYear: number;
  month: number;
  category: LifeMilestoneCategory;
  title: string;
  memberId?: string;
  detail?: string;
}

export interface LifeEventTableMember {
  id: string;
  label: string;
  role: FamilyMember['role'];
}

export interface LifeEventTableYear {
  calendarYear: number;
  agesByMember: Record<string, number | null>;
  milestones: LifeMilestone[];
}

export interface LifeEventTableData {
  members: LifeEventTableMember[];
  years: LifeEventTableYear[];
  startYear: number;
  endYear: number;
}

const SCHOOL_LABELS: Record<SchoolCategory, string> = {
  nursery: '保育',
  kindergarten: '幼稚園',
  elementary: '小学校',
  junior_high: '中学校',
  high_school: '高校',
  university: '大学',
  graduate: '大学院',
  other: '教育',
};

const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  employee: '会社員',
  civil_servant: '公務員',
  part_time: 'パート・アルバイト',
  self_employed: '自営業・事業',
  benefit: '給付等',
  other: 'その他収入',
};

function safeMonth(month: number | null | undefined): number {
  return Math.min(12, Math.max(1, Math.round(month ?? 1) || 1));
}

function memberLabel(member: FamilyMember): string {
  const nickname = member.nickname.trim();
  if (nickname) return nickname;
  if (member.role === 'head') return '世帯主';
  if (member.role === 'spouse') return '配偶者';
  if (member.role === 'child') return 'お子さま';
  if (member.role === 'pet') return 'ペット';
  return 'ご家族';
}

function yearAtAge(
  member: FamilyMember,
  age: number,
  month: number,
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return calcYearAtAge(
    birthYear,
    safeMonth(member.birthMonth),
    age,
    safeMonth(month),
  );
}

function ageMonthToAbsoluteIndex(
  member: FamilyMember,
  age: number,
  month: number,
  referenceDate: Date,
): number {
  return yearAtAge(member, age, month, referenceDate) * 12 + safeMonth(month);
}

function absoluteIndexToYearMonth(index: number): {
  calendarYear: number;
  month: number;
} {
  const calendarYear = Math.floor((index - 1) / 12);
  const month = ((index - 1) % 12) + 1;
  return { calendarYear, month };
}

function addMilestone(
  target: LifeMilestone[],
  milestone: LifeMilestone,
  startYear: number,
  endYear: number,
): void {
  if (milestone.calendarYear < startYear || milestone.calendarYear > endYear) {
    return;
  }
  target.push(milestone);
}

function getEducationStartTitle(
  entry: EducationExpenseEntry,
  member: FamilyMember,
): string {
  const prefix = memberLabel(member);
  const school = SCHOOL_LABELS[entry.schoolCategory];
  if (entry.schoolCategory === 'nursery') return `${prefix} ${school}開始`;
  if (entry.schoolCategory === 'kindergarten') return `${prefix} 幼稚園入園`;
  if (entry.schoolCategory === 'other') {
    return `${prefix} ${entry.schoolName.trim() || '教育'}開始`;
  }
  return `${prefix} ${school}入学`;
}

function getEducationEndTitle(
  entry: EducationExpenseEntry,
  member: FamilyMember,
): string {
  const prefix = memberLabel(member);
  const school = SCHOOL_LABELS[entry.schoolCategory];
  if (entry.schoolCategory === 'nursery') return `${prefix} ${school}終了`;
  if (entry.schoolCategory === 'kindergarten') return `${prefix} 幼稚園卒園`;
  if (entry.schoolCategory === 'other') {
    return `${prefix} ${entry.schoolName.trim() || '教育'}修了`;
  }
  return `${prefix} ${school}${entry.schoolCategory === 'graduate' ? '修了' : '卒業'}`;
}

function buildEducationMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, entries] of Object.entries(state.educationByMember)) {
    const member = memberById.get(memberId);
    if (!member) continue;

    for (const entry of entries) {
      addMilestone(
        milestones,
        {
          id: `education-start-${memberId}-${entry.id}`,
          calendarYear: yearAtAge(member, entry.startAge, entry.startMonth, state.referenceDate),
          month: safeMonth(entry.startMonth),
          category: 'education',
          title: getEducationStartTitle(entry, member),
          memberId,
          detail: entry.schoolName.trim() || undefined,
        },
        startYear,
        endYear,
      );
      addMilestone(
        milestones,
        {
          id: `education-end-${memberId}-${entry.id}`,
          calendarYear: yearAtAge(member, entry.endAge, entry.endMonth, state.referenceDate),
          month: safeMonth(entry.endMonth),
          category: 'education',
          title: getEducationEndTitle(entry, member),
          memberId,
          detail: entry.schoolName.trim() || undefined,
        },
        startYear,
        endYear,
      );
    }
  }

  return milestones;
}

function pushRecurringLifeEvent(
  target: LifeMilestone[],
  member: FamilyMember,
  entry: LifeEventEntry,
  referenceDate: Date,
  startYear: number,
  endYear: number,
): void {
  if (entry.source) return;

  const intervalMonths = Math.max(
    1,
    Math.round(entry.cycleInterval || 1) * (entry.cycleUnit === 'year' ? 12 : 1),
  );
  const startIndex = ageMonthToAbsoluteIndex(
    member,
    entry.startAge,
    entry.startMonth,
    referenceDate,
  );
  const endIndex =
    entry.endMode === 'once'
      ? startIndex
      : entry.endMode === 'lifetime'
        ? ageMonthToAbsoluteIndex(
            member,
            member.expectedLifespan,
            12,
            referenceDate,
          )
        : ageMonthToAbsoluteIndex(
            member,
            entry.endAge,
            entry.endMonth,
            referenceDate,
          );

  let occurrenceIndex = 0;
  for (
    let absoluteIndex = startIndex;
    absoluteIndex <= endIndex;
    absoluteIndex += intervalMonths
  ) {
    const { calendarYear, month } = absoluteIndexToYearMonth(absoluteIndex);
    if (calendarYear > endYear) break;
    if (calendarYear < startYear) {
      occurrenceIndex += 1;
      continue;
    }
    target.push({
      id: `life-event-${member.id}-${entry.id}-${occurrenceIndex}`,
      calendarYear,
      month,
      category: 'life-event',
      title: entry.label.trim() || 'ライフイベント',
      memberId: member.id,
    });
    occurrenceIndex += 1;
  }
}

function buildLifeEventMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, entries] of Object.entries(state.lifeEventState.byMember)) {
    const owner = memberById.get(memberId);
    if (!owner) continue;

    for (const entry of entries) {
      if (
        entry.type === 'celebration_gift' &&
        (entry.celebrationBeneficiaries?.length ?? 0) > 0
      ) {
        for (const beneficiary of entry.celebrationBeneficiaries ?? []) {
          const member = memberById.get(beneficiary.memberId);
          if (!member) continue;
          addMilestone(
            milestones,
            {
              id: `celebration-${entry.id}-${beneficiary.memberId}-${beneficiary.targetAge}`,
              calendarYear: yearAtAge(
                member,
                beneficiary.targetAge,
                member.birthMonth ?? 1,
                state.referenceDate,
              ),
              month: safeMonth(member.birthMonth),
              category: 'life-event',
              title: `${memberLabel(member)} ${entry.label.trim() || '祝い金'}`,
              memberId: member.id,
            },
            startYear,
            endYear,
          );
        }
        continue;
      }

      pushRecurringLifeEvent(
        milestones,
        owner,
        entry,
        state.referenceDate,
        startYear,
        endYear,
      );
    }
  }

  return milestones;
}

function buildFamilyMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  for (const member of state.familyMembers) {
    if (member.role === 'pet' || member.householdPeriod.mode === 'lifetime') continue;
    addMilestone(
      milestones,
      {
        id: `family-household-end-${member.id}`,
        calendarYear: yearAtAge(
          member,
          member.householdPeriod.endAge,
          member.householdPeriod.endMonth,
          state.referenceDate,
        ),
        month: safeMonth(member.householdPeriod.endMonth),
        category: 'family',
        title: `${memberLabel(member)} 世帯から独立`,
        memberId: member.id,
      },
      startYear,
      endYear,
    );
  }
  return milestones;
}

function buildHousingMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const head = state.familyMembers.find((member) => member.role === 'head');
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [targetId, data] of Object.entries(state.housingState.byTarget)) {
    const member = memberById.get(targetId) ?? head;
    if (!member) continue;

    for (const rental of data.rentals) {
      if (rental.occupancy === 'upcoming') {
        addMilestone(
          milestones,
          {
            id: `housing-rental-start-${targetId}-${rental.id}`,
            calendarYear: yearAtAge(member, rental.startAge, rental.startMonth, state.referenceDate),
            month: safeMonth(rental.startMonth),
            category: 'housing',
            title: `${rental.name.trim() || '賃貸住宅'}へ入居`,
            memberId: member.id,
          },
          startYear,
          endYear,
        );
      }
      if (rental.endMode === 'until') {
        addMilestone(
          milestones,
          {
            id: `housing-rental-end-${targetId}-${rental.id}`,
            calendarYear: yearAtAge(member, rental.endAge, rental.endMonth, state.referenceDate),
            month: safeMonth(rental.endMonth),
            category: 'housing',
            title: `${rental.name.trim() || '賃貸住宅'}を退去`,
            memberId: member.id,
          },
          startYear,
          endYear,
        );
      }
    }

    for (const property of data.owned) {
      if (property.usage === 'upcoming') {
        addMilestone(
          milestones,
          {
            id: `housing-owned-start-${targetId}-${property.id}`,
            calendarYear: yearAtAge(member, property.startAge, property.startMonth, state.referenceDate),
            month: safeMonth(property.startMonth),
            category: 'housing',
            title: `${property.name.trim() || '住宅'}を購入・入居`,
            memberId: member.id,
          },
          startYear,
          endYear,
        );
      }
      if (property.endMode === 'until') {
        addMilestone(
          milestones,
          {
            id: `housing-owned-end-${targetId}-${property.id}`,
            calendarYear: yearAtAge(member, property.endAge, property.endMonth, state.referenceDate),
            month: safeMonth(property.endMonth),
            category: 'housing',
            title: `${property.name.trim() || '住宅'}から住み替え`,
            memberId: member.id,
          },
          startYear,
          endYear,
        );
      }
    }
  }

  return milestones;
}

function buildVehicleMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, entries] of Object.entries(state.vehicleState.byMember)) {
    const member = memberById.get(memberId);
    if (!member) continue;

    for (const entry of entries) {
      if (entry.condition !== 'owned') {
        addMilestone(
          milestones,
          {
            id: `vehicle-start-${memberId}-${entry.id}`,
            calendarYear: yearAtAge(member, entry.startAge, entry.startMonth, state.referenceDate),
            month: safeMonth(entry.startMonth),
            category: 'vehicle',
            title: `${entry.label.trim() || '乗り物'}を購入・利用開始`,
            memberId,
          },
          startYear,
          endYear,
        );
      }
      if (entry.endMode === 'until') {
        addMilestone(
          milestones,
          {
            id: `vehicle-end-${memberId}-${entry.id}`,
            calendarYear: yearAtAge(member, entry.endAge, entry.endMonth, state.referenceDate),
            month: safeMonth(entry.endMonth),
            category: 'vehicle',
            title: `${entry.label.trim() || '乗り物'}の利用終了`,
            memberId,
          },
          startYear,
          endYear,
        );
      }
    }
  }

  return milestones;
}

function getIncomeRange(entry: IncomeEntry): {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
} | null {
  if (entry.periods.length === 0) return null;
  const start = [...entry.periods].sort(
    (left, right) =>
      left.startAge - right.startAge || left.startMonth - right.startMonth,
  )[0];
  const end = [...entry.periods].sort(
    (left, right) =>
      right.endAge - left.endAge || right.endMonth - left.endMonth,
  )[0];
  return {
    startAge: start.startAge,
    startMonth: start.startMonth,
    endAge: end.endAge,
    endMonth: end.endMonth,
  };
}

function buildWorkMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, entries] of Object.entries(state.incomeByMember)) {
    const member = memberById.get(memberId);
    if (!member) continue;

    for (const entry of entries) {
      const range = getIncomeRange(entry);
      if (range) {
        const category = INCOME_CATEGORY_LABELS[entry.category];
        addMilestone(
          milestones,
          {
            id: `work-start-${memberId}-${entry.id}`,
            calendarYear: yearAtAge(member, range.startAge, range.startMonth, state.referenceDate),
            month: safeMonth(range.startMonth),
            category: 'work',
            title: `${memberLabel(member)} ${category}の収入開始`,
            memberId,
          },
          startYear,
          endYear,
        );
        addMilestone(
          milestones,
          {
            id: `work-end-${memberId}-${entry.id}`,
            calendarYear: yearAtAge(member, range.endAge, range.endMonth, state.referenceDate),
            month: safeMonth(range.endMonth),
            category: 'work',
            title: `${memberLabel(member)} ${category}の収入終了`,
            memberId,
          },
          startYear,
          endYear,
        );
      }

      for (const allowance of entry.retirementAllowances) {
        addMilestone(
          milestones,
          {
            id: `retirement-allowance-${memberId}-${entry.id}-${allowance.id}`,
            calendarYear: yearAtAge(
              member,
              allowance.receiveAge,
              allowance.receiveMonth,
              state.referenceDate,
            ),
            month: safeMonth(allowance.receiveMonth),
            category: 'work',
            title: `${memberLabel(member)} 退職金受取`,
            memberId,
          },
          startYear,
          endYear,
        );
      }
    }
  }

  return milestones;
}

function buildPensionMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, pension] of Object.entries(state.pensionByMember)) {
    const member = memberById.get(memberId);
    if (!member || member.role === 'pet') continue;
    const setting = pension.benefitSettings.oldAgeBasic;
    addMilestone(
      milestones,
      {
        id: `pension-start-${memberId}`,
        calendarYear: yearAtAge(
          member,
          setting.startAge,
          (member.birthMonth ?? 1) + setting.startMonth,
          state.referenceDate,
        ),
        month: safeMonth((member.birthMonth ?? 1) + setting.startMonth),
        category: 'pension',
        title: `${memberLabel(member)} 公的年金受給開始`,
        memberId,
      },
      startYear,
      endYear,
    );
  }

  return milestones;
}

function buildLoanMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  for (const [memberId, entries] of Object.entries(state.loanState.byMember)) {
    for (const entry of entries) {
      let calendarYear = 0;
      let month = 12;
      if (entry.paymentMode === 'monthlyRepayment') {
        calendarYear = entry.repaymentEndYear;
        month = safeMonth(entry.repaymentEndMonth);
      } else if (
        entry.settingsConfigured &&
        entry.settings.startYear > 0 &&
        entry.settings.years > 0
      ) {
        calendarYear = entry.settings.startYear + entry.settings.years;
        month = safeMonth(entry.settings.startMonth);
      }
      if (calendarYear <= 0) continue;
      addMilestone(
        milestones,
        {
          id: `loan-end-${memberId}-${entry.id}`,
          calendarYear,
          month,
          category: 'loan',
          title: `${entry.name.trim() || 'ローン'}完済`,
          memberId,
        },
        startYear,
        endYear,
      );
    }
  }
  return milestones;
}

function buildInsuranceMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [ownerId, entries] of Object.entries(state.insuranceState.byMember)) {
    const owner = memberById.get(ownerId);
    if (!owner) continue;

    for (const entry of entries) {
      if (
        (entry.category === 'education' || entry.category === 'personal_pension') &&
        entry.benefitAmountMan > 0
      ) {
        const receiveMember =
          memberById.get(entry.benefitReceiveMemberId) ?? owner;
        addMilestone(
          milestones,
          {
            id: `insurance-benefit-${ownerId}-${entry.id}`,
            calendarYear: yearAtAge(
              receiveMember,
              entry.benefitReceiveAge,
              receiveMember.birthMonth ?? 1,
              state.referenceDate,
            ),
            month: safeMonth(receiveMember.birthMonth),
            category: 'insurance',
            title:
              entry.category === 'education'
                ? `${entry.name.trim() || '学資保険'}受取${entry.benefitPayoutMode === 'annuity' ? '開始' : ''}`
                : `${entry.name.trim() || '個人年金'}受取${entry.benefitPayoutMode === 'annuity' ? '開始' : ''}`,
            memberId: receiveMember.id,
          },
          startYear,
          endYear,
        );
      }

      if (entry.hasReturnValue && entry.returnValueMan > 0) {
        addMilestone(
          milestones,
          {
            id: `insurance-return-${ownerId}-${entry.id}`,
            calendarYear: yearAtAge(
              owner,
              entry.returnValueAge,
              owner.birthMonth ?? 1,
              state.referenceDate,
            ),
            month: safeMonth(owner.birthMonth),
            category: 'insurance',
            title: `${entry.name.trim() || '保険'}の返戻金・満期金受取`,
            memberId: owner.id,
          },
          startYear,
          endYear,
        );
      }
    }
  }

  return milestones;
}

function buildSavingsMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const memberById = new Map(state.familyMembers.map((member) => [member.id, member]));

  for (const [memberId, entries] of Object.entries(state.savingsState.byMember)) {
    const member = memberById.get(memberId);
    if (!member) continue;

    for (const entry of entries) {
      if (entry.category === 'time_deposit' && (entry.termYears ?? 0) > 0) {
        const depositStartYear = yearAtAge(
          member,
          entry.startAge,
          entry.startMonth,
          state.referenceDate,
        );
        addMilestone(
          milestones,
          {
            id: `savings-term-end-${memberId}-${entry.id}`,
            calendarYear: depositStartYear + (entry.termYears ?? 1),
            month: safeMonth(entry.startMonth),
            category: 'savings',
            title: `${entry.name.trim() || '定期預金'}満期`,
            memberId,
          },
          startYear,
          endYear,
        );
      }

      if (
        entry.withdrawalMode &&
        entry.withdrawalMode !== 'none' &&
        entry.withdrawalStartAge != null
      ) {
        addMilestone(
          milestones,
          {
            id: `savings-withdrawal-${memberId}-${entry.id}`,
            calendarYear: yearAtAge(
              member,
              entry.withdrawalStartAge,
              entry.withdrawalStartMonth ?? member.birthMonth ?? 1,
              state.referenceDate,
            ),
            month: safeMonth(entry.withdrawalStartMonth ?? member.birthMonth),
            category: 'savings',
            title: `${entry.name.trim() || '資産'}${entry.withdrawalMode === 'once' ? '一括売却' : '取崩し開始'}`,
            memberId,
          },
          startYear,
          endYear,
        );
      }
    }
  }

  return milestones;
}

function getSecondLifeHousingTitle(secondLife: SecondLifeState): string {
  if (secondLife.housingScenario === 'hometown') return '老後の住まいを地元・実家方面へ変更';
  if (secondLife.housingScenario === 'new_area') return '老後の住まいを新しい地域へ変更';
  if (secondLife.stayOption === 'renovate') return '老後の住まいをリフォーム';
  if (secondLife.stayOption === 'purchase_rebuild') return '老後の住まいを建替え・購入';
  return '老後の住まいを継続';
}

function buildSecondLifeMilestones(
  state: PlanAppState,
  startYear: number,
  endYear: number,
): LifeMilestone[] {
  const milestones: LifeMilestone[] = [];
  const head = state.familyMembers.find((member) => member.role === 'head');
  const spouse = state.familyMembers.find((member) => member.role === 'spouse');
  if (!head) return milestones;

  addMilestone(
    milestones,
    {
      id: 'second-life-start',
      calendarYear: yearAtAge(
        head,
        state.secondLifeState.startAge,
        head.birthMonth ?? 1,
        state.referenceDate,
      ),
      month: safeMonth(head.birthMonth),
      category: 'second-life',
      title: 'セカンドライフ開始',
      memberId: head.id,
    },
    startYear,
    endYear,
  );

  if (state.secondLifeState.housingConfigured && !state.secondLifeState.housingSkip) {
    addMilestone(
      milestones,
      {
        id: 'second-life-housing',
        calendarYear: yearAtAge(
          head,
          state.secondLifeState.housingActionAge,
          head.birthMonth ?? 1,
          state.referenceDate,
        ),
        month: safeMonth(head.birthMonth),
        category: 'second-life',
        title: getSecondLifeHousingTitle(state.secondLifeState),
        memberId: head.id,
      },
      startYear,
      endYear,
    );
  }

  for (const target of ['head', 'spouse'] as const) {
    const member = target === 'head' ? head : spouse;
    const nursing = state.secondLifeState.nursingByTarget[target];
    if (!member || !nursing?.configured || nursing.skip) continue;
    addMilestone(
      milestones,
      {
        id: `second-life-nursing-${target}`,
        calendarYear: yearAtAge(
          member,
          nursing.startAge,
          member.birthMonth ?? 1,
          state.referenceDate,
        ),
        month: safeMonth(member.birthMonth),
        category: 'second-life',
        title: `${memberLabel(member)} 介護生活開始`,
        memberId: member.id,
      },
      startYear,
      endYear,
    );
  }

  return milestones;
}

function dedupeMilestones(milestones: LifeMilestone[]): LifeMilestone[] {
  const seen = new Set<string>();
  return milestones.filter((milestone) => {
    const key = [
      milestone.calendarYear,
      milestone.month,
      milestone.category,
      milestone.memberId ?? '',
      milestone.title,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildLifeEventTableData(state: PlanAppState): LifeEventTableData {
  const members = state.familyMembers
    .filter((member) => member.role !== 'pet')
    .map((member) => ({
      id: member.id,
      label: memberLabel(member),
      role: member.role,
    }));

  const startYear = state.referenceDate.getFullYear();
  const lifespanYears = state.familyMembers
    .filter((member) => member.role !== 'pet' && member.age != null)
    .map((member) => {
      const birthYear = calcBirthYear(
        member.age,
        member.birthMonth,
        state.referenceDate,
      );
      return birthYear + member.expectedLifespan;
    });
  const endYear = Math.max(startYear + 1, ...lifespanYears);

  const milestones = dedupeMilestones([
    ...buildFamilyMilestones(state, startYear, endYear),
    ...buildEducationMilestones(state, startYear, endYear),
    ...buildLifeEventMilestones(state, startYear, endYear),
    ...buildHousingMilestones(state, startYear, endYear),
    ...buildVehicleMilestones(state, startYear, endYear),
    ...buildWorkMilestones(state, startYear, endYear),
    ...buildPensionMilestones(state, startYear, endYear),
    ...buildLoanMilestones(state, startYear, endYear),
    ...buildInsuranceMilestones(state, startYear, endYear),
    ...buildSavingsMilestones(state, startYear, endYear),
    ...buildSecondLifeMilestones(state, startYear, endYear),
  ]).sort(
    (left, right) =>
      left.calendarYear - right.calendarYear ||
      left.month - right.month ||
      left.title.localeCompare(right.title, 'ja'),
  );

  const byYear = new Map<number, LifeMilestone[]>();
  for (const milestone of milestones) {
    const list = byYear.get(milestone.calendarYear) ?? [];
    list.push(milestone);
    byYear.set(milestone.calendarYear, list);
  }

  const referenceMonth = state.referenceDate.getMonth() + 1;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const calendarYear = startYear + index;
    const agesByMember: Record<string, number | null> = {};
    for (const member of state.familyMembers) {
      if (member.role === 'pet') continue;
      agesByMember[member.id] =
        getMemberAgeMonth(
          member,
          state.referenceDate,
          calendarYear,
          referenceMonth,
        )?.age ?? null;
    }
    return {
      calendarYear,
      agesByMember,
      milestones: byYear.get(calendarYear) ?? [],
    };
  });

  return { members, years, startYear, endYear };
}

export const LIFE_MILESTONE_CATEGORY_LABELS: Record<
  LifeMilestoneCategory,
  string
> = {
  family: '家族',
  education: '教育',
  'life-event': 'イベント',
  housing: '住まい',
  vehicle: '乗り物',
  work: '仕事',
  pension: '年金',
  loan: 'ローン',
  insurance: '保険',
  savings: '資産',
  'second-life': '老後',
};
