import type { FamilyMember } from '../types/family';
import type { DbEarlyExitMode, SavingsEntry } from '../types/savings';
import { getMemberAgeMonth } from './birthDate';
import {
  resolveDbEnrollmentMode,
  resolveDbEnrollmentPeriod,
} from './dbEnrollment';

/** 原則の最早受給年齢（iDeCo/企業年金と同値） */
const DB_PAYOUT_MIN_AGE = 60;
export const DB_EARLY_EXIT_MODE_LABELS: Record<DbEarlyExitMode, string> = {
  defer: '据置（60歳以降に受取）',
  lump_at_exit: '脱退一時金として受取',
  transfer_ideco: 'iDeCoへ移換',
};

export const DB_EARLY_EXIT_MODES: DbEarlyExitMode[] = [
  'defer',
  'lump_at_exit',
  'transfer_ideco',
];

export function resolveDbEarlyExitMode(
  mode: DbEarlyExitMode | string | undefined,
): DbEarlyExitMode {
  if (mode === 'lump_at_exit' || mode === 'transfer_ideco') {
    return mode;
  }
  // 旧 transfer_federation も据置へ寄せる
  return 'defer';
}

/**
 * DB 加入資格の終了（退職・資格喪失）年齢月。
 * 期間モードは保存値。年数モードは受給開始から逆算した加入終了。
 */
export function resolveDbQualificationEnd(
  entry: Pick<
    SavingsEntry,
    | 'category'
    | 'dbEnrollmentMode'
    | 'dbEnrollmentStartAge'
    | 'dbEnrollmentStartMonth'
    | 'dbEnrollmentEndAge'
    | 'dbEnrollmentEndMonth'
    | 'dbEnrollmentYears'
    | 'withdrawalStartAge'
    | 'withdrawalStartMonth'
  >,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
): { age: number; month: number } | null {
  if (entry.category !== 'db') return null;
  const payout = {
    age: Math.max(
      0,
      Number(entry.withdrawalStartAge) ||
        Math.max(member.age ?? 0, DB_PAYOUT_MIN_AGE),
    ),
    month: Math.min(
      12,
      Math.max(1, Number(entry.withdrawalStartMonth) || member.birthMonth || 1),
    ),
  };
  const period = resolveDbEnrollmentPeriod(entry as SavingsEntry, payout);
  return {
    age: Math.max(0, period.endAge),
    month: Math.min(12, Math.max(1, period.endMonth)),
  };
}

/** 加入終了が受取開始可能年齢（原則60歳）より前なら早期退職の扱い選択が必要 */
export function needsDbEarlyExitChoice(
  entry: Pick<
    SavingsEntry,
    | 'category'
    | 'dbEnrollmentMode'
    | 'dbEnrollmentStartAge'
    | 'dbEnrollmentStartMonth'
    | 'dbEnrollmentEndAge'
    | 'dbEnrollmentEndMonth'
    | 'dbEnrollmentYears'
    | 'withdrawalStartAge'
    | 'withdrawalStartMonth'
  >,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
): boolean {
  if (entry.category !== 'db') return false;
  // 期間モードで終了が明示されているときだけ（年数モードは終了＝受給開始のため循環しやすい）
  if (resolveDbEnrollmentMode(entry.dbEnrollmentMode) !== 'period') {
    return false;
  }
  const end = resolveDbQualificationEnd(entry, member);
  if (!end) return false;
  return end.age < DB_PAYOUT_MIN_AGE;
}

export function isDbTransferToIdeco(
  entry: Pick<SavingsEntry, 'category' | 'dbEarlyExitMode'>,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
): boolean {
  if (entry.category !== 'db') return false;
  if (!needsDbEarlyExitChoice(entry as SavingsEntry, member)) return false;
  return resolveDbEarlyExitMode(entry.dbEarlyExitMode) === 'transfer_ideco';
}

export function isDbLumpAtExit(
  entry: Pick<SavingsEntry, 'category' | 'dbEarlyExitMode'>,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
): boolean {
  if (entry.category !== 'db') return false;
  if (!needsDbEarlyExitChoice(entry as SavingsEntry, member)) return false;
  return resolveDbEarlyExitMode(entry.dbEarlyExitMode) === 'lump_at_exit';
}

/** 据置: 60歳以降に DB 側で受取 */
export function isDbDeferredPayout(
  entry: Pick<SavingsEntry, 'category' | 'dbEarlyExitMode'>,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
): boolean {
  if (entry.category !== 'db') return false;
  if (!needsDbEarlyExitChoice(entry as SavingsEntry, member)) return false;
  return resolveDbEarlyExitMode(entry.dbEarlyExitMode) === 'defer';
}

export function isDbIdecoTransferMonth(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (!isDbTransferToIdeco(entry, member)) return false;
  const target = resolveDbQualificationEnd(entry, member);
  if (!target) return false;
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  return ageMonth.age === target.age && ageMonth.month === target.month;
}

/**
 * DB 脱退一時金相当額を iDeCo 残高へ付け替える。
 * DB は残高口座ではないので withdrawalMan（見込額）を移換額とする。
 */
export function applyDbAmountTransferToIdeco(input: {
  dbEntry: SavingsEntry;
  idecoEntry: SavingsEntry;
  balances: Record<string, number>;
  principals: Record<string, number>;
}): {
  balances: Record<string, number>;
  principals: Record<string, number>;
  transferredMan: number;
} {
  const amount = Math.max(0, Number(input.dbEntry.withdrawalMan) || 0);
  if (amount <= 0) {
    return {
      balances: input.balances,
      principals: input.principals,
      transferredMan: 0,
    };
  }
  const idecoId = input.idecoEntry.id;
  const nextBalances = { ...input.balances };
  const nextPrincipals = { ...input.principals };
  nextBalances[idecoId] = (nextBalances[idecoId] ?? 0) + amount;
  nextPrincipals[idecoId] = (nextPrincipals[idecoId] ?? 0) + amount;
  return {
    balances: nextBalances,
    principals: nextPrincipals,
    transferredMan: amount,
  };
}
