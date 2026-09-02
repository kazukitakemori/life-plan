import type { FamilyMember } from "../types/family";

import type {
  HousingState,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from "../types/housing";

import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  VehicleLinkedLoanView,
} from "../types/loan";

import type { VehicleEntry, VehicleState } from "../types/vehicle";

import {
  findLoanEntryBucket,
  getAllLoanEntries,
  removeLoanEntry,
  updateLoanByMember,
} from "./loanDefaults";

import {
  calcHousingLoanBankFeesInitialMan,
  calcHousingLoanTotalAmountMan,
  roundLoanAmountMan,
  type HousingLoanAmountOptions,
} from "./housingLoanAmount";

import { applyPairLinkedFeeInclusionSettings } from "./housingLoanFeeInclusion";

import { formatHousingLoanName, formatVehicleLoanName } from "./loanLabels";

import { getMemberTabLabel } from "./memberDisplay";

import {
  clampPairSharePct,
  complementPairSharePct,
  isJointDebtEntry,
  isPairLoanEntry,
  resolvePairSharePct,
} from "./pairLoanShare";

export function findPairPartnerEntry(
  loanState: LoanState,

  entry: LoanEntry,
): LoanEntry | undefined {
  if (entry.structureType !== "pair" || !entry.pairGroupId) {
    return undefined;
  }

  return getAllLoanEntries(loanState).find(
    (candidate) =>
      candidate.id !== entry.id && candidate.pairGroupId === entry.pairGroupId,
  );
}

export function getLoanContractorMemberId(
  loanState: LoanState,

  entry: LoanEntry,

  headMemberId?: string,
): string | undefined {
  const bucket = findLoanEntryBucket(loanState, entry.id);

  if (!bucket) return undefined;

  if (bucket.memberId === "__legacy__") {
    return headMemberId;
  }

  return bucket.memberId;
}

export function getLoansForHousingProperty(
  loanState: LoanState,

  targetId: string,

  propertyId: string,
): LoanEntry[] {
  return getAllLoanEntries(loanState).filter(
    (entry) =>
      entry.housingLink?.targetId === targetId &&
      entry.housingLink?.propertyId === propertyId,
  );
}

export function getHousingLinkedLoansForProperty(
  loanState: LoanState,

  members: FamilyMember[],

  targetId: string,

  propertyId: string,
): HousingLinkedLoanView[] {
  const memberById = Object.fromEntries(
    members.map((member) => [member.id, member]),
  );

  const headMember = members.find((member) => member.role === "head");

  return getLoansForHousingProperty(loanState, targetId, propertyId).map(
    (entry) => {
      const bucket = findLoanEntryBucket(loanState, entry.id);

      const contractorId =
        bucket?.memberId === "__legacy__" ? headMember?.id : bucket?.memberId;

      const contractor = contractorId ? memberById[contractorId] : headMember;

      return {
        entry,

        contractorLabel: contractor ? getMemberTabLabel(contractor) : "—",

        contractorRole: contractor?.role,
        contractorId: contractor?.id,
      };
    },
  );
}

export function getLoansForVehicle(
  loanState: LoanState,
  memberId: string,
  vehicleId: string,
): LoanEntry[] {
  return getAllLoanEntries(loanState).filter(
    (entry) =>
      entry.vehicleLink?.memberId === memberId &&
      entry.vehicleLink?.vehicleId === vehicleId,
  );
}

export function getVehicleLinkedLoans(
  loanState: LoanState,
  members: FamilyMember[],
  memberId: string,
  vehicleId: string,
): VehicleLinkedLoanView[] {
  const memberById = Object.fromEntries(
    members.map((member) => [member.id, member]),
  );
  const headMember = members.find((member) => member.role === "head");

  return getLoansForVehicle(loanState, memberId, vehicleId).map((entry) => {
    const bucket = findLoanEntryBucket(loanState, entry.id);
    const contractorId =
      bucket?.memberId === "__legacy__" ? headMember?.id : bucket?.memberId;
    const contractor = contractorId ? memberById[contractorId] : headMember;

    return {
      entry,
      contractorLabel: contractor ? getMemberTabLabel(contractor) : "—",
      contractorRole: contractor?.role,
      contractorId: contractor?.id,
    };
  });
}

/** Q5 から削除する際、ペアローンは夫婦2本をまとめて削除する */
export function removeHousingLoanEntry(
  loanState: LoanState,
  entryId: string,
): LoanState {
  const entry = getAllLoanEntries(loanState).find(
    (item) => item.id === entryId,
  );
  const partner =
    entry && isPairLoanEntry(entry)
      ? findPairPartnerEntry(loanState, entry)
      : undefined;

  let next = removeLoanEntry(loanState, entryId);
  if (partner) {
    next = removeLoanEntry(next, partner.id);
  }
  return next;
}

