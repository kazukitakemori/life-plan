/**
 * 退職所得控除の重複調整（税務の10年／19年ルール）と拠出期間のみの加入年数
 * npx tsx scripts/verify-retirement-deduction-overlap.mjs
 */
import {
  calcPensionRetirementDeductionEnrollmentYears,
  resolveEarliestPayoutAgeFromJoin,
  resolveMinPayoutAgeFromEnrollmentYears,
} from '../src/lib/idecoPayout.ts';
import {
  calcEnrollmentOverlapYears,
  calcRetirementDeductionYenAfterOverlap,
  collectAllRetirementLumpEvents,
  previewPensionOnceTaxWithOverlap,
  resolveRetirementDeductionLookbackYears,
  retirementDeductionOverlapRuleLabel,
  shortRetirementDeductionRuleName,
  RETIREMENT_DEDUCTION_COMPANY_THEN_COMPANY_LOOKBACK_YEARS,
  RETIREMENT_DEDUCTION_COMPANY_THEN_DC_LOOKBACK_YEARS,
  RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS,
  RETIREMENT_DEDUCTION_DC_THEN_DC_LOOKBACK_YEARS,
} from '../src/lib/retirementDeductionOverlap.ts';
import {
  calcMergedEnrollmentYearsFromPeriods,
  calcRetirementIncomeDeductionYen,
} from '../src/lib/retirementIncomeTax.ts';
import { mergeRetirementLumpSums } from '../src/lib/retirementAllowance.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createRetirementAllowanceEntry } from '../src/lib/retirementAllowance.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

const referenceDate = new Date(2026, 5, 1);
const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 1 };

// ── 基本3ロジック（後受けの種類で決まる）──────────────────────
assertEq(
  resolveRetirementDeductionLookbackYears('ideco', 'company'),
  RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS,
  'DC→company = 10y (9)',
);
assertEq(
  resolveRetirementDeductionLookbackYears('dc', 'db'),
  RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS,
  'DC→DB = 10y (9)',
);
assertEq(
  resolveRetirementDeductionLookbackYears('company', 'ideco'),
  RETIREMENT_DEDUCTION_COMPANY_THEN_DC_LOOKBACK_YEARS,
  'company→DC = 19y',
);
assertEq(
  resolveRetirementDeductionLookbackYears('db', 'dc'),
  RETIREMENT_DEDUCTION_COMPANY_THEN_DC_LOOKBACK_YEARS,
  'DB→DC = 19y',
);
assertEq(
  resolveRetirementDeductionLookbackYears('ideco', 'dc'),
  RETIREMENT_DEDUCTION_DC_THEN_DC_LOOKBACK_YEARS,
  'iDeCo→DC = 19y（どうし）',
);
assertEq(
  resolveRetirementDeductionLookbackYears('dc', 'ideco'),
  RETIREMENT_DEDUCTION_DC_THEN_DC_LOOKBACK_YEARS,
  'DC→iDeCo = 19y（どうし）',
);
assertEq(
  resolveRetirementDeductionLookbackYears('company', 'db'),
  RETIREMENT_DEDUCTION_COMPANY_THEN_COMPANY_LOOKBACK_YEARS,
  '退職金どうし = 5y (4)',
);

assertEq(
  retirementDeductionOverlapRuleLabel('ideco', 'db'),
  '10年ルール（DC/iDeCo先→DB・退職金後）',
  'label 10y',
);
assertEq(
  retirementDeductionOverlapRuleLabel('db', 'ideco'),
  '19年ルール（DB・退職金先→DC/iDeCo後）',
  'label 19y company→dc',
);
assertEq(
  retirementDeductionOverlapRuleLabel('ideco', 'dc'),
  '19年ルール（DC/iDeCoどうし）',
  'label 19y dc-dc',
);
assertEq(shortRetirementDeductionRuleName('ideco', 'dc'), '19年ルール', 'short');
assertEq(shortRetirementDeductionRuleName('dc', 'db'), '10年ルール', 'short 10');
console.log('OK tax lookback matrix (3 logics + DCどうし=19)');

// 通算加入者等期間の梯子（受給開始）は税ルールとは別
assertEq(resolveMinPayoutAgeFromEnrollmentYears(10), 60, '通算10y→60');
assertEq(resolveMinPayoutAgeFromEnrollmentYears(5), 63, '通算5y→63');
console.log('OK payout-age ladder (not tax 10y rule)');

