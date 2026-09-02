import type { FamilyMember } from '../types/family';
import type { SavingsEntry } from '../types/savings';
import { getMemberAgeMonth } from './birthDate';
import { isDcCategory } from './dcContribution';
import { isIdecoCategory } from './idecoContributionLimit';
import { IDECO_PAYOUT_MIN_AGE } from './idecoPayout';

/**
 * 企業型DCの拠出終了が受取開始可能年齢（原則60歳）より前か。
 * その場合は企業型に残せないため iDeCo 等への移管が必要。
 */
export function needsDcIdecoTransferOnEnd(
  entry: Pick<SavingsEntry, 'category' | 'endAge'>,
): boolean {
  if (!isDcCategory(entry.category)) return false;
  return Math.max(0, Number(entry.endAge) || 0) < IDECO_PAYOUT_MIN_AGE;
}

/** 企業型DC → iDeCo へ残高を移す年齢月（拠出終了月） */
export function resolveDcIdecoTransferAgeMonth(
  entry: Pick<
    SavingsEntry,
    'category' | 'endAge' | 'endMonth' | 'transferBalanceToIdecoOnEnd'
  >,
): { age: number; month: number } | null {
  if (!entry.transferBalanceToIdecoOnEnd) return null;
  if (!needsDcIdecoTransferOnEnd(entry)) return null;
  return {
    age: Math.max(0, Number(entry.endAge) || 0),
    month: Math.min(12, Math.max(1, Number(entry.endMonth) || 12)),
  };
}

/** 同一メンバーの移管先 iDeCo（先頭） */
export function findIdecoTransferTarget(
  memberEntries: readonly SavingsEntry[],
  dcEntryId: string,
): SavingsEntry | null {
  return (
    memberEntries.find(
      (e) => e.id !== dcEntryId && isIdecoCategory(e.category),
    ) ?? null
  );
}

export function isDcIdecoTransferMonth(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (!isDcCategory(entry.category) || !entry.transferBalanceToIdecoOnEnd) {
    return false;
  }
  if (!needsDcIdecoTransferOnEnd(entry)) return false;
  const target = resolveDcIdecoTransferAgeMonth(entry);
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
 * DC 残高を iDeCo へ付け替える（残高・簿価とも移動）。
 * 移管額（万円）。対象なし／残高0なら 0。
 */
export function applyDcBalanceTransferToIdeco(input: {
  dcEntry: SavingsEntry;
  idecoEntry: SavingsEntry;
  balances: Record<string, number>;
  principals: Record<string, number>;
}): {
  balances: Record<string, number>;
  principals: Record<string, number>;
  transferredMan: number;
} {
  const dcId = input.dcEntry.id;
  const idecoId = input.idecoEntry.id;
  const amount = Math.max(0, input.balances[dcId] ?? 0);
  if (amount <= 0) {
    return {
      balances: input.balances,
      principals: input.principals,
      transferredMan: 0,
    };
  }
  const dcPrincipal = Math.max(0, input.principals[dcId] ?? amount);
  const nextBalances = { ...input.balances };
  const nextPrincipals = { ...input.principals };
  nextBalances[dcId] = 0;
  nextBalances[idecoId] = (nextBalances[idecoId] ?? 0) + amount;
  nextPrincipals[dcId] = 0;
  nextPrincipals[idecoId] = (nextPrincipals[idecoId] ?? 0) + dcPrincipal;
  return {
    balances: nextBalances,
    principals: nextPrincipals,
    transferredMan: amount,
  };
}
