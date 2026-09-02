import { resolveMemberAge } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type {
  SavingsByMember,
  SavingsCategory,
  SavingsContributionMode,
  SavingsEntry,
  SavingsState,
} from '../types/savings';
import type { IncomeEntry } from '../types/income';
import {
  CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN,
  ensureIdecoFields,
  isIdecoCategory,
  memberHasCorporateDcEntry,
  memberHasDbEntry,
  reconcileMemberIdecoCorporatePensions,
  syncIdecoCorporateDcFlags,
  syncIdecoHasDbFlags,
  yenToMan,
} from './idecoContributionLimit';
import { createDefaultDbEnrollmentFields, ensureDbEnrollmentFields } from './dbEnrollment';
import { CORPORATE_PENSION_PAYOUT_DEFAULT_AGE } from './idecoPayout';
import { ensureDcContributionFields } from './dcContribution';
import { ensureNisaFields, isNisaCategory, normalizeSavingsEntry } from './nisaQuota';
import { ensureTaxableFields } from './taxableCapitalGains';
import { ensureTimeDepositFields, isTimeDepositCategory, TIME_DEPOSIT_DEFAULT_TERM_YEARS } from './timeDeposit';
import { getIncomeEligibleMembers } from './memberDisplay';
import {
  SAVINGS_CATEGORY_DEFAULT_NAMES,
  SAVINGS_CATEGORY_DEFAULT_RETURN_PCT,
  SAVINGS_CATEGORY_SECTOR,
  resolveDefaultSavingsContributionEndAge,
} from './savingsLabels';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

export {
  memberHasCorporateDcEntry,
  memberHasDbEntry,
  reconcileMemberIdecoCorporatePensions,
  syncIdecoCorporateDcFlags,
  syncIdecoHasDbFlags,
};

function createId(): string {
  return crypto.randomUUID();
}

export function createDefaultSavingsState(): SavingsState {
  return {
    byMember: {},
  };
}

export function getAllSavingsEntries(state: SavingsState): SavingsEntry[] {
  return Object.values(state.byMember).flat();
}

export function getMemberSavingsEntries(
  state: SavingsState,
  memberId: string,
): SavingsEntry[] {
  return state.byMember[memberId] ?? [];
}

export function getSavingsEntryCounts(
  state: SavingsState,
  memberIds: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const memberId of memberIds) {
    counts[memberId] = state.byMember[memberId]?.length ?? 0;
  }
  return counts;
}

export function findSavingsEntryBucket(
  state: SavingsState,
  entryId: string,
): { memberId: string; entries: SavingsEntry[] } | undefined {
  for (const [memberId, entries] of Object.entries(state.byMember)) {
    if (entries.some((entry) => entry.id === entryId)) {
      return { memberId, entries };
    }
  }
  return undefined;
}

export function updateSavingsByMember(
  state: SavingsState,
  memberId: string,
  entries: SavingsEntry[],
): SavingsState {
  const byMember: SavingsByMember = { ...state.byMember };
  if (entries.length === 0) {
    delete byMember[memberId];
  } else {
    byMember[memberId] = entries;
  }
  return { ...state, byMember };
}

export function removeSavingsEntry(
  state: SavingsState,
  entryId: string,
): SavingsState {
  const bucket = findSavingsEntryBucket(state, entryId);
  if (!bucket) return state;
  return updateSavingsByMember(
    state,
    bucket.memberId,
    bucket.entries.filter((entry) => entry.id !== entryId),
  );
}

function defaultContributionMode(
  category: SavingsCategory,
): SavingsContributionMode {
  if (SAVINGS_CATEGORY_SECTOR[category] === 'deposit') {
    return 'none';
  }
  return 'monthly';
}

function defaultContributionMan(category: SavingsCategory): number {
  if (category === 'nisa_tsumitate' || category === 'ideco' || category === 'dc') {
    return 3;
  }
  if (category === 'nisa_growth') {
    return 1;
  }
  if (category === 'taxable' || category === 'invest_other') {
    return 1;
  }
  return 0;
}