// ── 退職所得控除の加入年数 = 拠出期間のみ ─────────────────────
const entry = createSavingsEntry('ideco', member, referenceDate, {
  startAge: 50,
  startMonth: 1,
  endMode: 'until',
  endAge: 60,
  endMonth: 1,
  contributionMode: 'monthly',
  contributionMan: 2,
  withdrawalMode: 'once',
  withdrawalStartAge: 65,
  withdrawalStartMonth: 1,
});
const deductionYears = calcPensionRetirementDeductionEnrollmentYears(
  entry,
  member,
  { age: 65, month: 1 },
);
// 50/1〜60/1 = 121か月 → 11年（受給65まで伸ばさない）
assertEq(deductionYears, 11, 'deduction years = contribution only');
assert(
  resolveEarliestPayoutAgeFromJoin({ age: 50, month: 1 }, 1) === 60,
  '通算は運用指図も含め60到達可',
);
console.log('OK contribution-only deduction years');

// ── 重複期間 ─────────────────────────────────────────────────
assertEq(
  calcEnrollmentOverlapYears(
    { startAge: 30, startMonth: 4, endAge: 60, endMonth: 3 },
    { startAge: 40, startMonth: 1, endAge: 60, endMonth: 1 },
  ),
  20,
  'overlap floor ~20y (241mo → 20)',
);
assertEq(
  calcEnrollmentOverlapYears(
    { startAge: 40, startMonth: 1, endAge: 45, endMonth: 3 },
    { startAge: 40, startMonth: 1, endAge: 50, endMonth: 1 },
  ),
  5,
  'overlap 5y3m → floor 5',
);
assertEq(
  calcEnrollmentOverlapYears(
    { startAge: 40, startMonth: 1, endAge: 40, endMonth: 11 },
    { startAge: 40, startMonth: 1, endAge: 50, endMonth: 1 },
  ),
  0,
  'overlap 11mo → floor 0',
);

const adjusted = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm1',
    calendarYear: 2035,
    kind: 'company',
    revenueMan: 2000,
    enrollmentYears: 30,
    periodStartAge: 30,
    periodStartMonth: 4,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm1',
      calendarYear: 2030,
      kind: 'ideco',
      revenueMan: 500,
      enrollmentYears: 15,
      periodStartAge: 45,
      periodStartMonth: 1,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});
assert(adjusted.overlapYears > 0, 'overlap years > 0');
assert(
  adjusted.deductionYen < adjusted.fullDeductionYen,
  `deduction reduced ${adjusted.fullDeductionYen} → ${adjusted.deductionYen}`,
);
assertEq(
  adjusted.deductionYen,
  adjusted.fullDeductionYen -
    calcRetirementIncomeDeductionYen(adjusted.overlapYears),
  'reduction = overlap deduction',
);
console.log(
  `OK 10y-rule overlap: years=${adjusted.overlapYears}, deduction ${adjusted.fullDeductionYen}→${adjusted.deductionYen}`,
);

// 間隔が10年超（gap>9）なら調整なし
const noAdjust = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm1',
    calendarYear: 2040,
    kind: 'company',
    revenueMan: 2000,
    enrollmentYears: 30,
    periodStartAge: 30,
    periodStartMonth: 4,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm1',
      calendarYear: 2030,
      kind: 'ideco',
      revenueMan: 500,
      enrollmentYears: 15,
      periodStartAge: 45,
      periodStartMonth: 1,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});
assertEq(noAdjust.overlapYears, 0, 'gap 10y → no overlap adjust');
assertEq(
  noAdjust.deductionYen,
  noAdjust.fullDeductionYen,
  'full deduction when outside lookback',
);
console.log('OK outside 10y lookback');

// ── 6パターン相当の連鎖（隣接ルックバック）────────────────────
function look(prior, current) {
  return resolveRetirementDeductionLookbackYears(prior, current);
}
// ① iDeCo → DC → DB : 19 + 10
assertEq(look('ideco', 'dc'), 19, '① ideco→dc');
assertEq(look('dc', 'db'), 9, '① dc→db');
// ② DC → iDeCo → DB : 19 + 10
assertEq(look('dc', 'ideco'), 19, '② dc→ideco');
assertEq(look('ideco', 'db'), 9, '② ideco→db');
// ③ iDeCo → DB → DC : 10 + 19
assertEq(look('ideco', 'db'), 9, '③ ideco→db');
assertEq(look('db', 'dc'), 19, '③ db→dc');
// ④ DC → DB → iDeCo : 10 + 19
assertEq(look('dc', 'db'), 9, '④ dc→db');
assertEq(look('db', 'ideco'), 19, '④ db→ideco');
// ⑤ DB → iDeCo → DC : 19 + 19
assertEq(look('db', 'ideco'), 19, '⑤ db→ideco');
assertEq(look('ideco', 'dc'), 19, '⑤ ideco→dc');
// ⑥ DB → DC → iDeCo : 19 + 19
assertEq(look('db', 'dc'), 19, '⑥ db→dc');
assertEq(look('dc', 'ideco'), 19, '⑥ dc→ideco');
console.log('OK 6-pattern adjacent lookbacks');

