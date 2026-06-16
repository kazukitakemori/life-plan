import {
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
  SPOUSE_TOTAL_INCOME_LIMIT_YEN,
} from './incomeTaxDeductions';
import { treatsPeriodAsBusinessIncome } from './incomeBreakdown';
import {
  calcCombinedIncomeForOverlappingPeriods,
  countOverlappingIncomeEntries,
} from './memberCombinedIncome';
import {
  allowsSocialInsuranceDependentDefault,
  allowsTaxDependentDefault,
} from './memberDependentDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry, IncomePeriod } from '../types/income';

const MAN_TO_YEN = 10_000;

/** 税法上の扶養：合計所得金額の上限（万円） */
export const TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN =
  SPOUSE_TOTAL_INCOME_LIMIT_YEN / MAN_TO_YEN;

/** 配偶者特別控除の合計所得金額上限（万円） */
export const SPOUSE_SPECIAL_DEDUCTION_TOTAL_INCOME_LIMIT_MAN =
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN / MAN_TO_YEN;

/** 社会保険の被扶養者の収入上限（万円・以上で不可） */
export const SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN = 130;

export interface DependentValidationIssue {
  id: string;
  message: string;
}

function formatIncomeMan(amountMan: number): string {
  if (Number.isInteger(amountMan)) {
    return `${amountMan}万円`;
  }
  return `${amountMan.toFixed(1)}万円`;
}

/**
 * child/other メンバーのデフォルト扶養設定に関する警告を返す。
 * Q1（家族ページ）の扶養設定トグルの隣に表示する用途。
 */
export function validateMemberDependentDefaults(
  member: FamilyMember,
): DependentValidationIssue[] {
  if (member.role !== 'child' && member.role !== 'other') return [];

  const issues: DependentValidationIssue[] = [];

  if (
    member.role === 'other' &&
    member.otherRelationship === 'common_law_partner' &&
    (member.taxDependentDefault ?? true)
  ) {
    issues.push({
      id: 'common-law-tax-dependent-warning',
      message:
        '内縁の配偶者は親族に該当しないため、税法上の扶養控除の対象にはなりません。同居・生計が同一であっても、法律上の婚姻関係がなければ配偶者控除・扶養控除は適用されません。社会保険の扶養（収入130万円未満）は可能です。',
    });
  }

  return issues;
}

/**
 * child/other が所得超過・社保収入超過の場合の期間単位アラートを返す。
 * Q7（収入ページ）の期間ごとに表示する用途。
 */
export function validateDependentMemberPeriod(
  member: FamilyMember,
  entry: IncomeEntry,
  period: IncomePeriod,
  memberEntries: IncomeEntry[] = [entry],
): DependentValidationIssue[] {
  if (member.role !== 'child' && member.role !== 'other') return [];

  const issues: DependentValidationIssue[] = [];

  if (period.taxDependent && !allowsTaxDependentDefault(member)) {
    issues.push({
      id: 'q1-tax-dependent-disabled',
      message:
        'ご家族（Q1）で「税法上の扶養に入れる」がオフのため、この期間では税法上の扶養に設定できません。',
    });
  }

  if (period.socialInsuranceDependent && !allowsSocialInsuranceDependentDefault(member)) {
    issues.push({
      id: 'q1-social-insurance-disabled',
      message:
        'ご家族（Q1）で「社会保険の扶養に入れる」がオフのため、この期間では社会保険の扶養に設定できません。',
    });
  }

  if (period.dependentStatus !== 'dependent') return issues;

  const { totalIncomeMan, socialInsuranceIncomeMan } =
    calcCombinedIncomeForOverlappingPeriods(memberEntries, period);
  const hasMultipleSources =
    countOverlappingIncomeEntries(memberEntries, period) > 1;

  if (period.taxDependent && totalIncomeMan > TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN) {
    issues.push({
      id: 'child-other-tax-income-over-limit',
      message: `合計所得金額が${TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN}万円を超えているため、税法上の扶養控除が適用されません。（${hasMultipleSources ? '収入合算・' : ''}合計所得：${formatIncomeMan(totalIncomeMan)}）`,
    });
  }

  if (
    period.socialInsuranceDependent &&
    socialInsuranceIncomeMan >= SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN
  ) {
    issues.push({
      id: 'child-other-social-insurance-income-over-limit',
      message: `年収（額面）合算が${SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN}万円以上のため、社会保険の扶養には入れません。（${hasMultipleSources ? '収入合算・' : ''}合算額：${formatIncomeMan(socialInsuranceIncomeMan)}）`,
    });
  }

  return issues;
}

export function validatePeriodDependentSettings(
  member: FamilyMember,
  entry: IncomeEntry,
  period: IncomePeriod,
  familyMembers: FamilyMember[],
  memberEntries: IncomeEntry[] = [entry],
): DependentValidationIssue[] {
  if (period.dependentStatus !== 'dependent') {
    return [];
  }

  const issues: DependentValidationIssue[] = [];
  const hasSpouse = familyMembers.some((m) => m.role === 'spouse');
  const { totalIncomeMan, socialInsuranceIncomeMan } =
    calcCombinedIncomeForOverlappingPeriods(memberEntries, period);
  const hasMultipleSources =
    countOverlappingIncomeEntries(memberEntries, period) > 1;

  if (!hasSpouse) {
    issues.push({
      id: 'no-spouse',
      message:
        '配偶者が登録されていないため、「扶養に入る」は設定できません。ご家族（Q1）で配偶者を登録してください。',
    });
    return issues;
  }

  if (member.role === 'head') {
    issues.push({
      id: 'head-cannot-be-dependent',
      message:
        '世帯主の収入期間では「扶養に入る」は設定できません。配偶者の収入期間で設定してください。',
    });
  }

  if (!period.taxDependent && !period.socialInsuranceDependent) {
    issues.push({
      id: 'no-dependent-target',
      message:
        '「扶養に入る」を選択した場合、税法上または社会保険の扶養のいずれかにチェックが必要です。',
    });
  }

  if (
    period.taxDependent &&
    totalIncomeMan > TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN
  ) {
    if (totalIncomeMan <= SPOUSE_SPECIAL_DEDUCTION_TOTAL_INCOME_LIMIT_MAN) {
      issues.push({
        id: 'tax-income-special-range',
        message: `合計所得金額が${TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN}万円を超えているため、税法上の扶養には入れません。世帯主には配偶者特別控除が適用されます。（${hasMultipleSources ? '収入合算・' : ''}合計所得：${formatIncomeMan(totalIncomeMan)}）`,
      });
    } else {
      issues.push({
        id: 'tax-income-over-limit',
        message: `合計所得金額が${SPOUSE_SPECIAL_DEDUCTION_TOTAL_INCOME_LIMIT_MAN}万円を超えているため、税法上の扶養・配偶者控除は適用されません。（${hasMultipleSources ? '収入合算・' : ''}合計所得：${formatIncomeMan(totalIncomeMan)}）`,
      });
    }
  }

  if (
    period.socialInsuranceDependent &&
    socialInsuranceIncomeMan >= SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN
  ) {
    const isBusiness = treatsPeriodAsBusinessIncome(entry.category, period.streamType);
    const incomeLabel = hasMultipleSources
      ? '収入合算'
      : isBusiness
        ? '収入（額面 − 必要経費）'
        : '年収（額面）';
    issues.push({
      id: 'social-insurance-income-over-limit',
      message: `${incomeLabel}が${SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN}万円以上のため、社会保険の扶養には入れません。（${incomeLabel}：${formatIncomeMan(socialInsuranceIncomeMan)}）`,
    });
  }

  return issues;
}
