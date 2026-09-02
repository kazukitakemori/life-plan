/**
 * 諸費用をローン組込した複数トランシェで、ボーナス・繰上げが
 * 元本比率按分され二重計上されないことを検証
 * （npx tsx scripts/verify-housing-loan-tranche-events.mjs）
 */
import assert from 'node:assert/strict';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import {
  calcHousingLoanPrincipalInterestAtMonthYen,
  calcHousingLoanBalanceAfterRepaymentMonthsYen,
} from '../src/lib/housingLoanAmount.ts';

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
    buildingMan: 2500,
    landMan: 1500,
    brokerageFeeMan: 140,
    registrationFeeMan: 30,
  },
  { rentals: [], owned: [] },
);

const multiLoan = {
  ...property.loan,
  years: 35,
  financingFeeMan: 80,
  guaranteeFeeMan: 0,
  administrativeFeeMan: 0,
  bankFeePaymentTiming: 'loan',
  includeBrokerageFeeInLoan: true,
  includeRegistrationFeeInLoan: true,
  bonusRepaymentEnabled: true,
  bonusRepaymentAmountMan: 50,
  bonusRepaymentType: 'period_shortening',
  interestRatePeriods: [{ startOffsetYears: 0, interestRatePct: 1.0 }],
};

// 同金利・同総額の単一トランシェ相当（諸費用も物件価格に合算した想定）
const singleProperty = {
  ...property,
  buildingMan: 2500 + 140 + 30 + 80,
  landMan: 1500,
  brokerageFeeMan: 0,
  registrationFeeMan: 0,
};
const singleLoan = {
  ...multiLoan,
  financingFeeMan: 0,
  includeBrokerageFeeInLoan: false,
  includeRegistrationFeeInLoan: false,
  bankFeePaymentTiming: 'initial',
};

function totalMan(r) {
  return (r.principalYen + r.interestYen) / 10_000;
}

// ボーナス月（返済開始 2026-07 → index 12 = 2027-06）
const bonusMonth = 12;
const multiBonus = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(
    property,
    multiLoan,
    bonusMonth,
    40,
    2026,
  ),
);
const singleBonus = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(
    singleProperty,
    singleLoan,
    bonusMonth,
    40,
    2026,
  ),
);

console.log('multi bonus month totalMan', multiBonus.toFixed(2));
console.log('single bonus month totalMan', singleBonus.toFixed(2));

// 修正前は ~140万級。按分後は単一トランシェとほぼ一致し、50万ボーナス1回分程度のはず
assert.ok(
  Math.abs(multiBonus - singleBonus) < 1,
  `ボーナス月が単一トランシェと乖離: multi=${multiBonus} single=${singleBonus}`,
);
assert.ok(
  multiBonus < 80,
  `ボーナス月が過大（按分漏れの疑い）: ${multiBonus}`,
);

// 通常月もほぼ一致
const multiNormal = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(property, multiLoan, 1, 40, 2026),
);
const singleNormal = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(
    singleProperty,
    singleLoan,
    1,
    40,
    2026,
  ),
);
assert.ok(
  Math.abs(multiNormal - singleNormal) < 0.5,
  `通常月が乖離: multi=${multiNormal} single=${singleNormal}`,
);

// 繰上げ返済も按分されること（1年後 index 13 = offsetYears 1）
const multiPrepayLoan = {
  ...multiLoan,
  bonusRepaymentEnabled: false,
  prepaymentEnabled: true,
  prepayments: [{ offsetYears: 1, amountMan: 200, type: 'period_shortening' }],
};
const singlePrepayLoan = {
  ...singleLoan,
  bonusRepaymentEnabled: false,
  prepaymentEnabled: true,
  prepayments: [{ offsetYears: 1, amountMan: 200, type: 'period_shortening' }],
};
const prepayMonth = 13;
const multiPrepay = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(
    property,
    multiPrepayLoan,
    prepayMonth,
    40,
    2026,
  ),
);
const singlePrepay = totalMan(
  calcHousingLoanPrincipalInterestAtMonthYen(
    singleProperty,
    singlePrepayLoan,
    prepayMonth,
    40,
    2026,
  ),
);
console.log('multi prepay month totalMan', multiPrepay.toFixed(2));
console.log('single prepay month totalMan', singlePrepay.toFixed(2));
assert.ok(
  Math.abs(multiPrepay - singlePrepay) < 2,
  `繰上げ月が乖離: multi=${multiPrepay} single=${singlePrepay}`,
);
assert.ok(
  multiPrepay < 250,
  `繰上げ月が過大（按分漏れの疑い）: ${multiPrepay}`,
);

// 残債も同程度
const multiBal = calcHousingLoanBalanceAfterRepaymentMonthsYen(
  property,
  multiLoan,
  24,
  40,
  2026,
);
const singleBal = calcHousingLoanBalanceAfterRepaymentMonthsYen(
  singleProperty,
  singleLoan,
  24,
  40,
  2026,
);
assert.ok(
  Math.abs(multiBal - singleBal) / 10_000 < 5,
  `2年後残債が乖離: multi=${multiBal} single=${singleBal}`,
);

console.log('verify-housing-loan-tranche-events: OK');