/**
 * 物件に紐づく融資契約（CF・借入合計の対象）。
 * ペア・非ペアを問わずリンク済みをすべて含める（1本目だけに落とさない）。
 */
export function resolveHousingPropertyFinanceLoans(
  linked: LoanEntry[],
): LoanEntry[] {
  return linked;
}

/**
 * 物件価格から借入額を算出するか、契約の amountMan を使うか。
 * - ペア契約: 常に物件×分担
 * - 非ペアが物件に1本だけ: 物件価格ベース
 * - 非ペアが2本以上、またはペアと併存: 明示の amountMan（二重計上防止）
 */
export function usesPropertyDerivedLoanAmount(
  entry: LoanEntry,
  financeLoans: LoanEntry[],
): boolean {
  if (isPairLoanEntry(entry)) return true;
  const nonPairCount = financeLoans.filter((e) => !isPairLoanEntry(e)).length;
  const pairCount = financeLoans.filter((e) => isPairLoanEntry(e)).length;
  return nonPairCount === 1 && pairCount === 0 && financeLoans.length === 1;
}

function toAmountOptions(
  entry: LoanEntry,
): HousingLoanAmountOptions | undefined {
  const pairSharePct = resolvePairSharePct(entry);
  return pairSharePct == null ? undefined : { pairSharePct };
}

export function calcLoanEntryAmountMan(
  property: OwnedProperty,
  entry: LoanEntry,
  financeLoans?: LoanEntry[],
): number {
  const all = financeLoans ?? [entry];
  if (!usesPropertyDerivedLoanAmount(entry, all)) {
    return Math.max(0, roundLoanAmountMan(entry.settings.amountMan ?? 0));
  }
  return calcHousingLoanTotalAmountMan(
    property,
    entry.settings,
    toAmountOptions(entry),
  );
}

/** 償却・残債計算用オプション（按分 or 明示元本） */
export function toLoanEntryAmountOptions(
  property: OwnedProperty,
  entry: LoanEntry,
  financeLoans: LoanEntry[],
): HousingLoanAmountOptions | undefined {
  if (!usesPropertyDerivedLoanAmount(entry, financeLoans)) {
    return {
      principalOverrideMan: calcLoanEntryAmountMan(
        property,
        entry,
        financeLoans,
      ),
    };
  }
  return toAmountOptions(entry);
}

/** 物件に紐づく住宅ローンの世帯合計借入額（万円） */
export function calcHousingPropertyTotalLoanAmountMan(
  property: OwnedProperty,
  loanState?: LoanState,
  targetId?: string,
): number {
  if (!loanState || !targetId) {
    return calcHousingLoanTotalAmountMan(property, property.loan);
  }

  const financeLoans = resolveHousingPropertyFinanceLoans(
    getLoansForHousingProperty(loanState, targetId, property.id),
  );
  if (financeLoans.length > 0) {
    return financeLoans.reduce(
      (sum, entry) =>
        sum + calcLoanEntryAmountMan(property, entry, financeLoans),
      0,
    );
  }

  return calcHousingLoanTotalAmountMan(property, property.loan);
}

/** 物件に紐づく住宅ローンの初回支払い諸手数料合計（万円）。ペアローンは契約ごとに合算 */
export function calcHousingPropertyBankFeesInitialMan(
  property: OwnedProperty,
  loanState?: LoanState,
  targetId?: string,
  fallbackSettings?: OwnedPropertyLoanSettings,
): number {
  const fallback = fallbackSettings ?? property.loan;

  if (!loanState || !targetId) {
    return calcHousingLoanBankFeesInitialMan(fallback);
  }

  const financeLoans = resolveHousingPropertyFinanceLoans(
    getLoansForHousingProperty(loanState, targetId, property.id),
  );
  if (financeLoans.length > 0) {
    return financeLoans.reduce(
      (sum, entry) => sum + calcHousingLoanBankFeesInitialMan(entry.settings),
      0,
    );
  }

  return calcHousingLoanBankFeesInitialMan(fallback);
}

export function resolveOwnedPropertyLoanSettings(
  property: OwnedProperty,

  loanState: LoanState | undefined,

  targetId: string,
): OwnedPropertyLoanSettings {
  if (loanState) {
    const linked = getLoansForHousingProperty(loanState, targetId, property.id);

    if (linked.length > 0) {
      return linked[0].settings;
    }
  }

  return property.loan;
}

export function getLinkedHousingProperty(
  housingState: HousingState,

  entry: LoanEntry,
): OwnedProperty | undefined {
  if (!entry.housingLink) return undefined;

  const data = housingState.byTarget[entry.housingLink.targetId];

  return data?.owned.find((p) => p.id === entry.housingLink?.propertyId);
}

