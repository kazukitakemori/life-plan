/**
 * 企業型DC 過去積み立て複数セグメント
 * npx tsx scripts/verify-dc-past-segments.mjs
 */
import {
  applyIdecoPastContributionEnabled,
  appendDcPastContributionSegment,
  buildDcPastSegmentsFromEnrollmentYears,
  calcIdecoDcRetirementDeductionEnrollmentYears,
  createDcPastContributionSegment,
  migrateDcScalarPastToSegments,
  normalizeDcPastContributionSegments,
  resolveDcPastEnrollmentYearsFromSegments,
  resolveDcPastSegmentsBounds,
  resolveIdecoDcContributionJoin,
  resolveIdecoDcOpeningBalanceMan,
  suggestDcPastSegmentsFromIncome,
  syncIdecoDcPastContributionPeriods,
} from '../src/lib/idecoPastContribution.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';

const referenceDate = new Date(2026, 5, 1); // June 2026

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 4 };

let dc = createSavingsEntry('dc', member, referenceDate, {
  employerContributionMode: 'monthly',
  employerContributionMan: 2,
  employeeContributionMode: 'none',
  employeeContributionMan: 0,
  expectedReturnRatePct: 0,
  pastContributionEnabled: false,
});

dc = applyIdecoPastContributionEnabled(dc, true, member, referenceDate);
assert(dc.pastContributionEnabled === true, 'past on');
assert(
  Array.isArray(dc.pastContributionSegments) &&
    dc.pastContributionSegments.length >= 1,
  'has segments',
);
console.log('OK enable past creates segment');

// スカラーから移行
const legacy = syncIdecoDcPastContributionPeriods(
  {
    ...createSavingsEntry('dc', member, referenceDate, {
      expectedReturnRatePct: 0,
    }),
    pastContributionEnabled: true,
    pastContributionInputMode: 'amount',
    pastStartAge: 30,
    pastStartMonth: 4,
    pastEndAge: 35,
    pastEndMonth: 3,
    pastContributionMan: 1.5,
    pastContributionMode: 'monthly',
    pastExpectedReturnRatePct: 0,
    pastContributionSegments: undefined,
  },
  member,
  referenceDate,
);
const migrated = migrateDcScalarPastToSegments(legacy);
assert(migrated.length >= 1, 'migrate length');
assertEq(migrated[0].contributionMan, 1.5, 'migrate amount');
assertEq(migrated[0].startAge, 30, 'migrate start');
console.log('OK scalar migrate');

const seg1 = createDcPastContributionSegment({
  startAge: 30,
  startMonth: 4,
  endAge: 34,
  endMonth: 3,
  expectedReturnRatePct: 0,
  contributionMan: 1,
  contributionMode: 'monthly',
});
const seg2 = createDcPastContributionSegment({
  startAge: 35,
  startMonth: 4,
  endAge: 39,
  endMonth: 12,
  expectedReturnRatePct: 0,
  contributionMan: 2,
  contributionMode: 'monthly',
});
const multi = syncIdecoDcPastContributionPeriods(
  {
    ...dc,
    pastContributionEnabled: true,
    pastContributionInputMode: 'amount',
    expectedReturnRatePct: 0,
    pastExpectedReturnRatePct: 0,
    pastContributionSegments: [seg1, seg2],
  },
  member,
  referenceDate,
);
const opening = resolveIdecoDcOpeningBalanceMan(multi, member, referenceDate);
// seg1: Apr30–Mar34 = 48 months × 1 = 48
// seg2: Apr35–Dec39 = 57 months × 2 = 114
// total 162 (rate 0)
assert(opening >= 160 && opening <= 165, `opening ~162 got ${opening}`);
console.log('OK multi-segment balance', opening);

const join = resolveIdecoDcContributionJoin(multi);
assertEq(join.age, 30, 'join earliest');
assertEq(join.month, 4, 'join month');

const years = calcIdecoDcRetirementDeductionEnrollmentYears(multi, member, {
  age: 60,
  month: 4,
});
assert(years >= 10, `enrollment years include past got ${years}`);
console.log('OK enrollment years', years);