export function createSavingsEntry(
  category: SavingsCategory,
  member: FamilyMember,
  referenceDate: Date,
  overrides: Partial<SavingsEntry> = {},
): SavingsEntry {
  const referenceMonth = referenceDate.getMonth() + 1;
  const defaultStart = resolveDefaultStartAgeMonth(member.age, referenceMonth);
  const endMode = 'until';
  const endAge = resolveDefaultSavingsContributionEndAge({
    age: resolveMemberAge(member),
    expectedLifespan: member.expectedLifespan,
  });

  const base: SavingsEntry = {
    id: createId(),
    category,
    name: SAVINGS_CATEGORY_DEFAULT_NAMES[category],
    balanceMan: 0,
    contributionMan: defaultContributionMan(category),
    contributionMode: defaultContributionMode(category),
    expectedReturnRatePct: SAVINGS_CATEGORY_DEFAULT_RETURN_PCT[category],
    startAge: defaultStart.startAge,
    startMonth: defaultStart.startMonth,
    endMode,
    endAge,
    endMonth: 12,
    ...overrides,
  };

  if (isNisaCategory(category)) {
    return ensureNisaFields({
      ...base,
      nisaUtilization: 'new',
      nisaValuationMode: 'rate',
      principalMan: 0,
      gainsMan: 0,
      nisaCurrentReturnRatePct: 0,
      withdrawalMode: 'none',
      withdrawalMan: 0,
      withdrawalStartAge: defaultStart.startAge,
      withdrawalStartMonth: defaultStart.startMonth,
      withdrawalEndMode: 'lifetime',
      withdrawalEndAge: member.expectedLifespan,
      withdrawalEndMonth: 12,
      ...overrides,
    });
  }

  if (category === 'taxable') {
    return ensureTaxableFields({
      ...base,
      taxableUtilization: 'new',
      nisaValuationMode: 'rate',
      principalMan: 0,
      gainsMan: 0,
      nisaCurrentReturnRatePct: 0,
      withdrawalMode: 'none',
      withdrawalMan: 0,
      withdrawalStartAge: defaultStart.startAge,
      withdrawalStartMonth: defaultStart.startMonth,
      withdrawalEndMode: 'lifetime',
      withdrawalEndAge: member.expectedLifespan,
      withdrawalEndMonth: 12,
      ...overrides,
    });
  }

  if (isTimeDepositCategory(category)) {
    return ensureTimeDepositFields({
      ...base,
      termYears: TIME_DEPOSIT_DEFAULT_TERM_YEARS,
      contributionMode: 'none',
      contributionMan: 0,
      ...overrides,
    });
  }

  if (isIdecoCategory(category)) {
    return ensureIdecoFields({
      ...base,
      hasCorporateDc: false,
      hasDb: false,
      withdrawalMode: 'once',
      withdrawalMan: 0,
      ...overrides,
    });
  }

  if (category === 'dc') {
    const withPayout = {
      ...base,
      withdrawalMode: 'once' as const,
      withdrawalMan: 0,
      withdrawalStartAge: endAge,
      withdrawalStartMonth: 12,
      // employer* は未設定のまま ensure に任せ、contribution*（overrides 含む）から移行
      employeeContributionMode: 'none' as const,
      employeeContributionMan: 0,
      ...overrides,
    };
    return ensureDcContributionFields(withPayout, member);
  }

  if (category === 'db') {
    const payoutAge = Math.max(
      resolveMemberAge(member),
      CORPORATE_PENSION_PAYOUT_DEFAULT_AGE,
    );
    return ensureDbEnrollmentFields(
      {
        ...base,
        balanceMan: 0,
        contributionMan: 0,
        contributionMode: 'none',
        expectedReturnRatePct: 0,
        withdrawalMode: 'once',
        withdrawalMan: 0,
        withdrawalStartAge: payoutAge,
        withdrawalStartMonth: 1,
        withdrawalEndMode: 'until',
        withdrawalEndAge: payoutAge,
        withdrawalEndMonth: 1,
        otherSystemContributionMan: yenToMan(
          CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN,
        ),
        ...createDefaultDbEnrollmentFields(member, payoutAge, 1),
        ...overrides,
      },
      member,
    );
  }

  return base;
}

