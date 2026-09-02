import type { FamilyMember } from '../types/family';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import { INCOME_ADJUSTMENT_SALARY_THRESHOLD_YEN } from './incomeTaxDeductions';

/**
 * 所得金額調整控除の対象要件（いずれか）を満たすか。
 * 参考: https://www.mmea.biz/news/12746-2/
 *
 * - 本人が特別障害者
 * - 年齢23歳未満の扶養親族がいる
 * - 同一生計配偶者が特別障害者
 * - 扶養親族が特別障害者
 *
 * 障害者区分は「障害あり」で特別障害者相当として概算する。
 */
export function qualifiesForIncomeAdjustmentDeduction(input: {
  salaryRevenueYen: number;
  taxpayer: FamilyMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  calendarYear: number;
}): boolean {
  if (input.salaryRevenueYen <= INCOME_ADJUSTMENT_SALARY_THRESHOLD_YEN) {
    return false;
  }

  if (input.taxpayer.disability === 'has') {
    return true;
  }

  for (const member of input.familyMembers) {
    if (member.role === 'spouse' && member.disability === 'has') {
      return true;
    }

    if (member.role === 'child' || member.role === 'other') {
      if (member.disability === 'has') {
        return true;
      }

      const age = getMemberAgeAtYearEnd(
        member,
        input.referenceDate,
        input.calendarYear,
      );
      if (age != null && age < 23) {
        return true;
      }
    }
  }

  return false;
}
