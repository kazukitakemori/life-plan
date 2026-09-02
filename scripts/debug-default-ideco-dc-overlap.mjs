/**
 * デフォルト iDeCo+DC でイベント期間と重複月を詳細出力
 * npx tsx scripts/debug-default-ideco-dc-overlap.mjs
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
import {
  resolveIdecoPayoutStart,
  clampIdecoPayoutFields,
  calcPensionRetirementDeductionEnrollmentYears,
} from '../src/lib/idecoPayout.ts';
import {
  collectAllRetirementLumpEvents,
  calcEnrollmentOverlapMonths,
  previewPensionOnceTaxWithOverlap,
} from '../src/lib/retirementDeductionOverlap.ts';
import { resolveIdecoOncePayoutMan } from '../src/lib/savingsCashFlow.ts';

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

entries = entries.map((e) => clampIdecoPayoutFields(e, member));
const ideco = entries.find((e) => e.category === 'ideco');
const dc = entries.find((e) => e.category === 'dc');

const events = collectAllRetirementLumpEvents({
  familyMembers: [member],
  incomeByMember: { [member.id]: incomeEntries },
  savingsState: { byMember: { [member.id]: entries } },
  referenceDate,
});

console.log(
  'events',
  events.map((e) => ({
    kind: e.kind,
    year: e.calendarYear,
    years: e.enrollmentYears,
    period: `${e.periodStartAge}/${e.periodStartMonth}-${e.periodEndAge}/${e.periodEndMonth}`,
  })),
);

const idecoEv = events.find((e) => e.kind === 'ideco');
const dcEv = events.find((e) => e.kind === 'dc');
if (idecoEv && dcEv) {
  const months = calcEnrollmentOverlapMonths(
    {
      startAge: idecoEv.periodStartAge,
      startMonth: idecoEv.periodStartMonth,
      endAge: idecoEv.periodEndAge,
      endMonth: idecoEv.periodEndMonth,
    },
    {
      startAge: dcEv.periodStartAge,
      startMonth: dcEv.periodStartMonth,
      endAge: dcEv.periodEndAge,
      endMonth: dcEv.periodEndMonth,
    },
  );
  const dcMonths =
    dcEv.periodEndAge * 12 +
    dcEv.periodEndMonth -
    (dcEv.periodStartAge * 12 + dcEv.periodStartMonth) +
    1;
  console.log({
    overlapMonths: months,
    dcMonths,
    fullCover: months >= dcMonths,
    floorOverlapY: Math.floor(months / 12),
    dcEnrollment: dcEv.enrollmentYears,
  });
}

// UI が payout month を誕生日月で持っているケース
const idecoBirthPayout = {
  ...ideco,
  withdrawalStartAge: 60,
  withdrawalStartMonth: member.birthMonth || 1,
};
const entries2 = [idecoBirthPayout, dc];
const dcPayout = resolveIdecoPayoutStart(dc, member, {
  age: dc.withdrawalStartAge,
  month: dc.withdrawalStartMonth,
});
const man = resolveIdecoOncePayoutMan(dc, member, entries2, referenceDate);
const preview = previewPensionOnceTaxWithOverlap({
  entry: dc,
  member,
  incomeEntries,
  memberEntries: entries2,
  referenceDate,
  revenueMan: man,
  payoutStart: dcPayout,
});
console.log('if iDeCo payout month = birthMonth', {
  idecoPayoutMonth: idecoBirthPayout.withdrawalStartMonth,
  preview: {
    fullMan: preview.fullDeductionYen / 10000,
    dedMan: preview.breakdown.deductionYen / 10000,
    overlap: preview.overlapYears,
  },
});

const previewNormal = previewPensionOnceTaxWithOverlap({
  entry: dc,
  member,
  incomeEntries,
  memberEntries: entries,
  referenceDate,
  revenueMan: resolveIdecoOncePayoutMan(dc, member, entries, referenceDate),
  payoutStart: dcPayout,
});
console.log('normal clamped', {
  idecoPayout: `${ideco.withdrawalStartAge}/${ideco.withdrawalStartMonth}`,
  dcPayout: `${dc.withdrawalStartAge}/${dc.withdrawalStartMonth}`,
  preview: {
    fullMan: previewNormal.fullDeductionYen / 10000,
    dedMan: previewNormal.breakdown.deductionYen / 10000,
    overlap: previewNormal.overlapYears,
  },
});
