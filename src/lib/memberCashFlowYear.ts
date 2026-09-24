import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';
import {
  addInsuranceIncomeBreakdown,
  addPensionBreakdown,
  createEmptyIncomeBreakdown,
  createEmptyPensionBreakdown,
  roundInsuranceIncomeBreakdown,
  roundPensionBreakdown,
  sumIncomeBreakdown,
  sumTaxSocialBreakdown,
  type IncomeBreakdown,
  type MemberCashFlowYearSlice,
  type PensionBreakdown,
  type TaxSocialBreakdown,
} from '../types/cashFlow';
import type { InsuranceState } from '../types/insurance';
import type { PensionByMember, PensionMemberState } from '../types/pension';
import type { SavingsState } from '../types/savings';
import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import {
  isDcCategory,
  reclassifySalaryForSelectiveDc,
  resolveDcContributionAmountsAtAgeMonth,
} from './dcContribution';
import { yenToMan } from './educationCashFlow';
import { calcMemberMonthlyInsuranceIncomeDetailMan } from './insuranceCashFlow';
import {
  calcMemberMonthlyEarnedIncomeBreakdown,
  type EarnedIncomeCalcInput,
} from './memberEarnedIncome';
import { prorateAnnualLevyYen } from './otherCashFlowLinkage';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan } from './pensionIncome';
import { calcPensionPaymentFromEntitlements } from './pensionPaymentSchedule';
import type { MemberTaxBreakdownData } from './taxCalculator';

