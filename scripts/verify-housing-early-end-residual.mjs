/**
 * 所有をローン完済前に終了（until）した月に残債が一括計上されることを検証
 * （npx tsx scripts/verify-housing-early-end-residual.mjs）
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import { calcHouseholdMonthlyHousingDetailMan } from '../src/lib/housingCashFlow.ts';
import { calcHousingLoanBalanceAfterRepaymentMonthsYen } from '../src/lib/housingLoanAmount.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createLoanEntry } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

const referenceDate = new Date(2026, 5, 1); // 2026-06
const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 6,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

// 40歳6月取得 → 45歳6月まで所有（5年で売却）。ローンは35年
const property = createOwnedProperty(
  'detached_house',
  head,
  6,
  2026,
  {
    usage: 'planned',
    startAge: 40,
    startMonth: 6,
    endMode: 'until',
    endAge: 45,
    endMonth: 6,
    paymentMethod: 'loan',
    buildingMan: 2500,
    landMan: 1500,
    brokerageFeeMan: 0,
    registrationFeeMan: 0,
    currentExpenseMode: 'analysis',
  },
  { rentals: [], owned: [] },
);

const loanEntry = createLoanEntry('housing', {
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: {
    ...property.loan,
    years: 35,
    startYear: 0,
    startMonth: 0,
    includeBrokerageFeeInLoan: false,
    includeRegistrationFeeInLoan: false,
    bankFeePaymentTiming: 'initial',
    financingFeeMan: 0,
    interestRatePeriods: [{ startOffsetYears: 0, interestRatePct: 1.0 }],
  },
});
const loanState = { byMember: { head: [loanEntry] } };
const housingState = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [property] },
  },
};

const loanTotal = (d) =>
  d.loanRepaymentDetail.principal + d.loanRepaymentDetail.interest;

// 所有終了月 2031-06（45歳6月）: 返済開始は 2026-07 → index = 60
// 2031-06: repayment month 60, then residual after month 60
const endMonthDetail = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2031,
  6,
  loanState,
);
const expectedResidualYen = calcHousingLoanBalanceAfterRepaymentMonthsYen(
  property,
  loanEntry.settings,
  60,
  40,
  2026,
  { birthMonth: 6, referenceMonth: 6 },
);
const expectedResidualMan = expectedResidualYen / 10_000;

assert.ok(expectedResidualMan > 3000, `残債が残っている想定: ${expectedResidualMan}`);
assert.ok(
  endMonthDetail.loanRepaymentDetail.principal > expectedResidualMan * 0.95,
  `終了月の元金に残債が含まれるべき: principal=${endMonthDetail.loanRepaymentDetail.principal} residual=${expectedResidualMan}`,
);
console.log('end month 2031-06', {
  principal: endMonthDetail.loanRepaymentDetail.principal,
  interest: endMonthDetail.loanRepaymentDetail.interest,
  expectedResidualMan,
});

// 終了翌月は 0
const afterEnd = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2031,
  7,
  loanState,
);
assert.equal(loanTotal(afterEnd), 0, '所有終了後はローンCF 0');

// 生涯所有では残債一括しない（終了月相当でも通常返済のみ）
const lifetimeProperty = {
  ...property,
  endMode: 'lifetime',
  endAge: 90,
  endMonth: 12,
  id: 'lifetime-owned',
};
const lifetimeLoan = createLoanEntry('housing', {
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: lifetimeProperty.id,
  },
  settings: { ...loanEntry.settings },
});
const lifetimeHousing = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [lifetimeProperty] },
  },
};
const lifetimeLoanState = { byMember: { head: [lifetimeLoan] } };
const lifetimeSameMonth = calcHouseholdMonthlyHousingDetailMan(
  [head],
  lifetimeHousing,
  referenceDate,
  2031,
  6,
  lifetimeLoanState,
);
assert.ok(
  lifetimeSameMonth.loanRepaymentDetail.principal < 50,
  `生涯所有は通常月次のみ: ${lifetimeSameMonth.loanRepaymentDetail.principal}`,
);

// CF表でも終了年に大きなローン元金が出る
const table = buildCashFlowTable({
  familyMembers: [head],
  incomeByMember: {},
  livingState: createDefaultLivingState(head, 6),
  housingState,
  loanState,
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember([head]),
  taxSocialState: createDefaultTaxSocialState(head.age, 6),
  referenceDate,
});
const y2031 = table.years.find((y) => y.calendarYear === 2031);
assert.ok(y2031, '2031年行がある');
assert.ok(
  y2031.expenseBreakdown.housingDetail.loanRepaymentDetail.principal >
    expectedResidualMan * 0.95,
  `CF表2031の元金に残債: ${y2031.expenseBreakdown.housingDetail.loanRepaymentDetail.principal}`,
);

// 終了後の年はローン0
const y2032 = table.years.find((y) => y.calendarYear === 2032);
assert.ok(y2032);
assert.equal(
  y2032.expenseBreakdown.housingDetail.loanRepaymentDetail.principal +
    y2032.expenseBreakdown.housingDetail.loanRepaymentDetail.interest,
  0,
);

console.log('verify-housing-early-end-residual: OK');
