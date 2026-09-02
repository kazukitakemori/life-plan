/**
 * 所有開始カレンダーが誕生月を反映し、物件活性期間と一致することを検証
 * （npx tsx scripts/verify-housing-ownership-calendar.mjs）
 */
import assert from 'node:assert/strict';
import { getOwnershipStartCalendar } from '../src/lib/housingLoanAmortization.ts';
import { getMemberAgeMonth, calcYearAtAge, calcBirthYear } from '../src/lib/birthDate.ts';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import { calcHouseholdMonthlyHousingDetailMan } from '../src/lib/housingCashFlow.ts';
import { createLoanEntry } from '../src/lib/loanDefaults.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

const referenceDate = new Date(2026, 5, 1); // 2026-06

function findOwnedActiveStart(member, startAge, startMonth) {
  for (let y = 2026; y <= 2035; y++) {
    for (let m = 1; m <= 12; m++) {
      const am = getMemberAgeMonth(member, referenceDate, y, m);
      if (am && am.age === startAge && am.month === startMonth) {
        return { year: y, month: m };
      }
    }
  }
  return null;
}

for (const birthMonth of [3, 6, 10]) {
  const member = {
    id: 'head',
    role: 'head',
    age: 40,
    birthMonth,
    expectedLifespan: 90,
    nickname: '',
    gender: 'male',
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
  const startAge = 45;
  const startMonth = 11;
  const cal = getOwnershipStartCalendar(
    { startAge, startMonth },
    40,
    2026,
    birthMonth,
    6,
  );
  const ownedStart = findOwnedActiveStart(member, startAge, startMonth);
  const birthYear = calcBirthYear(40, birthMonth, referenceDate);
  const taxYear = calcYearAtAge(birthYear, birthMonth, startAge, startMonth);

  assert.deepEqual(
    cal,
    ownedStart,
    `birthMonth=${birthMonth}: loan calendar ${JSON.stringify(cal)} != owned ${JSON.stringify(ownedStart)}`,
  );
  assert.equal(
    cal.year,
    taxYear,
    `birthMonth=${birthMonth}: calendar year ${cal.year} != taxYear ${taxYear}`,
  );
}

// CF: 誕生月10・開始45歳11月 → 所有開始は2030-11、返済は翌月2030-12から
const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 10,
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
    startAge: 45,
    startMonth: 11,
    paymentMethod: 'loan',
    buildingMan: 2500,
    landMan: 1500,
    brokerageFeeMan: 0,
    registrationFeeMan: 0,
    currentExpenseMode: 'analysis',
    maintenance: {
      managementFees: [
        { startOffsetYears: 0, endOffsetYears: -1, amountManPerMonth: 1 },
      ],
      repairReserveFees: [],
      selfRepair: {
        costMan: 0,
        nextYear: 2040,
        nextMonth: 1,
        intervalYears: 5,
      },
      improvements: [],
      landTaxes: [],
      buildingTaxes: [],
    },
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

// 旧ロジック（誕生月無視）なら所有開始は2031-11 → 2030-11は非活性だった
const oct2030 = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2030,
  10,
  loanState,
);
assert.equal(oct2030.managementFee, 0, '所有開始前は管理費0');
assert.equal(loanTotal(oct2030), 0, '所有開始前は返済0');

const nov2030 = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2030,
  11,
  loanState,
);
assert.equal(nov2030.managementFee, 1, '2030-11 から所有が活性');
assert.equal(loanTotal(nov2030), 0, '所有開始月は返済まだ（翌月から）');

const dec2030 = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2030,
  12,
  loanState,
);
assert.ok(loanTotal(dec2030) > 0, `2030-12 から返済があるべき: ${loanTotal(dec2030)}`);

// 旧カレンダー年（2031-11）で返済が「初回」扱いにならないこと（すでに返済中）
const nov2031 = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  2031,
  11,
  loanState,
);
assert.ok(loanTotal(nov2031) > 0, '2031-11 も返済継続');
assert.equal(nov2031.managementFee, 1, '2031-11 も所有継続');

console.log('verify-housing-ownership-calendar: OK');
