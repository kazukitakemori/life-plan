/**
 * ???E?E??E??????????Evs ??E????E??????E
 * npx vite-node scripts/verify-income-tax-cf-vs-other.mjs
 */
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { buildMemberTaxBreakdownData } from '../src/lib/taxCalculator.ts';
import { prorateAnnualLevyYen } from '../src/lib/otherCashFlowLinkage.ts';

function roundMan(valueMan) {
  return Math.round(valueMan * 10) / 10;
}

function yenToMan(yen) {
  return roundMan(yen / 10_000);
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
  const cfTaxYen = Math.round(r.household.incomeTaxMan * 10_000);
  const otherAnnualTaxYen = bd?.incomeTax.incomeTaxYen ?? 0;
  const expectedCfFromOther = Math.round(
    yenToMan(prorateAnnualLevyYen(otherAnnualTaxYen, levyPaymentFactor)) *
      10_000,
  );
  const row = {
    year,
    cfTaxYen,
    otherAnnualTaxYen,
    expectedCfFromOther,
    diff: cfTaxYen - expectedCfFromOther,
    levyPaymentFactor,
    grossSalary: bd?.incomeTax.grossSalaryRevenueYen,
    socialDeduction: Object.values(
      bd?.incomeTax.socialInsuranceDeduction ?? {},
    ).reduce((a, b) => a + b, 0),
  };
  console.log(JSON.stringify(row));
  if (row.diff !== 0) {
    console.error(`Mismatch in year ${year}: CF ${cfTaxYen} vs expected ${expectedCfFromOther}`);
    process.exit(1);
  }
}

console.log('\nOK: CF income tax matches Other tab (with proration on year 1)');

// ????E????E??????? ?E?E?E?E??????????????E???E?E?E??E?E??E
function assertSocialInsuranceAligned(year) {
  const monthStart = year === startYear ? 6 : 1;
  const bd = buildMemberTaxBreakdownData({
    familyMembers: [head],
    incomeByMember,
    referenceDate,
    calendarYear: year,
    memberId: 'head',
    monthStart,
    monthEnd: 12,
    levyPaymentFactor: year === startYear ? 7 / 12 : 1,
    simulationMonthStart: monthStart,
    simulationMonthEnd: 12,
    annualPensionManByMember: {},
    simulationStartYear: startYear,
  });
  const tax = bd.incomeTax.socialInsuranceDeduction;
  const resTax = bd.residentTax.socialInsuranceDeduction;
  const ins = bd.employeeInsurance;
  const pensionYen = ins.annualPensionFromSalaryYen + ins.annualPensionFromBonusYen;
  const healthTabTotalYen =
    ins.annualHealthMedicalSupportYen +
    ins.annualHealthChildcareYen +
    ins.annualHealthNursingYen;
  const healthTaxYen = tax.healthInsurance + tax.longTermCare;
  if (year === startYear) {
    // ???: ?????????/CF ??????????
    if (!(pensionYen < tax.employeesPension)) {
      console.error(
        `Year ${year} CF pension ${pensionYen} should be < annual deduction ${tax.employeesPension}`,
      );
      process.exit(1);
    }
    if (!(healthTabTotalYen < healthTaxYen)) {
      console.error(
        `Year ${year} CF health ${healthTabTotalYen} should be < annual deduction ${healthTaxYen}`,
      );
      process.exit(1);
    }
  } else {
    const checks = [
      ['employeesPension', tax.employeesPension, pensionYen],
      ['healthInsuranceTotal', healthTaxYen, healthTabTotalYen],
      ['employmentInsurance', tax.employmentInsurance, ins.annualEmploymentYen],
    ];
    for (const [label, taxYen, tabYen] of checks) {
      if (taxYen !== tabYen) {
        console.error(
          `Year ${year} income tax ${label}: deduction ${taxYen} != tab ${tabYen}`,
        );
        process.exit(1);
      }
    }
  }
  if (year === startYear) {
    // simulation_start ????????????????????????????????????
    const resSocialY1 = Object.values(resTax).reduce((a, b) => a + b, 0);
    if (resSocialY1 <= 0) {
      console.error(
        `Year ${year} resident tax social expected > 0, got ${resSocialY1}`,
      );
      process.exit(1);
    }
  }

  const resSocialTotal = Object.values(resTax).reduce((a, b) => a + b, 0);
  const incomeSocialTotal = Object.values(tax).reduce((a, b) => a + b, 0);
  if (year === startYear + 1 && resSocialTotal !== incomeSocialTotal) {
    console.error(
      `Year ${year} resident tax social ${resSocialTotal} != year ${startYear} income tax social ${incomeSocialTotal}`,
    );
    process.exit(1);
  }

  if (bd.incomeTax.incomeTaxCashFlowYen == null) {
    console.error(`Year ${year} missing incomeTaxCashFlowYen`);
    process.exit(1);
  }
  const expectedCfIncomeTax =
    year === startYear
      ? Math.round(
          yenToMan(
            prorateAnnualLevyYen(bd.incomeTax.incomeTaxYen, 7 / 12),
          ) * 10_000,
        )
      : bd.incomeTax.incomeTaxYen;
  if (year === startYear && bd.incomeTax.incomeTaxCashFlowYen !== expectedCfIncomeTax) {
    console.error(
      `Year ${year} incomeTaxCashFlowYen ${bd.incomeTax.incomeTaxCashFlowYen} != expected ${expectedCfIncomeTax}`,
    );
    process.exit(1);
  }
}

for (const year of [2026, 2027, 2028]) {
  assertSocialInsuranceAligned(year);
}
console.log('\nOK: tax social insurance deductions match social insurance tabs');
