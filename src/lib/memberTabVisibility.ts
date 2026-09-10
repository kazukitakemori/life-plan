import type { EducationByMember } from '../types/education';
import type { FamilyMember, FamilyMemberRole } from '../types/family';
import type { HousingState } from '../types/housing';
import type { IncomeByMember } from '../types/income';
import type { InsuranceState } from '../types/insurance';
import type { LifeEventState } from '../types/lifeEvent';
import type { LivingExpenseState } from '../types/living';
import type { LoanState } from '../types/loan';
import type {
  MemberTabDomain,
  MemberTabExtras,
} from '../types/memberTabVisibility';
import type { PensionByMember } from '../types/pension';
import type { SavingsState } from '../types/savings';
import type { VehicleState } from '../types/vehicle';
import { countHousingItems } from './housingDefaults';
import { getIncomeEligibleMembers } from './memberDisplay';

export type { MemberTabDomain, MemberTabExtras };

/** 世帯主・配偶者を常時表示するドメイン */
const HEAD_SPOUSE_ALWAYS_DOMAINS = new Set<MemberTabDomain>([
  'living',
  'housing',
  'income',
  'pension',
  'vehicle',
  'loan',
  'insurance',
  'savings',
  'lifeEvent',
  'taxSocialBreakdown',
]);

function isAlwaysVisibleRole(
  domain: MemberTabDomain,
  role: FamilyMemberRole,
): boolean {
  if (domain === 'education') return role === 'child';
  if (domain === 'lifeEvent') {
    return role === 'head' || role === 'spouse' || role === 'child';
  }
  if (HEAD_SPOUSE_ALWAYS_DOMAINS.has(domain)) {
    return role === 'head' || role === 'spouse';
  }
  return false;
}

export function normalizeMemberTabExtras(
  extras: MemberTabExtras | undefined,
  memberIds?: Set<string>,
): MemberTabExtras {
  if (!extras) return {};
  const next: MemberTabExtras = {};
  for (const [domain, ids] of Object.entries(extras) as [
    MemberTabDomain,
    string[] | undefined,
  ][]) {
    if (!ids?.length) continue;
    const filtered = ids.filter((id) => {
      if (typeof id !== 'string' || !id) return false;
      if (memberIds && !memberIds.has(id)) return false;
      return true;
    });
    if (filtered.length > 0) {
      next[domain] = [...new Set(filtered)];
    }
  }
  return next;
}

export function pruneMemberTabExtras(
  extras: MemberTabExtras,
  members: FamilyMember[],
): MemberTabExtras {
  const memberIds = new Set(getIncomeEligibleMembers(members).map((m) => m.id));
  return normalizeMemberTabExtras(extras, memberIds);
}

export function addMemberTabExtra(
  extras: MemberTabExtras,
  domain: MemberTabDomain,
  memberId: string,
): MemberTabExtras {
  const current = extras[domain] ?? [];
  if (current.includes(memberId)) return extras;
  return {
    ...extras,
    [domain]: [...current, memberId],
  };
}

export function removeMemberTabExtra(
  extras: MemberTabExtras,
  domain: MemberTabDomain,
  memberId: string,
): MemberTabExtras {
  const current = extras[domain] ?? [];
  const next = current.filter((id) => id !== memberId);
  if (next.length === current.length) return extras;
  const result = { ...extras };
  if (next.length === 0) {
    delete result[domain];
  } else {
    result[domain] = next;
  }
  return result;
}

export function resolveVisibleTabMembers(params: {
  domain: MemberTabDomain;
  members: FamilyMember[];
  extras?: MemberTabExtras;
  memberHasData: (memberId: string) => boolean;
}): FamilyMember[] {
  const eligible = getIncomeEligibleMembers(params.members);
  const extraIds = new Set(params.extras?.[params.domain] ?? []);

  return eligible.filter((member) => {
    if (isAlwaysVisibleRole(params.domain, member.role)) return true;
    if (extraIds.has(member.id)) return true;
    if (params.memberHasData(member.id)) return true;
    return false;
  });
}

export function listAddableTabMembers(params: {
  domain: MemberTabDomain;
  members: FamilyMember[];
  extras?: MemberTabExtras;
  memberHasData: (memberId: string) => boolean;
}): FamilyMember[] {
  const visibleIds = new Set(
    resolveVisibleTabMembers(params).map((m) => m.id),
  );
  return getIncomeEligibleMembers(params.members).filter(
    (m) => !visibleIds.has(m.id),
  );
}

/** extras 由来で、かつデータが空のときだけタブを外せる */
export function canRemoveMemberTab(params: {
  domain: MemberTabDomain;
  member: FamilyMember;
  extras?: MemberTabExtras;
  memberHasData: (memberId: string) => boolean;
}): boolean {
  if (isAlwaysVisibleRole(params.domain, params.member.role)) return false;
  if (params.memberHasData(params.member.id)) return false;
  const extraIds = params.extras?.[params.domain] ?? [];
  return extraIds.includes(params.member.id);
}

export function memberHasLivingData(
  state: LivingExpenseState,
  memberId: string,
): boolean {
  return (state.byTarget[memberId]?.length ?? 0) > 0;
}

export function memberHasHousingData(
  state: HousingState,
  memberId: string,
): boolean {
  const data = state.byTarget[memberId];
  if (!data) return false;
  return countHousingItems(data) > 0;
}

export function memberHasIncomeData(
  byMember: IncomeByMember,
  memberId: string,
): boolean {
  return (byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasVehicleData(
  state: VehicleState,
  memberId: string,
): boolean {
  return (state.byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasLoanData(
  state: LoanState,
  memberId: string,
): boolean {
  return (state.byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasInsuranceData(
  state: InsuranceState,
  memberId: string,
): boolean {
  return (state.byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasSavingsData(
  state: SavingsState,
  memberId: string,
): boolean {
  return (state.byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasLifeEventData(
  state: LifeEventState,
  memberId: string,
): boolean {
  return (state.byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasEducationData(
  byMember: EducationByMember,
  memberId: string,
): boolean {
  return (byMember[memberId]?.length ?? 0) > 0;
}

export function memberHasPensionData(
  byMember: PensionByMember,
  memberId: string,
): boolean {
  const entry = byMember[memberId];
  if (!entry) return false;
  // 全メンバーに空バケットが作られるため、加入歴の入力開始を目印にする
  return entry.pastEnrollment !== 'none';
}
