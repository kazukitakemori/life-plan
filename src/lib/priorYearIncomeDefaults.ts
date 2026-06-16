import { resolveMemberYearIncomeProfile } from './memberYearIncome';
import type { FamilyMember } from '../types/family';
import type {
  IncomeByMember,
  PriorYearIncomeByMember,
  PriorYearIncomeForNursery,
} from '../types/income';

export function createDefaultPriorYearIncome(
  member: FamilyMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
): PriorYearIncomeForNursery {
  const entries = incomeByMember[member.id] ?? [];
  const currentYear = referenceDate.getFullYear();
  const profile = resolveMemberYearIncomeProfile(
    member,
    entries,
    referenceDate,
    currentYear,
  );

  const monthlyAmountMan =
    profile.grossIncomeMan > 0
      ? Math.round((profile.grossIncomeMan / 12) * 10) / 10
      : member.role === 'spouse'
        ? 0
        : 50;

  return {
    differsFromCurrentYear: false,
    category: profile.category ?? 'employee',
    monthlyAmountMan,
  };
}

export function getPriorYearIncomeForMember(
  member: FamilyMember,
  priorYearIncomeByMember: PriorYearIncomeByMember,
  incomeByMember: IncomeByMember,
  referenceDate: Date,
): PriorYearIncomeForNursery {
  return (
    priorYearIncomeByMember[member.id] ??
    createDefaultPriorYearIncome(member, incomeByMember, referenceDate)
  );
}

export function syncPriorYearIncomeWithFamily(
  members: FamilyMember[],
  priorYearIncomeByMember: PriorYearIncomeByMember,
): PriorYearIncomeByMember {
  const parentIds = new Set(
    members.filter((m) => m.role === 'head' || m.role === 'spouse').map((m) => m.id),
  );
  const next: PriorYearIncomeByMember = {};
  for (const [memberId, value] of Object.entries(priorYearIncomeByMember)) {
    if (parentIds.has(memberId)) {
      next[memberId] = value;
    }
  }
  return next;
}
