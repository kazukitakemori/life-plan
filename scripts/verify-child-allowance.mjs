/**
 * 児童手当（令和6年10月改正後）の検証
 * npx tsx scripts/verify-child-allowance.mjs
 */
import assert from 'node:assert/strict';
import {
  calcChildAllowancePaymentFromEntitlements,
  calcHouseholdMonthlyChildAllowanceEntitlementMan,
  calcHouseholdMonthlyChildAllowanceMan,
} from '../src/lib/childAllowance.ts';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createFamilyMember } from '../src/lib/familyDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';

const referenceDate = new Date(2026, 5, 1); // 2026年6月

function makeChild(age, birthMonth, extra = {}) {
  return {
    ...createFamilyMember('child'),
    age,
    birthMonth,
    birthDay: extra.birthDay ?? 1,
    ...extra,
  };
}

function makeHead() {
  return {
    ...createFamilyMember('head'),
    age: 40,
    birthMonth: 3,
    birthDay: 1,
    expectedLifespan: 90,
  };
}

function entitlement(members, year, month) {
  return calcHouseholdMonthlyChildAllowanceEntitlementMan(
    members,
    referenceDate,
    year,
    month,
  );
}

function assertEq(actual, expected, label) {
  assert.equal(actual, expected, label);
}

const head = makeHead();

// ── 子供なし ──────────────────────────────────────────────────────────
assertEq(entitlement([head], 2026, 6), 0, 'no children');

// ── 第1子 3歳未満 1.5万円 ────────────────────────────────────────────
const infant = makeChild(1, 4);
assertEq(entitlement([head, infant], 2026, 6), 1.5, 'infant under 3');

// ── 第1子 3歳以上 1.0万円 ────────────────────────────────────────────
const schoolAge = makeChild(5, 4);
assertEq(entitlement([head, schoolAge], 2026, 6), 1.0, 'school age');

// ── 3歳到達月は 1.5万円、翌月から 1.0万円 ────────────────────────────
const turning3 = makeChild(2, 8);
assertEq(entitlement([head, turning3], 2026, 8), 1.5, 'turn 3 month inclusive');
assertEq(entitlement([head, turning3], 2026, 9), 1.0, 'month after turning 3');

// ── 3人とも高校生年代 → 1+1+3 ────────────────────────────────────────
const first = makeChild(10, 4);
const second = makeChild(8, 6);
const third = makeChild(5, 9);
assertEq(
  entitlement([head, first, second, third], 2026, 6),
  5.0,
  'three school-age children',
);

// ── 最年長が22歳年度末を過ぎると第3子加算が消える ──────────────────
const agedOut = makeChild(23, 1);
assertEq(
  entitlement([head, agedOut, second, third], 2026, 6),
  2.0,
  'oldest past 22 fiscal end loses third-child count',
);

// ── 22歳到達後最初の3月まではカウント対象 ──────────────────────────
const stillCountable = makeChild(22, 6);
assertEq(
  entitlement([head, stillCountable, second, third], 2026, 6),
  4.0,
  'age 22 June still countable: 0+1+3',
);

// ── 未出生は 0、出生月から支給 ──────────────────────────────────────
const unborn = makeChild(-1, 4);
assertEq(entitlement([head, unborn], 2026, 6), 0, 'unborn before birth');
assertEq(entitlement([head, unborn], 2027, 4), 1.5, 'birth month starts');
assertEq(entitlement([head, unborn], 2027, 3), 0, 'month before birth');

// ── 4月生まれ: 18歳到達後最初の3月まで ──────────────────────────────
const aprilBorn = makeChild(17, 4);
assertEq(entitlement([head, aprilBorn], 2028, 3), 1.0, 'April-born until Mar after 18');
assertEq(entitlement([head, aprilBorn], 2028, 4), 0, 'April-born stops in April');

// ── 1月生まれ: 18歳到達年の3月まで ──────────────────────────────────
const januaryBorn = makeChild(17, 1);
assertEq(entitlement([head, januaryBorn], 2027, 3), 1.0, 'Jan-born until Mar of turn-18 year');
assertEq(entitlement([head, januaryBorn], 2027, 4), 0, 'Jan-born stops in April');

// ── 生年月未入力は 0 ────────────────────────────────────────────────
const incomplete = makeChild(null, null);
assertEq(entitlement([head, incomplete], 2026, 6), 0, 'incomplete birth');

// ── 支払: 奇数月 0、偶数月は前2か月分 ────────────────────────────────
assertEq(calcChildAllowancePaymentFromEntitlements(5, 1.5, 1.5), 0, 'odd month');
assertEq(calcChildAllowancePaymentFromEntitlements(6, 1.5, 1.0), 2.5, 'even month');

assertEq(
  calcHouseholdMonthlyChildAllowanceMan([head, schoolAge], referenceDate, 2026, 5),
  0,
  'May payment is 0',
);
assertEq(
  calcHouseholdMonthlyChildAllowanceMan([head, schoolAge], referenceDate, 2026, 6),
  2.0,
  'June payment = Apr+May',
);

// ── CF表: 子供がいれば収入に載る ────────────────────────────────────
function buildCf(members) {
  return buildCashFlowTable({
    familyMembers: members,
    incomeByMember: {},
    livingState: createDefaultLivingState(members[0], 6),
    housingState: createDefaultHousingState(members[0], 6),
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember(members),
    taxSocialState: createDefaultTaxSocialState(members[0].age, 6),
    referenceDate,
  });
}

const cfNone = buildCf([head]);
const cfNone2027 = cfNone.years.find((y) => y.calendarYear === 2027);
assert.ok(cfNone2027);
assertEq(cfNone2027.incomeBreakdown.childAllowance, 0, 'CF no children');

const cfOne = buildCf([head, schoolAge]);
const cfOne2027 = cfOne.years.find((y) => y.calendarYear === 2027);
assert.ok(cfOne2027);
assertEq(cfOne2027.incomeBreakdown.childAllowance, 12, 'CF school-age full year 12 man');
assert.ok(
  cfOne2027.income >= 12,
  `CF income should include child allowance, got ${cfOne2027.income}`,
);

const cfThree = buildCf([head, first, second, third]);
const cfThree2027 = cfThree.years.find((y) => y.calendarYear === 2027);
assert.ok(cfThree2027);
assertEq(cfThree2027.incomeBreakdown.childAllowance, 60, 'CF three children 5 man x 12');

const cfInfant = buildCf([head, infant]);
const cfInfant2027 = cfInfant.years.find((y) => y.calendarYear === 2027);
assert.ok(cfInfant2027);
assertEq(cfInfant2027.incomeBreakdown.childAllowance, 18, 'CF infant 1.5 x 12');

// 18歳年度末後は 0
const cfApril = buildCf([head, aprilBorn]);
const cfApril2028 = cfApril.years.find((y) => y.calendarYear === 2028);
const cfApril2029 = cfApril.years.find((y) => y.calendarYear === 2029);
assert.ok(cfApril2028);
assert.ok(cfApril2029);
assert.ok(
  cfApril2028.incomeBreakdown.childAllowance > 0,
  'still paid in the year of last March',
);
assertEq(cfApril2029.incomeBreakdown.childAllowance, 0, 'stopped the following year');

console.log('OK child allowance');
