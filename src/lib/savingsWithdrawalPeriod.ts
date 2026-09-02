import { resolveMemberAge } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type { SavingsEntry } from '../types/savings';
import {
  resolveSavingsContributionMode,
  resolveSavingsWithdrawalMode,
  SAVINGS_DEFAULT_WITHDRAWAL_YEARS,
} from './savingsLabels';

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isNisaEntry(entry: SavingsEntry): boolean {
  return (
    entry.category === 'nisa_tsumitate' || entry.category === 'nisa_growth'
  );
}

export function nextAgeMonth(
  age: number,
  month: number,
): { age: number; month: number } {
  if (month >= 12) return { age: age + 1, month: 1 };
  return { age, month: month + 1 };
}

export interface NisaFillPoint {
  age: number;
  month: number;
}

/**
 * 積立終了時点（inclusive）。
 * - 年齢指定: その年月
 * - NISA「枠が埋まるまで」: nisaFill があればその時点、なければ null（未確定）
 * - その他の一生涯: null
 */
export function resolveContributionEndPoint(
  entry: SavingsEntry,
  _member: FamilyMember,
  nisaFill?: NisaFillPoint | null,
): { age: number; month: number } | null {
  if (resolveSavingsContributionMode(entry.contributionMode) === 'none') {
    return null;
  }
  if (entry.endMode === 'until') {
    return {
      age: entry.endAge,
      month: entry.endMonth,
    };
  }
  if (isNisaEntry(entry) && nisaFill != null) {
    return nisaFill;
  }
  return null;
}

/**
 * 取崩開始の推奨値。
 * 積立に終了（または NISA 枠埋まり見込み）があるときはその翌月。
 * それ以外は 65歳1月（現年齢より若ければ現年齢）。
 */
export function suggestWithdrawalStart(
  entry: SavingsEntry,
  member: FamilyMember,
  nisaFill?: NisaFillPoint | null,
): { age: number; month: number } {
  const contributionEnd = resolveContributionEndPoint(entry, member, nisaFill);
  if (contributionEnd) {
    const next = nextAgeMonth(contributionEnd.age, contributionEnd.month);
    if (next.age > member.expectedLifespan) {
      return { age: member.expectedLifespan, month: 12 };
    }
    return next;
  }

  const defaultAge = Math.min(
    Math.max(resolveMemberAge(member), 65),
    member.expectedLifespan,
  );
  return { age: defaultAge, month: 1 };
}

/** 取崩開始から年数分の終了年月（inclusive） */
export function withdrawalEndFromYears(
  startAge: number,
  startMonth: number,
  years: number,
): { age: number; month: number } {
  const months = Math.max(1, Math.round(years)) * 12;
  const endIndex = ageMonthIndex(startAge, startMonth) + months - 1;
  return {
    age: Math.floor((endIndex - 1) / 12),
    month: ((endIndex - 1) % 12) + 1,
  };
}

export function resolveWithdrawalYears(
  entry: SavingsEntry,
  member: FamilyMember,
): number {
  const raw = Number(entry.withdrawalYears);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(Math.round(raw), 80);
  }
  const startAge = entry.withdrawalStartAge ?? resolveMemberAge(member);
  const endAge = entry.withdrawalEndAge;
  if (
    entry.withdrawalEndMode === 'until' &&
    endAge != null &&
    endAge > startAge
  ) {
    return Math.min(Math.max(1, endAge - startAge), 80);
  }
  const untilLifespan = Math.max(1, member.expectedLifespan - startAge);
  return Math.min(SAVINGS_DEFAULT_WITHDRAWAL_YEARS, untilLifespan);
}

/**
 * 運用資産を年数で割った取崩ペース。
 * 年額は1万円単位。月額は年額÷12（小数第1位）。
 */
export function calcDrawdownAmounts(
  assetsMan: number,
  years: number,
): { annualMan: number; monthlyMan: number } {
  const y = Math.max(1, Math.round(years));
  const assets = Math.max(0, assetsMan);
  const annualMan = Math.round(assets / y);
  const monthlyMan = Math.round((annualMan / 12) * 10) / 10;
  return { annualMan, monthlyMan };
}

