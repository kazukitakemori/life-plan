/**
 * iDeCo/DC 過去積み立てと開始残高・控除年数
 * npx tsx scripts/verify-ideco-past-contribution.mjs
 */
import {
  applyIdecoPastContributionEnabled,
  calcIdecoDcRetirementDeductionEnrollmentYears,
  estimateContributionScheduleBalanceMan,
  resolveIdecoDcMainContributionStart,
  resolveIdecoDcOpeningBalanceMan,
  resolveIdecoDcReferenceNow,
  syncIdecoDcPastContributionPeriods,
} from '../src/lib/idecoPastContribution.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

const referenceDate = new Date(2026, 0, 1); // Jan 2026
const member = {
  id: 'm1',
  age: 40,
  birthMonth: 4,
  expectedLifespan: 90,
};

const now = resolveIdecoDcReferenceNow(member, referenceDate);
const mainFloor = resolveIdecoDcMainContributionStart(member, referenceDate);
assertEq(now.age, 40, 'now age');
assertEq(now.month, 1, 'now month');
assertEq(mainFloor.age, 40, 'main floor age');
assertEq(mainFloor.month, 2, 'main floor month (next)');

const baseIdeco = {
  id: 'ideco1',
  category: 'ideco',
  name: 'iDeCo',
  balanceMan: 0,
  contributionMan: 2,
  contributionMode: 'monthly',
  expectedReturnRatePct: 3,
  startAge: 30,
  startMonth: 4,
  endMode: 'until',
  endAge: 60,
  endMonth: 3,
  pastContributionEnabled: false,
};

// 過去オフ: 遡及なし。開始が来月未満なら来月へ押し上げ（それ以降は維持）
const syncedOff = syncIdecoDcPastContributionPeriods(
  baseIdeco,
  member,
  referenceDate,
);
assertEq(syncedOff.startAge, mainFloor.age, 'past start bumped to floor age');
assertEq(syncedOff.startMonth, mainFloor.month, 'past start bumped to floor month');
assertEq(
  resolveIdecoDcOpeningBalanceMan(syncedOff, member, referenceDate),
  0,
  'no past → opening 0',
);

const laterStart = syncIdecoDcPastContributionPeriods(
  { ...baseIdeco, startAge: 45, startMonth: 6 },
  member,
  referenceDate,
);
assertEq(laterStart.startAge, 45, 'later start age kept');
assertEq(laterStart.startMonth, 6, 'later start month kept');

const yearsOff = calcIdecoDcRetirementDeductionEnrollmentYears(
  syncedOff,
  member,
  { age: 60, month: 4 },
);
assert(yearsOff >= 19 && yearsOff <= 21, `future-only years ~20, got ${yearsOff}`);

// Past on: 初期値は終了＝今月・開始＝来月。編集で早め終了・遅い開始も可
let withPast = applyIdecoPastContributionEnabled(
  syncedOff,
  true,
  member,
  referenceDate,
);
assertEq(withPast.pastEndAge, now.age, 'initial past end age');
assertEq(withPast.pastEndMonth, now.month, 'initial past end month');
assertEq(withPast.startAge, mainFloor.age, 'initial main start age');
assertEq(withPast.startMonth, mainFloor.month, 'initial main start month');

withPast = {
  ...withPast,
  pastStartAge: 30,
  pastStartMonth: 4,
  pastEndAge: 35,
  pastEndMonth: 6,
  pastContributionInputMode: 'amount',
  pastContributionMan: 2,
  pastContributionMode: 'monthly',
  pastExpectedReturnRatePct: 3,
  startAge: 50,
  startMonth: 1,
};
withPast = syncIdecoDcPastContributionPeriods(withPast, member, referenceDate);
assertEq(withPast.pastEndAge, 35, 'edited past end kept');
assertEq(withPast.pastEndMonth, 6, 'edited past end month kept');
assertEq(withPast.startAge, 50, 'gap main start kept');
assertEq(withPast.startMonth, 1, 'gap main start month kept');

const openingPast = resolveIdecoDcOpeningBalanceMan(
  withPast,
  member,
  referenceDate,
);
assert(openingPast > 0, `past amount opening >0, got ${openingPast}`);

// 過去終了の上限クランプ
const pastEndClamped = syncIdecoDcPastContributionPeriods(
  {
    ...withPast,
    pastEndAge: 50,
    pastEndMonth: 1,
  },
  member,
  referenceDate,
);
assertEq(pastEndClamped.pastEndAge, now.age, 'past end max age');
assertEq(pastEndClamped.pastEndMonth, now.month, 'past end max month');

const yearsPast = calcIdecoDcRetirementDeductionEnrollmentYears(
  withPast,
  member,
  { age: 60, month: 4 },
);
assert(yearsPast >= 15, `gapped years combine, got ${yearsPast}`);

// Balance mode
const withBal = syncIdecoDcPastContributionPeriods(
  {
    ...withPast,
    pastContributionInputMode: 'balance',
    pastBalanceMan: 500,
  },
  member,
  referenceDate,
);
assertEq(
  resolveIdecoDcOpeningBalanceMan(withBal, member, referenceDate),
  500,
  'balance mode opening',
);

const sched = estimateContributionScheduleBalanceMan({
  startAge: 30,
  startMonth: 1,
  endAge: 39,
  endMonth: 12,
  contributionMode: 'monthly',
  contributionMan: 1,
  expectedReturnRatePct: 0,
});
assertEq(sched, 120, '10y * 12 * 1man at 0%');

const legacy = syncIdecoDcPastContributionPeriods(
  {
    ...baseIdeco,
    pastContributionEnabled: undefined,
    balanceMan: 300,
    startAge: 30,
    startMonth: 1,
  },
  member,
  referenceDate,
);
assert(legacy.pastContributionEnabled === true, 'legacy migrates');
assertEq(legacy.pastBalanceMan, 300, 'legacy balance');
assertEq(legacy.startAge, mainFloor.age, 'legacy main start floor');
assertEq(legacy.startMonth, mainFloor.month, 'legacy main start floor month');
assertEq(legacy.balanceMan, 300, 'synced opening');

console.log('verify-ideco-past-contribution: ok');
