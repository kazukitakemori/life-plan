import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

function run(label, startMonthHead, startMonthSpouse, isNew) {
  const referenceDate = new Date(2026, 5, 1);
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
  const emp = (id, age, man, sm) => ({
    id: `${id}-e`,
    memberId: id,
    category: 'employee',
    spouseContingencyOnly: false,
    isNewIncomeFromStart: isNew,
    periods: [
      {
        id: `${id}-p`,
        startAge: age,
        startMonth: sm,
        endAge: 60,
        endMonth: 12,
        streamType: 'salary_social_insurance',
        monthlyAmountMan: man,
        bonuses: [],
        annualAmountMan: man * 12,
        spouseContingencyRate: null,
        annualIncreaseRate: null,
      },
    ],
    expenseManPerMonth: null,
    filingType: null,
  });
  const members = [head, spouse];
  const incomeByMember = {
    head: [emp('head', 40, 30, startMonthHead)],
    spouse: [emp('spouse', 38, 50, startMonthSpouse)],
  };
  const cf = buildCashFlowTable({
    familyMembers: members,
    incomeByMember,
    livingState: createDefaultLivingState(head, 6),
    housingState: createDefaultHousingState(head, 6),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember(members),
    taxSocialState: createDefaultTaxSocialState(40, 6),
    referenceDate,
  });
  const rows = cf.years.slice(0, 4).map((y) => ({
    y: y.calendarYear,
    inc: y.income,
    tax: y.taxSocial,
    it: y.taxSocialBreakdown?.incomeTax,
    rt: y.taxSocialBreakdown?.residentTax,
    ms: y.simulationMonthStart,
  }));
  console.log(label, JSON.stringify(rows));

  // resident tax gross for years 2-3
  for (const year of [2027, 2028]) {
    const y0 = cf.years[0];
    const r = calcHouseholdTaxYearResult({
      familyMembers: members,
      incomeByMember,
      referenceDate,
      calendarYear: year,
      monthStart: year === cf.startYear ? y0.simulationMonthStart : 1,
      monthEnd: 12,
      levyPaymentFactor: year === cf.startYear ? y0.levyPaymentFactor : 1,
      simulationStartYear: cf.startYear,
      annualPensionManByMember: {},
    });
    const h = r.memberBreakdownByMemberId.head;
    const s = r.memberBreakdownByMemberId.spouse;
    console.log(
      '  taxDetail',
      year,
      JSON.stringify({
        phase: h.residentTax.levyPhase,
        rtGrossSum:
          (h.residentTax.grossSalaryRevenueYen +
            s.residentTax.grossSalaryRevenueYen) /
          10000,
        itGrossSum:
          (h.incomeTax.grossSalaryRevenueYen +
            s.incomeTax.grossSalaryRevenueYen) /
          10000,
        totalTax: r.household.totalMan,
      }),
    );
  }
}

run('sm1 continuous', 1, 1, false);
run('sm7 continuous', 7, 7, false);
run('sm7 new', 7, 7, true);
run('sm6 continuous', 6, 6, false);
run('head1 spouse7', 1, 7, false);
run('head7 spouse1', 7, 1, false);
