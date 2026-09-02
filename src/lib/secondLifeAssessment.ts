import { calcBirthYear } from './birthDate';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { calcMemberMonthlyPensionBreakdownMan } from './pensionIncome';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import { sumPensionBreakdown } from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';
import type { PensionMemberState } from '../types/pension';

const FULL_PENSION_MONTH_TOLERANCE_MAN = 0.001;

interface SecondLifeMemberContext {
  member: FamilyMember;
  memberState: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}

function toMemberContext(input: {
  member: FamilyMember;
  memberState?: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}): SecondLifeMemberContext {
  return {
    member: input.member,
    memberState: input.memberState ?? createDefaultPensionMemberState(),
    incomeEntries: input.incomeEntries,
    referenceDate: input.referenceDate,
  };
}

/** 暦年の各月すべてで公的年金の受給資格があり、年間が月額×12と一致するか */
export function isFullPensionCalendarYear(input: {
  member: FamilyMember;
  memberState: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
}): boolean {
  const monthly: number[] = [];

  for (let month = 1; month <= 12; month++) {
    const amount = sumPensionBreakdown(
      calcMemberMonthlyPensionBreakdownMan(
        input.member,
        input.memberState,
        input.incomeEntries,
        input.referenceDate,
        input.calendarYear,
        month,
      ),
    );
    if (amount <= 0) {
      return false;
    }
    monthly.push(amount);
  }

  const steadyMonthAmount = monthly[11];
  const annual = monthly.reduce((sum, value) => sum + value, 0);
  return (
    Math.abs(annual - steadyMonthAmount * 12) <=
    FULL_PENSION_MONTH_TOLERANCE_MAN
  );
}

function findFullPensionYearInAgeRange(
  context: SecondLifeMemberContext,
  minAge: number,
  maxAge: number,
): number | null {
  const birthYear = calcBirthYear(
    context.member.age,
    context.member.birthMonth,
    context.referenceDate,
  );

  for (let year = birthYear + minAge; year <= birthYear + maxAge + 1; year++) {
    const age =
      getMemberAgeAtYearEnd(
        context.member,
        context.referenceDate,
        year,
      ) ?? -1;
    if (age < minAge || age > maxAge) {
      continue;
    }
    if (
      isFullPensionCalendarYear({
        member: context.member,
        memberState: context.memberState,
        incomeEntries: context.incomeEntries,
        referenceDate: context.referenceDate,
        calendarYear: year,
      })
    ) {
      return year;
    }
  }

  return null;
}

/**
 * 公的年金を12か月分満額受給する最初の暦年を返す。
 * 該当がなければ null。
 */
export function resolveFullPensionCalendarYear(input: {
  member: FamilyMember;
  memberState?: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}): number | null {
  const context = toMemberContext(input);
  const birthYear = calcBirthYear(
    context.member.age,
    context.member.birthMonth,
    context.referenceDate,
  );

  for (let year = birthYear + 60; year <= birthYear + 100; year++) {
    if (
      isFullPensionCalendarYear({
        member: context.member,
        memberState: context.memberState,
        incomeEntries: context.incomeEntries,
        referenceDate: context.referenceDate,
        calendarYear: year,
      })
    ) {
      return year;
    }
  }

  return null;
}

/** 前期高齢者（65～74歳）で国保を負担し、年金を12か月満額受給する最初の年 */
export function resolveSecondLifeNhiCalendarYear(input: {
  member: FamilyMember;
  memberState?: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}): number | null {
  return findFullPensionYearInAgeRange(toMemberContext(input), 65, 74);
}

/** 75歳以上で後期高齢者医療の保険料を満額負担する最初の年（年金12か月満額） */
export function resolveSecondLifeLateElderlyCalendarYear(input: {
  member: FamilyMember;
  memberState?: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}): number | null {
  return findFullPensionYearInAgeRange(toMemberContext(input), 75, 100);
}

export function formatFullPensionYearLabel(calendarYear: number): string {
  return `${calendarYear}年（公的年金12か月満額受給年）`;
}

export function formatSecondLifeNhiYearLabel(calendarYear: number): string {
  return `${calendarYear}年（65～74歳・国保加入・年金12か月満額）`;
}

export function formatSecondLifeLateElderlyYearLabel(calendarYear: number): string {
  return `${calendarYear}年（75歳以上・年金12か月満額）`;
}
