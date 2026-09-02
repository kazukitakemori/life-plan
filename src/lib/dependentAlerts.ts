import { treatsPeriodAsBusinessIncome } from './incomeBreakdown';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry, IncomePeriod } from '../types/income';

export interface DependentAlert {
  id: string;
  message: string;
}

export const SELF_EMPLOYED_SOCIAL_INSURANCE_DEPENDENT_ALERT =
  '事業所得者の社会保険の扶養判定では「収入 − 必要経費」で130万円未満かを判断します（青色申告特別控除は含みません）。ここでは入力された経費をそのまま控除していますが、健康保険組合によって認められる経費の範囲が異なる場合があるため、実際の判定は加入先に確認してください。';

/** 老人扶養控除・同居老親等控除の対象となる最低年齢 */
export const ELDERLY_DEPENDENT_MIN_AGE = 70;

export function isParentOrGrandparent(member: FamilyMember): boolean {
  if (member.role !== 'other') return false;
  const rel = member.otherRelationship;
  return rel === 'parent' || rel === 'grandparent';
}

/** 70歳以上の親・祖父母（老人扶養・同居老親等控除の対象） */
export function isElderlyParentOrGrandparent(member: FamilyMember): boolean {
  return isParentOrGrandparent(member) && (member.age ?? 0) >= ELDERLY_DEPENDENT_MIN_AGE;
}

/** 70歳以上の親・祖父母で、税法上の扶養を想定しているときにQ8年金入力を促す */
export function shouldShowParentPensionGuide(member: FamilyMember): boolean {
  if (!isElderlyParentOrGrandparent(member)) return false;
  return member.taxDependentDefault ?? true;
}

export function getParentPensionGuideDeductionLabel(member: FamilyMember): string {
  const cohabiting = member.isCohabiting ?? false;
  return cohabiting ? '同居老親等控除' : '老人扶養控除';
}

export function buildParentPensionGuideMessage(
  memberLabel: string,
  deductionLabel: string,
): string {
  return (
    `正確な${deductionLabel}の判定には、${memberLabel}の年金所得の入力が必要です。` +
    'Q8（年金）で受給額を登録してください（手入力でも可）。' +
    '65歳以上で年金のみの場合も、合計所得が58万円を超えると扶養の範囲外になります（令和7年分以降）。'
  );
}

export function getPeriodDependentAlerts(
  member: FamilyMember,
  entry: IncomeEntry,
  period: IncomePeriod,
): DependentAlert[] {
  if (member.role !== 'spouse') return [];
  if (!treatsPeriodAsBusinessIncome(entry.category, period.streamType)) {
    return [];
  }
  if (period.dependentStatus !== 'dependent') return [];

  return [
    {
      id: 'self-employed-social-insurance-soft',
      message: SELF_EMPLOYED_SOCIAL_INSURANCE_DEPENDENT_ALERT,
    },
  ];
}