export interface BuildMemberCashFlowYearSlicesInput {
  familyMembers: FamilyMember[];
  incomeByMember: EarnedIncomeCalcInput['incomeByMember'];
  pensionByMember: PensionByMember;
  insuranceState?: InsuranceState;
  savingsState?: SavingsState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  levyPaymentFactor: number;
  memberTaxBreakdownByMemberId: Record<string, MemberTaxBreakdownData>;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

function calcMemberSelectiveDcManForYear(input: {
  savingsState: SavingsState;
  member: FamilyMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): number {
  const list = input.savingsState.byMember[input.member.id] ?? [];
  let total = 0;

  for (const entry of list) {
    if (!isDcCategory(entry.category)) continue;
    for (let month = input.monthStart; month <= input.monthEnd; month += 1) {
      const ageMonth = getMemberAgeMonth(
        input.member,
        input.referenceDate,
        input.calendarYear,
        month,
      );
      if (!ageMonth) continue;
      total += resolveDcContributionAmountsAtAgeMonth(
        entry,
        ageMonth.age,
        ageMonth.month,
        input.member,
        calcBirthYear(
          input.member.age,
          input.member.birthMonth,
          input.referenceDate,
        ),
      ).employeeMan;
    }
  }

  return total;
}

export function buildMemberTaxSocialBreakdownForCashFlow(
  memberBreakdown: MemberTaxBreakdownData,
  levyPaymentFactor: number,
): TaxSocialBreakdown {
  let incomeTaxCfYen = 0;
  let residentTaxCfYen = 0;
  const giftTaxCfYen = memberBreakdown.giftTax.giftTaxCashFlowYen;
  let employeesPensionYen = 0;
  let healthMedicalYen = 0;
  let healthChildYen = 0;
  let ltcYen = 0;
  let employmentYen = 0;
  let nationalPensionYen = 0;
  let nhiYen = 0;
  let lateElderlyHealthYen = 0;
  let publicLongTermCareYen = 0;

  if (memberBreakdown.isTaxIndependent) {
    incomeTaxCfYen += memberBreakdown.incomeTax.incomeTaxCashFlowYen;
    residentTaxCfYen += memberBreakdown.residentTax.residentTaxCashFlowYen;
  }

  const ins = memberBreakdown.employeeInsurance;
  if (ins.isEmployeeInsured) {
    employeesPensionYen +=
      ins.annualPensionFromSalaryYen + ins.annualPensionFromBonusYen;
    healthMedicalYen += ins.annualHealthMedicalSupportYen;
    healthChildYen += ins.annualHealthChildcareYen;
    ltcYen += ins.annualHealthNursingYen;
    employmentYen += ins.annualEmploymentYen;
  }

  if (memberBreakdown.nhiInsurance.isNhiMember) {
    nationalPensionYen += memberBreakdown.nhiInsurance.nationalPensionYen;
    nhiYen += memberBreakdown.nhiInsurance.memberShareYen;
  }

  if (memberBreakdown.lateElderlyHealth.isApplicable) {
    lateElderlyHealthYen += memberBreakdown.lateElderlyHealth.memberPremiumYen;
  }

  if (
    memberBreakdown.longTermCare.variant === 'first_class' ||
    memberBreakdown.longTermCare.variant === 'late_elderly'
  ) {
    publicLongTermCareYen += memberBreakdown.longTermCare.memberPremiumYen;
  }

  if (levyPaymentFactor < 1) {
    nationalPensionYen = prorateAnnualLevyYen(
      nationalPensionYen,
      levyPaymentFactor,
    );
    nhiYen = prorateAnnualLevyYen(nhiYen, levyPaymentFactor);
    lateElderlyHealthYen = prorateAnnualLevyYen(
      lateElderlyHealthYen,
      levyPaymentFactor,
    );
    publicLongTermCareYen = prorateAnnualLevyYen(
      publicLongTermCareYen,
      levyPaymentFactor,
    );
  }

  return {
    incomeTax: roundMan(yenToMan(incomeTaxCfYen)),
    residentTax: roundMan(yenToMan(residentTaxCfYen)),
    giftTax: roundMan(yenToMan(giftTaxCfYen)),
    socialInsuranceDetail: {
      healthInsurance: roundMan(
        yenToMan(healthMedicalYen + healthChildYen + ltcYen),
      ),
      employeesPension: roundMan(yenToMan(employeesPensionYen)),
      employmentInsurance: roundMan(yenToMan(employmentYen)),
    },
    publicInsuranceDetail: {
      nationalPension: roundMan(yenToMan(nationalPensionYen)),
      nationalHealthInsurance: roundMan(yenToMan(nhiYen)),
      longTermCare: roundMan(yenToMan(publicLongTermCareYen)),
      lateElderlyHealth: roundMan(yenToMan(lateElderlyHealthYen)),
    },
  };
}

function buildMemberIncomeBreakdown(
  input: BuildMemberCashFlowYearSlicesInput,
  member: FamilyMember,
): IncomeBreakdown {
  const earnedInput: EarnedIncomeCalcInput = {
    familyMembers: input.familyMembers,
    incomeByMember: input.incomeByMember,
    referenceDate: input.referenceDate,
  };
  const incomeBreakdown = createEmptyIncomeBreakdown();
  const memberState =
    input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
  const incomeEntries = input.incomeByMember[member.id] ?? [];

  const memberEntitlementsByMonth: PensionBreakdown[] = [];
  memberEntitlementsByMonth[0] =
    calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
      member,
      memberState,
      incomeEntries,
      input.familyMembers,
      input.pensionByMember,
      input.incomeByMember,
      input.referenceDate,
      input.calendarYear - 1,
      12,
    );
  for (let month = 1; month <= 12; month += 1) {
    memberEntitlementsByMonth[month] =
      calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
        member,
        memberState,
        incomeEntries,
        input.familyMembers,
        input.pensionByMember,
        input.incomeByMember,
        input.referenceDate,
        input.calendarYear,
        month,
      );
  }

  for (let month = input.monthStart; month <= input.monthEnd; month += 1) {
    addBreakdown(
      incomeBreakdown,
      calcMemberMonthlyEarnedIncomeBreakdown(
        earnedInput,
        member,
        input.calendarYear,
        month,
      ),
    );

    addPensionBreakdown(
      incomeBreakdown.pension,
      calcPensionPaymentFromEntitlements(
        month,
        memberEntitlementsByMonth[month - 1] ??
          createEmptyPensionBreakdown(),
        memberEntitlementsByMonth[month - 2] ??
          createEmptyPensionBreakdown(),
      ),
    );

    if (input.insuranceState) {
      addInsuranceIncomeBreakdown(
        incomeBreakdown.insurance,
        calcMemberMonthlyInsuranceIncomeDetailMan(
          member,
          input.insuranceState.byMember[member.id] ?? [],
          input.familyMembers,
          input.referenceDate,
          input.calendarYear,
          month,
        ),
      );
    }
  }

