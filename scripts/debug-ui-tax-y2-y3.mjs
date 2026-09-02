/**
 * 画像再現: 世帯主360 + 配偶者600 + 児童手当、IT 25→4 を分解
 * npx tsx scripts/debug-ui-tax-y2-y3.mjs
 */
import { writeFileSync } from 'node:fs';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { resolveResidentTaxLevyPhase } from '../src/lib/priorYearIncomeResolution.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

const referenceDate = new Date(2026, 7, 1); // → 試算9月開始想定
const head = {
  id: 'head',
  role: 'head',
  age: 32,
  birthMonth: 3,
  birthDay: 15,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};
const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 32,
  birthMonth: 5,
  birthDay: 10,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};
const child = {
  id: 'child',
  role: 'child',
  age: 0,
  birthMonth: 4,
  birthDay: 1,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'custom', endAge: 22, endMonth: 3 },
  taxDependentDefault: true,
  socialInsuranceDependentDefault: true,
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
        startMonth: 1,
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

const members = [head, spouse, child];
const incomeByMember = {
  head: [emp('head', 32, 30)],
  spouse: [emp('spouse', 32, 50)],
};
const pensionByMember = createDefaultPensionByMember(members);
const taxSocialState = createDefaultTaxSocialState(32, 9);

const cf = buildCashFlowTable({
  familyMembers: members,
  incomeByMember,
  livingState: createDefaultLivingState(head, 9),
  housingState: createDefaultHousingState(head, 9),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember,
  taxSocialState,
  referenceDate,
});

const start = cf.years[0].calendarYear;
const rows = cf.years.slice(0, 5).map((y) => {
  const h = y.taxSocialBreakdown;
  return {
    year: y.calendarYear,
    phase: resolveResidentTaxLevyPhase(y.calendarYear, start),
    income: y.income,
    taxSocial: y.taxSocial,
    incomeTax: h.incomeTax,
    residentTax: h.residentTax,
    si: h.socialInsuranceDetail,
  };
});

const details = [];
for (const year of [start, start + 1, start + 2, start + 15]) {
  const y = cf.years.find((r) => r.calendarYear === year);
  if (!y) continue;
  const r = calcHouseholdTaxYearResult({
    familyMembers: members,
    incomeByMember,
    pensionByMember,
    taxSocialState,
    referenceDate,
    calendarYear: year,
    monthStart: y.simulationMonthStart,
    monthEnd: y.simulationMonthEnd,
    levyPaymentFactor: y.levyPaymentFactor,
    simulationStartYear: start,
    annualPensionManByMember: {},
  });
  for (const [id, bd] of Object.entries(r.memberBreakdownByMemberId)) {
    const sum = (d) =>
      d ? Object.values(d).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
    details.push({
      year,
      id,
      isTaxIndependent: bd.isTaxIndependent,
      itYen: bd.incomeTax?.adjustedIncomeTaxYen,
      itCfYen: bd.incomeTax?.incomeTaxCashFlowYen,
      taxableYen: bd.incomeTax?.taxableIncomeYen,
      totalIncomeYen: bd.incomeTax?.totalIncomeYen,
      salaryIncomeYen: bd.incomeTax?.salaryIncomeYen,
      basicDeductionYen: bd.incomeTax?.basicDeductionYen,
      dependentDeductionYen: bd.incomeTax?.dependentDeductionYen,
      spouseDeductionYen: bd.incomeTax?.spouseDeductionYen,
      spouseSpecialDeductionYen: bd.incomeTax?.spouseSpecialDeductionYen,
      incomeAdjDeductionYen: bd.incomeTax?.incomeAdjustmentDeductionYen,
      siDeductYen: sum(bd.incomeTax?.socialInsuranceDeduction),
      rtYen: bd.residentTax?.adjustedResidentTaxYen,
      rtTaxableYen: bd.residentTax?.taxableIncomeYen,
      rtSiDeductYen: sum(bd.residentTax?.socialInsuranceDeduction),
      rtDependentYen: bd.residentTax?.residentDependentDeductionYen,
      rtAnnualBasis: bd.residentTax?.incomeReferenceUsesAnnualBasis,
      rtRefYear: bd.residentTax?.incomeReferenceYear,
    });
  }
}

writeFileSync(
  'tmp-ui-tax.json',
  JSON.stringify({ start, simMonth: cf.simulationMonthStart, rows, details }, null, 2),
);
console.log('wrote tmp-ui-tax.json');
