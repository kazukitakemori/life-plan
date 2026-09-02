/**
 * 諸費用をすべてローン組込したとき購入日・初が 0 になること、
 * および旧既定（銀行手数料だけ initial）で UI が loan 誤表示しないことを検証
 * （npx tsx scripts/verify-housing-fees-in-loan-purchase-initial.mjs）
 */
import assert from 'node:assert/strict';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import { calcOwnedLoanDownPaymentMan } from '../src/lib/housingOwnedAmount.ts';
import { calcHousingLoanTotalAmountMan } from '../src/lib/housingLoanAmount.ts';
import { calcHouseholdMonthlyHousingDetailMan } from '../src/lib/housingCashFlow.ts';
import { resolveHousingLoanFeesInLoanMode } from '../src/lib/housingLoanFeeInclusion.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';
import { createOwnedPropertyLoanSettings } from '../src/lib/housingDefaults.ts';

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
const referenceDate = new Date(2026, 5, 1);

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
    buildingMan: 2500,
    landMan: 1500,
    brokerageFeeMan: 140,
    registrationFeeMan: 30,
    currentExpenseMode: 'analysis',
  },
  { rentals: [], owned: [] },
);

// 新規既定は銀行手数料もローン組込
assert.equal(property.loan.bankFeePaymentTiming, 'loan');
assert.equal(resolveHousingLoanFeesInLoanMode(property.loan), 'loan');

property.loan = {
  ...property.loan,
  financingFeeMan: 80,
  guaranteeFeeMan: 0,
  administrativeFeeMan: 0,
};

const loanAmount = calcHousingLoanTotalAmountMan(property, property.loan);
const downPayment = calcOwnedLoanDownPaymentMan(property, property.loan);
assert.equal(loanAmount, 2500 + 1500 + 140 + 30 + 80);
assert.equal(downPayment, 0, '全額ローン組込時の頭金は0');

const housingState = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [property] },
  },
};
const startMonthDetail = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2026,
  6,
);
assert.equal(startMonthDetail.purchaseInitial, 0);

// 現金諸費用なら購入日に出る
const cashFeesProperty = {
  ...property,
  loan: {
    ...property.loan,
    includeBrokerageFeeInLoan: false,
    includeRegistrationFeeInLoan: false,
    bankFeePaymentTiming: 'initial',
  },
};
assert.equal(resolveHousingLoanFeesInLoanMode(cashFeesProperty.loan), 'cash');
assert.equal(
  calcOwnedLoanDownPaymentMan(cashFeesProperty, cashFeesProperty.loan),
  140 + 30 + 80,
);

// 旧不整合: 仲介・登記はローン、銀行だけ initial → UI は cash（誤って loan にしない）
const legacyMixed = createOwnedPropertyLoanSettings({
  includeBrokerageFeeInLoan: true,
  includeRegistrationFeeInLoan: true,
  bankFeePaymentTiming: 'initial',
  financingFeeMan: 110,
});
assert.equal(
  resolveHousingLoanFeesInLoanMode(legacyMixed),
  'cash',
  '銀行手数料が現金の中間状態を loan と表示しない',
);
const legacyProperty = {
  ...property,
  loan: legacyMixed,
  brokerageFeeMan: 140,
  registrationFeeMan: 30,
};
assert.equal(
  calcOwnedLoanDownPaymentMan(legacyProperty, legacyMixed),
  110,
  '銀行手数料のみ購入日・初に残る',
);

console.log('verify-housing-fees-in-loan-purchase-initial: OK');