function resolveWithdrawalEndPoint(
  entry: SavingsEntry,
  member: FamilyMember,
): { age: number; month: number } {
  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  if (mode === 'once') {
    return {
      age: entry.withdrawalStartAge ?? resolveMemberAge(member),
      month: entry.withdrawalStartMonth ?? 1,
    };
  }
  if (mode === 'drawdown') {
    const startAge = entry.withdrawalStartAge ?? resolveMemberAge(member);
    const startMonth = entry.withdrawalStartMonth ?? 1;
    if (
      entry.category === 'ideco' &&
      entry.idecoAnnuityPeriodMode === 'until_age' &&
      entry.withdrawalEndMode === 'until' &&
      entry.withdrawalEndAge != null
    ) {
      return {
        age: entry.withdrawalEndAge,
        month: entry.withdrawalEndMonth ?? 12,
      };
    }
    return withdrawalEndFromYears(
      startAge,
      startMonth,
      resolveWithdrawalYears(entry, member),
    );
  }
  if (entry.withdrawalEndMode === 'until') {
    return {
      age: entry.withdrawalEndAge ?? member.expectedLifespan,
      month: entry.withdrawalEndMonth ?? 12,
    };
  }
  return { age: member.expectedLifespan, month: 12 };
}

/**
 * 積立と取崩しの期間が1ヶ月でも重なるか。
 */
export function doContributionWithdrawalPeriodsOverlap(
  entry: SavingsEntry,
  member: FamilyMember,
  nisaFill?: NisaFillPoint | null,
): boolean {
  if (resolveSavingsContributionMode(entry.contributionMode) === 'none') {
    return false;
  }
  const withdrawalMode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  if (withdrawalMode === 'none') return false;

  const contribStart = ageMonthIndex(entry.startAge, entry.startMonth);
  let contribEnd: number;
  if (entry.endMode === 'until') {
    contribEnd = ageMonthIndex(entry.endAge, entry.endMonth);
  } else if (isNisaEntry(entry)) {
    if (nisaFill == null) return false;
    contribEnd = ageMonthIndex(nisaFill.age, nisaFill.month);
  } else {
    contribEnd = ageMonthIndex(member.expectedLifespan, 12);
  }

  const withdrawStart = ageMonthIndex(
    entry.withdrawalStartAge ?? resolveMemberAge(member),
    entry.withdrawalStartMonth ?? 1,
  );
  const withdrawEndPoint = resolveWithdrawalEndPoint(entry, member);
  const withdrawEnd = ageMonthIndex(
    withdrawEndPoint.age,
    withdrawEndPoint.month,
  );

  return contribStart <= withdrawEnd && withdrawStart <= contribEnd;
}

export type ContributionWithdrawalOverlapKind =
  | 'none'
  | 'overlap'
  | 'both_lifetime';

export function getContributionWithdrawalOverlapKind(
  entry: SavingsEntry,
  member: FamilyMember,
  nisaFill?: NisaFillPoint | null,
): ContributionWithdrawalOverlapKind {
  if (!doContributionWithdrawalPeriodsOverlap(entry, member, nisaFill)) {
    return 'none';
  }
  // drawdown / once は一生涯取崩しではない
  return 'overlap';
}

/**
 * 運用口座の取崩し（売却）フィールドを正規化。
 */
export function ensureSavingsWithdrawalFields(entry: SavingsEntry): SavingsEntry {
  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  if (mode === 'none') {
    return {
      ...entry,
      withdrawalMode: 'none',
      withdrawalMan: 0,
      withdrawalYears: undefined,
    };
  }

  const startAge = Math.max(0, Number(entry.withdrawalStartAge) || 0);
  const startMonth = clampMonth(entry.withdrawalStartMonth);

  if (mode === 'once') {
    return {
      ...entry,
      withdrawalMode: 'once',
      withdrawalMan: Math.max(0, Number(entry.withdrawalMan) || 0),
      withdrawalStartAge: startAge,
      withdrawalStartMonth: startMonth,
      withdrawalYears: undefined,
      withdrawalEndMode: 'until',
      withdrawalEndAge: startAge,
      withdrawalEndMonth: startMonth,
    };
  }

  const rawYears = Number(entry.withdrawalYears);
  const resolvedYears =
    Number.isFinite(rawYears) && rawYears >= 1
      ? Math.min(Math.round(rawYears), 80)
      : SAVINGS_DEFAULT_WITHDRAWAL_YEARS;
  const end = withdrawalEndFromYears(startAge, startMonth, resolvedYears);

  return {
    ...entry,
    withdrawalMode: 'drawdown',
    withdrawalMan: Math.max(0, Number(entry.withdrawalMan) || 0),
    withdrawalYears: resolvedYears,
    withdrawalStartAge: startAge,
    withdrawalStartMonth: startMonth,
    withdrawalEndMode: 'until',
    withdrawalEndAge: end.age,
    withdrawalEndMonth: end.month,
  };
}

function clampMonth(month: number | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}
