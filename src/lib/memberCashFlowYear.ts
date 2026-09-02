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
  sumPensionBreakdown,
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
import { calcMemberMonthlyPensionBreakdownMan } from './pensionIncome';
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
  householdEntitlementsByMonth: PensionBreakdown[];
  memberTaxBreakdownByMemberId: Record<string, MemberTaxBreakdownData>;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

function scalePensionBreakdown(
  source: PensionBreakdown,
  factor: number,
): PensionBreakdown {
  if (factor <= 0) return createEmptyPensionBreakdown();
  if (factor >= 1) {
    const copy = createEmptyPensionBreakdown();
    addPensionBreakdown(copy, source);
    return copy;
  }

  const scaled = JSON.parse(JSON.stringify(source)) as PensionBreakdown;
  const scaleRecord = (record: Record<string, number>) => {
    for (const key of Object.keys(record)) {
      record[key] = record[key] * factor;
    }
  };

  scaleRecord(scaled.oldAge.basic as unknown as Record<string, number>);
  scaleRecord(scaled.oldAge.generalEmployees as unknown as Record<string, number>);
  scaleRecord(scaled.oldAge.publicServant as unknown as Record<string, number>);
  scaleRecord(scaled.disability.basic as unknown as Record<string, number>);
  scaleRecord(scaled.disability.employees as unknown as Record<string, number>);
  scaleRecord(scaled.survivor.basic as unknown as Record<string, number>);
  scaleRecord(scaled.survivor.employees as unknown as Record<string, number>);

  return scaled;
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

function resolveMemberMonthlyPensionEntitlement(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  householdEntitlement: PensionBreakdown,
  memberEntitlements: Record<string, PensionBreakdown>,
  headMember: FamilyMember | undefined,
): PensionBreakdown {
  const entitlement = calcMemberMonthlyPensionBreakdownMan(
    member,
    memberState,
    incomeEntries,
    referenceDate,
    calendarYear,
    calendarMonth,
  );

  if (!headMember || member.id !== headMember.id) {
    return entitlement;
  }

  const householdTotal = sumPensionBreakdown(householdEntitlement);
  const memberTotal = Object.values(memberEntitlements).reduce(
    (sum, value) => sum + sumPensionBreakdown(value),
    0,
  );
  const gap = Math.max(0, householdTotal - memberTotal);
  if (gap <= 0) {
    return entitlement;
  }

  const adjusted = createEmptyPensionBreakdown();
  addPensionBreakdown(adjusted, entitlement);
  adjusted.oldAge.generalEmployees.dependent += gap;
  return adjusted;
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
  const headMember = input.familyMembers.find((m) => m.role === 'head');
  const memberState =
    input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
  const incomeEntries = input.incomeByMember[member.id] ?? [];

  const memberEntitlementsByMonth: PensionBreakdown[] = [];
  for (let month = 0; month <= 12; month += 1) {
    if (month === 0) {
      memberEntitlementsByMonth[month] =
        input.householdEntitlementsByMonth[0] ?? createEmptyPensionBreakdown();
      continue;
    }

    const perMember: Record<string, PensionBreakdown> = {};
    for (const familyMember of input.familyMembers) {
      if (familyMember.role === 'pet') continue;
      perMember[familyMember.id] = calcMemberMonthlyPensionBreakdownMan(
        familyMember,
        input.pensionByMember[familyMember.id] ??
          createDefaultPensionMemberState(),
        input.incomeByMember[familyMember.id] ?? [],
        input.referenceDate,
        input.calendarYear,
        month,
      );
    }

    memberEntitlementsByMonth[month] = resolveMemberMonthlyPensionEntitlement(
      member,
      memberState,
      incomeEntries,
      input.referenceDate,
      input.calendarYear,
      month,
      input.householdEntitlementsByMonth[month] ??
        createEmptyPensionBreakdown(),
      perMember,
      headMember,
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

    const householdPayment = calcPensionPaymentFromEntitlements(
      month,
      input.householdEntitlementsByMonth[month - 1] ??
        createEmptyPensionBreakdown(),
      input.householdEntitlementsByMonth[month - 2] ??
        createEmptyPensionBreakdown(),
    );
    const householdEntitlementTotal =
      sumPensionBreakdown(
        input.householdEntitlementsByMonth[month - 1] ??
          createEmptyPensionBreakdown(),
      ) +
      sumPensionBreakdown(
        input.householdEntitlementsByMonth[month - 2] ??
          createEmptyPensionBreakdown(),
      );
    const memberEntitlementTotal =
      sumPensionBreakdown(
        memberEntitlementsByMonth[month - 1] ?? createEmptyPensionBreakdown(),
      ) +
      sumPensionBreakdown(
        memberEntitlementsByMonth[month - 2] ?? createEmptyPensionBreakdown(),
      );
    const share =
      householdEntitlementTotal > 0
        ? memberEntitlementTotal / householdEntitlementTotal
        : 0;
    addPensionBreakdown(
      incomeBreakdown.pension,
      scalePensionBreakdown(householdPayment, share),
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
