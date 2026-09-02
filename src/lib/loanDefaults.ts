import {
  DEFAULT_PAIR_SHARE_PCT,
} from './pairLoanShare';
import { createOwnedPropertyLoanSettings } from './housingDefaults';
import {
  DEFAULT_NON_HOUSING_REPAYMENT_COUNT,
  yearsFromRepaymentCount,
} from './loanInterestRatePeriod';
import {
  LOAN_CATEGORY_DEFAULT_NAMES,
  formatHousingLoanName,
  formatVehicleLoanName,
} from './loanLabels';
import { resolveLoanPaymentMode } from './loanPaymentMode';
import type { FamilyMember } from '../types/family';
import type { OwnedPropertyLoanSettings } from '../types/housing';
import type {
  HousingLoanLink,
  LoanByMember,
  LoanCategory,
  LoanEntry,
  LoanState,
  LoanStructureType,
  VehicleLoanLink,
} from '../types/loan';

function createId(): string {
  return crypto.randomUUID();
}

export function createDefaultLoanState(): LoanState {
  return { byMember: {} };
}

/** 旧エントリへの paymentMode 等の補完 */
export function normalizeLoanEntry(entry: LoanEntry): LoanEntry {
  return {
    ...entry,
    paymentMode: resolveLoanPaymentMode(entry),
    monthlyRepaymentMan: entry.monthlyRepaymentMan ?? 0,
    repaymentStartYear: entry.repaymentStartYear ?? 0,
    repaymentStartMonth: entry.repaymentStartMonth ?? 0,
    repaymentEndYear: entry.repaymentEndYear ?? 0,
    repaymentEndMonth: entry.repaymentEndMonth ?? 0,
  };
}

function normalizeLoanByMember(byMember: LoanByMember): LoanByMember {
  const next: LoanByMember = {};
  for (const [memberId, entries] of Object.entries(byMember)) {
    next[memberId] = entries.map(normalizeLoanEntry);
  }
  return next;
}

/** 旧形式 `{ entries: [] }` からの移行 */
export function migrateLoanState(state: LoanState | { entries?: LoanEntry[] }): LoanState {
  if ('byMember' in state && state.byMember) {
    return { byMember: normalizeLoanByMember(state.byMember) };
  }
  if ('entries' in state && Array.isArray(state.entries) && state.entries.length > 0) {
    return {
      byMember: normalizeLoanByMember({ __legacy__: state.entries }),
    };
  }
  return createDefaultLoanState();
}

export function getAllLoanEntries(state: LoanState): LoanEntry[] {
  return Object.values(state.byMember).flat();
}

export function getMemberLoanEntries(
  state: LoanState,
  memberId: string,
): LoanEntry[] {
  return state.byMember[memberId] ?? [];
}

export function getLoanEntryCounts(
  state: LoanState,
  memberIds: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const memberId of memberIds) {
    counts[memberId] = state.byMember[memberId]?.length ?? 0;
  }
  return counts;
}

export function findLoanEntryBucket(
  state: LoanState,
  entryId: string,
): { memberId: string; entries: LoanEntry[] } | undefined {
  for (const [memberId, entries] of Object.entries(state.byMember)) {
    if (entries.some((entry) => entry.id === entryId)) {
      return { memberId, entries };
    }
  }
  return undefined;
}

export function updateLoanByMember(
  state: LoanState,
  memberId: string,
  entries: LoanEntry[],
): LoanState {
  const byMember: LoanByMember = { ...state.byMember };
  if (entries.length === 0) {
    delete byMember[memberId];
  } else {
    byMember[memberId] = entries;
  }
  return { ...state, byMember };
}

export function removeLoanEntry(state: LoanState, entryId: string): LoanState {
  const bucket = findLoanEntryBucket(state, entryId);
  if (!bucket) return state;
  return updateLoanByMember(
    state,
    bucket.memberId,
    bucket.entries.filter((entry) => entry.id !== entryId),
  );
}

export function updateLoanEntry(
  state: LoanState,
  entry: LoanEntry,
): LoanState {
  const bucket = findLoanEntryBucket(state, entry.id);
  if (!bucket) return state;
  return updateLoanByMember(
    state,
    bucket.memberId,
    bucket.entries.map((current) =>
      current.id === entry.id ? entry : current,
    ),
  );
}

export function resolveLoanContractorMember(
  state: LoanState,
  members: FamilyMember[],
  entryId: string,
): FamilyMember | undefined {
  const bucket = findLoanEntryBucket(state, entryId);
  if (!bucket) return undefined;
  const headMember = members.find((member) => member.role === 'head');
  const contractorId =
    bucket.memberId === '__legacy__' ? headMember?.id : bucket.memberId;
  return members.find((member) => member.id === contractorId);
}

export function createLoanEntry(
  category: LoanCategory,
  overrides: Partial<LoanEntry> = {},
): LoanEntry {
  const isHousing = category === 'housing';
  const settings = isHousing
    ? createOwnedPropertyLoanSettings()
    : createOwnedPropertyLoanSettings({
        repaymentCount: DEFAULT_NON_HOUSING_REPAYMENT_COUNT,
        years: yearsFromRepaymentCount(DEFAULT_NON_HOUSING_REPAYMENT_COUNT),
      });

  return {
    id: createId(),
    category,
    name: LOAN_CATEGORY_DEFAULT_NAMES[category],
    settings,
    note: '',
    paymentMode: 'loanSettings',
    monthlyRepaymentMan: 0,
    repaymentStartYear: 0,
    repaymentStartMonth: 0,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    structureType: isHousing ? 'sole' : undefined,
    ...overrides,
  };
}

