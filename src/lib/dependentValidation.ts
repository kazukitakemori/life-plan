import {
  calcApproximateEmployeeGrossYenForTotalIncomeYen,
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
} from './incomeTaxDeductions';
import { getSpouseTotalIncomeLimitYen } from './spouseDeduction';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry, IncomePeriod } from '../types/income';

const MAN_TO_YEN = 10_000;

/** 税法上の扶養：合計所得金額の上限（万円・令和7年分以降の試算デフォルト） */
export function getTaxDependentTotalIncomeLimitMan(calendarYear = 2026): number {
  return getSpouseTotalIncomeLimitYen(calendarYear) / MAN_TO_YEN;
}

/** @deprecated getTaxDependentTotalIncomeLimitMan(calendarYear) を使用 */
export const TAX_DEPENDENT_TOTAL_INCOME_LIMIT_MAN =
  getTaxDependentTotalIncomeLimitMan(2026);

/**
 * 給与所得のみ・賞与なしの場合、合計所得が扶養・配偶者控除の上限に収まる
 * おおよその年収（額面・万円）。令和7年分以降は約123万円（旧103万円の壁は48万円上限時代）。
 */
export function getApproximateEmployeeGrossLimitManForTaxDependent(
  calendarYear = 2026,
): number {
  const totalIncomeLimitYen = getSpouseTotalIncomeLimitYen(calendarYear);
  return (
    calcApproximateEmployeeGrossYenForTotalIncomeYen(
      totalIncomeLimitYen,
      calendarYear,
    ) / MAN_TO_YEN
  );
}

/** 配偶者特別控除がなくなるおおよその年収（額面・万円・給与のみ） */
export function getApproximateEmployeeGrossLimitManForSpouseSpecialDeduction(
  calendarYear = 2026,
): number {
  return (
    calcApproximateEmployeeGrossYenForTotalIncomeYen(
      SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN,
      calendarYear,
    ) / MAN_TO_YEN
  );
}

/** 配偶者特別控除の合計所得金額上限（万円） */
export const SPOUSE_SPECIAL_DEDUCTION_TOTAL_INCOME_LIMIT_MAN =
  SPOUSE_SPECIAL_DEDUCTION_INCOME_LIMIT_YEN / MAN_TO_YEN;

/** 社会保険の被扶養者の収入上限（万円・以上で不可） */
export const SOCIAL_INSURANCE_DEPENDENT_INCOME_LIMIT_MAN = 130;

export interface DependentValidationIssue {
  id: string;
  message: string;
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

/** child/other の期間単位バリデーション（自動判定のため所得超過は表示のみ） */
export function validateDependentMemberPeriod(
  member: FamilyMember,
  _entry: IncomeEntry,
  period: IncomePeriod,
  _memberEntries: IncomeEntry[] = [],
  _calendarYear = 2026,
): DependentValidationIssue[] {
  if (member.role !== 'child' && member.role !== 'other') return [];
  if (period.dependentStatus !== 'dependent') return [];
  return [];
}

export function validatePeriodDependentSettings(
  member: FamilyMember,
  _entry: IncomeEntry,
  period: IncomePeriod,
  familyMembers: FamilyMember[],
  _memberEntries: IncomeEntry[] = [],
  _calendarYear = 2026,
): DependentValidationIssue[] {
  if (period.dependentStatus !== 'dependent') {
    return [];
  }

  const issues: DependentValidationIssue[] = [];
  const hasSpouse = familyMembers.some((m) => m.role === 'spouse');

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

  return issues;
}
