import { getMemberAgeMonth } from './birthDate';
import {
  calcEnrollmentYearsFromAgeMonths,
  calcMergedEnrollmentYearsFromPeriods,
} from './retirementIncomeTax';
import type { FamilyMember } from '../types/family';
import type {
  IncomeByMember,
  IncomeEntry,
  RetirementAllowanceEntry,
  RetirementEnrollmentMode,
} from '../types/income';
import { incomeCategoryShowsRetirementAllowance } from './incomeLabels';
import type { IdecoLumpSumTaxInput } from './idecoTax';

export function retirementAllowancesForEntry(
  entry: IncomeEntry,
): RetirementAllowanceEntry[] {
  if (!incomeCategoryShowsRetirementAllowance(entry.category)) return [];
  return entry.retirementAllowances ?? [];
}

export function createRetirementAllowanceEntry(
  member: FamilyMember,
  defaults?: Partial<RetirementAllowanceEntry>,
): RetirementAllowanceEntry {
  const receiveAge = Math.min(
    member.expectedLifespan,
    Math.max(member.age ?? 0, 60),
  );
  const enrollmentYears = 30;
  const enrollmentStartAge = Math.max(0, receiveAge - enrollmentYears);
  return {
    id: crypto.randomUUID(),
    amountMan: 1000,
    receiveAge,
    receiveMonth: 3,
    enrollmentMode: 'years',
    enrollmentYears,
    enrollmentStartAge,
    enrollmentStartMonth: 4,
    enrollmentEndAge: receiveAge,
    enrollmentEndMonth: 3,
    ...defaults,
  };
}

export function resolveRetirementEnrollmentMode(
  mode: RetirementEnrollmentMode | undefined,
): RetirementEnrollmentMode {
  return mode === 'period' ? 'period' : 'years';
}

export function resolveRetirementEnrollmentYears(
  allowance: RetirementAllowanceEntry,
): number {
  if (resolveRetirementEnrollmentMode(allowance.enrollmentMode) === 'period') {
    return calcEnrollmentYearsFromAgeMonths(
      {
        age: allowance.enrollmentStartAge,
        month: allowance.enrollmentStartMonth,
      },
      {
        age: allowance.enrollmentEndAge,
        month: allowance.enrollmentEndMonth,
      },
    );
  }
  return Math.max(1, Math.floor(Number(allowance.enrollmentYears) || 1));
}

/** 指定暦月の退職金合計（万円） */
export function calcRetirementAllowanceManForMonth(
  entry: IncomeEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const allowances = retirementAllowancesForEntry(entry);
  if (allowances.length === 0) return 0;
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  let total = 0;
  for (const allowance of allowances) {
    if (
      ageMonth.age === allowance.receiveAge &&
      ageMonth.month === allowance.receiveMonth
    ) {
      total += Math.max(0, Number(allowance.amountMan) || 0);
    }
  }
  return total;
}

export function collectCompanyRetirementLumpByMember(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): Record<string, IdecoLumpSumTaxInput> {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const result: Record<string, IdecoLumpSumTaxInput> = {};

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const entries = input.incomeByMember[member.id] ?? [];
    let revenueMan = 0;
    let enrollmentYears = 1;

    for (const entry of entries) {
      for (const allowance of retirementAllowancesForEntry(entry)) {
        const amount = Math.max(0, Number(allowance.amountMan) || 0);
        if (amount <= 0) continue;
        if (
          allowance.receiveMonth < monthStart ||
          allowance.receiveMonth > monthEnd
        ) {
          continue;
        }
        const ageMonth = getMemberAgeMonth(
          member,
          input.referenceDate,
          input.calendarYear,
          allowance.receiveMonth,
        );
        if (
          !ageMonth ||
          ageMonth.age !== allowance.receiveAge ||
          ageMonth.month !== allowance.receiveMonth
        ) {
          continue;
        }
        revenueMan += amount;
        enrollmentYears = Math.max(
          enrollmentYears,
          resolveRetirementEnrollmentYears(allowance),
        );
      }
    }

    if (revenueMan > 0) {
      const primary = (input.incomeByMember[member.id] ?? [])
        .flatMap((e) => retirementAllowancesForEntry(e))
        .find((a) => Math.max(0, Number(a.amountMan) || 0) > 0);
      let periodStartAge = 0;
      let periodStartMonth = 4;
      let periodEndAge = 0;
      let periodEndMonth = 12;
      if (primary) {
        if (resolveRetirementEnrollmentMode(primary.enrollmentMode) === 'period') {
          periodStartAge = primary.enrollmentStartAge;
          periodStartMonth = primary.enrollmentStartMonth;
          periodEndAge = primary.enrollmentEndAge;
          periodEndMonth = primary.enrollmentEndMonth;
        } else {
          periodEndAge = primary.receiveAge;
          periodEndMonth = primary.receiveMonth;
          periodStartAge = Math.max(0, periodEndAge - enrollmentYears);
          periodStartMonth = 4;
        }
      }
      result[member.id] = {
        revenueMan,
        enrollmentYears,
        kind: 'company',
        periodStartAge,
        periodStartMonth,
        periodEndAge,
        periodEndMonth,
      };
    }
  }

  return result;
}

