/**
 * アプリの addEntry に近い手順でデフォルト iDeCo+DC を再現
 * npx tsx scripts/verify-default-ideco-dc-overlap.mjs
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
  calcMemberCorporateDcMonthlyYen,
  calcMemberDbOtherSystemMonthlyYen,
  syncIdecoCorporateDcFlags,
  reconcileMemberIdecoCorporatePensions,
} from '../src/lib/idecoContributionLimit.ts';
import { ensureDcContributionFields } from '../src/lib/dcContribution.ts';
import {
  calcPensionRetirementDeductionEnrollmentYears,
  resolveIdecoPayoutStart,
  clampIdecoPayoutFields,
} from '../src/lib/idecoPayout.ts';
import { previewPensionOnceTaxWithOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { resolveIdecoOncePayoutMan } from '../src/lib/savingsCashFlow.ts';
import { resolveIdecoDcContributionJoin } from '../src/lib/idecoPastContribution.ts';

const referenceDate = new Date(2026, 7, 7);
const member = createDefaultFamily()[0];
const income = createIncomeEntry(member.id, 'employee', member.age, 1, member);
const incomeEntries = [income];

let entries = [];

// 1) add iDeCo
{
  const startAge = member.age;
  const startMonth = referenceDate.getMonth() + 1;
  const occupancy = resolveIdecoOccupancy(
    member,
    incomeEntries,
    referenceDate,
    { age: startAge, month: startMonth },
  );
  const flags = defaultIdecoCorporatePensionFlags({
    occupancy,
    memberHasCorporateDcEntry: false,
    memberHasDbEntry: false,
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
      entries,
    ),
  ];
}

// 2) add DC
{
  let created = createSavingsEntry('dc', member, referenceDate);
  created = ensureDcContributionFields(created, member, {
    incomeEntries,
    referenceDate,
  });
  entries = [...entries, created];
  entries = reconcileMemberIdecoCorporatePensions(
    syncIdecoCorporateDcFlags(entries),
    member,
    incomeEntries,
    referenceDate,
  );
}

let [ideco, dc] = entries;
// 画面を開いたとき相当の clamp
ideco = clampIdecoPayoutFields(ideco, member);
dc = clampIdecoPayoutFields(dc, member);
entries = [ideco, dc];

function describe(entry, label) {
  const payout = resolveIdecoPayoutStart(entry, member, {
    age: entry.withdrawalStartAge ?? member.age,
    month: entry.withdrawalStartMonth ?? 1,
  });
  const years = calcPensionRetirementDeductionEnrollmentYears(
    entry,
    member,
    payout,
  );
  const join = resolveIdecoDcContributionJoin(entry);
  const man = resolveIdecoOncePayoutMan(entry, member, entries, referenceDate);
  const preview = previewPensionOnceTaxWithOverlap({
    entry,
    member,
    incomeEntries,
    memberEntries: entries,
    referenceDate,
    revenueMan: man,
    payoutStart: payout,
  });
  console.log(label, {
    contrib: `${entry.startAge}/${entry.startMonth} → ${entry.endAge}/${entry.endMonth}`,
    join: `${join.age}/${join.month}`,
    payout,
    years,
    man,
    withdrawalStored: `${entry.withdrawalStartAge}/${entry.withdrawalStartMonth}`,
    preview: preview && {
      fullMan: preview.fullDeductionYen / 10000,
      dedMan: preview.breakdown.deductionYen / 10000,
      overlap: preview.overlapYears,
      adjusted: preview.adjusted,
      rule: preview.ruleLabel,
      calYear: preview.payoutCalendarYear,
    },
  });
}

console.log('income period', income.periods?.[0]);
describe(ideco, 'iDeCo');
describe(dc, 'DC');
