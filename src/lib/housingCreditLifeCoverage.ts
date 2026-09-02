import type { FamilyMember } from '../types/family';
import type { OwnedProperty } from '../types/housing';
import type { HousingLinkedLoanView, LoanEntry, LoanState } from '../types/loan';
import type { RequiredCoverageSubject } from '../types/requiredCoverage';
import { normalizeGroupCreditLifePlan } from './groupCreditLife';
import { getLoanContractorMemberId } from './loanResolution';
import { getMemberTabLabel } from './memberDisplay';
import { isPairLoanEntry } from './pairLoanShare';

export type OwnedPropertyCreditLifeKind =
  | 'no_loan'
  | 'covered'
  | 'uncovered'
  | 'partial';

function resolveContractorRole(
  familyMembers: FamilyMember[],
  memberId: string | undefined,
): FamilyMember['role'] | undefined {
  if (!memberId || memberId === '__legacy__') {
    return familyMembers.find((member) => member.role === 'head')?.role;
  }
  return familyMembers.find((member) => member.id === memberId)?.role;
}

/** 当該メンバーの万一で、この住宅ローンが団信により消滅するか */
export function isHousingLoanPaidByGroupCreditLife(
  entry: LoanEntry,
  contractorRole: FamilyMember['role'] | undefined,
  deceased: RequiredCoverageSubject,
): boolean {
  if (entry.category !== 'housing') return false;

  const structure = entry.structureType ?? 'sole';
  const rawPlan = entry.settings?.groupCreditLifePlan;
  const plan = normalizeGroupCreditLifePlan(rawPlan, structure);

  if (
    structure === 'joint_debt' &&
    (rawPlan === 'couple_joint' || plan === 'couple_joint')
  ) {
    return deceased === 'head' || deceased === 'spouse';
  }

  return contractorRole === deceased;
}

/** 居住中の物件に紐づくローンは既契約とみなす */
export function isOwnedHousingLoanInForce(
  property: Pick<OwnedProperty, 'usage'>,
): boolean {
  return property.usage === 'current';
}

/**
 * 既契約かつこの万一で団信が効く借入は、必要保障額に含めずオンにもできない。
 * 入居予定（これから借りる）は団信設定があってもデフォルトで含める。
 */
export function isHousingLoanCoverageLockedOff(
  paidByCreditLife: boolean,
  propertyInForce: boolean,
): boolean {
  return paidByCreditLife && propertyInForce;
}

export function housingLoanCoverageDesignedFactor(options: {
  paidByCreditLife: boolean;
  propertyInForce: boolean;
  lineFactor: number;
}): number {
  if (
    isHousingLoanCoverageLockedOff(
      options.paidByCreditLife,
      options.propertyInForce,
    )
  ) {
    return 0;
  }
  return options.lineFactor;
}

export function excludeHousingLoansPaidByGroupCreditLife(
  loanState: LoanState | undefined,
  familyMembers: FamilyMember[],
  deceased: RequiredCoverageSubject,
): LoanState | undefined {
  if (!loanState) return loanState;

  const headId = familyMembers.find((member) => member.role === 'head')?.id;
  const byMember: LoanState['byMember'] = {};
  for (const [memberId, entries] of Object.entries(loanState.byMember)) {
    byMember[memberId] = entries.filter((entry) => {
      if (entry.category !== 'housing' || !entry.housingLink) return true;
      const contractorId =
        getLoanContractorMemberId(loanState, entry, headId) ?? memberId;
      const contractorRole = resolveContractorRole(familyMembers, contractorId);
      return !isHousingLoanPaidByGroupCreditLife(
        entry,
        contractorRole,
        deceased,
      );
    });
  }
  return { ...loanState, byMember };
}

export function resolveOwnedPropertyCreditLifeKind(
  loans: HousingLinkedLoanView[],
  deceased: RequiredCoverageSubject,
): OwnedPropertyCreditLifeKind {
  const housingLoans = loans.filter((loan) => loan.entry.category === 'housing');
  if (housingLoans.length === 0) return 'no_loan';

  const paidCount = housingLoans.filter((loan) =>
    isHousingLoanPaidByGroupCreditLife(
      loan.entry,
      loan.contractorRole,
      deceased,
    ),
  ).length;
  if (paidCount === housingLoans.length) return 'covered';
  if (paidCount === 0) return 'uncovered';
  return 'partial';
}

export function formatOwnedPropertyCreditLifeHint(
  kind: OwnedPropertyCreditLifeKind,
  deceased: RequiredCoverageSubject,
  familyMembers: FamilyMember[],
  loans: HousingLinkedLoanView[] = [],
): string {
  const survivorRole = deceased === 'head' ? 'spouse' : 'head';
  const survivor = familyMembers.find((member) => member.role === survivorRole);
  const survivorLabel = survivor
    ? getMemberTabLabel(survivor)
    : survivorRole === 'spouse'
      ? '配偶者'
      : '世帯主';

  switch (kind) {
    case 'no_loan':
      return '団信なし';
    case 'covered':
      return '団信でローン消滅';
    case 'uncovered':
      return '団信対象外';
    case 'partial':
      return loans.length > 0 && loans.every((loan) => isPairLoanEntry(loan.entry))
        ? `ペアローン：${survivorLabel}の借入は残る`
        : `一部のローンは残る`;
  }
}