// 連鎖: iDeCo → DC → DB で DB が両方の先行と10年窓内なら重複が効く
const chainDb = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm1',
    calendarYear: 2040,
    kind: 'db',
    revenueMan: 2000,
    enrollmentYears: 30,
    periodStartAge: 30,
    periodStartMonth: 4,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm1',
      calendarYear: 2032,
      kind: 'ideco',
      revenueMan: 400,
      enrollmentYears: 12,
      periodStartAge: 45,
      periodStartMonth: 1,
      periodEndAge: 57,
      periodEndMonth: 1,
    },
    {
      memberId: 'm1',
      calendarYear: 2035,
      kind: 'dc',
      revenueMan: 600,
      enrollmentYears: 15,
      periodStartAge: 40,
      periodStartMonth: 1,
      periodEndAge: 55,
      periodEndMonth: 1,
    },
  ],
});
assert(chainDb.overlapYears > 0, 'chain DB overlaps with DC-style priors');
assert(
  chainDb.deductionYen < chainDb.fullDeductionYen,
  'chain DB deduction reduced',
);
console.log(
  `OK chain iDeCo→DC→DB: overlapYears=${chainDb.overlapYears}, ded ${chainDb.fullDeductionYen}→${chainDb.deductionYen}`,
);

// ── 期間が重ならない → 重複0（短い方全額フォールバック禁止）──
const noPeriodOverlap = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm1',
    calendarYear: 2035,
    kind: 'ideco',
    revenueMan: 500,
    enrollmentYears: 5,
    periodStartAge: 61,
    periodStartMonth: 1,
    periodEndAge: 65,
    periodEndMonth: 1,
  },
  priors: [
    {
      memberId: 'm1',
      calendarYear: 2030,
      kind: 'company',
      revenueMan: 2000,
      enrollmentYears: 30,
      periodStartAge: 30,
      periodStartMonth: 4,
      periodEndAge: 60,
      periodEndMonth: 12,
    },
  ],
});
assertEq(noPeriodOverlap.overlapYears, 0, 'non-overlapping periods → 0');
assertEq(
  noPeriodOverlap.deductionYen,
  noPeriodOverlap.fullDeductionYen,
  'non-overlapping keeps full deduction',
);
console.log('OK non-overlapping periods do not invent overlap');

// ── 過去拠出開始が税イベント期間に反映される ─────────────────
const income = createIncomeEntry(member.id, 'employee', 40, 1, member);
income.retirementAllowances = [
  createRetirementAllowanceEntry(member, {
    amountMan: 1500,
    receiveAge: 45,
    receiveMonth: 3,
    enrollmentMode: 'period',
    enrollmentStartAge: 25,
    enrollmentStartMonth: 4,
    enrollmentEndAge: 45,
    enrollmentEndMonth: 3,
  }),
];

const idecoWithPast = createSavingsEntry('ideco', member, referenceDate, {
  startAge: 46,
  startMonth: 1,
  endMode: 'until',
  endAge: 60,
  endMonth: 1,
  contributionMode: 'monthly',
  contributionMan: 2,
  withdrawalMode: 'once',
  withdrawalStartAge: 60,
  withdrawalStartMonth: 4,
  balanceMan: 500,
  pastContributionEnabled: true,
  pastStartAge: 30,
  pastStartMonth: 1,
  pastEndAge: 40,
  pastEndMonth: 12,
  pastContributionMan: 1,
});

const events = collectAllRetirementLumpEvents({
  familyMembers: [member],
  incomeByMember: { [member.id]: [income] },
  savingsState: { byMember: { [member.id]: [idecoWithPast] } },
  referenceDate,
});
const idecoEvent = events.find((e) => e.kind === 'ideco');
assert(idecoEvent, 'ideco event exists');
assertEq(
  idecoEvent.periodStartAge,
  30,
  'tax event period starts at past join (not main startAge 46)',
);
assertEq(idecoEvent.periodStartMonth, 1, 'past join month');

