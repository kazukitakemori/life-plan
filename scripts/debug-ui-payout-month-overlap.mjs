/**
 * UI と同じく受取月=誕生日月で preview したときの結果
 * npx tsx scripts/debug-ui-payout-month-overlap.mjs
 */
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
import { resolvePensionPayoutStart } from '../src/lib/idecoPayout.ts';
import { previewPensionOnceTaxWithOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { resolveIdecoOncePayoutMan } from '../src/lib/savingsCashFlow.ts';
import { estimateInvestBalanceManAt } from '../src/lib/savingsCashFlow.ts';

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

// clamp せず、画面と同じ birthday month で preview（未オープンのままだと withdrawal 未設定）
const dc = entries.find((e) => e.category === 'dc');
const pensionPayoutMonth = member.birthMonth || 1;
const pensionPayoutStart = resolvePensionPayoutStart(dc, member, {
  age: dc.withdrawalStartAge ?? member.age,
  month: pensionPayoutMonth,
});
const withdrawalStartAge = pensionPayoutStart.age;
const withdrawalStartMonth = pensionPayoutMonth;

const man = Math.round(
  estimateInvestBalanceManAt({
    entry: dc,
    member,
    memberEntries: entries,
    referenceDate,
    targetAge: withdrawalStartAge,
    targetMonth: withdrawalStartMonth,
  }),
);

const preview = previewPensionOnceTaxWithOverlap({
  entry: dc,
  member,
  incomeEntries,
  memberEntries: entries,
  referenceDate,
  revenueMan: man,
  payoutStart: {
    age: withdrawalStartAge,
    month: withdrawalStartMonth,
  },
});

console.log({
  entries: entries.map((e) => ({
    cat: e.category,
    contrib: `${e.startAge}/${e.startMonth}-${e.endAge}/${e.endMonth}`,
    wd: `${e.withdrawalStartAge}/${e.withdrawalStartMonth}`,
  })),
  uiPayout: { age: withdrawalStartAge, month: withdrawalStartMonth },
  man,
  preview: {
    fullMan: preview.fullDeductionYen / 10000,
    dedMan: preview.breakdown.deductionYen / 10000,
    overlap: preview.overlapYears,
    rule: preview.ruleLabel,
  },
});