  if (input.savingsState) {
    const selectiveDcMan = calcMemberSelectiveDcManForYear({
      savingsState: input.savingsState,
      member,
      referenceDate: input.referenceDate,
      calendarYear: input.calendarYear,
      monthStart: input.monthStart,
      monthEnd: input.monthEnd,
    });
    if (selectiveDcMan > 0) {
      incomeBreakdown.salary = reclassifySalaryForSelectiveDc(
        incomeBreakdown.salary,
        selectiveDcMan,
      );
    }
  }

  return {
    salary: {
      socialInsurance: roundMan(incomeBreakdown.salary.socialInsurance),
      civilMutual: roundMan(incomeBreakdown.salary.civilMutual),
      nationalInsurance: roundMan(incomeBreakdown.salary.nationalInsurance),
      selectiveDc: roundMan(incomeBreakdown.salary.selectiveDc),
    },
    bonus: {
      socialInsurance: roundMan(incomeBreakdown.bonus.socialInsurance),
      civilMutual: roundMan(incomeBreakdown.bonus.civilMutual),
      nationalInsurance: roundMan(incomeBreakdown.bonus.nationalInsurance),
    },
    retirementAllowance: roundMan(incomeBreakdown.retirementAllowance),
    businessCf: roundMan(incomeBreakdown.businessCf),
    realEstateCf: roundMan(incomeBreakdown.realEstateCf),
    pension: roundPensionBreakdown(incomeBreakdown.pension, roundMan),
    insurance: roundInsuranceIncomeBreakdown(
      incomeBreakdown.insurance,
      roundMan,
    ),
    childAllowance: roundMan(incomeBreakdown.childAllowance),
    transferCf: roundMan(incomeBreakdown.transferCf),
    taxFreeIncome: roundMan(incomeBreakdown.taxFreeIncome),
    otherIncome: roundMan(incomeBreakdown.otherIncome),
  };
}

function addBreakdown(target: IncomeBreakdown, source: IncomeBreakdown): void {
  target.salary.socialInsurance += source.salary.socialInsurance;
  target.salary.civilMutual += source.salary.civilMutual;
  target.salary.nationalInsurance += source.salary.nationalInsurance;
  target.salary.selectiveDc += source.salary.selectiveDc;
  target.bonus.socialInsurance += source.bonus.socialInsurance;
  target.bonus.civilMutual += source.bonus.civilMutual;
  target.bonus.nationalInsurance += source.bonus.nationalInsurance;
  target.retirementAllowance += source.retirementAllowance;
  target.businessCf += source.businessCf;
  target.realEstateCf += source.realEstateCf;
  addPensionBreakdown(target.pension, source.pension);
  addInsuranceIncomeBreakdown(target.insurance, source.insurance);
  target.childAllowance += source.childAllowance ?? 0;
  target.transferCf += source.transferCf;
  target.taxFreeIncome += source.taxFreeIncome;
  target.otherIncome += source.otherIncome;
}

export function buildMemberCashFlowYearSlices(
  input: BuildMemberCashFlowYearSlicesInput,
): Record<string, MemberCashFlowYearSlice> {
  const result: Record<string, MemberCashFlowYearSlice> = {};

  for (const member of input.familyMembers) {
    if (member.role !== 'head' && member.role !== 'spouse') continue;

    const memberTax = input.memberTaxBreakdownByMemberId[member.id];
    if (!memberTax) continue;

    const incomeBreakdown = buildMemberIncomeBreakdown(input, member);
    const taxSocialBreakdown = buildMemberTaxSocialBreakdownForCashFlow(
      memberTax,
      input.levyPaymentFactor,
    );
    const taxSocial = roundMan(sumTaxSocialBreakdown(taxSocialBreakdown));

    result[member.id] = {
      income: roundMan(sumIncomeBreakdown(incomeBreakdown)),
      incomeBreakdown,
      taxSocial,
      taxSocialBreakdown,
    };
  }

  return result;
}