export function getLinkedAcquisitionAmountMan(
  housingState: HousingState,
  entry: LoanEntry,
  loanState?: LoanState,
): number | undefined {
  const property = getLinkedHousingProperty(housingState, entry);
  if (!property || !entry.housingLink) return undefined;
  const financeLoans =
    loanState != null
      ? resolveHousingPropertyFinanceLoans(
          getLoansForHousingProperty(
            loanState,
            entry.housingLink.targetId,
            entry.housingLink.propertyId,
          ),
        )
      : [entry];
  return calcLoanEntryAmountMan(
    property,
    entry,
    financeLoans.length > 0 ? financeLoans : [entry],
  );
}

export function getLinkedVehicle(
  vehicleState: VehicleState,

  entry: LoanEntry,
): VehicleEntry | undefined {
  if (!entry.vehicleLink) return undefined;

  const { memberId, vehicleId } = entry.vehicleLink;

  return vehicleState.byMember[memberId]?.find(
    (vehicle) => vehicle.id === vehicleId,
  );
}

/** Q6 購入費用から自動車ローン借入額を求める */
export function calcVehicleLoanEntryAmountMan(vehicle: VehicleEntry): number {
  return Math.max(0, Math.round(vehicle.purchaseAmountMan));
}

export function getLinkedVehiclePurchaseAmountMan(
  vehicleState: VehicleState,

  entry: LoanEntry,
): number | undefined {
  const vehicle = getLinkedVehicle(vehicleState, entry);

  if (!vehicle) return undefined;

  return calcVehicleLoanEntryAmountMan(vehicle);
}

function syncEntryAmountFromAcquisition(
  property: OwnedProperty,
  entry: LoanEntry,
  financeLoans: LoanEntry[],
): LoanEntry {
  // 複数非ペアなど明示額モードでは amountMan を上書きしない
  if (!usesPropertyDerivedLoanAmount(entry, financeLoans)) {
    return {
      ...entry,
      name: formatHousingLoanName(property.name),
    };
  }
  const amountMan = calcLoanEntryAmountMan(property, entry, financeLoans);
  return {
    ...entry,
    name: formatHousingLoanName(property.name),
    settings: { ...entry.settings, amountMan },
  };
}

function syncEntryAmountFromVehiclePurchase(
  vehicle: VehicleEntry,
  entry: LoanEntry,
): LoanEntry {
  const amountMan = calcVehicleLoanEntryAmountMan(vehicle);
  return {
    ...entry,
    name: formatVehicleLoanName(vehicle.label),
    settings: { ...entry.settings, amountMan },
  };
}

/** 住宅ローンの借入金額を物件価格・諸費用設定に合わせる */
export function syncHousingLoanAmountsFromAcquisition(
  housingState: HousingState,
  loanState: LoanState,
): LoanState {
  const financeLoansByProperty = new Map<string, LoanEntry[]>();
  for (const entry of getAllLoanEntries(loanState)) {
    if (!entry.housingLink) continue;
    const key = `${entry.housingLink.targetId}::${entry.housingLink.propertyId}`;
    const list = financeLoansByProperty.get(key) ?? [];
    list.push(entry);
    financeLoansByProperty.set(key, list);
  }

  const byMember = Object.fromEntries(
    Object.entries(loanState.byMember).map(([memberId, entries]) => [
      memberId,
      entries.map((entry) => {
        const property = getLinkedHousingProperty(housingState, entry);
        if (!property || !entry.housingLink) return entry;
        const key = `${entry.housingLink.targetId}::${entry.housingLink.propertyId}`;
        const financeLoans = resolveHousingPropertyFinanceLoans(
          financeLoansByProperty.get(key) ?? [entry],
        );
        return syncEntryAmountFromAcquisition(property, entry, financeLoans);
      }),
    ]),
  );

  return { ...loanState, byMember };
}

/** 自動車ローンの借入金額を Q6 購入費用に合わせる */
export function syncVehicleLoanAmountsFromPurchase(
  vehicleState: VehicleState,

  loanState: LoanState,
): LoanState {
  const byMember = Object.fromEntries(
    Object.entries(loanState.byMember).map(([memberId, entries]) => [
      memberId,

      entries.map((entry) => {
        const vehicle = getLinkedVehicle(vehicleState, entry);

        if (!vehicle) return entry;

        return syncEntryAmountFromVehiclePurchase(vehicle, entry);
      }),
    ]),
  );

  return { ...loanState, byMember };
}

/** ペアローンの分担割合を更新し、パートナー側を補完する */

