import {
  getTaxDependentTotalIncomeLimitMan,
  SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN,
} from './dependentValidation';
import { calcCombinedIncomeForOverlappingPeriods } from './memberCombinedIncome';
import {
  allowsSocialInsuranceDependentDefault,
  allowsTaxDependentDefault,
  canConfigureDependentInQ7,
} from './memberDependentDefaults';
import {
  resolveHeadTotalIncomeYenForSpouseDeduction,
} from './spouseDeductionIncome';
import {
  resolveSpouseDeductionKind,
  TAXPAYER_SPOUSE_DEDUCTION_INCOME_CAP_YEN,
} from './spouseDeduction';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry, IncomePeriod } from '../types/income';

const MAN_TO_YEN = 10_000;

export type PeriodTaxDependentStatus =
  | 'none'
  | 'within_spouse_deduction'
  | 'within_spouse_special_deduction'
  | 'within_tax_dependent';

export type PeriodSocialInsuranceDependentStatus = 'none' | 'within';

export interface PeriodDependentResolutionContext {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  annualPensionManByMember?: Record<string, number>;
}

export interface ResolvedPeriodDependent {
  taxStatus: PeriodTaxDependentStatus;
  socialInsuranceStatus: PeriodSocialInsuranceDependentStatus;
  taxDependent: boolean;
  socialInsuranceDependent: boolean;
  /** 「扶養に入る」ラジオを選択可能か（税制上・社会保険のいずれかに該当） */
  canSelectDependent: boolean;
  /** 世帯主の合計所得超過により配偶者控除・配偶者特別控除が不可 */
  headSpouseDeductionBlocked: boolean;
}

function isTaxDependentEligibleMember(member: FamilyMember): boolean {
  if (member.role === 'spouse') return true;
  if (!allowsTaxDependentDefault(member)) return false;
  if (
    member.role === 'other' &&
    member.otherRelationship === 'common_law_partner'
  ) {
    return false;
  }
  return member.role === 'child' || member.role === 'other';
}

function isSocialInsuranceDependentEligibleMember(member: FamilyMember): boolean {
  if (member.role === 'spouse') return true;
  return allowsSocialInsuranceDependentDefault(member);
}

function resolveHeadTotalIncomeYen(
  context: PeriodDependentResolutionContext | undefined,
  calendarYear: number,
): number | null {
  if (!context) return null;
  const head = context.familyMembers.find((m) => m.role === 'head');
  if (!head) return null;
  return resolveHeadTotalIncomeYenForSpouseDeduction({
    head,
    headEntries: context.incomeByMember[head.id] ?? [],
    familyMembers: context.familyMembers,
    referenceDate: context.referenceDate,
    calendarYear,
    annualPensionMan: context.annualPensionManByMember?.[head.id],
  });
}

function resolveSpouseTaxStatus(
  spouseTotalIncomeMan: number,
  headTotalIncomeYen: number | null,
  calendarYear: number,
): {
  taxStatus: PeriodTaxDependentStatus;
  headSpouseDeductionBlocked: boolean;
} {
  const spouseTotalIncomeYen = Math.round(spouseTotalIncomeMan * MAN_TO_YEN);
  const headIncomeYen = headTotalIncomeYen ?? 0;

  const kindIfHeadEligible = resolveSpouseDeductionKind({
    headTotalIncomeYen: headIncomeYen,
    spouseTotalIncomeYen,
    spouseAgeAtYearEnd: null,
    calendarYear,
  });

  const headSpouseDeductionBlocked =
    headTotalIncomeYen !== null &&
    headTotalIncomeYen > TAXPAYER_SPOUSE_DEDUCTION_INCOME_CAP_YEN &&
    resolveSpouseDeductionKind({
      headTotalIncomeYen: 0,
      spouseTotalIncomeYen,
      spouseAgeAtYearEnd: null,
      calendarYear,
    }) !== 'none';

  let taxStatus: PeriodTaxDependentStatus = 'none';
  switch (kindIfHeadEligible) {
    case 'spouse':
      taxStatus = 'within_spouse_deduction';
      break;
    case 'special':
      taxStatus = 'within_spouse_special_deduction';
      break;
    default:
      taxStatus = 'none';
  }

  return { taxStatus, headSpouseDeductionBlocked };
}

export function resolveAutoPeriodDependent(
  member: FamilyMember,
  _entry: IncomeEntry,
  period: IncomePeriod,
  memberEntries: IncomeEntry[],
  calendarYear = 2026,
  context?: PeriodDependentResolutionContext,
): ResolvedPeriodDependent {
  const { totalIncomeMan, socialInsuranceIncomeMan } =
    calcCombinedIncomeForOverlappingPeriods(
      memberEntries,
      period,
      calendarYear,
    );

  const taxLimitMan = getTaxDependentTotalIncomeLimitMan(calendarYear);
  const headTotalIncomeYen = resolveHeadTotalIncomeYen(context, calendarYear);

  let taxStatus: PeriodTaxDependentStatus = 'none';
  let socialInsuranceStatus: PeriodSocialInsuranceDependentStatus = 'none';
  let headSpouseDeductionBlocked = false;

  if (isTaxDependentEligibleMember(member)) {
    if (member.role === 'spouse') {
      const spouseTax = resolveSpouseTaxStatus(
        totalIncomeMan,
        headTotalIncomeYen,
        calendarYear,
      );
      taxStatus = spouseTax.taxStatus;
      headSpouseDeductionBlocked = spouseTax.headSpouseDeductionBlocked;
    } else if (totalIncomeMan <= taxLimitMan) {
      taxStatus = 'within_tax_dependent';
    }
  }

  if (
    isSocialInsuranceDependentEligibleMember(member) &&
    socialInsuranceIncomeMan < SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN
  ) {
    socialInsuranceStatus = 'within';
  }

  const taxDependent =
    taxStatus === 'within_spouse_deduction' ||
    taxStatus === 'within_tax_dependent';
  const socialInsuranceDependent = socialInsuranceStatus === 'within';
  const canSelectDependent =
    canConfigureDependentInQ7(member) &&
    (taxStatus !== 'none' || socialInsuranceStatus !== 'none');

  return {
    taxStatus,
    socialInsuranceStatus,
    taxDependent,
    socialInsuranceDependent,
    canSelectDependent,
    headSpouseDeductionBlocked,
  };
}

/** 収入・扶養意図に応じて期間の扶養フラグを自動同期する */
export function syncPeriodWithAutoDependent(
  member: FamilyMember,
  entry: IncomeEntry,
  period: IncomePeriod,
  memberEntries: IncomeEntry[],
  calendarYear = 2026,
  context?: PeriodDependentResolutionContext,
): IncomePeriod {
  if (period.dependentStatus !== 'dependent') {
    if (!period.taxDependent && !period.socialInsuranceDependent) {
      return period;
    }
    return {
      ...period,
      taxDependent: false,
      socialInsuranceDependent: false,
    };
  }

  const resolved = resolveAutoPeriodDependent(
    member,
    entry,
    period,
    memberEntries,
    calendarYear,
    context,
  );

  if (!resolved.canSelectDependent) {
    return {
      ...period,
      dependentStatus: 'none',
      taxDependent: false,
      socialInsuranceDependent: false,
    };
  }

  if (
    period.taxDependent === resolved.taxDependent &&
    period.socialInsuranceDependent === resolved.socialInsuranceDependent
  ) {
    return period;
  }

  return {
    ...period,
    taxDependent: resolved.taxDependent,
    socialInsuranceDependent: resolved.socialInsuranceDependent,
  };
}
