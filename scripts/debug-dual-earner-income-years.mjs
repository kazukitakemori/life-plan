/**
 * 世帯主30万＋配偶者50万で年次の収入・税をダンプ
 * npx tsx scripts/debug-dual-earner-income-years.mjs
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

const referenceDate = new Date(2026, 5, 1); // June 1 → often sim starts July
const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};
const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 38,
  birthMonth: 5,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

function emp(id, age, monthlyMan, startMonth = 1) {
  return {
    id: `${id}-e`,
    memberId: id,
    category: 'employee',
    spouseContingencyOnly: false,
    periods: [
      {
        id: `${id}-p`,
        startAge: age,
        startMonth,
        endAge: 60,
        endMonth: 12,
        streamType: 'salary_social_insurance',
        monthlyAmountMan: monthlyMan,
        bonuses: [],
        annualAmountMan: monthlyMan * 12,
        spouseContingencyRate: null,
        annualIncreaseRate: null,
      },
    ],
    expenseManPerMonth: null,
    filingType: null,
  };
}

const members = [head, spouse];
const incomeByMember = {
  head: [emp('head', 40, 30, 1)],
  spouse: [emp('spouse', 38, 50, 1)],
};

const cf = buildCashFlowTable({
  familyMembers: members,
  incomeByMember,
  livingState: createDefaultLivingState(head, referenceDate.getMonth() + 1),
  housingState: createDefaultHousingState(head, referenceDate.getMonth() + 1),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember(members),
  taxSocialState: createDefaultTaxSocialState(
    head.age,
    referenceDate.getMonth() + 1,
  ),
  referenceDate,
});

console.log('--- Cash flow income / tax (first 5 years) ---');
for (const y of cf.years.slice(0, 5)) {
  const bd = y.incomeBreakdown;
  console.log(
    JSON.stringify({
      year: y.calendarYear,
      monthStart: y.simulationMonthStart,
      monthEnd: y.simulationMonthEnd,
      factor: y.levyPaymentFactor,
      income: y.income,
      salary: bd.salary,
      taxSocial: y.taxSocial,
      incomeTax: y.taxSocialBreakdown?.incomeTax,
      residentTax: y.taxSocialBreakdown?.residentTax,
      social: y.taxSocialBreakdown
        ? {
            empPension: y.taxSocialBreakdown.employeesPension,
            health: y.taxSocialBreakdown.healthInsurance,
          }
        : null,
    }),
  );
}

console.log('\n--- Tax year detail (income tax gross / resident gross) ---');
for (const year of [2026, 2027, 2028, 2029]) {
  const monthStart =
    year === cf.startYear ? (cf.years[0]?.simulationMonthStart ?? 1) : 1;
  const factor =
    year === cf.startYear ? (cf.years[0]?.levyPaymentFactor ?? 1) : 1;
  const r = calcHouseholdTaxYearResult({
    familyMembers: members,
    incomeByMember,
    referenceDate,
    calendarYear: year,
    monthStart,
    monthEnd: 12,
    levyPaymentFactor: factor,
    simulationStartYear: cf.startYear,
    annualPensionManByMember: {},
  });
  const h = r.memberBreakdownByMemberId.head;
  const s = r.memberBreakdownByMemberId.spouse;
  console.log(
    JSON.stringify({
      year,
      phase: h.residentTax.levyPhase,
      household: {
        it: r.household.incomeTaxMan,
        rt: r.household.residentTaxMan,
        total: r.household.totalMan,
      },
      head: {
        itGross: h.incomeTax.grossSalaryRevenueYen / 10000,
        rtGross: h.residentTax.grossSalaryRevenueYen / 10000,
        rtSocial: Object.values(h.residentTax.socialInsuranceDeduction).reduce(
          (a, b) => a + b,
          0,
        ),
        itCf: h.incomeTax.incomeTaxCashFlowYen / 10000,
        rtCf: h.residentTax.residentTaxCashFlowYen / 10000,
      },
      spouse: {
        itGross: s.incomeTax.grossSalaryRevenueYen / 10000,
        rtGross: s.residentTax.grossSalaryRevenueYen / 10000,
        rtSocial: Object.values(s.residentTax.socialInsuranceDeduction).reduce(
          (a, b) => a + b,
          0,
        ),
        itCf: s.incomeTax.incomeTaxCashFlowYen / 10000,
        rtCf: s.residentTax.residentTaxCashFlowYen / 10000,
      },
      sumGrossIt:
        (h.incomeTax.grossSalaryRevenueYen + s.incomeTax.grossSalaryRevenueYen) /
        10000,
      sumGrossRt:
        (h.residentTax.grossSalaryRevenueYen +
          s.residentTax.grossSalaryRevenueYen) /
        10000,
    }),
  );
}
