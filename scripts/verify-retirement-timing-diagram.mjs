/**
 * ?????????????????????
 * npx tsx scripts/verify-retirement-timing-diagram.mjs
 */
import { buildLiveRetirementTimingScenario } from '../src/lib/retirementTimingDiagram.ts';
import {
  retirementDeductionOverlapRuleLabel,
  resolveRetirementDeductionLookbackYears,
} from '../src/lib/retirementDeductionOverlap.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(got, expected, msg) {
  if (got !== expected) throw new Error(`${msg}: expected ${expected}, got ${got}`);
}

const referenceDate = new Date(2026, 0, 1);
const member = {
  id: 'm1',
  name: 'head',
  role: 'head',
  age: 40,
  birthMonth: 4,
  expectedLifespan: 90,
};

const incomeEntries = [
  {
    id: 'inc1',
    category: 'employee',
    periods: [],
    retirementAllowances: [
      {
        id: 'ra1',
        amountMan: 1500,
        receiveAge: 60,
        receiveMonth: 3,
        enrollmentMode: 'years',
        enrollmentYears: 30,
        enrollmentStartAge: 30,
        enrollmentStartMonth: 4,
        enrollmentEndAge: 60,
        enrollmentEndMonth: 3,
      },
    ],
  },
];

const baseIdeco = {
  id: 'ideco1',
  category: 'ideco',
  startAge: 40,
  startMonth: 4,
  endMode: 'until',
  endAge: 60,
  endMonth: 3,
  contributionMode: 'monthly',
  monthlyMan: 2,
  withdrawalMode: 'once',
  withdrawalStartAge: 62,
  withdrawalStartMonth: 4,
  withdrawalMan: 500,
  balanceMan: 100,
  ratePercent: 3,
};

const baseDc = {
  id: 'dc1',
  category: 'dc',
  startAge: 40,
  startMonth: 4,
  endMode: 'until',
  endAge: 60,
  endMonth: 3,
  contributionMode: 'monthly',
  monthlyMan: 3,
  withdrawalMode: 'once',
  withdrawalStartAge: 60,
  withdrawalStartMonth: 4,
  withdrawalMan: 800,
  balanceMan: 200,
  ratePercent: 3,
};

const baseDb = {
  id: 'db1',
  category: 'db',
  startAge: 30,
  startMonth: 4,
  endMode: 'until',
  endAge: 60,
  endMonth: 3,
  contributionMode: 'none',
  monthlyMan: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: 65,
  withdrawalStartMonth: 4,
  withdrawalMan: 1200,
  balanceMan: 0,
  ratePercent: 0,
  dbEnrollmentMode: 'period',
  dbEnrollmentYears: 35,
  dbEnrollmentStartAge: 30,
  dbEnrollmentStartMonth: 4,
  dbEnrollmentEndAge: 65,
  dbEnrollmentEndMonth: 4,
};

const scenario = buildLiveRetirementTimingScenario({
  member,
  incomeEntries,
  memberEntries: [baseIdeco],
  referenceDate,
});

assert(scenario, 'live scenario should build');
assert(scenario.isLive === true, 'isLive');
assert(scenario.id === 'nineteenYear', `expected nineteenYear, got ${scenario.id}`);
assert(String(scenario.subtitle).includes('iDeCo'), scenario.subtitle);
assert(scenario.gap, 'gap required');
assert(Array.isArray(scenario.gaps) && scenario.gaps.length >= 1, 'gaps[]');
assert(
  Array.isArray(scenario.axisBreakPcts) && scenario.axisBreakPcts.length >= 1,
  'pre-receipt equal spacing should show axis breaks',
);
assert(
  scenario.gap.endPct - scenario.gap.startPct >= 20,
  `receipt gap should be spacious, got ${scenario.gap.endPct - scenario.gap.startPct}`,
);

const sameYear = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [
    {
      ...incomeEntries[0],
      retirementAllowances: [
        {
          ...incomeEntries[0].retirementAllowances[0],
          receiveAge: 62,
          receiveMonth: 4,
          enrollmentEndAge: 62,
          enrollmentEndMonth: 4,
        },
      ],
    },
  ],
  memberEntries: [
    {
      ...baseIdeco,
      withdrawalStartAge: 62,
      withdrawalStartMonth: 4,
    },
  ],
  referenceDate,
});
assert(sameYear, 'sameYear scenario');
assert(sameYear.id === 'sameYear', `expected sameYear, got ${sameYear.id}`);
assert(sameYear.gap === null, 'same year has no gap');
assertEq(sameYear.gaps.length, 0, 'same year gaps empty');

