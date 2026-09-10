import type { FamilyMember } from '../types/family';
import type { InsuranceState } from '../types/insurance';
import type { LoanState } from '../types/loan';
import {
  createEmptyHousingTargetData,
  HOUSEHOLD_HOUSING_KEY,
  type HousingState,
  type HousingTargetData,
  type RentalPayerMode,
  type RentalProperty,
} from '../types/housing';

function getTargetData(
  state: HousingState,
  targetId: string,
): HousingTargetData {
  return state.byTarget[targetId] ?? createEmptyHousingTargetData();
}

export function resolveRentalPayerMode(
  rental: RentalProperty,
  storageTargetId?: string,
  headId?: string,
  spouseId?: string,
): RentalPayerMode {
  if (rental.payerMode === 'head' || rental.payerMode === 'spouse' || rental.payerMode === 'both') {
    return rental.payerMode;
  }
  if (spouseId && storageTargetId === spouseId) return 'spouse';
  if (headId && storageTargetId === headId) return 'head';
  return 'head';
}

/** CF に載せる月額家賃（両方負担は合算） */
export function getRentalCfMonthlyRentMan(rental: RentalProperty): number {
  const mode = rental.payerMode ?? 'head';
  if (mode === 'both') {
    return Math.max(0, rental.monthlyRentMan) + Math.max(0, rental.spouseMonthlyRentMan ?? 0);
  }
  return Math.max(0, rental.monthlyRentMan);
}

export function desiredStorageTargetIdForPayerMode(
  mode: RentalPayerMode,
  headId: string,
  spouseId: string | undefined,
): string {
  if (mode === 'spouse' && spouseId) return spouseId;
  return headId;
}

export interface RentalTabView {
  rental: RentalProperty;
  storageTargetId: string;
  /** 居住期間の年齢カレンダー基準（格納先メンバー） */
  periodMemberId: string;
  /** このタブで編集する家賃欄の意味 */
  amountRole: 'primary' | 'spouseShare';
}

/** 表示タブに出す賃貸（両方負担は世帯主格納・配偶者タブにも出す） */
export function listRentalViewsForTarget(
  housingState: HousingState,
  viewTargetId: string,
  headId: string,
  spouseId: string | undefined,
): RentalTabView[] {
  const views: RentalTabView[] = [];
  const local = getTargetData(housingState, viewTargetId).rentals;
  for (const rental of local) {
    views.push({
      rental,
      storageTargetId: viewTargetId,
      periodMemberId: viewTargetId,
      amountRole: 'primary',
    });
  }

  if (spouseId && viewTargetId === spouseId) {
    const headRentals = getTargetData(housingState, headId).rentals;
    for (const rental of headRentals) {
      if (resolveRentalPayerMode(rental, headId, headId, spouseId) !== 'both') {
        continue;
      }
      if (views.some((v) => v.rental.id === rental.id)) continue;
      views.push({
        rental,
        storageTargetId: headId,
        periodMemberId: headId,
        amountRole: 'spouseShare',
      });
    }
  }

  return views;
}

function upsertTargetData(
  byTarget: HousingState['byTarget'],
  targetId: string,
  data: HousingTargetData,
): HousingState['byTarget'] {
  return { ...byTarget, [targetId]: data };
}

function remapLinksForPropertyMove(
  loanState: LoanState,
  insuranceState: InsuranceState | undefined,
  propertyId: string,
  fromTargetId: string,
  toTargetId: string,
): { loanState: LoanState; insuranceState: InsuranceState | undefined } {
  if (fromTargetId === toTargetId) {
    return { loanState, insuranceState };
  }

  const nextLoanByMember: LoanState['byMember'] = {};
  for (const [memberId, entries] of Object.entries(loanState.byMember)) {
    nextLoanByMember[memberId] = entries.map((entry) => {
      if (
        entry.housingLink?.propertyId === propertyId &&
        entry.housingLink.targetId === fromTargetId
      ) {
        return {
          ...entry,
          housingLink: { ...entry.housingLink, targetId: toTargetId },
        };
      }
      return entry;
    });
  }

  let nextInsurance = insuranceState;
  if (insuranceState) {
    const nextByMember: InsuranceState['byMember'] = {};
    for (const [memberId, entries] of Object.entries(insuranceState.byMember)) {
      nextByMember[memberId] = entries.map((entry) => {
        if (
          entry.housingLink?.propertyId === propertyId &&
          entry.housingLink.targetId === fromTargetId
        ) {
          return {
            ...entry,
            housingLink: { ...entry.housingLink, targetId: toTargetId },
          };
        }
        return entry;
      });
    }
    nextInsurance = { ...insuranceState, byMember: nextByMember };
  }

  return {
    loanState: { ...loanState, byMember: nextLoanByMember },
    insuranceState: nextInsurance,
  };
}