/**
 * 企業型DCの加入有無を口座の有無と一致させる。
 * あり → 空の企業型DC口座を作成（なければ）
 * なし → 企業型DC口座をすべて削除し、iDeCo掛金を新上限へクランプ
 */
export function setMemberCorporateDcEnrollment(
  entries: SavingsEntry[],
  enabled: boolean,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry[] {
  let next = entries;
  if (enabled) {
    if (!memberHasCorporateDcEntry(next)) {
      next = [
        ...next,
        ensureDcContributionFields(
          createSavingsEntry('dc', member, referenceDate, {
            balanceMan: 0,
            contributionMan: 0,
            contributionMode: 'none',
            employerContributionMode: 'none',
            employerContributionMan: 0,
            employeeContributionMode: 'none',
            employeeContributionMan: 0,
          }),
          member,
          { incomeEntries, referenceDate },
        ),
      ];
    }
  } else {
    next = next.filter((entry) => entry.category !== 'dc');
  }
  return reconcileMemberIdecoCorporatePensions(
    next,
    member,
    incomeEntries,
    referenceDate,
  );
}

/**
 * DB（確定給付）の加入有無を口座の有無と一致させる。
 * あり → 空の DB 口座を作成（なければ）
 * なし → DB 口座をすべて削除し、iDeCo掛金を新上限へクランプ
 */
export function setMemberDbEnrollment(
  entries: SavingsEntry[],
  enabled: boolean,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry[] {
  let next = entries;
  if (enabled) {
    if (!memberHasDbEntry(next)) {
      next = [...next, createSavingsEntry('db', member, referenceDate)];
    }
  } else {
    next = next.filter((entry) => entry.category !== 'db');
  }
  return reconcileMemberIdecoCorporatePensions(
    next,
    member,
    incomeEntries,
    referenceDate,
  );
}

/** @deprecated use setMemberDbEnrollment */
export function setMemberIdecoHasDb(
  entries: SavingsEntry[],
  hasDb: boolean,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry[] {
  return setMemberDbEnrollment(
    entries,
    hasDb,
    member,
    incomeEntries,
    referenceDate,
  );
}

/** 収入対象メンバーに紐づかない口座を除去し、NISA 等を正規化 */
export function syncSavingsWithFamily(
  members: FamilyMember[],
  state: SavingsState,
): SavingsState {
  const eligibleIds = new Set(
    getIncomeEligibleMembers(members).map((member) => member.id),
  );
  const normalized = normalizeSavingsState(state);
  let changed = normalized !== state;
  const byMember: SavingsByMember = {};
  for (const [memberId, entries] of Object.entries(normalized.byMember)) {
    if (!eligibleIds.has(memberId)) {
      changed = true;
      continue;
    }
    byMember[memberId] = entries;
  }
  if (Object.keys(byMember).length !== Object.keys(normalized.byMember).length) {
    changed = true;
  }
  return changed ? { ...normalized, byMember } : state;
}

export function normalizeSavingsState(state: SavingsState): SavingsState {
  let changed = false;
  const byMember: SavingsByMember = {};
  for (const [memberId, entries] of Object.entries(state.byMember)) {
    const normalized = entries.map(normalizeSavingsEntry);
    if (
      normalized.some(
        (entry, index) => JSON.stringify(entry) !== JSON.stringify(entries[index]),
      )
    ) {
      changed = true;
    }
    byMember[memberId] = normalized;
  }
  return changed ? { ...state, byMember } : state;
}
