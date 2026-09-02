import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + (month - 1);
}

/**
 * 試算初年度内かつ試算開始以降に始まる収入期間か。
 * （継続勤務の過去開始は除外。開始月が試算開始より後でも初年度内なら対象）
 */
export function isPeriodStartEligibleForNewIncomeFlag(
  startAge: number,
  startMonth: number,
  simulationStart: { startAge: number; startMonth: number },
): boolean {
  const start = ageMonthIndex(startAge, startMonth);
  const simStart = ageMonthIndex(
    simulationStart.startAge,
    simulationStart.startMonth,
  );
  const firstYearEnd = ageMonthIndex(simulationStart.startAge, 12);
  return start >= simStart && start <= firstYearEnd;
}

/**
 * 「新しい収入」チェックを出せる開始月。
 * 試算開始月ぴったりに限らず、初年度内で試算開始以降に始まる期間があればその開始月を返す。
 */
export function resolveNewIncomeStartMonth(
  entry: IncomeEntry,
  member: FamilyMember,
  referenceMonth?: number,
): number | null {
  const defaultStart =
    referenceMonth != null
      ? resolveDefaultStartAgeMonth(member.age, referenceMonth)
      : {
          startAge: member.age ?? 0,
          startMonth: 1,
        };

  const eligibleStarts = entry.periods
    .filter((period) =>
      isPeriodStartEligibleForNewIncomeFlag(
        period.startAge,
        period.startMonth,
        defaultStart,
      ),
    )
    .map((period) => ({
      age: period.startAge,
      month: period.startMonth,
      index: ageMonthIndex(period.startAge, period.startMonth),
    }));

  if (eligibleStarts.length === 0) return null;

  eligibleStarts.sort((a, b) => a.index - b.index);
  return eligibleStarts[0].month;
}

/** 就職・開業など、試算初年度に始まる新しい収入か */
export function memberHasNewIncomeFromStart(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceMonth?: number,
): boolean {
  return entries.some(
    (entry) =>
      entry.isNewIncomeFromStart &&
      resolveNewIncomeStartMonth(entry, member, referenceMonth) != null,
  );
}

export function memberHasNewIncomeFromStartById(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceMonth?: number,
): boolean {
  return memberHasNewIncomeFromStart(
    member,
    incomeByMember[member.id] ?? [],
    referenceMonth,
  );
}