/** 家賃負担者変更に合わせて格納タブを移す（期間は同一オブジェクトで連動） */
export function applyRentalPayerModeChange(input: {
  housingState: HousingState;
  loanState: LoanState;
  insuranceState?: InsuranceState;
  storageTargetId: string;
  rentalId: string;
  payerMode: RentalPayerMode;
  headId: string;
  spouseId?: string;
}): {
  housingState: HousingState;
  loanState: LoanState;
  insuranceState?: InsuranceState;
  storageTargetId: string;
} {
  const {
    housingState,
    loanState,
    insuranceState,
    storageTargetId,
    rentalId,
    payerMode,
    headId,
    spouseId,
  } = input;

  const fromData = getTargetData(housingState, storageTargetId);
  const rental = fromData.rentals.find((item) => item.id === rentalId);
  if (!rental) {
    return { housingState, loanState, insuranceState, storageTargetId };
  }

  const desiredTargetId = desiredStorageTargetIdForPayerMode(
    payerMode,
    headId,
    spouseId,
  );

  const nextRental: RentalProperty = {
    ...rental,
    payerMode,
    spouseMonthlyRentMan:
      payerMode === 'both'
        ? (rental.spouseMonthlyRentMan ?? 0)
        : undefined,
  };

  let byTarget = { ...housingState.byTarget };

  if (desiredTargetId === storageTargetId) {
    byTarget = upsertTargetData(byTarget, storageTargetId, {
      ...fromData,
      rentals: fromData.rentals.map((item) =>
        item.id === rentalId ? nextRental : item,
      ),
    });
    return {
      housingState: { ...housingState, byTarget },
      loanState,
      insuranceState,
      storageTargetId,
    };
  }

  const toData = getTargetData(housingState, desiredTargetId);
  byTarget = upsertTargetData(byTarget, storageTargetId, {
    ...fromData,
    rentals: fromData.rentals.filter((item) => item.id !== rentalId),
  });
  byTarget = upsertTargetData(byTarget, desiredTargetId, {
    ...toData,
    rentals: [...toData.rentals, nextRental],
  });

  // 空の旧ご家族キーは掃除
  const emptied = byTarget[storageTargetId];
  if (
    emptied &&
    emptied.rentals.length === 0 &&
    emptied.owned.length === 0 &&
    storageTargetId === HOUSEHOLD_HOUSING_KEY
  ) {
    delete byTarget[storageTargetId];
  }

  const remapped = remapLinksForPropertyMove(
    loanState,
    insuranceState,
    rentalId,
    storageTargetId,
    desiredTargetId,
  );

  return {
    housingState: { ...housingState, byTarget },
    loanState: remapped.loanState,
    insuranceState: remapped.insuranceState,
    storageTargetId: desiredTargetId,
  };
}

export function updateStoredRental(
  housingState: HousingState,
  storageTargetId: string,
  rental: RentalProperty,
): HousingState {
  const data = getTargetData(housingState, storageTargetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, storageTargetId, {
      ...data,
      rentals: data.rentals.map((item) =>
        item.id === rental.id ? rental : item,
      ),
    }),
  };
}

export function removeStoredRental(
  housingState: HousingState,
  storageTargetId: string,
  rentalId: string,
): HousingState {
  const data = getTargetData(housingState, storageTargetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, storageTargetId, {
      ...data,
      rentals: data.rentals.filter((item) => item.id !== rentalId),
    }),
  };
}

export function addRentalToTarget(
  housingState: HousingState,
  targetId: string,
  rental: RentalProperty,
): HousingState {
  const data = getTargetData(housingState, targetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, targetId, {
      ...data,
      rentals: [...data.rentals, rental],
    }),
  };
}

/** 旧ご家族キーの物件を世帯主へ寄せ、ローン/保険リンクも付け替える */
export function migrateHouseholdHousingToHead(input: {
  housingState: HousingState;
  loanState: LoanState;
  insuranceState?: InsuranceState;
  headId: string | null | undefined;
}): {
  housingState: HousingState;
  loanState: LoanState;
  insuranceState?: InsuranceState;
} {
  const { headId } = input;
  if (!headId) {
    return {
      housingState: input.housingState,
      loanState: input.loanState,
      insuranceState: input.insuranceState,
    };
  }

  const household = input.housingState.byTarget[HOUSEHOLD_HOUSING_KEY];
  let housingState = input.housingState;

  if (household) {
    const headData =
      housingState.byTarget[headId] ?? createEmptyHousingTargetData();
    const byTarget = { ...housingState.byTarget };
    byTarget[headId] = {
      rentals: [...headData.rentals, ...household.rentals],
      owned: [...headData.owned, ...household.owned],
    };
    delete byTarget[HOUSEHOLD_HOUSING_KEY];
    housingState = { ...housingState, byTarget };
  }

  // 住まいキー移行後も、リンクだけ旧ご家族のまま残っている場合がある
  const remappedLoans: LoanState['byMember'] = {};
  for (const [memberId, entries] of Object.entries(input.loanState.byMember)) {
    remappedLoans[memberId] = entries.map((entry) => {
      if (entry.housingLink?.targetId === HOUSEHOLD_HOUSING_KEY) {
        return {
          ...entry,
          housingLink: { ...entry.housingLink, targetId: headId },
        };
      }
      return entry;
    });
  }

  let insuranceState = input.insuranceState;
  if (insuranceState) {
    const remappedIns: InsuranceState['byMember'] = {};
    for (const [memberId, entries] of Object.entries(insuranceState.byMember)) {
      remappedIns[memberId] = entries.map((entry) => {
        if (entry.housingLink?.targetId === HOUSEHOLD_HOUSING_KEY) {
          return {
            ...entry,
            housingLink: { ...entry.housingLink, targetId: headId },
          };
        }
        return entry;
      });
    }
    insuranceState = { ...insuranceState, byMember: remappedIns };
  }

  return {
    housingState,
    loanState: { ...input.loanState, byMember: remappedLoans },
    insuranceState,
  };
}

export function defaultPayerModeForTarget(
  targetId: string,
  headId: string,
  spouseId: string | undefined,
): RentalPayerMode {
  if (spouseId && targetId === spouseId) return 'spouse';
  if (targetId === headId) return 'head';
  return 'head';
}

export function memberIdsForHousing(members: FamilyMember[]): {
  headId: string | undefined;
  spouseId: string | undefined;
} {
  return {
    headId: members.find((m) => m.role === 'head')?.id,
    spouseId: members.find((m) => m.role === 'spouse')?.id,
  };
}
