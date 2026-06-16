import {
  calcBirthYear,
  calcYearAtAge,
  getMemberAgeMonth,
} from './birthDate';
import { calcMonthlyEquivalentMan } from './livingAmount';
import { getMemberTabLabel } from './memberDisplay';
import {
  resolveBonusStreamKey,
  resolveOtherIncomeKey,
  resolveSalaryStreamKey,
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';
import type {
  CashFlowTableData,
  CashFlowYearRow,
  ExpenseBreakdown,
  IncomeBreakdown,
} from '../types/cashFlow';
import {
  addPensionBreakdown,
  createEmptyExpenseBreakdown,
  createEmptyIncomeBreakdown,
  createEmptyLifeEventExpenseDetail,
  createEmptyPensionBreakdown,
  roundPensionBreakdown,
  sumExpenseBreakdown,
  sumIncomeBreakdown,
  sumLifeEventExpenseDetail,
  sumPensionBreakdown,
} from '../types/cashFlow';
import {
  calcMemberMonthlyPensionBreakdownMan,
  calcMonthlyPensionEntitlementBreakdownMan,
} from './pensionIncome';
import { createDefaultPensionMemberState } from './pensionDefaults';
import { calcPensionPaymentFromEntitlements } from './pensionPaymentSchedule';
import { calcMemberMonthlyEducationYen, yenToMan } from './educationCashFlow';
import type { FamilyMember } from '../types/family';
import type { EducationByMember } from '../types/education';
import type { LifeEventState } from '../types/lifeEvent';
import type { IncomeByMember, IncomeEntry, IncomePeriod } from '../types/income';
import { calcHouseholdMonthlyLifeEventBreakdownMan } from './lifeEventCashFlow';
import type { PensionByMember } from '../types/pension';
import type { TaxSocialState } from '../types/taxSocial';
import { calcHouseholdTaxSocialMan } from './taxCalculator';
import {
  HOUSEHOLD_LIVING_KEY,
  type LivingExpenseSchedule,
  type LivingExpenseState,
} from '../types/living';

export interface CashFlowInput {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  taxSocialState: TaxSocialState;
  referenceDate: Date;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isInAgeMonthRange(
  age: number,
  month: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): boolean {
  const current = ageMonthIndex(age, month);
  const start = ageMonthIndex(startAge, startMonth);
  const end = ageMonthIndex(endAge, endMonth);
  return current >= start && current <= end;
}

function yearsElapsedSince(
  birthYear: number,
  birthMonth: number,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  const fromCalYear = calcYearAtAge(birthYear, birthMonth, fromAge, fromMonth);
  const months =
    (toYear - fromCalYear) * 12 + (toMonth - fromMonth);
  return Math.max(0, Math.floor(months / 12));
}

function getPeriodIncomeFactor(
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  if (
    !isInAgeMonthRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
    )
  ) {
    return 0;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    period.startAge,
    period.startMonth,
    calendarYear,
    calendarMonth,
  );

  const increaseRate = period.annualIncreaseRate ?? 0;
  return Math.pow(1 + increaseRate / 100, yearsElapsed);
}

function calcIncomeBreakdownManForMonth(
  entry: IncomeEntry,
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): IncomeBreakdown {
  const result = createEmptyIncomeBreakdown();
  const factor = getPeriodIncomeFactor(
    period,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (factor === 0) return result;

  if (treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
    const salaryKey = resolveSalaryStreamKey(period.streamType);
    if (salaryKey) {
      result.salary[salaryKey] += Math.max(0, period.monthlyAmountMan * factor);
    }

    const bonusKey = resolveBonusStreamKey(period.streamType);
    if (bonusKey) {
      for (const bonus of period.bonuses) {
        if (bonus.paymentMonth === calendarMonth) {
          result.bonus[bonusKey] += bonus.amountMan * factor;
        }
      }
    }
    return result;
  }

  const otherKey = resolveOtherIncomeKey(entry.category, period.streamType);
  if (otherKey) {
    let monthlyMan = period.monthlyAmountMan * factor;
    if (
      treatsPeriodAsBusinessIncome(entry.category, period.streamType) &&
      entry.expenseManPerMonth != null
    ) {
      monthlyMan -= entry.expenseManPerMonth * factor;
    }
    result[otherKey] += Math.max(0, monthlyMan);
  }

  return result;
}

function addBreakdown(
  target: IncomeBreakdown,
  source: IncomeBreakdown,
): void {
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
  target.insurancePayout += source.insurancePayout;
  target.transferCf += source.transferCf;
  target.taxFreeIncome += source.taxFreeIncome;
  target.otherIncome += source.otherIncome;
}

function getScheduleEnd(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (schedule.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: schedule.endAge, endMonth: schedule.endMonth };
}

function calcLivingManForMonth(
  schedule: LivingExpenseSchedule,
  member: FamilyMember,
  livingState: LivingExpenseState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  const { endAge, endMonth } = getScheduleEnd(schedule, member);
  if (
    !isInAgeMonthRange(
      ageMonth.age,
      ageMonth.month,
      schedule.startAge,
      schedule.startMonth,
      endAge,
      endMonth,
    )
  ) {
    return 0;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    schedule.startAge,
    schedule.startMonth,
    calendarYear,
    calendarMonth,
  );

  const baseMonthlyMan = calcMonthlyEquivalentMan(schedule.items);
  const inflationFactor = Math.pow(
    1 + livingState.inflationRate / 100,
    yearsElapsed,
  );

  let itemFactor = 1;
  const firstItem = schedule.items[0];
  if (firstItem?.increaseRate != null) {
    itemFactor = Math.pow(1 + firstItem.increaseRate / 100, yearsElapsed);
  }

  return baseMonthlyMan * inflationFactor * itemFactor;
}

function calcMonthlyIncomeBreakdown(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
): IncomeBreakdown {
  const total = createEmptyIncomeBreakdown();

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;

    const entries = input.incomeByMember[member.id] ?? [];
    for (const entry of entries) {
      if (entry.spouseContingencyOnly) continue;
      for (const period of entry.periods) {
        addBreakdown(
          total,
          calcIncomeBreakdownManForMonth(
            entry,
            period,
            member,
            input.referenceDate,
            calendarYear,
            calendarMonth,
          ),
        );
      }
    }
  }

  return total;
}

function calcMonthlyIncomeBreakdownWithPension(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
  pensionPayment: IncomeBreakdown['pension'],
): IncomeBreakdown {
  const total = calcMonthlyIncomeBreakdown(input, calendarYear, calendarMonth);
  addBreakdown(total, {
    ...createEmptyIncomeBreakdown(),
    pension: pensionPayment,
  });
  return total;
}

function calcMonthlyLivingMan(
  input: CashFlowInput,
  calendarYear: number,
  calendarMonth: number,
): number {
  let total = 0;

  for (const [targetId, schedules] of Object.entries(
    input.livingState.byTarget,
  )) {
    const member =
      targetId === HOUSEHOLD_LIVING_KEY
        ? input.familyMembers.find((m) => m.role === 'head')
        : input.familyMembers.find((m) => m.id === targetId);

    if (!member) continue;

    for (const schedule of schedules) {
      total += calcLivingManForMonth(
        schedule,
        member,
        input.livingState,
        input.referenceDate,
        calendarYear,
        calendarMonth,
      );
    }
  }

  return total;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildCashFlowTable(input: CashFlowInput): CashFlowTableData {
  const head = input.familyMembers.find((m) => m.role === 'head');
  if (!head) {
    return {
      startYear: 0,
      endYear: 0,
      memberAgeRows: [],
      expenseEducationMembers: [],
      years: [],
    };
  }

  const birthYear = calcBirthYear(head.age, head.birthMonth, input.referenceDate);
  const startYear = input.referenceDate.getFullYear();
  const endYear = calcYearAtAge(
    birthYear,
    head.birthMonth,
    head.expectedLifespan,
    12,
  );

  const displayMembers = input.familyMembers.filter((m) => m.role !== 'pet');
  const expenseEducationMembers = displayMembers.map((member) => ({
    memberId: member.id,
    label: getMemberTabLabel(member),
  }));
  const expenseMemberIds = expenseEducationMembers.map((row) => row.memberId);
  const memberAgeRows = displayMembers.map((member) => {
    const agesByYear: Record<number, number | null> = {};
    for (let year = startYear; year <= endYear; year++) {
      const ageMonth = getMemberAgeMonth(
        member,
        input.referenceDate,
        year,
        12,
      );
      agesByYear[year] = ageMonth?.age ?? null;
    }
    return {
      memberId: member.id,
      label: getMemberTabLabel(member),
      agesByYear,
    };
  });

  const years: CashFlowYearRow[] = [];
  let financialAssets = 0;
  let entitlementPreviousYearDecember =
    createEmptyPensionBreakdown();

  for (let year = startYear; year <= endYear; year++) {
    const incomeBreakdown = createEmptyIncomeBreakdown();
    const expenseBreakdown: ExpenseBreakdown =
      createEmptyExpenseBreakdown(expenseMemberIds);
    let annualLiving = 0;
    let annualMedicalCare = 0;
    const annualLifeEventDetail = createEmptyLifeEventExpenseDetail();

    const monthStart = year === startYear ? input.referenceDate.getMonth() + 1 : 1;
    const monthEnd = 12;

    const entitlementsByMonth: IncomeBreakdown['pension'][] = [];
    entitlementsByMonth[0] = entitlementPreviousYearDecember;

    for (let month = 1; month <= 12; month++) {
      entitlementsByMonth[month] = calcMonthlyPensionEntitlementBreakdownMan(
        input.familyMembers,
        input.pensionByMember,
        input.incomeByMember,
        input.referenceDate,
        year,
        month,
      );
    }

    // ── メンバー別年間年金受給額（税計算用）────────────────────────────────
    // 課税標準は支払ベースではなく受給権ベース（毎月の受給額合計）で近似する。
    // 加給年金・振替加算などの世帯加算分は世帯主に帰属させる。
    const memberAnnualPensionMan: Record<string, number> = {};
    for (const member of input.familyMembers) {
      if (member.role === 'pet') continue;
      const memberState =
        input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
      const incomeEntries = input.incomeByMember[member.id] ?? [];
      let memberPension = 0;
      for (let month = monthStart; month <= monthEnd; month++) {
        memberPension += sumPensionBreakdown(
          calcMemberMonthlyPensionBreakdownMan(
            member,
            memberState,
            incomeEntries,
            input.referenceDate,
            year,
            month,
          ),
        );
      }
      memberAnnualPensionMan[member.id] = memberPension;
    }
    // 世帯合計（加給年金・振替加算を含む）と個人合計の差を世帯主に帰属
    const householdPensionTotal = Array.from(
      { length: monthEnd - monthStart + 1 },
      (_, i) => monthStart + i,
    ).reduce(
      (sum, m) =>
        sum + sumPensionBreakdown(entitlementsByMonth[m] ?? createEmptyPensionBreakdown()),
      0,
    );
    const memberPensionTotal = Object.values(memberAnnualPensionMan).reduce(
      (sum, v) => sum + v,
      0,
    );
    const pensionAdditions = Math.max(0, householdPensionTotal - memberPensionTotal);
    if (pensionAdditions > 0) {
      memberAnnualPensionMan[head.id] =
        (memberAnnualPensionMan[head.id] ?? 0) + pensionAdditions;
    }

    for (let month = monthStart; month <= monthEnd; month++) {
      const pensionPayment = calcPensionPaymentFromEntitlements(
        month,
        entitlementsByMonth[month - 1] ?? createEmptyPensionBreakdown(),
        entitlementsByMonth[month - 2] ?? createEmptyPensionBreakdown(),
      );

      addBreakdown(
        incomeBreakdown,
        calcMonthlyIncomeBreakdownWithPension(
          input,
          year,
          month,
          pensionPayment,
        ),
      );
      annualLiving += calcMonthlyLivingMan(input, year, month);

      const lifeEventBreakdown = calcHouseholdMonthlyLifeEventBreakdownMan(
        input.familyMembers,
        input.lifeEventState,
        input.referenceDate,
        year,
        month,
      );
      annualLifeEventDetail.travel += lifeEventBreakdown.detail.travel;
      annualLifeEventDetail.appliance += lifeEventBreakdown.detail.appliance;
      annualLifeEventDetail.celebration += lifeEventBreakdown.detail.celebration;
      annualLifeEventDetail.other += lifeEventBreakdown.detail.other;
      annualMedicalCare += lifeEventBreakdown.medicalCare;

      for (const member of displayMembers) {
        const entries = input.educationByMember[member.id] ?? [];
        const monthlyYen = calcMemberMonthlyEducationYen(
          member,
          entries,
          input.referenceDate,
          year,
          month,
        );
        expenseBreakdown.educationByMember[member.id] += yenToMan(monthlyYen);
      }
    }

    expenseBreakdown.living = roundMan(annualLiving);
    expenseBreakdown.lifeEventDetail = {
      travel: roundMan(annualLifeEventDetail.travel),
      appliance: roundMan(annualLifeEventDetail.appliance),
      celebration: roundMan(annualLifeEventDetail.celebration),
      other: roundMan(annualLifeEventDetail.other),
    };
    expenseBreakdown.lifeEvent = roundMan(
      sumLifeEventExpenseDetail(expenseBreakdown.lifeEventDetail),
    );
    expenseBreakdown.medicalCare = roundMan(annualMedicalCare);
    for (const memberId of expenseMemberIds) {
      expenseBreakdown.educationByMember[memberId] = roundMan(
        expenseBreakdown.educationByMember[memberId],
      );
    }

    entitlementPreviousYearDecember =
      entitlementsByMonth[12] ?? createEmptyPensionBreakdown();

    const roundedBreakdown: IncomeBreakdown = {
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
      insurancePayout: roundMan(incomeBreakdown.insurancePayout),
      transferCf: roundMan(incomeBreakdown.transferCf),
      taxFreeIncome: roundMan(incomeBreakdown.taxFreeIncome),
      otherIncome: roundMan(incomeBreakdown.otherIncome),
    };

    const annualIncome = roundMan(sumIncomeBreakdown(roundedBreakdown));
    const taxBreakdown = calcHouseholdTaxSocialMan({
      familyMembers: input.familyMembers,
      incomeByMember: input.incomeByMember,
      referenceDate: input.referenceDate,
      calendarYear: year,
      monthStart,
      monthEnd,
      annualPensionManByMember: memberAnnualPensionMan,
    });
    const taxSocial = taxBreakdown.totalMan;
    const disposableIncome = roundMan(annualIncome - taxSocial);
    const annualExpenditure = roundMan(sumExpenseBreakdown(expenseBreakdown));
    const annualBalance = roundMan(disposableIncome - annualExpenditure);
    const savings = annualBalance;
    financialAssets += savings;

    const taxSocialBreakdown = {
      incomeTax: roundMan(taxBreakdown.incomeTaxMan),
      residentTax: roundMan(taxBreakdown.residentTaxMan),
      socialInsuranceDetail: {
        healthInsurance: roundMan(taxBreakdown.socialInsurance.healthInsurance),
        employeesPension: roundMan(taxBreakdown.socialInsurance.employeesPension),
        longTermCare: roundMan(taxBreakdown.socialInsurance.longTermCare),
        employmentInsurance: roundMan(
          taxBreakdown.socialInsurance.employmentInsurance,
        ),
      },
      publicInsuranceDetail: {
        nationalPension: roundMan(taxBreakdown.publicInsurance.nationalPension),
        nationalHealthInsurance: roundMan(
          taxBreakdown.publicInsurance.nationalHealthInsurance,
        ),
        lateElderlyHealth: roundMan(
          taxBreakdown.publicInsurance.lateElderlyHealth,
        ),
        lateElderlyLongTermCare: roundMan(
          taxBreakdown.publicInsurance.lateElderlyLongTermCare,
        ),
      },
    };

    years.push({
      calendarYear: year,
      income: annualIncome,
      incomeBreakdown: roundedBreakdown,
      taxSocial: roundMan(taxSocial),
      taxSocialBreakdown,
      disposableIncome,
      expenditure: annualExpenditure,
      expenseBreakdown,
      annualBalance,
      savings,
      financialAssets: roundMan(financialAssets),
    });
  }

  return {
    startYear,
    endYear,
    memberAgeRows,
    expenseEducationMembers,
    years,
  };
}

export function formatCashFlowValue(
  value: number,
  options?: { emptyAsDash?: boolean },
): string {
  if (value === 0 && options?.emptyAsDash) return '-';
  if (value === 0) return '0';
  return value.toFixed(1);
}
