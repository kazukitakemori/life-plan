import type { FamilyMember } from '../types/family';
import type {
  OwnedProperty,
  RentalProperty,
} from '../types/housing';
import type {
  HousingInsuranceLink,
  InsuranceByMember,
  InsuranceCategory,
  InsuranceEntry,
  InsuranceState,
  VehicleInsuranceLink,
} from '../types/insurance';
import type { VehicleEntry } from '../types/vehicle';
import {
  getDefaultBenefitReceiveAge,
  getDefaultLifeDeductionKind,
  DEFAULT_EDUCATION_ANNUITY_YEARS,
  DEFAULT_PERSONAL_PENSION_ANNUITY_YEARS,
  INSURANCE_CATEGORY_DEFAULT_NAMES,
  formatAutoInsuranceName,
  formatFireInsuranceName,
  hasBenefitPayoutInput,
} from './insuranceLabels';
import {
  calcPremiumEndJustBeforeBenefit,
  periodPatchFromAsset,
} from './insurancePeriod';
import { getIncomeEligibleMembers } from './memberDisplay';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

function createId(): string {
  return crypto.randomUUID();
}

export function createDefaultInsuranceState(): InsuranceState {
  return {
    byMember: {},
  };
}

export function migrateInsuranceState(
  state: InsuranceState | undefined | null,
): InsuranceState {
  if (!state || typeof state !== 'object') {
    return createDefaultInsuranceState();
  }
  return {
    byMember:
      state.byMember && typeof state.byMember === 'object'
        ? state.byMember
        : {},
  };
}

export function getAllInsuranceEntries(state: InsuranceState): InsuranceEntry[] {
  return Object.values(state.byMember ?? {}).flat();
}

export function getMemberInsuranceEntries(
  state: InsuranceState,
  memberId: string,
): InsuranceEntry[] {
  return state.byMember[memberId] ?? [];
}

export function getInsuranceEntryCounts(
  state: InsuranceState,
  memberIds: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const memberId of memberIds) {
    counts[memberId] = state.byMember[memberId]?.length ?? 0;
  }
  return counts;
}

export function findInsuranceEntryBucket(
  state: InsuranceState,
  entryId: string,
): { memberId: string; entries: InsuranceEntry[] } | undefined {
  for (const [memberId, entries] of Object.entries(state.byMember ?? {})) {
    if (entries.some((entry) => entry.id === entryId)) {
      return { memberId, entries };
    }
  }
  return undefined;
}

export function updateInsuranceByMember(
  state: InsuranceState,
  memberId: string,
  entries: InsuranceEntry[],
): InsuranceState {
  const byMember: InsuranceByMember = { ...state.byMember };
  if (entries.length === 0) {
    delete byMember[memberId];
  } else {
    byMember[memberId] = entries;
  }
  return { ...state, byMember };
}

export function removeInsuranceEntry(
  state: InsuranceState,
  entryId: string,
): InsuranceState {
  const bucket = findInsuranceEntryBucket(state, entryId);
  if (!bucket) return state;
  return updateInsuranceByMember(
    state,
    bucket.memberId,
    bucket.entries.filter((entry) => entry.id !== entryId),
  );
}

export function updateInsuranceEntry(
  state: InsuranceState,
  entry: InsuranceEntry,
): InsuranceState {
  const bucket = findInsuranceEntryBucket(state, entry.id);
  if (!bucket) return state;
  return updateInsuranceByMember(
    state,
    bucket.memberId,
    bucket.entries.map((current) =>
      current.id === entry.id ? entry : current,
    ),
  );
}

export function resolveInsuranceContractorMember(
  state: InsuranceState,
  members: FamilyMember[],
  entryId: string,
): FamilyMember | undefined {
  const bucket = findInsuranceEntryBucket(state, entryId);
  if (!bucket) return undefined;
  return members.find((member) => member.id === bucket.memberId);
}

export function createInsuranceEntry(
  category: InsuranceCategory,
  member: FamilyMember,
  referenceDate: Date,
  overrides: Partial<InsuranceEntry> = {},
  familyMembers: FamilyMember[] = [member],
): InsuranceEntry {
  const referenceMonth = referenceDate.getMonth() + 1;
  const defaultStart = resolveDefaultStartAgeMonth(member.age, referenceMonth);
  const benefitReceiveMemberId =
    overrides.benefitReceiveMemberId ??
    getDefaultBenefitReceiveMemberId(category, member, familyMembers);
  const benefitReceiveAge =
    overrides.benefitReceiveAge ?? getDefaultBenefitReceiveAge(category);
  const startAge = overrides.startAge ?? defaultStart.startAge;
  const startMonth = overrides.startMonth ?? defaultStart.startMonth;
  const hasExplicitPremiumEnd =
    overrides.endMode != null ||
    overrides.endAge != null ||
    overrides.endMonth != null;

  let endMode: InsuranceEntry['endMode'] = 'lifetime';
  let endAge = member.expectedLifespan;
  let endMonth = 12;
  if (!hasExplicitPremiumEnd && hasBenefitPayoutInput(category)) {
    const receiveMember =
      familyMembers.find((item) => item.id === benefitReceiveMemberId) ??
      member;
    const premiumEnd = calcPremiumEndJustBeforeBenefit({
      contractor: member,
      receiveMember,
      benefitReceiveAge,
      startAge,
      startMonth,
      referenceDate,
    });
    endMode = premiumEnd.endMode;
    endAge = premiumEnd.endAge;
    endMonth = premiumEnd.endMonth;
  }

  return {
    id: createId(),
    category,
    name: INSURANCE_CATEGORY_DEFAULT_NAMES[category],
    premiumMan: 0,
    premiumPaymentMode: 'annual',
    periodSource: 'manual',
    startAge,
    startMonth,
    endMode,
    endAge,
    endMonth,
    lifeDeductionKind: getDefaultLifeDeductionKind(category),
    hasReturnValue: false,
    returnValueAge: member.expectedLifespan,
    returnValueMan: 0,
    benefitPayoutMode: 'lump_sum',
    personalPensionAnnuityKind: 'certain',
    personalPensionAnnuityYears: DEFAULT_PERSONAL_PENSION_ANNUITY_YEARS,
    beneficiaryMemberId: getDefaultBeneficiaryMemberId(
      category,
      member,
      familyMembers,
    ),
    benefitReceiveMemberId,
    benefitReceiveAge,
    benefitAmountMan: 0,
    educationAnnuityYears: DEFAULT_EDUCATION_ANNUITY_YEARS,
    note: '',
    ...overrides,
  };
}