/** 借入形態に応じて Q9 用の住宅ローンエントリを生成 */
export function createHousingLoanEntriesForStructure(
  structureType: LoanStructureType,
  contractorMemberIds: [string, string] | [string],
): LoanEntry[] {
  if (structureType === 'pair' && contractorMemberIds.length === 2) {
    const pairGroupId = createId();
    return contractorMemberIds.map((_, index) =>
      createLoanEntry('housing', {
        structureType: 'pair',
        pairGroupId,
        pairSharePct: DEFAULT_PAIR_SHARE_PCT,
        name: `${LOAN_CATEGORY_DEFAULT_NAMES.housing}（${index + 1}本目）`,
      }),
    );
  }

  return [
    createLoanEntry('housing', {
      structureType,
      ...(structureType === 'joint_debt'
        ? { pairSharePct: DEFAULT_PAIR_SHARE_PCT }
        : {}),
    }),
  ];
}

/** 借入形態に応じて LoanState に住宅ローンを追加 */
export function addHousingLoanWithStructure(
  state: LoanState,
  structureType: LoanStructureType,
  contractorMemberIds: [string, string] | [string],
): LoanState {
  const entries = createHousingLoanEntriesForStructure(
    structureType,
    contractorMemberIds,
  );

  if (structureType === 'pair' && contractorMemberIds.length === 2) {
    let next = state;
    entries.forEach((entry, index) => {
      const memberId = contractorMemberIds[index];
      const current = getMemberLoanEntries(next, memberId);
      next = updateLoanByMember(next, memberId, [...current, entry]);
    });
    return next;
  }

  const memberId = contractorMemberIds[0];
  const current = getMemberLoanEntries(state, memberId);
  return updateLoanByMember(state, memberId, [...current, entries[0]]);
}

export function createHousingLoanEntry(
  propertyName: string,
  housingLink: HousingLoanLink,
  settingsOverrides: Partial<OwnedPropertyLoanSettings> = {},
  entryOverrides: Partial<LoanEntry> = {},
): LoanEntry {
  return createLoanEntry('housing', {
    name: formatHousingLoanName(propertyName),
    settings: createOwnedPropertyLoanSettings(settingsOverrides),
    housingLink,
    ...entryOverrides,
  });
}

/** Q5 所有物件に紐づく住宅ローンを借入形態に応じて追加 */
export function addOwnedPropertyHousingLoanWithStructure(
  state: LoanState,
  structureType: LoanStructureType,
  contractorMemberIds: [string, string] | [string],
  housingLink: HousingLoanLink,
  propertyName: string,
): LoanState {
  const loanName = formatHousingLoanName(propertyName);

  if (structureType === 'pair' && contractorMemberIds.length === 2) {
    const pairGroupId = createId();
    const entries = contractorMemberIds.map((_, index) =>
      createHousingLoanEntry(
        propertyName,
        housingLink,
        {},
        {
          structureType: 'pair',
          pairGroupId,
          pairSharePct: DEFAULT_PAIR_SHARE_PCT,
          name: `${loanName}（${index + 1}本目）`,
        },
      ),
    );
    let next = state;
    entries.forEach((entry, index) => {
      const memberId = contractorMemberIds[index];
      const current = getMemberLoanEntries(next, memberId);
      next = updateLoanByMember(next, memberId, [...current, entry]);
    });
    return next;
  }

  const memberId = contractorMemberIds[0];
  const entry = createHousingLoanEntry(propertyName, housingLink, {}, {
    structureType,
    ...(structureType === 'joint_debt'
      ? { pairSharePct: DEFAULT_PAIR_SHARE_PCT }
      : {}),
  });
  const current = getMemberLoanEntries(state, memberId);
  return updateLoanByMember(state, memberId, [...current, entry]);
}

export function createVehicleLoanEntry(
  vehicleName: string,
  vehicleLink: VehicleLoanLink,
  purchaseAmountMan = 0,
  entryOverrides: Partial<LoanEntry> = {},
): LoanEntry {
  return createLoanEntry('vehicle', {
    name: formatVehicleLoanName(vehicleName),
    vehicleLink,
    settings: createOwnedPropertyLoanSettings({
      repaymentCount: DEFAULT_NON_HOUSING_REPAYMENT_COUNT,
      years: yearsFromRepaymentCount(DEFAULT_NON_HOUSING_REPAYMENT_COUNT),
      amountMan: Math.max(0, Math.round(purchaseAmountMan)),
    }),
    ...entryOverrides,
  });
}

/** Q6 乗り物に紐づく自動車ローンを追加 */
export function addVehicleLoanForMember(
  state: LoanState,
  memberId: string,
  vehicleId: string,
  vehicleName: string,
  purchaseAmountMan = 0,
): LoanState {
  const entry = createVehicleLoanEntry(vehicleName, { memberId, vehicleId }, purchaseAmountMan);
  const current = getMemberLoanEntries(state, memberId);
  return updateLoanByMember(state, memberId, [...current, entry]);
}
