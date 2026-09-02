/**
 * 世帯主＋配偶者の税CF足し込み確認
 * npx tsx scripts/verify-dual-earner-tax-cf.mjs
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

function emp(id, age, man) {
  return {
    id: `${id}-e`,
    memberId: id,
    category: 'employee',
    spouseContingencyOnly: false,
    periods: [
      {
        id: `${id}-p`,
        startAge: age,
        startMonth: 6,
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
  };
}

const incomeByMember = {
  head: [emp('head', 40, 50)],
  spouse: [emp('spouse', 38, 30)],
};

let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    failed = true;
  }
}

for (const year of [2026, 2027]) {
  const monthStart = year === startYear ? 6 : 1;
  const factor = year === startYear ? 7 / 12 : 1;
  const r = calcHouseholdTaxYearResult({
    familyMembers: [head, spouse],
    incomeByMember,
    referenceDate,
    calendarYear: year,
    monthStart,
    monthEnd: 12,
    levyPaymentFactor: factor,
    simulationStartYear: startYear,
    annualPensionManByMember: {},
  });
  const h = r.memberBreakdownByMemberId.head;
  const s = r.memberBreakdownByMemberId.spouse;
  const sumIt =
    h.incomeTax.incomeTaxCashFlowYen + s.incomeTax.incomeTaxCashFlowYen;
  const sumRt =
    h.residentTax.residentTaxCashFlowYen + s.residentTax.residentTaxCashFlowYen;
  const hhIt = Math.round(r.household.incomeTaxMan * 10_000);
  const hhRt = Math.round(r.household.residentTaxMan * 10_000);

  console.log(
    JSON.stringify({
      year,
      householdMan: {
        incomeTax: r.household.incomeTaxMan,
        residentTax: r.household.residentTaxMan,
        total: r.household.totalMan,
      },
      headYen: {
        it: h.incomeTax.incomeTaxCashFlowYen,
        rt: h.residentTax.residentTaxCashFlowYen,
        indep: h.isTaxIndependent,
      },
      spouseYen: {
        it: s.incomeTax.incomeTaxCashFlowYen,
        rt: s.residentTax.residentTaxCashFlowYen,
        indep: s.isTaxIndependent,
      },
    }),
  );

  assert(h.isTaxIndependent, `${year} head independent`);
  assert(s.isTaxIndependent, `${year} spouse independent`);
  assert(s.incomeTax.incomeTaxCashFlowYen > 0, `${year} spouse income tax > 0`);
  assert(s.residentTax.residentTaxCashFlowYen > 0, `${year} spouse resident > 0`);
  assert(hhIt === sumIt, `${year} household IT = head+spouse (${hhIt} vs ${sumIt})`);
  assert(hhRt === sumRt, `${year} household RT = head+spouse (${hhRt} vs ${sumRt})`);
}

if (failed) process.exit(1);
console.log('OK dual-earner head+spouse CF tax sums');
