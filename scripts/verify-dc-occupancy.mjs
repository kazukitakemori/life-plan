/**
 * 企業型DC 加入区分（iDeCo同型）
 * npx tsx scripts/verify-dc-occupancy.mjs
 */
import {
  applyDcOccupancySelection,
  clampDcContributionPeriod,
  listDcOccupancyOptionsFromIncome,
  resolveContinuousDcOccupancySegmentEnd,
  resolveDcContributionEndCap,
  resolveDcContributionPeriodForOccupancy,
  resolveEffectiveDcOccupancy,
} from '../src/lib/dcContribution.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';

const referenceDate = new Date(2026, 5, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 4 };

const employee = createIncomeEntry(member.id, 'employee', 40, 6, member);
employee.periods = [
  {
    ...employee.periods[0],
    startAge: 40,
    startMonth: 7,
    endAge: 45,
    endMonth: 3,
  },
];
const self = createIncomeEntry(member.id, 'self_employed', 40, 6, member);
self.periods = [
  {
    ...self.periods[0],
    startAge: 45,
    startMonth: 4,
    endAge: 50,
    endMonth: 3,
  },
];
const part = createIncomeEntry(member.id, 'part_time', 40, 6, member);
part.periods = [
  {
    ...part.periods[0],
    startAge: 50,
    startMonth: 4,
    endAge: 60,
    endMonth: 3,
  },
];
const incomes = [employee, self, part];

const options = listDcOccupancyOptionsFromIncome(incomes);
assert(options.includes('employee'), 'options employee');
assert(options.includes('part_time'), 'options part_time');
assertEq(options.length, 2, 'options length');
console.log('OK occupancy options');

const employeePeriod = resolveDcContributionPeriodForOccupancy(
  'employee',
  member,
  incomes,
  referenceDate,
);
assertEq(employeePeriod.startAge, 40, 'employee startAge');
assertEq(employeePeriod.startMonth, 7, 'employee startMonth');
assertEq(employeePeriod.endAge, 45, 'employee endAge');
assertEq(employeePeriod.endMonth, 3, 'employee endMonth');

const partPeriod = resolveDcContributionPeriodForOccupancy(
  'part_time',
  member,
  incomes,
  referenceDate,
);
assertEq(partPeriod.startAge, 50, 'part startAge');
assertEq(partPeriod.endAge, 60, 'part endAge');
console.log('OK period for occupancy');

let dc = createSavingsEntry('dc', member, referenceDate, {
  employerContributionMode: 'monthly',
  employerContributionMan: 2,
  employeeContributionMode: 'monthly',
  employeeContributionMan: 1,
});
dc = applyDcOccupancySelection(dc, 'employee', member, incomes, referenceDate);
assertEq(dc.dcOccupancy, 'employee', 'applied occupancy');
assertEq(dc.endAge, 45, 'applied endAge');
assertEq(dc.endMonth, 3, 'applied endMonth');

dc = applyDcOccupancySelection(dc, 'part_time', member, incomes, referenceDate);
assertEq(dc.dcOccupancy, 'part_time', 'switched occupancy');
assertEq(dc.startAge, 50, 'switched startAge');
assertEq(dc.endAge, 60, 'switched endAge');
console.log('OK apply occupancy selection');

const effective = resolveEffectiveDcOccupancy(
  dc,
  member,
  incomes,
  referenceDate,
);
assertEq(effective, 'part_time', 'effective');

const cont = resolveContinuousDcOccupancySegmentEnd(
  member,
  incomes,
  referenceDate,
  50,
  4,
);
assertEq(cont.endAge, 60, 'continuous part');
assertEq(cont.endMonth, 3, 'continuous part month');

const cap = resolveDcContributionEndCap(member, {
  incomeEntries: incomes,
  referenceDate,
  startAge: 50,
  startMonth: 4,
  occupancy: 'part_time',
});
assertEq(cap.endAge, 60, 'end cap');
console.log('OK continuous / end cap');

const clamped = clampDcContributionPeriod(
  {
    ...dc,
    endAge: 70,
    endMonth: 12,
  },
  member,
  incomes,
  referenceDate,
);
assertEq(clamped.endAge, 60, 'clamp to occupancy end');
assertEq(clamped.dcOccupancy, 'part_time', 'clamp keeps occupancy');
console.log('OK clamp');

console.log('All DC occupancy checks passed');
