/**
 * ??E????E???E?E??E?????????????????2???E??E???E?E??E??E?E
 * npx vite-node scripts/verify-tax-cf-alignment.mjs
 */
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { taxYenToCashFlowYen } from '../src/lib/taxCalculator.ts';

function roundMan(valueMan) {
  return Math.round(valueMan * 10) / 10;
}

function yenFromMan(man) {
  return Math.round(roundMan(man) * 10_000);
}

function mergedHealthManFromHousehold(social) {
  return roundMan(social.healthInsurance + social.longTermCare);
}

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

const incomeByMember = {
  head: [
    {
      id: 'e1',
      memberId: 'head',
      category: 'employee',
      spouseContingencyOnly: false,
      periods: [
        {
          id: 'p1',
          startAge: 40,
          startMonth: 6,
          endAge: 60,
          endMonth: 12,
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

let failed = false;

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: ${actual} !== ${expected}`);
    failed = true;
  }
}

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
  const cf = r.household;
  const cfDetail = {
    incomeTax: yenFromMan(cf.incomeTaxMan),
    residentTax: yenFromMan(cf.residentTaxMan),
    employeesPension: yenFromMan(cf.socialInsurance.employeesPension),
    healthInsurance: yenFromMan(mergedHealthManFromHousehold(cf.socialInsurance)),
    employmentInsurance: yenFromMan(cf.socialInsurance.employmentInsurance),
  };

  const ins = bd.employeeInsurance;
  const pensionTabYen = ins.annualPensionFromSalaryYen + ins.annualPensionFromBonusYen;
  const healthTabYen =
    ins.annualHealthMedicalSupportYen +
    ins.annualHealthChildcareYen +
    ins.annualHealthNursingYen;
  const taxDeduction = bd.incomeTax.socialInsuranceDeduction;

  console.log(
    JSON.stringify({
      year,
      cfDetail,
      other: {
        incomeTaxCf: bd.incomeTax.incomeTaxCashFlowYen,
        residentTaxCf: bd.residentTax.residentTaxCashFlowYen,
        pensionTabYen,
        healthTabYen,
        employmentTabYen: ins.annualEmploymentYen,
        taxDeductionPension: taxDeduction.employeesPension,
      },
    }),
  );

  assertEqual(`${year} CF income tax vs other CF amount`, cfDetail.incomeTax, bd.incomeTax.incomeTaxCashFlowYen);
  assertEqual(`${year} CF resident tax vs other CF amount`, cfDetail.residentTax, bd.residentTax.residentTaxCashFlowYen);
  assertEqual(`${year} CF pension vs pension tab`, cfDetail.employeesPension, taxYenToCashFlowYen(pensionTabYen));
  assertEqual(
    `${year} CF health vs tab (man rounded, incl. nursing)`,
    cfDetail.healthInsurance,
    taxYenToCashFlowYen(healthTabYen),
  );
  assertEqual(`${year} CF employment vs tab`, cfDetail.employmentInsurance, taxYenToCashFlowYen(ins.annualEmploymentYen));

  // 2????? CF ?????????????? CF ?????????????????????????
  if (year !== startYear) {
    assertEqual(`${year} pension tab vs income tax deduction`, pensionTabYen, taxDeduction.employeesPension);
    assertEqual(`${year} health tab vs income tax deduction`, healthTabYen, taxDeduction.healthInsurance);
    assertEqual(`${year} employment tab vs income tax deduction`, ins.annualEmploymentYen, taxDeduction.employmentInsurance);
  } else {
    if (!(pensionTabYen < taxDeduction.employeesPension)) {
      console.error(
        `FAIL ${year}: first-year CF pension ${pensionTabYen} should be < annual deduction ${taxDeduction.employeesPension}`,
      );
      failed = true;
    }
  }
  assertEqual(`${year} pension tab vs annualPensionYen display`, pensionTabYen, ins.annualPensionYen);
  assertEqual(
    `${year} no late elderly LTC for age 40 employee`,
    yenFromMan(r.household.publicInsurance.longTermCare),
    0,
  );
}

if (failed) {
  process.exit(1);
}

console.log('\nOK: Other tab, tax deductions, and cash flow are aligned');
