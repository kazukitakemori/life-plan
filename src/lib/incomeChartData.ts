import { calcBirthYear, calcFutureYear } from './birthDate';
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcMemberMonthlyEarnedIncomeBreakdown,
} from './memberEarnedIncome';
import {
  sumBonusDetail,
  sumIncomeBreakdown,
  sumSalaryDetail,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';

export type IncomeChartSeriesKey =
  | 'salary'
  | 'bonus'
  | 'business'
  | 'retirementAllowance'
  | 'other';

export interface IncomeChartPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: null;
  salary: number;
  bonus: number;
  business: number;
  retirementAllowance: number;
  other: number;
}

export const INCOME_CHART_SERIES: ReadonlyArray<{
  key: IncomeChartSeriesKey;
  label: string;
  color: string;
}> = [
  { key: 'retirementAllowance', label: '退職金', color: '#f59e0b' },
  { key: 'bonus', label: '賞与', color: '#93b7f5' },
  { key: 'salary', label: '給与', color: '#5b8def' },
  { key: 'business', label: '事業', color: '#94a3b8' },
  { key: 'other', label: 'その他', color: '#cbd5e1' },
];

/** Recharts は先頭が底。凡例上→下と同じ見た目になるよう下→上に積む */
export const INCOME_CHART_STACK_ORDER: IncomeChartSeriesKey[] = [
  ...INCOME_CHART_SERIES.map((item) => item.key),
].reverse();

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

function resolveChartEndYear(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(member);
  let endYear = referenceDate.getFullYear();

  for (const entry of entries) {
    for (const period of entry.periods) {
      endYear = Math.max(
        endYear,
        calcFutureYear(
          birthYear,
          period.endAge,
          period.endMonth,
          birthMonth,
        ),
      );
    }
    for (const allowance of entry.retirementAllowances ?? []) {
      endYear = Math.max(
        endYear,
        calcFutureYear(
          birthYear,
          allowance.receiveAge,
          allowance.receiveMonth,
          birthMonth,
        ),
      );
    }
  }

  return endYear;
}

export function buildIncomeChartPoints(input: {
  member: FamilyMember;
  incomeByMember: IncomeByMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
}): IncomeChartPoint[] {
  const { member, incomeByMember, familyMembers, referenceDate } = input;
  const entries = incomeByMember[member.id] ?? [];
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const startYear = referenceDate.getFullYear();
  const endYear = resolveChartEndYear(member, entries, referenceDate);
  const earnedInput = {
    familyMembers,
    incomeByMember,
    referenceDate,
  };

  const points: IncomeChartPoint[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    let salary = 0;
    let bonus = 0;
    let business = 0;
    let retirementAllowance = 0;
    let other = 0;

    for (let month = 1; month <= 12; month += 1) {
      const breakdown = calcMemberMonthlyEarnedIncomeBreakdown(
        earnedInput,
        member,
        year,
        month,
      );
      const salaryPart = sumSalaryDetail(breakdown.salary);
      const bonusPart = sumBonusDetail(breakdown.bonus);
      const businessPart = breakdown.businessCf;
      const retirementPart = breakdown.retirementAllowance;
      const total = sumIncomeBreakdown(breakdown);
      const otherPart = Math.max(
        0,
        total - salaryPart - bonusPart - businessPart - retirementPart,
      );

      salary += salaryPart;
      bonus += bonusPart;
      business += businessPart;
      retirementAllowance += retirementPart;
      other += otherPart;
    }

    points.push({
      calendarYear: year,
      headAge: year - birthYear,
      spouseAge: null,
      salary: roundMan(salary),
      bonus: roundMan(bonus),
      business: roundMan(business),
      retirementAllowance: roundMan(retirementAllowance),
      other: roundMan(other),
    });
  }

  return points;
}

export function sumIncomeChartPoint(
  point: IncomeChartPoint,
  visible?: Partial<Record<IncomeChartSeriesKey, boolean>>,
): number {
  let total = 0;
  for (const item of INCOME_CHART_SERIES) {
    if (visible && visible[item.key] === false) continue;
    total += point[item.key];
  }
  return roundMan(total);
}
