import type { FamilyMember } from '../types/family';
import type { DependentStatus, IncomeByMember, IncomeEntry, IncomePeriod } from '../types/income';

export interface MemberDependentDefaults {
  dependentStatus: DependentStatus;
  taxDependent: boolean;
  socialInsuranceDependent: boolean;
}

/** Q1の扶養トグル（child/other）と連動するメンバーか */
export function usesQ1DependentDefaults(member: FamilyMember): boolean {
  return member.role === 'child' || member.role === 'other';
}

/** Q1の扶養設定から、そのメンバーが取りうる扶養区分の上限を返す */
export function getMemberDependentDefaults(
  member: FamilyMember,
): MemberDependentDefaults {
  if (member.role === 'spouse') {
    return {
      dependentStatus: 'dependent',
      taxDependent: true,
      socialInsuranceDependent: true,
    };
  }
  if (usesQ1DependentDefaults(member)) {
    const taxDep = member.taxDependentDefault ?? true;
    const siDep = member.socialInsuranceDependentDefault ?? true;
    return {
      dependentStatus: taxDep || siDep ? 'dependent' : 'none',
      taxDependent: taxDep,
      socialInsuranceDependent: siDep,
    };
  }
  return {
    dependentStatus: 'none',
    taxDependent: false,
    socialInsuranceDependent: false,
  };
}

export function allowsTaxDependentDefault(member: FamilyMember): boolean {
  if (!usesQ1DependentDefaults(member)) return true;
  return member.taxDependentDefault ?? true;
}

export function allowsSocialInsuranceDependentDefault(member: FamilyMember): boolean {
  if (!usesQ1DependentDefaults(member)) return true;
  return member.socialInsuranceDependentDefault ?? true;
}

export function canConfigureDependentInQ2(member: FamilyMember): boolean {
  if (!usesQ1DependentDefaults(member)) return true;
  return allowsTaxDependentDefault(member) || allowsSocialInsuranceDependentDefault(member);
}

/** 収入期間の扶養設定をQ1の上限内に収める（child/other） */
export function clampPeriodDependentToMember(
  period: IncomePeriod,
  member: FamilyMember,
): IncomePeriod {
  if (!usesQ1DependentDefaults(member)) return period;

  const taxDependent = allowsTaxDependentDefault(member)
    ? period.taxDependent
    : false;
  const socialInsuranceDependent = allowsSocialInsuranceDependentDefault(member)
    ? period.socialInsuranceDependent
    : false;
  const dependentStatus: DependentStatus =
    taxDependent || socialInsuranceDependent ? 'dependent' : 'none';

  if (
    period.dependentStatus === dependentStatus &&
    period.taxDependent === taxDependent &&
    period.socialInsuranceDependent === socialInsuranceDependent
  ) {
    return period;
  }

  return {
    ...period,
    dependentStatus,
    taxDependent,
    socialInsuranceDependent,
  };
}

/** Q2で「扶養に入る」を選んだときの初期値（Q1連動） */
export function dependentFieldsForMemberSelection(
  member: FamilyMember,
  selectingDependent: boolean,
): Pick<IncomePeriod, 'dependentStatus' | 'taxDependent' | 'socialInsuranceDependent'> {
  if (!selectingDependent) {
    return {
      dependentStatus: 'none',
      taxDependent: false,
      socialInsuranceDependent: false,
    };
  }
  if (usesQ1DependentDefaults(member)) {
    return getMemberDependentDefaults(member);
  }
  return {
    dependentStatus: 'dependent',
    taxDependent: true,
    socialInsuranceDependent: true,
  };
}

export function syncMemberIncomeWithDefaults(
  member: FamilyMember,
  entries: IncomeEntry[],
): IncomeEntry[] {
  if (!usesQ1DependentDefaults(member)) return entries;
  return entries.map((entry) => ({
    ...entry,
    periods: entry.periods.map((period) =>
      clampPeriodDependentToMember(period, member),
    ),
  }));
}

export function syncAllIncomeWithFamilyDefaults(
  members: FamilyMember[],
  incomeByMember: IncomeByMember,
): IncomeByMember {
  const result = { ...incomeByMember };
  for (const member of members) {
    if (!usesQ1DependentDefaults(member)) continue;
    const entries = result[member.id];
    if (!entries) continue;
    result[member.id] = syncMemberIncomeWithDefaults(member, entries);
  }
  return result;
}
