/**
 * DB 加入期間（年数／期間）→ 退職所得控除の加入年数
 * npx tsx scripts/verify-db-enrollment.mjs
 */
import {
  createDefaultDbEnrollmentFields,
  ensureDbEnrollmentFields,
  resolveDbEnrollmentMode,
  resolveDbEnrollmentPeriod,
  resolveDbEnrollmentYears,
} from '../src/lib/dbEnrollment.ts';
import { calcPensionRetirementDeductionEnrollmentYears } from '../src/lib/idecoPayout.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';

const referenceDate = new Date(2026, 5, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 45, birthMonth: 4 };

const created = createSavingsEntry('db', member, referenceDate);
assert(created.dbEnrollmentMode === 'years', 'default mode years');
assertEq(created.dbEnrollmentYears, 30, 'default years');
assert(
  created.dbEnrollmentStartAge != null && created.dbEnrollmentEndAge != null,
  'period fields filled',
);
console.log('OK createDefaults');

const yearsEntry = ensureDbEnrollmentFields(
  {
    ...created,
    dbEnrollmentMode: 'years',
    dbEnrollmentYears: 22,
  },
  member,
);
assertEq(resolveDbEnrollmentYears(yearsEntry), 22, 'years mode');
assertEq(
  calcPensionRetirementDeductionEnrollmentYears(yearsEntry, member, {
    age: 60,
    month: 4,
  }),
  22,
  'deduction uses years input (not start→payout approx)',
);
console.log('OK years mode');

const periodEntry = ensureDbEnrollmentFields(
  {
    ...created,
    dbEnrollmentMode: 'period',
    dbEnrollmentStartAge: 30,
    dbEnrollmentStartMonth: 4,
    dbEnrollmentEndAge: 55,
    dbEnrollmentEndMonth: 3,
  },
  member,
);
assert(resolveDbEnrollmentMode(periodEntry.dbEnrollmentMode) === 'period');
assertEq(resolveDbEnrollmentYears(periodEntry), 25, '30歳〜55歳 → 25年');
assertEq(
  calcPensionRetirementDeductionEnrollmentYears(periodEntry, member, {
    age: 60,
    month: 4,
  }),
  25,
  'deduction uses age span',
);

const periodBounds = resolveDbEnrollmentPeriod(periodEntry, {
  age: 60,
  month: 4,
});
assertEq(periodBounds.startAge, 30, 'period start');
assertEq(periodBounds.endAge, 55, 'period end');
assertEq(periodBounds.startMonth, 4, 'start month kept');
assertEq(periodBounds.endMonth, 3, 'end month kept');
console.log('OK period mode (age+month)');

// 年数モードの図用期間は受給開始から逆算
const yearsPeriod = resolveDbEnrollmentPeriod(yearsEntry, {
  age: 60,
  month: 4,
});
assertEq(yearsPeriod.endAge, 60, 'years reverse end');
assertEq(yearsPeriod.startAge, 60 - 22, 'years reverse start');
console.log('OK reverse period from years');

const defaults = createDefaultDbEnrollmentFields(member, 60, 1);
assertEq(defaults.dbEnrollmentYears, 30, 'factory years');
console.log('OK factory');

console.log('verify-db-enrollment: ok');