const overlap = normalizeDcPastContributionSegments(
  [
    createDcPastContributionSegment({
      startAge: 30,
      startMonth: 1,
      endAge: 32,
      endMonth: 12,
      expectedReturnRatePct: 0,
      contributionMan: 1,
    }),
    createDcPastContributionSegment({
      startAge: 32,
      startMonth: 1,
      endAge: 34,
      endMonth: 12,
      expectedReturnRatePct: 0,
      contributionMan: 2,
    }),
  ],
  { age: 40, month: 6 },
  { expectedReturnRatePct: 0, contributionMan: 1 },
);
assertEq(overlap.length, 2, 'two after normalize');
assert(
  overlap[1].startAge > 32 ||
    (overlap[1].startAge === 33 && overlap[1].startMonth === 1),
  `overlap pushed start got ${overlap[1].startAge}/${overlap[1].startMonth}`,
);
console.log('OK overlap normalize');

const bounds = resolveDcPastSegmentsBounds(overlap);
assert(bounds != null && bounds.startAge === 30, 'bounds');

const income = createIncomeEntry(member.id, 'employee', member.age, 6, member);
income.periods = [
  {
    ...income.periods[0],
    startAge: 25,
    startMonth: 4,
    endAge: 35,
    endMonth: 3,
  },
];
const suggested = suggestDcPastSegmentsFromIncome(
  [income],
  member,
  referenceDate,
  { expectedReturnRatePct: 3, contributionMan: 2 },
);
assert(suggested.length >= 1, 'suggest from income');
assertEq(suggested[0].startAge, 25, 'suggest start');
console.log('OK income suggest');

const withBal = syncIdecoDcPastContributionPeriods(
  {
    ...multi,
    pastContributionInputMode: 'balance',
    pastBalanceMan: 500,
  },
  member,
  referenceDate,
);
assertEq(
  resolveIdecoDcOpeningBalanceMan(withBal, member, referenceDate),
  500,
  'balance mode',
);
console.log('OK balance mode');

// 2回目の sync は参照を維持（UI の更新ループ防止）
const syncedOnce = syncIdecoDcPastContributionPeriods(multi, member, referenceDate);
const syncedTwice = syncIdecoDcPastContributionPeriods(
  syncedOnce,
  member,
  referenceDate,
);
assert(syncedOnce === syncedTwice, 'idempotent sync keeps reference');
console.log('OK idempotent sync');

// 区間追加: 末尾が今月でも捨てられず増える
const atNow = [
  createDcPastContributionSegment({
    startAge: 30,
    startMonth: 1,
    endAge: 40,
    endMonth: 6,
    expectedReturnRatePct: 0,
    contributionMan: 1,
  }),
];
const appended = appendDcPastContributionSegment(
  atNow,
  { age: 40, month: 6 },
  { expectedReturnRatePct: 0, contributionMan: 1 },
);
assert(appended.length === 2, `append splits when full: got ${appended.length}`);
assert(
  appended[1].endAge === 40 && appended[1].endMonth === 6,
  'new segment ends at now',
);
console.log('OK append when full');

const roomAfter = [
  createDcPastContributionSegment({
    startAge: 30,
    startMonth: 1,
    endAge: 35,
    endMonth: 12,
    expectedReturnRatePct: 0,
    contributionMan: 1,
  }),
];
const appendedRoom = appendDcPastContributionSegment(
  roomAfter,
  { age: 40, month: 6 },
  { expectedReturnRatePct: 0, contributionMan: 2 },
);
assert(appendedRoom.length === 2, 'append with room');
assert(appendedRoom[1].startAge === 36, 'starts after previous');
console.log('OK append with room');

const fromYears = buildDcPastSegmentsFromEnrollmentYears({
  years: 10,
  now: { age: 40, month: 6 },
  expectedReturnRatePct: 0,
  contributionMan: 0,
});
assertEq(fromYears.length, 1, 'years → 1 segment');
assertEq(
  resolveDcPastEnrollmentYearsFromSegments(fromYears),
  10,
  'years round-trip',
);
console.log('OK enrollment years builder');

console.log('verify-dc-past-segments: ok');
