/**
 * 誕生日月受取でも拠出期間は切らず、全重複なら控除0
 * npx tsx scripts/verify-birth-month-overlap-zero.mjs
 */
import { calcRetirementDeductionYenAfterOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import {
  applyIdecoOccupancySelection,
  defaultIdecoCorporatePensionFlags,
  resolveIdecoOccupancy,
  yenToMan,
  resolveIdecoMonthlyLimitYen,
  syncIdecoCorporateDcFlags,
  reconcileMemberIdecoCorporatePensions,
} from '../src/lib/idecoContributionLimit.ts';
import { ensureDcContributionFields } from '../src/lib/dcContribution.ts';
import { previewPensionOnceTaxWithOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { estimateInvestBalanceManAt } from '../src/lib/savingsCashFlow.ts';

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

// 直接: iDeCo期間が誕生日月で切られていた旧バグ相当でも、
// 拠出終了まで見れば全重複→0
const direct = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2051,
    kind: 'dc',
    revenueMan: 1115,
    enrollmentYears: 20,
    periodStartAge: 40,
    periodStartMonth: 9,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2046,
      kind: 'ideco',
      revenueMan: 645,
      enrollmentYears: 21,
      // 旧: 受取60/1で期間が切れた状態
      periodStartAge: 40,
      periodStartMonth: 2,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});
// 期間を拠出終了まで伸ばした prior
const fixed = calcRetirementDeductionYenAfterOverlap({
  current: direct.current ?? {
    memberId: 'm',
    calendarYear: 2051,
    kind: 'dc',
    revenueMan: 1115,
    enrollmentYears: 20,
    periodStartAge: 40,
    periodStartMonth: 9,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2046,
      kind: 'ideco',
      revenueMan: 645,
      enrollmentYears: 21,
      periodStartAge: 40,
      periodStartMonth: 2,
      periodEndAge: 60,
      periodEndMonth: 3,
    },
  ],
});

console.log('truncated prior (60/1)', {
  overlap: direct.overlapYears,
  dedMan: direct.deductionYen / 10000,
});
console.log('contrib-end prior (60/3)', {
  overlap: fixed.overlapYears,
  dedMan: fixed.deductionYen / 10000,
});
assertEq(fixed.deductionYen, 0, 'full contrib overlap → 0');

// アプリ経路
const referenceDate = new Date(2026, 7, 7);
const member = createDefaultFamily()[0];
const income = createIncomeEntry(member.id, 'employee', member.age, 1, member);
const incomeEntries = [income];
let entries = [];
{
  const occupancy = resolveIdecoOccupancy(member, incomeEntries, referenceDate, {
    age: member.age,
    month: referenceDate.getMonth() + 1,
  });
  const flags = defaultIdecoCorporatePensionFlags({
    occupancy,
    memberHasCorporateDcEntry: false,
  });
  const base = createSavingsEntry('ideco', member, referenceDate, {
    ...flags,
    idecoOccupancy: occupancy,
    contributionMan: Math.min(
      3,
      yenToMan(resolveIdecoMonthlyLimitYen(occupancy, flags, {})),
    ),
  });
  entries = [
    applyIdecoOccupancySelection(
      base,
      occupancy,
      member,
      incomeEntries,
      referenceDate,
      [],
    ),
  ];
}
{
  let created = ensureDcContributionFields(
    createSavingsEntry('dc', member, referenceDate),
    member,
    { incomeEntries, referenceDate },
  );
  entries = [...entries, created];
  entries = reconcileMemberIdecoCorporatePensions(
    syncIdecoCorporateDcFlags(entries),
    member,
    incomeEntries,
    referenceDate,
  );
}
// iDeCo を誕生日月受取で保存した状態を模擬
entries = entries.map((e) =>
  e.category === 'ideco'
    ? {
        ...e,
        withdrawalStartAge: 60,
        withdrawalStartMonth: member.birthMonth || 1,
      }
    : e,
);

const dc = entries.find((e) => e.category === 'dc');
const man = Math.round(
  estimateInvestBalanceManAt({
    entry: dc,
    member,
    memberEntries: entries,
    referenceDate,
    targetAge: 65,
    targetMonth: 1,
  }),
);
const preview = previewPensionOnceTaxWithOverlap({
  entry: dc,
  member,
  incomeEntries,
  memberEntries: entries,
  referenceDate,
  revenueMan: man,
  payoutStart: { age: 65, month: 1 },
});
console.log('app path with ideco birth-month payout', {
  man,
  fullMan: preview.fullDeductionYen / 10000,
  dedMan: preview.breakdown.deductionYen / 10000,
  overlap: preview.overlapYears,
});
assertEq(preview.breakdown.deductionYen, 0, 'app path deduction 0');
console.log('OK birth-month / contrib-end overlap → 0');
