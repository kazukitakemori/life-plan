/**
 * 収入期間の年齢×暦月判定が誕生日またぎで暦と整合することを確認
 * npx tsx scripts/verify-income-period-calendar-order.mjs
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import {
  calcMonthsFromBirthAtAgeCalendarMonth,
  isAgeCalendarMonthInRange,
  calendarYearFromAgeCalendarMonth,
} from '../src/lib/birthDate.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(got, expected, msg) {
  if (got !== expected) throw new Error(`${msg}: expected ${expected}, got ${got}`);
}

// Unit: 3月生まれ、40歳7月開始 → 翌年1月（まだ40歳）は開始後
const birthYear = 1986;
const birthMonth = 3;
const start = calcMonthsFromBirthAtAgeCalendarMonth(birthMonth, 40, 7);
const janNext = calcMonthsFromBirthAtAgeCalendarMonth(birthMonth, 40, 1);
assert(janNext > start, 'Jan while still 40 must be after July start');
assert(
  isAgeCalendarMonthInRange(40, 1, 40, 7, 60, 12, birthYear, birthMonth),
  'range must include Jan after July start',
);
assert(
  isAgeCalendarMonthInRange(40, 7, 40, 1, 60, 12, birthYear, birthMonth),
  'startMonth 1 is active in July of turn-40 year',
);
// getMemberAgeMonth の逆写像: 現時点の (40歳, 1月) → 暦年
assertEq(
  calendarYearFromAgeCalendarMonth(1986, 3, 40, 1),
  2027,
  '40歳1月 calendar year (current-point inverse)',
);
assertEq(
  calendarYearFromAgeCalendarMonth(1986, 3, 40, 7),
  2026,
  '40歳7月 calendar year',
);

const referenceDate = new Date(2026, 5, 1);
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

function emp(id, age, man, startMonth) {
  return {
    id: `${id}-e`,
    memberId: id,
    category: 'employee',
    spouseContingencyOnly: false,
    periods: [
      {
        id: `${id}-p`,
        startAge: age,
        startMonth,
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

const members = [head, spouse];
const incomeByMember = {
  head: [emp('head', 40, 30, 7)],
  spouse: [emp('spouse', 38, 50, 7)],
};

const cf = buildCashFlowTable({
  familyMembers: members,
  incomeByMember,
  livingState: createDefaultLivingState(head, 6),
  housingState: createDefaultHousingState(head, 6),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember(members),
  taxSocialState: createDefaultTaxSocialState(40, 6),
  referenceDate,
});

const y0 = cf.years[0];
const y1 = cf.years[1];
const y2 = cf.years[2];
assert(y0 && y1 && y2, 'years');
assertEq(y0.income, 480, 'year1 partial Jul-Dec');
assertEq(y1.income, 960, 'year2 full 12 months (was 700 before fix)');
assertEq(y2.income, 960, 'year3 full');

// 3年目の税が「欠けた2年目」由来で極端に安くならないこと（住民税ベースが960）
assert(
  y2.taxSocial >= y1.taxSocial * 0.9,
  `year3 tax ${y2.taxSocial} should not collapse vs year2 ${y1.taxSocial}`,
);

console.log(
  JSON.stringify({
    y1: { income: y0.income, tax: y0.taxSocial },
    y2: { income: y1.income, tax: y1.taxSocial },
    y3: { income: y2.income, tax: y2.taxSocial },
  }),
);
console.log('OK income period calendar order');
