/**
 * 初年度途中開始の税金・社保按分（回帰防止）
 * npx tsx scripts/verify-first-year-tax-social-proration.mjs
 *
 * - 所得税・住民税 CF は levyPaymentFactor 按分（二重按分しない）
 * - 継続給与の被用者社保 CF はシミュレーション月（控除は年額のまま）
 * - 公的保険 CF は年額 × levyPaymentFactor
 * - 2年目以降は被用者社保・公的保険が年額のまま
 * - 贈与税は按分しない
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { prorateAnnualLevyYen } from '../src/lib/otherCashFlowLinkage.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { taxYenToCashFlowYen } from '../src/lib/taxCalculator.ts';

function roundMan(valueMan) {
  return Math.round(valueMan * 10) / 10;
}

function yenToMan(yen) {
  return roundMan(yen / 10_000);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(got, expected, msg) {
  if (got !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${got}`);
  }
}

const referenceDate = new Date(2026, 5, 1); // June
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
const members = [head];

const continuousIncome = {
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

function taxYear(year, incomeByMember) {
  const monthStart = year === startYear ? 6 : 1;
  const levyPaymentFactor = year === startYear ? 7 / 12 : 1;
  return calcHouseholdTaxYearResult({
    familyMembers: members,
    incomeByMember,
    referenceDate,
    calendarYear: year,
    monthStart,
    monthEnd: 12,
    levyPaymentFactor,
    simulationStartYear: startYear,
    annualPensionManByMember: {},
    pensionByMember: createDefaultPensionByMember(members),
  });
}

// --- Continuous employee: income tax / SI ---
const y1 = taxYear(2026, continuousIncome);
const y2 = taxYear(2027, continuousIncome);
const bd1 = y1.memberBreakdownByMemberId.head;
const bd2 = y2.memberBreakdownByMemberId.head;

assertEq(
  bd1.incomeTax.incomeTaxCashFlowYen,
  Math.round(
    yenToMan(prorateAnnualLevyYen(bd1.incomeTax.incomeTaxYen, 7 / 12)) * 10_000,
  ),
  'y1 income tax CF',
);
assertEq(
  bd1.residentTax.residentTaxCashFlowYen,
  Math.round(
    yenToMan(prorateAnnualLevyYen(bd1.residentTax.adjustedResidentTaxYen, 7 / 12)) *
      10_000,
  ),
  'y1 resident tax CF',
);

const pension1 =
  bd1.employeeInsurance.annualPensionFromSalaryYen +
  bd1.employeeInsurance.annualPensionFromBonusYen;
const pension2 =
  bd2.employeeInsurance.annualPensionFromSalaryYen +
  bd2.employeeInsurance.annualPensionFromBonusYen;
const deductionPension1 = bd1.incomeTax.socialInsuranceDeduction.employeesPension;

assert(pension1 < deductionPension1, 'y1 CF pension < annual deduction');
assert(pension1 < pension2, 'y1 CF pension < y2 full year');
assertEq(pension2, deductionPension1, 'y2 CF pension == y1 annual deduction');
assertEq(
  taxYenToCashFlowYen(pension1),
  Math.round(y1.household.socialInsurance.employeesPension * 10_000),
  'household CF pension matches tab',
);

// No double-proration of income tax at household
assertEq(
  Math.round(y1.household.incomeTaxMan * 10_000),
  bd1.incomeTax.incomeTaxCashFlowYen,
  'household income tax == member CF',
);

// Gift tax unfactored (0 in this fixture)
assertEq(bd1.giftTax.giftTaxCashFlowYen, bd1.giftTax.giftTaxYen, 'gift tax no factor');

console.log('OK continuous employee first-year SI + tax proration');

// --- Self-employed / NHI fixture for public insurance factor ---
const nhiIncome = {
  head: [
    {
      id: 'b1',
      memberId: 'head',
      category: 'self_employed',
      spouseContingencyOnly: false,
      periods: [
        {
          id: 'bp1',
          startAge: 40,
          startMonth: 6,
          endAge: 65,
          endMonth: 12,
          streamType: 'business_national_insurance',
          monthlyAmountMan: 40,
          bonuses: [],
          annualAmountMan: 480,
          spouseContingencyRate: null,
          annualIncreaseRate: null,
        },
      ],
      expenseManPerMonth: 10,
      filingType: 'blue',
    },
  ],
};

const nhiY1 = taxYear(2026, nhiIncome);
const nhiY2 = taxYear(2027, nhiIncome);
const nhiBd1 = nhiY1.memberBreakdownByMemberId.head;
const nhiBd2 = nhiY2.memberBreakdownByMemberId.head;

assert(nhiBd1.nhiInsurance.isNhiMember, 'head is NHI member');

const annualNationalPension = nhiBd1.nhiInsurance.nationalPensionYen;
const annualNhiShare = nhiBd1.nhiInsurance.memberShareYen;
assert(annualNationalPension > 0, 'national pension annual > 0');

assertEq(
  Math.round(nhiY1.household.publicInsurance.nationalPension * 10_000),
  taxYenToCashFlowYen(
    prorateAnnualLevyYen(annualNationalPension, 7 / 12),
  ),
  'y1 national pension CF = annual × 7/12',
);
assertEq(
  Math.round(nhiY2.household.publicInsurance.nationalPension * 10_000),
  taxYenToCashFlowYen(nhiBd2.nhiInsurance.nationalPensionYen),
  'y2 national pension full year',
);

if (annualNhiShare > 0) {
  assertEq(
    Math.round(nhiY1.household.publicInsurance.nationalHealthInsurance * 10_000),
    taxYenToCashFlowYen(prorateAnnualLevyYen(annualNhiShare, 7 / 12)),
    'y1 NHI CF = annual × 7/12',
  );
}

console.log('OK NHI/national pension first-year proration');

// --- Cash flow table disposable: taxSocial should not be full-year SI on partial income ---
const cf = buildCashFlowTable({
  familyMembers: members,
  incomeByMember: continuousIncome,
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

const cfY0 = cf.years[0];
const cfY1 = cf.years[1];
assert(cfY0 && cfY1, 'cf years');
assertEq(cfY0.calendarYear, startYear, 'cf start year');
assert(cfY0.taxSocial < cfY1.taxSocial, 'first-year taxSocial < second year');
assert(
  cfY0.levyPaymentFactor < 1,
  `levyPaymentFactor expected < 1, got ${cfY0.levyPaymentFactor}`,
);

console.log(
  `OK cash flow first-year taxSocial ${cfY0.taxSocial} < y2 ${cfY1.taxSocial}`,
);
console.log('OK verify-first-year-tax-social-proration');
