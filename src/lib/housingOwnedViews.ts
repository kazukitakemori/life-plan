import { createEmptyHousingTargetData } from '../types/housing';
import type {
  HousingState,
  HousingTargetData,
  OwnedProperty,
} from '../types/housing';
import type { FamilyMember } from '../types/family';
import type { LoanState, LoanStructureType } from '../types/loan';
import { getHousingLinkedLoansForProperty } from './loanResolution';

export type OwnedViewRole = 'owner' | 'linked';

export interface OwnedTabView {
  property: OwnedProperty;
  storageTargetId: string;
  periodMemberId: string;
  viewRole: OwnedViewRole;
}

function getTargetData(
  state: HousingState,
  targetId: string,
): HousingTargetData {
  return state.byTarget[targetId] ?? createEmptyHousingTargetData();
}

function isCoupleLoanStructure(
  structureType: LoanStructureType | undefined,
): boolean {
  return (
    structureType === 'pair' ||
    structureType === 'joint_debt' ||
    structureType === 'income_combined'
  );
}

/** このメンバーが物件のローン支払い側として関与しているか */
export function isMemberInvolvedInOwnedLoans(input: {
  loanState: LoanState;
  members: FamilyMember[];
  storageTargetId: string;
  propertyId: string;
  memberId: string;
  headId: string;
  spouseId?: string;
}): boolean {
  const linked = getHousingLinkedLoansForProperty(
    input.loanState,
    input.members,
    input.storageTargetId,
    input.propertyId,
  );
  if (linked.length === 0) return false;

  if (linked.some((view) => view.contractorId === input.memberId)) {
    return true;
  }

  const coupleLoan = linked.some((view) =>
    isCoupleLoanStructure(view.entry.structureType),
  );
  if (!coupleLoan) return false;

  const isCoupleMember =
    input.memberId === input.headId ||
    (input.spouseId != null && input.memberId === input.spouseId);
  return isCoupleMember;
}

/** 表示タブに出す所有物件（ペア・連帯等は相手タブにも出す） */
export function listOwnedViewsForTarget(
  housingState: HousingState,
  loanState: LoanState,
  members: FamilyMember[],
  viewTargetId: string,
  headId: string,
  spouseId: string | undefined,
): OwnedTabView[] {
  const views: OwnedTabView[] = [];
  const local = getTargetData(housingState, viewTargetId).owned;
  for (const property of local) {
    views.push({
      property,
      storageTargetId: viewTargetId,
      periodMemberId: viewTargetId,
      viewRole: 'owner',
    });
  }

  for (const [storageTargetId, data] of Object.entries(housingState.byTarget)) {
    if (storageTargetId === viewTargetId) continue;
    for (const property of data.owned) {
      if (views.some((view) => view.property.id === property.id)) continue;
      if (
        !isMemberInvolvedInOwnedLoans({
          loanState,
          members,
          storageTargetId,
          propertyId: property.id,
          memberId: viewTargetId,
          headId,
          spouseId,
        })
      ) {
        continue;
      }
      views.push({
        property,
        storageTargetId,
        periodMemberId: storageTargetId,
        viewRole: 'linked',
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

export function updateStoredOwned(
  housingState: HousingState,
  storageTargetId: string,
  property: OwnedProperty,
): HousingState {
  const data = getTargetData(housingState, storageTargetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, storageTargetId, {
      ...data,
      owned: data.owned.map((item) =>
        item.id === property.id ? property : item,
      ),
    }),
  };
}

export function removeStoredOwned(
  housingState: HousingState,
  storageTargetId: string,
  propertyId: string,
): HousingState {
  const data = getTargetData(housingState, storageTargetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, storageTargetId, {
      ...data,
      owned: data.owned.filter((item) => item.id !== propertyId),
    }),
  };
}

export function addOwnedToTarget(
  housingState: HousingState,
  targetId: string,
  property: OwnedProperty,
): HousingState {
  const data = getTargetData(housingState, targetId);
  return {
    ...housingState,
    byTarget: upsertTargetData(housingState.byTarget, targetId, {
      ...data,
      owned: [...data.owned, property],
    }),
  };
}

export function memberHasLinkedOwnedHousing(
  housingState: HousingState,
  loanState: LoanState,
  members: FamilyMember[],
  memberId: string,
): boolean {
  const headId = members.find((m) => m.role === 'head')?.id;
  if (!headId) return false;
  const spouseId = members.find((m) => m.role === 'spouse')?.id;
  return (
    listOwnedViewsForTarget(
      housingState,
      loanState,
      members,
      memberId,
      headId,
      spouseId,
    ).length > 0
  );
}
