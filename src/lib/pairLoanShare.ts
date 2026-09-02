import type { FamilyMember } from '../types/family';
import type { HousingLinkedLoanView } from '../types/loan';
import type { LoanEntry } from '../types/loan';
import { roundLoanAmountMan } from './housingLoanAmount';

/** ペアローンのデフォルト分担割合（%） */
export const DEFAULT_PAIR_SHARE_PCT = 50;

export const MIN_PAIR_SHARE_PCT = 1;
export const MAX_PAIR_SHARE_PCT = 99;

export function isPairLoanEntry(entry: LoanEntry): boolean {
  return entry.structureType === 'pair' && Boolean(entry.pairGroupId);
}

export function isJointDebtEntry(entry: LoanEntry): boolean {
  return entry.structureType === 'joint_debt';
}

/** ペアローン以外は 100%（全額）扱い */
export function resolvePairSharePct(entry: LoanEntry): number | undefined {
  if (!isPairLoanEntry(entry)) return undefined;
  return entry.pairSharePct ?? DEFAULT_PAIR_SHARE_PCT;
}

/** 連帯債務の主契約者側控除按分（%）。借入額は按分しない */
export function resolveJointDebtPrimaryDeductionSharePct(
  entry: LoanEntry,
): number | undefined {
  if (!isJointDebtEntry(entry)) return undefined;
  return entry.pairSharePct ?? DEFAULT_PAIR_SHARE_PCT;
}

export function resolveJointDebtSpouseDeductionSharePct(
  entry: LoanEntry,
): number | undefined {
  const primaryShare = resolveJointDebtPrimaryDeductionSharePct(entry);
  if (primaryShare == null) return undefined;
  return complementPairSharePct(primaryShare);
}

export function clampPairSharePct(value: number): number {
  return Math.min(MAX_PAIR_SHARE_PCT, Math.max(MIN_PAIR_SHARE_PCT, Math.round(value)));
}

export function complementPairSharePct(sharePct: number): number {
  return 100 - clampPairSharePct(sharePct);
}

/** 世帯共通の諸費用などをペアローン分担割合で按分（万円） */
export function calcPairSharedAmountMan(
  amountMan: number,
  sharePct: number,
): number {
  if (sharePct >= 100) return amountMan;
  if (sharePct <= 0) return 0;
  return roundLoanAmountMan((amountMan * sharePct) / 100);
}

/** Q5 一覧など向けの短い肩書き（夫 / 妻） */
export function formatPairLoanSideShortLabel(
  role: FamilyMember['role'] | string | undefined,
): string {
  if (role === 'head') return '夫';
  if (role === 'spouse') return '妻';
  return '借入者';
}

const PAIR_LOAN_SIDE_ORDER: Record<string, number> = {
  head: 0,
  spouse: 1,
};

function sortPairLoansForDisplay(
  loans: HousingLinkedLoanView[],
): HousingLinkedLoanView[] {
  return [...loans].sort((left, right) => {
    const leftOrder = PAIR_LOAN_SIDE_ORDER[left.contractorRole ?? ''] ?? 9;
    const rightOrder = PAIR_LOAN_SIDE_ORDER[right.contractorRole ?? ''] ?? 9;
    return leftOrder - rightOrder;
  });
}

/** 例: 夫50% / 妻50% */
export function formatJointDebtShareSummary(
  loan: HousingLinkedLoanView,
): string {
  const primaryLabel = formatPairLoanSideShortLabel(loan.contractorRole);
  const primaryShare =
    resolveJointDebtPrimaryDeductionSharePct(loan.entry) ??
    DEFAULT_PAIR_SHARE_PCT;
  const spouseLabel =
    loan.contractorRole === 'head'
      ? '妻'
      : loan.contractorRole === 'spouse'
        ? '夫'
        : '配偶者';
  const spouseShare = complementPairSharePct(primaryShare);
  return `${primaryLabel}${primaryShare}% / ${spouseLabel}${spouseShare}%`;
}

/** 例: 夫50% / 妻50% */
export function formatPairLoanShareSummary(
  pairLoans: HousingLinkedLoanView[],
): string {
  return sortPairLoansForDisplay(pairLoans)
    .map((loan) => {
      const sideLabel = formatPairLoanSideShortLabel(loan.contractorRole);
      const sharePct = resolvePairSharePct(loan.entry) ?? DEFAULT_PAIR_SHARE_PCT;
      return `${sideLabel}${sharePct}%`;
    })
    .join(' / ');
}

export interface HousingLoanLinkDisplayRow {
  key: string;
  meta: string;
  editEntryId: string;
  removeEntryIds: string[];
}

function resolveHousingLoanEditEntryId(
  group: HousingLinkedLoanView[],
): string {
  const headEntry = group.find((item) => item.contractorRole === 'head');
  return headEntry?.entry.id ?? group[0].entry.id;
}

/** Q5 ローン一覧用。ペアローンは1行にまとめて分担を表示する */
export function buildHousingLoanLinkDisplayRows(
  loans: HousingLinkedLoanView[],
): HousingLoanLinkDisplayRow[] {
  const pairGroups = new Map<string, HousingLinkedLoanView[]>();
  const rows: HousingLoanLinkDisplayRow[] = [];
  const handledPairGroupIds = new Set<string>();

  for (const loan of loans) {
    const pairGroupId = loan.entry.pairGroupId;
    if (isPairLoanEntry(loan.entry) && pairGroupId) {
      const group = pairGroups.get(pairGroupId) ?? [];
      group.push(loan);
      pairGroups.set(pairGroupId, group);
    }
  }

  for (const loan of loans) {
    const pairGroupId = loan.entry.pairGroupId;
    if (isPairLoanEntry(loan.entry) && pairGroupId) {
      if (handledPairGroupIds.has(pairGroupId)) continue;
      handledPairGroupIds.add(pairGroupId);

      const group = pairGroups.get(pairGroupId) ?? [];
      if (group.length >= 2) {
        rows.push({
          key: `pair-${pairGroupId}`,
          meta: `ペアローン · ${formatPairLoanShareSummary(group)}`,
          editEntryId: resolveHousingLoanEditEntryId(group),
          removeEntryIds: group.map((item) => item.entry.id),
        });
        continue;
      }
    }

    if (isJointDebtEntry(loan.entry)) {
      rows.push({
        key: loan.entry.id,
        meta: `連帯債務 · ${formatJointDebtShareSummary(loan)}`,
        editEntryId: loan.entry.id,
        removeEntryIds: [loan.entry.id],
      });
      continue;
    }

    rows.push({
      key: loan.entry.id,
      meta: `契約者：${loan.contractorLabel}`,
      editEntryId: loan.entry.id,
      removeEntryIds: [loan.entry.id],
    });
  }

  return rows;
}
