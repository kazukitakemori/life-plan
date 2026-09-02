/**
 * 収入なしデフォルトで iDeCo+DC
 * npx tsx scripts/debug-default-ideco-dc-no-income.mjs
 */
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
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
import { estimateInvestBalanceManAt } from '../src/lib/savingsCashFlow.ts';

const referenceDate = new Date(2026, 7, 7);
const member = createDefaultFamily()[0];
const incomeEntries = [];

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

const dc = entries.find((e) => e.category === 'dc');
const pensionPayoutMonth = member.birthMonth || 1;
const pensionPayoutStart = resolvePensionPayoutStart(dc, member, {
  age: dc.withdrawalStartAge ?? member.age,
  month: pensionPayoutMonth,
});
const man = Math.round(
  estimateInvestBalanceManAt({
    entry: dc,
    member,
    memberEntries: entries,
    referenceDate,
    targetAge: pensionPayoutStart.age,
    targetMonth: pensionPayoutMonth,
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
    age: pensionPayoutStart.age,
    month: pensionPayoutMonth,
  },
});

console.log({
  entries: entries.map((e) => ({
    cat: e.category,
    contrib: `${e.startAge}/${e.startMonth}-${e.endAge}/${e.endMonth}`,
    wd: `${e.withdrawalStartAge}/${e.withdrawalStartMonth}`,
  })),
  uiPayout: { age: pensionPayoutStart.age, month: pensionPayoutMonth },
  resolvedMonth: pensionPayoutStart.month,
  man,
  preview: preview && {
    fullMan: preview.fullDeductionYen / 10000,
    dedMan: preview.breakdown.deductionYen / 10000,
    overlap: preview.overlapYears,
    rule: preview.ruleLabel,
  },
});
