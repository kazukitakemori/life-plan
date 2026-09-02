import { resolveMemberBirthMonth } from './familyDefaults';
import { calcBirthYear } from './birthDate';
import { qualifiesForIncomeAdjustmentDeduction } from './incomeAdjustmentDeduction';
import { calcIncomeAdjustmentDeductionYen } from './incomeTaxDeductions';
import {
  calcMemberSalaryBreakdownYenForTaxYear,
  buildMemberIncomeProfileFromIncomeTaxAnnualBasis,
} from './memberYearIncome';
import {
  calcOtherIncomeExcludingPensionYen,
  calcPensionMiscIncomeYen,
} from './publicPensionDeduction';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';

const MAN_TO_YEN = 10_000;

function getMemberAgeAtYearEnd(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
): number | null {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let age = calendarYear - birthYear;
  if (12 < resolveMemberBirthMonth(member)) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

/** 配偶者控除・配偶者特別控除の判定に用いる合計所得金額（円） */
export function calcTaxpayerTotalIncomeYenForSpouseDeduction(input: {
  taxableIncomeYen: number;
  annualPensionYen?: number;
  age?: number | null;
  incomeAdjustmentDeductionYen?: number;
}): number {
  const pensionYen = input.annualPensionYen ?? 0;
  const age = input.age ?? 65;
  const incomeAdjustmentDeductionYen = input.incomeAdjustmentDeductionYen ?? 0;
  const otherIncomeYen = calcOtherIncomeExcludingPensionYen(
    input.taxableIncomeYen,
    incomeAdjustmentDeductionYen,
  );
  const pensionIncomeYen = calcPensionMiscIncomeYen(
    pensionYen,
    age,
    otherIncomeYen,
  );
  return Math.max(
    0,
    input.taxableIncomeYen +
      pensionIncomeYen -
      incomeAdjustmentDeductionYen,
  );
}

export interface HeadSpouseDeductionIncomeInput {
  head: FamilyMember;
  headEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  referenceDate: Date;
  calendarYear: number;
  annualPensionMan?: number;
}

/** 世帯主の合計所得金額（円）— 配偶者控除の本人所得要件に使用 */
export function resolveHeadTotalIncomeYenForSpouseDeduction(
  input: HeadSpouseDeductionIncomeInput,
): number {
  const annualProfile = buildMemberIncomeProfileFromIncomeTaxAnnualBasis(
    input.head,
    input.headEntries,
    input.calendarYear,
    input.referenceDate,
  );
  if (!annualProfile?.hasActiveIncomeBlock) {
    return 0;
  }

  const salaryBreakdown = calcMemberSalaryBreakdownYenForTaxYear({
    member: input.head,
    entries: input.headEntries,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
    annualize: true,
  });
  const qualifies = qualifiesForIncomeAdjustmentDeduction({
    salaryRevenueYen: salaryBreakdown.grossSalaryRevenueYen,
    taxpayer: input.head,
    familyMembers: input.familyMembers,
    referenceDate: input.referenceDate,
    calendarYear: input.calendarYear,
  });
  const incomeAdjustmentDeductionYen = calcIncomeAdjustmentDeductionYen(
    salaryBreakdown.grossSalaryRevenueYen,
    qualifies,
  );

  return calcTaxpayerTotalIncomeYenForSpouseDeduction({
    taxableIncomeYen: Math.round(annualProfile.taxableIncomeMan * MAN_TO_YEN),
    annualPensionYen: Math.round((input.annualPensionMan ?? 0) * MAN_TO_YEN),
    age: getMemberAgeAtYearEnd(
      input.head,
      input.referenceDate,
      input.calendarYear,
    ),
    incomeAdjustmentDeductionYen,
  });
}