/** 受取時期の基準にできるメンバー（世帯主・配偶者・子ども） */
export function getBenefitReceiveMemberOptions(
  members: FamilyMember[],
): FamilyMember[] {
  return members.filter(
    (item) =>
      item.role === 'head' || item.role === 'spouse' || item.role === 'child',
  );
}

/** 受取人の既定は契約者（保険料の払込者） */
export function getDefaultBeneficiaryMemberId(
  _category: InsuranceCategory,
  contractor: FamilyMember,
  _members: FamilyMember[] = [],
): string {
  return contractor.id;
}

/** 受取時期の基準者の既定（学資は子ども、個人年金は契約者） */
export function getDefaultBenefitReceiveMemberId(
  category: InsuranceCategory,
  contractor: FamilyMember,
  members: FamilyMember[],
): string {
  const options = getBenefitReceiveMemberOptions(members);
  if (category === 'education') {
    const child = options.find((item) => item.role === 'child');
    if (child) return child.id;
  }
  if (options.some((item) => item.id === contractor.id)) {
    return contractor.id;
  }
  return options[0]?.id ?? contractor.id;
}

/** Q5 住まいから火災保険を追加 */
export function addFireInsuranceForHousing(
  state: InsuranceState,
  memberId: string,
  member: FamilyMember,
  referenceDate: Date,
  link: HousingInsuranceLink,
  property: OwnedProperty | RentalProperty,
): InsuranceState {
  const linkedAsset =
    link.propertyKind === 'rental'
      ? ({ kind: 'rental' as const, property: property as RentalProperty })
      : ({ kind: 'owned' as const, property: property as OwnedProperty });
  const entry = createInsuranceEntry('fire', member, referenceDate, {
    name: formatFireInsuranceName(property.name),
    housingLink: link,
    ...periodPatchFromAsset(linkedAsset),
  });
  const current = getMemberInsuranceEntries(state, memberId);
  return updateInsuranceByMember(state, memberId, [...current, entry]);
}

/** Q6 乗り物から自動車保険を追加 */
export function addAutoInsuranceForVehicle(
  state: InsuranceState,
  memberId: string,
  member: FamilyMember,
  referenceDate: Date,
  link: VehicleInsuranceLink,
  vehicle: VehicleEntry,
): InsuranceState {
  const entry = createInsuranceEntry('auto', member, referenceDate, {
    name: formatAutoInsuranceName(vehicle.label),
    vehicleLink: link,
    ...periodPatchFromAsset({ kind: 'vehicle', vehicle }),
  });
  const current = getMemberInsuranceEntries(state, memberId);
  return updateInsuranceByMember(state, memberId, [...current, entry]);
}

export function getInsurancesForVehicle(
  state: InsuranceState,
  memberId: string,
  vehicleId: string,
): InsuranceEntry[] {
  return getAllInsuranceEntries(state).filter(
    (entry) =>
      entry.category === 'auto' &&
      entry.vehicleLink?.memberId === memberId &&
      entry.vehicleLink?.vehicleId === vehicleId,
  );
}

export function getInsurancesForHousingProperty(
  state: InsuranceState,
  targetId: string,
  propertyId: string,
): InsuranceEntry[] {
  return getAllInsuranceEntries(state).filter(
    (entry) =>
      entry.category === 'fire' &&
      entry.housingLink?.targetId === targetId &&
      entry.housingLink?.propertyId === propertyId,
  );
}

export function syncInsurancesWithFamily(
  members: FamilyMember[],
  state: InsuranceState,
): InsuranceState {
  const eligibleIds = new Set(
    getIncomeEligibleMembers(members).map((member) => member.id),
  );
  const receiveOptions = getBenefitReceiveMemberOptions(members);
  const receiveIds = new Set(receiveOptions.map((member) => member.id));
  const byMember: InsuranceByMember = {};
  for (const [memberId, entries] of Object.entries(state.byMember ?? {})) {
    if (!eligibleIds.has(memberId)) continue;
    byMember[memberId] = entries.map((entry) => {
      let next = entry;
      if (
        entry.beneficiaryMemberId &&
        !eligibleIds.has(entry.beneficiaryMemberId)
      ) {
        next = { ...next, beneficiaryMemberId: memberId };
      }
      if (
        entry.benefitReceiveMemberId &&
        !receiveIds.has(entry.benefitReceiveMemberId)
      ) {
        const fallback =
          receiveOptions.find((item) => item.id === memberId)?.id ??
          receiveOptions[0]?.id ??
          memberId;
        next = { ...next, benefitReceiveMemberId: fallback };
      }
      return next;
    });
  }
  return { ...state, byMember };
}
