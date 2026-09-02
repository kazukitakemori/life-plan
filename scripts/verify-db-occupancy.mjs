/**
 * DB 加入区分（第2号）と期間連動
 * npx tsx scripts/verify-db-occupancy.mjs
 */
import {
  applyDbOccupancySelection,
  resolveDbEnrollmentEndCap,
  resolveDbEnrollmentYears,
  resolveEffectiveDbOccupancy,
} from '../src/lib/dbEnrollment.ts';
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
    startAge: 30,
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

let db = createSavingsEntry('db', member, referenceDate);
db = applyDbOccupancySelection(
  db,
  'employee',
  member,
  [employee, part],
  referenceDate,
);
assertEq(db.dbOccupancy, 'employee', 'occupancy');
assertEq(db.dbEnrollmentMode, 'period', 'mode');
assertEq(db.dbEnrollmentStartAge, 30, 'startAge');
assertEq(db.dbEnrollmentEndAge, 50, 'endAge');
assertEq(db.dbEnrollmentEndMonth, 3, 'endMonth');
assert(resolveDbEnrollmentYears(db) >= 19, 'years ~20');
const empCap = resolveDbEnrollmentEndCap(
  db,
  member,
  [employee, part],
  referenceDate,
);
assertEq(empCap?.endAge, 50, 'end cap age for employee segment');
console.log('OK apply employee occupancy');

db = applyDbOccupancySelection(
  db,
  'part_time',
  member,
  [employee, part],
  referenceDate,
);
assertEq(db.dbOccupancy, 'part_time', 'part occupancy');
assertEq(db.dbEnrollmentStartAge, 50, 'part start');
assertEq(db.dbEnrollmentEndAge, 60, 'part end');
console.log('OK switch to part_time');

const effective = resolveEffectiveDbOccupancy(
  db,
  member,
  [employee, part],
  referenceDate,
);
assertEq(effective, 'part_time', 'effective');
console.log('All DB occupancy checks passed');