const tenYear = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [
    {
      ...incomeEntries[0],
      retirementAllowances: [
        {
          ...incomeEntries[0].retirementAllowances[0],
          receiveAge: 65,
          receiveMonth: 3,
          enrollmentEndAge: 65,
        },
      ],
    },
  ],
  memberEntries: [
    {
      ...baseIdeco,
      withdrawalStartAge: 60,
      withdrawalStartMonth: 4,
    },
  ],
  referenceDate,
});
assert(tenYear, 'tenYear scenario');
assert(tenYear.id === 'tenYear', tenYear.id);

const solo = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [baseIdeco],
  referenceDate,
});
assert(solo, 'solo ideco scenario');
assert(solo.id === 'solo', `expected solo, got ${solo.id}`);
assert(solo.receipts.length === 1, 'solo has one receipt');
assert(String(solo.title).includes('iDeCo'), solo.title);

const idecoDc = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [
    baseIdeco,
    {
      ...baseDc,
      withdrawalStartAge: 65,
      withdrawalStartMonth: 4,
    },
  ],
  referenceDate,
});
assert(idecoDc, 'ideco+dc scenario');
assert(idecoDc.id === 'nineteenYear', `expected nineteenYear, got ${idecoDc.id}`);
assert(String(idecoDc.subtitle).includes('DC'), `subtitle=${idecoDc.subtitle}`);
assert(
  String(retirementDeductionOverlapRuleLabel('ideco', 'dc') ?? '').includes('19'),
  'dc-dc label should be 19y',
);
assertEq(resolveRetirementDeductionLookbackYears('ideco', 'dc'), 19, 'dc-dc lb');

const chain = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [
    {
      ...baseIdeco,
      withdrawalStartAge: 60,
      withdrawalStartMonth: 4,
      balanceMan: 300,
    },
    {
      ...baseDc,
      withdrawalStartAge: 62,
      withdrawalStartMonth: 4,
      balanceMan: 400,
    },
    {
      ...baseDb,
      withdrawalStartAge: 65,
      withdrawalStartMonth: 4,
      withdrawalMan: 1500,
    },
  ],
  referenceDate,
});
assert(chain, 'chain scenario');
assert(chain.receipts.length === 3, `expected 3 receipts, got ${chain.receipts.length}`);
assert(chain.gaps.length === 2, `expected 2 gaps, got ${chain.gaps.length}`);
assert(
  chain.id === 'chain' || chain.id === 'tenYear' || chain.id === 'nineteenYear',
  `chain id ${chain.id}`,
);
assert(
  chain.gaps.some((g) => /10|19/.test(String(g.label))),
  `gaps should annotate rules: ${JSON.stringify(chain.gaps)}`,
);

// Same receive age must not duplicate age ticks on the axis
const allAt60 = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [
    { ...baseIdeco, withdrawalStartAge: 60, withdrawalStartMonth: 1, balanceMan: 300 },
    { ...baseDc, withdrawalStartAge: 60, withdrawalStartMonth: 6, balanceMan: 400 },
    { ...baseDb, withdrawalStartAge: 60, withdrawalStartMonth: 12, withdrawalMan: 1500 },
  ],
  referenceDate,
});
assert(allAt60, 'all-at-60 scenario');
assert(allAt60.id === 'sameYear', `expected sameYear, got ${allAt60.id}`);
const ages60 = allAt60.milestones.map((m) => m.age);
assertEq(new Set(ages60).size, ages60.length, 'milestone ages must be unique');
assertEq(
  ages60.filter((a) => a === 60).length,
  1,
  'age 60 tick appears once',
);

const empty = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [],
  referenceDate,
});
assert(empty === null, 'no lump events -> null');

// ????????????????????????
const withPast = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [
    {
      ...baseIdeco,
      startAge: 40,
      startMonth: 2,
      pastContributionEnabled: true,
      pastStartAge: 30,
      pastStartMonth: 4,
      pastEndAge: 40,
      pastEndMonth: 1,
      balanceMan: 200,
    },
  ],
  referenceDate,
});
assert(withPast, 'past contribution scenario');
assert(
  withPast.milestones.some((m) => m.age === 30),
  `past start age 30 should appear on axis: ${JSON.stringify(withPast.milestones.map((m) => m.age))}`,
);
assert(
  /\b30\u5e74\b/.test(withPast.periods[0].label) ||
    withPast.periods[0].label.includes('30'),
  `period years should reflect past join: ${withPast.periods[0].label}`,
);
const withoutPast = buildLiveRetirementTimingScenario({
  member,
  incomeEntries: [],
  memberEntries: [
    {
      ...baseIdeco,
      startAge: 40,
      startMonth: 2,
      pastContributionEnabled: false,
      balanceMan: 0,
    },
  ],
  referenceDate,
});
assert(withoutPast, 'no-past scenario');
assert(
  !withoutPast.milestones.some((m) => m.age === 30),
  'without past, age 30 should not be a period start tick',
);

console.log('verify-retirement-timing-diagram: ok');