export function updatePairLoanShare(
  loanState: LoanState,

  entry: LoanEntry,

  sharePct: number,
): LoanState {
  if (!isPairLoanEntry(entry)) return loanState;

  const partner = findPairPartnerEntry(loanState, entry);

  if (!partner) return loanState;

  const nextShare = clampPairSharePct(sharePct);

  const partnerShare = complementPairSharePct(nextShare);

  const updateEntry = (target: LoanEntry, pct: number): LoanEntry => ({
    ...target,

    pairSharePct: pct,
  });

  const byMember = Object.fromEntries(
    Object.entries(loanState.byMember).map(([memberId, entries]) => [
      memberId,

      entries.map((candidate) => {
        if (candidate.id === entry.id) {
          return updateEntry(candidate, nextShare);
        }

        if (candidate.id === partner.id) {
          return updateEntry(candidate, partnerShare);
        }

        return candidate;
      }),
    ]),
  );

  return { ...loanState, byMember };
}

/** 連帯債務の控除按分（主契約者側%）を更新する */

export function updateJointDebtDeductionShare(
  loanState: LoanState,

  entry: LoanEntry,

  sharePct: number,
): LoanState {
  if (!isJointDebtEntry(entry)) return loanState;

  const nextShare = clampPairSharePct(sharePct);

  const bucket = findLoanEntryBucket(loanState, entry.id);

  if (!bucket) return loanState;

  return updateLoanByMember(
    loanState,

    bucket.memberId,

    bucket.entries.map((candidate) =>
      candidate.id === entry.id
        ? { ...candidate, pairSharePct: nextShare }
        : candidate,
    ),
  );
}

/** ペアローンのローン組み込み設定をパートナーへ連動反映する */

export function syncPairLoanFeeInclusionInState(
  loanState: LoanState,

  sourceEntry: LoanEntry,
): LoanState {
  if (!isPairLoanEntry(sourceEntry)) return loanState;

  const partner = findPairPartnerEntry(loanState, sourceEntry);

  if (!partner) return loanState;

  const partnerBucket = findLoanEntryBucket(loanState, partner.id);

  if (!partnerBucket) return loanState;

  const syncedPartner: LoanEntry = {
    ...partner,

    settings: applyPairLinkedFeeInclusionSettings(
      partner.settings,

      sourceEntry.settings,
    ),
  };

  return updateLoanByMember(
    loanState,

    partnerBucket.memberId,

    partnerBucket.entries.map((candidate) =>
      candidate.id === partner.id ? syncedPartner : candidate,
    ),
  );
}

/** Q5 の対象物件設定を紐づく住宅ローンへ反映 */

export function syncPropertyTargetSettingsToLoans(
  housingState: HousingState,

  loanState: LoanState,
): LoanState {
  const byMember = Object.fromEntries(
    Object.entries(loanState.byMember).map(([memberId, entries]) => [
      memberId,

      entries.map((entry) => {
        if (!entry.housingLink) return entry;

        const data = housingState.byTarget[entry.housingLink.targetId];

        const property = data?.owned.find(
          (owned) => owned.id === entry.housingLink?.propertyId,
        );

        if (!property) return entry;

        return {
          ...entry,

          settings: {
            ...entry.settings,

            isNewConstruction: property.loan.isNewConstruction,

            deductionCategory: property.loan.deductionCategory,
          },
        };
      }),
    ]),
  );

  return { ...loanState, byMember };
}

export function applyHousingAndLoanSync(
  housingState: HousingState,

  loanState: LoanState,

  vehicleState?: VehicleState,
): { housingState: HousingState; loanState: LoanState } {
  const withTargets = syncPropertyTargetSettingsToLoans(
    housingState,
    loanState,
  );

  let syncedLoans = syncHousingLoanAmountsFromAcquisition(
    housingState,

    withTargets,
  );

  if (vehicleState) {
    syncedLoans = syncVehicleLoanAmountsFromPurchase(vehicleState, syncedLoans);
  }

  return {
    housingState: syncHousingLoansFromLoanState(housingState, syncedLoans),

    loanState: syncedLoans,
  };
}

export function syncHousingLoansFromLoanState(
  housingState: HousingState,

  loanState: LoanState,
): HousingState {
  const byTarget = { ...housingState.byTarget };

  for (const entry of getAllLoanEntries(loanState)) {
    if (!entry.housingLink) continue;

    const { targetId, propertyId } = entry.housingLink;

    const data = byTarget[targetId];

    if (!data) continue;

    byTarget[targetId] = {
      ...data,

      owned: data.owned.map((property) =>
        property.id === propertyId && property.paymentMethod === "loan"
          ? { ...property, loan: { ...entry.settings } }
          : property,
      ),
    };
  }

  return { ...housingState, byTarget };
}
