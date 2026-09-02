/**
 * 2蟷ｴ逶ｮ菴乗ｰ醍ｨ趣ｿｽE遉ｾ菫晄而髯､謨ｴ蜷医ｒ讀懆ｨｼ・ｽE・ｽEode --experimental-strip-types scripts/verify-year2-resident-tax.mjs・ｽE・ｽE
 */
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';

const referenceDate = new Date(2026, 5, 1);
const startYear = 2026;
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

function buildIncome(isNewIncomeFromStart) {
  return {
  head: [
    {
      id: 'e1',
      memberId: 'head',
      category: 'employee',
      spouseContingencyOnly: false,
      isNewIncomeFromStart,
      periods: [
        {
          id: 'p1',
          startAge: 40,
          startMonth: 6,
          endAge: 60,
          endMonth: 3,
          streamType: 'salary_social_insurance',
          monthlyAmountMan: 50,
          bonuses: [],
          annualAmountMan: 600,
          spouseContingencyRate: null,
          annualIncreaseRate: null,
        },
      ],
      expenseManPerMonth: null,
      filingType: null,
    },
  ],
};
}

function runScenario(label, isNewIncomeFromStart) {
const incomeByMember = buildIncome(isNewIncomeFromStart);
const results = [];
for (const year of [2026, 2027, 2028, 2029]) {
  const monthStart = year === startYear ? 6 : 1;
  const levyPaymentFactor = year === startYear ? 7 / 12 : 1;
  const r = calcHouseholdTaxYearResult({
    familyMembers: [head],
    incomeByMember,
    referenceDate,
    calendarYear: year,
    monthStart,
    monthEnd: 12,
    levyPaymentFactor,
    simulationStartYear: startYear,
    annualPensionManByMember: {},
  });
  const bd = r.memberBreakdownByMemberId.head;
  const social = bd?.residentTax?.socialInsuranceDeduction;
  const socialTotal = social
    ? Object.values(social).reduce((a, b) => a + b, 0)
    : 0;
  results.push({
    year,
    cfResidentTaxYen: Math.round(r.household.residentTaxMan * 10_000),
    bdResidentTaxYen: bd?.residentTax?.adjustedResidentTaxYen ?? 0,
    incomeYen: bd?.residentTax?.totalIncomeYen ?? 0,
    grossSalaryYen: bd?.residentTax?.grossSalaryRevenueYen ?? 0,
    socialDeductionYen: socialTotal,
    annualBasis: bd?.residentTax?.incomeReferenceUsesAnnualBasis ?? false,
  });
}

console.log(`\n=== ${label} ===`);
for (const row of results) {
  console.log(JSON.stringify(row));
}

const year2 = results.find((r) => r.year === 2027);
const year3 = results.find((r) => r.year === 2029);
return { year2, year3 };
}

const continuous = runScenario('continuous income', false);
const newIncome = runScenario('new income from start', true);

const tolerance = 5_000;
const y2 = continuous.year2;
const y3 = continuous.year3;

if (!y2 || !y3) {
  console.error('Missing year rows');
  process.exit(1);
}

if (y2.grossSalaryYen !== y3.grossSalaryYen) {
  console.log(`Note: gross salary differs y2=${y2.grossSalaryYen} y3=${y3.grossSalaryYen}`);
}

if (
  y2.grossSalaryYen === y3.grossSalaryYen &&
  Math.abs(y2.bdResidentTaxYen - y3.bdResidentTaxYen) > tolerance
) {
  console.error(
    `Year 2 resident tax ${y2.bdResidentTaxYen} differs from year 3 ${y3.bdResidentTaxYen} at same gross`,
  );
  process.exit(1);
}

if (y2.socialDeductionYen < 900_000) {
  console.error(
    `Year 2 social deduction too low: ${y2.socialDeductionYen} (expected ~960000)`,
  );
  process.exit(1);
}

if (newIncome.year2 && continuous.year2) {
  const diff = newIncome.year2.bdResidentTaxYen - continuous.year2.bdResidentTaxYen;
  console.log(`\nNew income vs continuous year2 tax diff: ${diff} yen`);
}

console.log('\nOK: year 2 continuous income resident tax checks passed');

// Missing simulationStartYear reproduces the year-2 social mismatch bug.
const incomeByMember = buildIncome(false);
const year2027MissingStart = calcHouseholdTaxYearResult({
  familyMembers: [head],
  incomeByMember,
  referenceDate,
  calendarYear: 2027,
  monthStart: 1,
  monthEnd: 12,
  levyPaymentFactor: 1,
  annualPensionManByMember: {},
});
const bdMissing = year2027MissingStart.memberBreakdownByMemberId.head;
const socialMissing = Object.values(
  bdMissing?.residentTax?.socialInsuranceDeduction ?? {},
).reduce((a, b) => a + b, 0);
console.log('\nWithout simulationStartYear (2027):');
console.log(
  JSON.stringify({
    tax: bdMissing?.residentTax?.adjustedResidentTaxYen,
    gross: bdMissing?.residentTax?.grossSalaryRevenueYen,
    social: socialMissing,
    annualBasis: bdMissing?.residentTax?.incomeReferenceUsesAnnualBasis,
  }),
);
if (
  bdMissing?.residentTax?.grossSalaryRevenueYen === 6_000_000 &&
  socialMissing < 600_000
) {
  console.error('BUG REPRO: annual income with partial social deduction');
  process.exit(1);
}

// Wrong simulationStartYear (off by one) reproduces inflated year-2 resident tax.
const year2027WrongStart = calcHouseholdTaxYearResult({
  familyMembers: [head],
  incomeByMember,
  referenceDate,
  calendarYear: 2027,
  monthStart: 1,
  monthEnd: 12,
  levyPaymentFactor: 1,
  simulationStartYear: 2027,
  annualPensionManByMember: {},
});
const bdWrong = year2027WrongStart.memberBreakdownByMemberId.head;
const socialWrong = Object.values(
  bdWrong?.residentTax?.socialInsuranceDeduction ?? {},
).reduce((a, b) => a + b, 0);
console.log('\nWrong simulationStartYear=2027 (2027):');
console.log(
  JSON.stringify({
    tax: bdWrong?.residentTax?.adjustedResidentTaxYen,
    gross: bdWrong?.residentTax?.grossSalaryRevenueYen,
    social: socialWrong,
    annualBasis: bdWrong?.residentTax?.incomeReferenceUsesAnnualBasis,
  }),
);
if (
  bdWrong?.residentTax?.grossSalaryRevenueYen === 6_000_000 &&
  socialWrong < 600_000
) {
  console.error(
    'BUG: annual gross with partial social when simulationStartYear mismatches',
  );
  process.exit(1);
}
if (
  y2 &&
  bdWrong?.residentTax?.adjustedResidentTaxYen != null &&
  Math.abs(bdWrong.residentTax.adjustedResidentTaxYen - y2.bdResidentTaxYen) >
    tolerance
) {
  console.error(
    `Wrong-start tax ${bdWrong.residentTax.adjustedResidentTaxYen} should match correct year2 ${y2.bdResidentTaxYen}`,
  );
  process.exit(1);
}