/** 会社退職金と iDeCo/DC/DB 一時金を同年合算（勤続年数は最長＋非重複） */
export function mergeRetirementLumpSums(
  ...sources: Array<Record<string, IdecoLumpSumTaxInput>>
): Record<string, IdecoLumpSumTaxInput> {
  const merged: Record<string, IdecoLumpSumTaxInput> = {};
  for (const source of sources) {
    for (const [memberId, lump] of Object.entries(source)) {
      const prev = merged[memberId];
      if (!prev) {
        merged[memberId] = { ...lump };
        continue;
      }
      const sameKind = prev.kind != null && prev.kind === lump.kind;
      const periods = [];
      if (
        prev.periodStartAge != null &&
        prev.periodStartMonth != null &&
        prev.periodEndAge != null &&
        prev.periodEndMonth != null
      ) {
        periods.push({
          startAge: prev.periodStartAge,
          startMonth: prev.periodStartMonth,
          endAge: prev.periodEndAge,
          endMonth: prev.periodEndMonth,
        });
      }
      if (
        lump.periodStartAge != null &&
        lump.periodStartMonth != null &&
        lump.periodEndAge != null &&
        lump.periodEndMonth != null
      ) {
        periods.push({
          startAge: lump.periodStartAge,
          startMonth: lump.periodStartMonth,
          endAge: lump.periodEndAge,
          endMonth: lump.periodEndMonth,
        });
      }
      const enrollmentYears =
        periods.length >= 2
          ? calcMergedEnrollmentYearsFromPeriods(periods)
          : periods.length === 1
            ? Math.max(
                calcMergedEnrollmentYearsFromPeriods(periods),
                prev.enrollmentYears,
                lump.enrollmentYears,
              )
            : Math.max(prev.enrollmentYears, lump.enrollmentYears);

      let periodStartAge = prev.periodStartAge;
      let periodStartMonth = prev.periodStartMonth;
      let periodEndAge = prev.periodEndAge;
      let periodEndMonth = prev.periodEndMonth;
      if (periods.length > 0) {
        periodStartAge = Math.min(...periods.map((p) => p.startAge));
        // 同じ開始年齢なら月の早い方
        const startCandidates = periods.filter((p) => p.startAge === periodStartAge);
        periodStartMonth = Math.min(...startCandidates.map((p) => p.startMonth));
        periodEndAge = Math.max(...periods.map((p) => p.endAge));
        const endCandidates = periods.filter((p) => p.endAge === periodEndAge);
        periodEndMonth = Math.max(...endCandidates.map((p) => p.endMonth));
      }

      merged[memberId] = {
        revenueMan: prev.revenueMan + lump.revenueMan,
        enrollmentYears,
        // 異なる区分の同年合算は合算計算（重複調整の対象外）
        kind: sameKind ? prev.kind : undefined,
        periodStartAge,
        periodStartMonth,
        periodEndAge,
        periodEndMonth,
      };
    }
  }
  return merged;
}