const pastPreview = previewPensionOnceTaxWithOverlap({
  entry: idecoWithPast,
  member,
  incomeEntries: [income],
  memberEntries: [idecoWithPast],
  referenceDate,
  revenueMan: 500,
  payoutStart: { age: 60, month: 4 },
});
assert(pastPreview, 'past preview exists');
assert(
  pastPreview.overlapYears > 0,
  `past-overlap should reduce deduction, got ${pastPreview.overlapYears}`,
);
assert(
  pastPreview.breakdown.deductionYen < pastPreview.fullDeductionYen,
  'past period overlap reduces deduction (not ignored / not full wipe)',
);
// 本体だけなら会社(〜45)と重ならない → 旧実装はフォールバックで全消しし得た。
// 過去込みならカレンダー重複があり、加入年数より小さい重複になる。
assert(
  pastPreview.overlapYears <
    calcPensionRetirementDeductionEnrollmentYears(idecoWithPast, member, {
      age: 60,
      month: 4,
    }),
  'overlap is calendar overlap, not min(enrollmentYears) fallback',
);
console.log(
  `OK past contribution in tax period: start=${idecoEvent.periodStartAge}, overlapYears=${pastPreview.overlapYears}`,
);

// ── 重複端数切り捨て・同年和集合・複数先行の和集合 ───────────
assertEq(
  calcMergedEnrollmentYearsFromPeriods([
    { startAge: 40, startMonth: 4, endAge: 49, endMonth: 3 },
    { startAge: 42, startMonth: 4, endAge: 49, endMonth: 7 },
  ]),
  10,
  'same-year merge 9y4m → ceil 10 (No.2735 example shape)',
);
assertEq(
  calcMergedEnrollmentYearsFromPeriods([
    { startAge: 30, startMonth: 1, endAge: 39, endMonth: 12 },
    { startAge: 45, startMonth: 1, endAge: 54, endMonth: 12 },
  ]),
  20,
  'disjoint same-year periods → 20 (not max=10)',
);
assertEq(
  calcMergedEnrollmentYearsFromPeriods([
    { startAge: 30, startMonth: 1, endAge: 50, endMonth: 12 },
    { startAge: 35, startMonth: 1, endAge: 40, endMonth: 12 },
  ]),
  21,
  'nested same-year → longest only 21',
);

const mergedLumps = mergeRetirementLumpSums(
  {
    m1: {
      revenueMan: 400,
      enrollmentYears: 9,
      kind: 'company',
      periodStartAge: 40,
      periodStartMonth: 4,
      periodEndAge: 49,
      periodEndMonth: 3,
    },
  },
  {
    m1: {
      revenueMan: 180,
      enrollmentYears: 8,
      kind: 'company',
      periodStartAge: 42,
      periodStartMonth: 4,
      periodEndAge: 49,
      periodEndMonth: 7,
    },
  },
);
assertEq(mergedLumps.m1.enrollmentYears, 10, 'mergeRetirementLumpSums years');
assertEq(mergedLumps.m1.revenueMan, 580, 'mergeRetirementLumpSums revenue');

const multiPriorUnion = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm1',
    calendarYear: 2040,
    kind: 'company',
    revenueMan: 2000,
    enrollmentYears: 30,
    periodStartAge: 30,
    periodStartMonth: 1,
    periodEndAge: 60,
    periodEndMonth: 1,
  },
  priors: [
    {
      memberId: 'm1',
      calendarYear: 2032,
      kind: 'ideco',
      revenueMan: 400,
      enrollmentYears: 12,
      periodStartAge: 45,
      periodStartMonth: 1,
      periodEndAge: 50,
      periodEndMonth: 1,
    },
    {
      memberId: 'm1',
      calendarYear: 2035,
      kind: 'dc',
      revenueMan: 600,
      enrollmentYears: 15,
      periodStartAge: 52,
      periodStartMonth: 1,
      periodEndAge: 57,
      periodEndMonth: 1,
    },
  ],
});
assertEq(
  multiPriorUnion.overlapYears,
  10,
  'disjoint prior overlaps union to 10 (not max 5)',
);
console.log('OK floor / same-year union / multi-prior union');

console.log('All retirement deduction overlap checks passed.');
