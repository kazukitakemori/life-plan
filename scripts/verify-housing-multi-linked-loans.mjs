/**
 * 同一物件にリンクした非ペアローン2本が両方CFに乗り、物件価格の二重計上にならないこと
 * （npx tsx scripts/verify-housing-multi-linked-loans.mjs）
 */
import assert from 'node:assert/strict';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import { calcHouseholdMonthlyHousingDetailMan } from '../src/lib/housingCashFlow.ts';
import {
  calcHousingPropertyTotalLoanAmountMan,
  calcLoanEntryAmountMan,
  resolveHousingPropertyFinanceLoans,
  syncHousingLoanAmountsFromAcquisition,
  usesPropertyDerivedLoanAmount,
} from '../src/lib/loanResolution.ts';
import { createLoanEntry } from '../src/lib/loanDefaults.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

const referenceDate = new Date(2026, 5, 1);
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

const property = createOwnedProperty(
  'detached_house',
  head,
  6,
  2026,
  {
    usage: 'planned',
    startAge: 40,
    startMonth: 6,
    paymentMethod: 'loan',
    buildingMan: 3000,
    landMan: 1000,
    brokerageFeeMan: 0,
    registrationFeeMan: 0,
    currentExpenseMode: 'analysis',
  },
  { rentals: [], owned: [] },
);

const baseSettings = {
  ...property.loan,
  years: 35,
  startYear: 0,
  startMonth: 0,
  includeBrokerageFeeInLoan: false,
  includeRegistrationFeeInLoan: false,
  bankFeePaymentTiming: 'loan',
  financingFeeMan: 0,
  interestRatePeriods: [{ startOffsetYears: 0, interestRatePct: 1.0 }],
};

const loanA = createLoanEntry('housing', {
  name: 'ローンA',
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: { ...baseSettings, amountMan: 2500 },
});
const loanB = createLoanEntry('housing', {
  name: 'ローンB',
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: { ...baseSettings, amountMan: 1500 },
});

let loanState = { byMember: { head: [loanA, loanB] } };
const housingState = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [property] },
  },
};

const finance = resolveHousingPropertyFinanceLoans(loanState.byMember.head);
assert.equal(finance.length, 2);
assert.equal(usesPropertyDerivedLoanAmount(loanA, finance), false);
assert.equal(calcLoanEntryAmountMan(property, loanA, finance), 2500);
assert.equal(calcLoanEntryAmountMan(property, loanB, finance), 1500);
assert.equal(
  calcHousingPropertyTotalLoanAmountMan(
    property,
    loanState,
    HOUSEHOLD_HOUSING_KEY,
  ),
  4000,
);

loanState = syncHousingLoanAmountsFromAcquisition(housingState, loanState);
assert.equal(loanState.byMember.head[0].settings.amountMan, 2500);
assert.equal(loanState.byMember.head[1].settings.amountMan, 1500);

// 月々返済モードなら合計が明示的に分かる
const monthlyA = createLoanEntry('housing', {
  name: '月々A',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2060,
  repaymentEndMonth: 6,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: { ...baseSettings, amountMan: 2500 },
});
const monthlyB = createLoanEntry('housing', {
  name: '月々B',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 3,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2060,
  repaymentEndMonth: 6,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: { ...baseSettings, amountMan: 1500 },
});
const monthlyState = { byMember: { head: [monthlyA, monthlyB] } };
const jul = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2026,
  7,
  monthlyState,
);
assert.equal(
  jul.loanRepaymentDetail.principal,
  8,
  `2本の月々返済が合算されること: ${jul.loanRepaymentDetail.principal}`,
);

// 単独リンクは従来どおり物件価格ベース
const sole = createLoanEntry('housing', {
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: property.id,
  },
  settings: { ...baseSettings, amountMan: 1 },
});
assert.equal(usesPropertyDerivedLoanAmount(sole, [sole]), true);
assert.equal(calcLoanEntryAmountMan(property, sole, [sole]), 4000);

console.log('verify-housing-multi-linked-loans: OK');
