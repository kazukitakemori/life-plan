/**
 * 企業型DCの積立期間クランプ検証（制度上限 + 加入区分連動）
 * npx tsx scripts/verify-dc-contribution-period.mjs
 */
import {
  clampDcContributionPeriod,
  CORPORATE_DC_CONTRIBUTION_MAX_AGE,
  ensureDcContributionFields,
  isCorporateDcEligibleIncomeCategory,
  resolveContinuousCorporateDcEmploymentSegmentEnd,
  resolveDcContributionEndCap,
  resolveDcStatutoryContributionEndCap,
} from '../src/lib/dcContribution.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';

const referenceDate = new Date(2026, 5, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 4 };

assert(
  isCorporateDcEligibleIncomeCategory('employee') === true,
  'employee eligible',
);
assert(
  isCorporateDcEligibleIncomeCategory('part_time') === true,
  'part_time eligible',
);
assert(
  isCorporateDcEligibleIncomeCategory('civil_servant') === false,
  'civil_servant not eligible',
);
assert(
  isCorporateDcEligibleIncomeCategory('self_employed') === false,
  'self_employed not eligible',
);
console.log('OK eligibility');

const statutory = resolveDcStatutoryContributionEndCap(member);
assert(
  statutory.endAge === CORPORATE_DC_CONTRIBUTION_MAX_AGE,
  `statutory endAge: got ${statutory.endAge}`,
);
assert(statutory.endMonth === 4, `statutory endMonth: got ${statutory.endMonth}`);
console.log('OK statutory cap');

const created = createSavingsEntry('dc', member, referenceDate, {
  contributionMode: 'monthly',
  contributionMan: 1,
});
assert(created.endMode === 'until', 'new DC must be until');
assert(
  created.endAge <= CORPORATE_DC_CONTRIBUTION_MAX_AGE,
  `new DC endAge ${created.endAge} exceeds max`,
);
console.log('OK createSavingsEntry');

const lifetime = clampDcContributionPeriod(
  {
    ...created,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
  },
  member,
);
assert(lifetime.endMode === 'until', 'lifetime → until');
assert(lifetime.endAge === 70, `lifetime endAge: got ${lifetime.endAge}`);
assert(lifetime.endMonth === 4, `lifetime endMonth: got ${lifetime.endMonth}`);
console.log('OK lifetime clamp');

const overAge = clampDcContributionPeriod(
  {
    ...created,
    endMode: 'until',
    endAge: 75,
    endMonth: 12,
  },
  member,
);
assert(overAge.endAge === 70, `overAge endAge: got ${overAge.endAge}`);
assert(overAge.endMonth === 4, `overAge endMonth: got ${overAge.endMonth}`);
console.log('OK over-age clamp');

const ensureNoMember = ensureDcContributionFields({
  ...created,
  endMode: 'lifetime',
  endAge: 99,
  endMonth: 12,
});
assert(ensureNoMember.endMode === 'until', 'ensure without member: until');
assert(
  ensureNoMember.endAge === CORPORATE_DC_CONTRIBUTION_MAX_AGE,
  `ensure without member endAge: got ${ensureNoMember.endAge}`,
);
console.log('OK ensure without member');

const ensureWithMember = ensureDcContributionFields(
  {
    ...created,
    endMode: 'until',
    endAge: 80,
    endMonth: 12,
    startAge: 75,
    startMonth: 1,
  },
  member,
);
assert(ensureWithMember.endAge === 70, 'ensure with member endAge');
assert(ensureWithMember.endMonth === 4, 'ensure with member endMonth');
assert(
  ensureWithMember.startAge === 70 && ensureWithMember.startMonth === 4,
  `start after end should snap: ${ensureWithMember.startAge}/${ensureWithMember.startMonth}`,
);
console.log('OK ensure with member');

// --- 収入連動（加入区分なし＝開始月の区分で連続） ---
const careerHead = { ...member, age: 40, birthMonth: 4 };
const employeeEntry = createIncomeEntry(
  careerHead.id,
  'employee',
  40,
  1,
  careerHead,
);
employeeEntry.periods = [
  {
    ...employeeEntry.periods[0],
    startAge: 40,
    startMonth: 1,
    endAge: 50,
    endMonth: 12,
  },
];
const selfEntry = createIncomeEntry(
  careerHead.id,
  'self_employed',
  40,
  1,
  careerHead,
);
selfEntry.periods = [
  {
    ...selfEntry.periods[0],
    startAge: 51,
    startMonth: 1,
    endAge: 65,
    endMonth: 12,
  },
];
const careerIncomes = [employeeEntry, selfEntry];

const segEmployee = resolveContinuousCorporateDcEmploymentSegmentEnd(
  careerHead,
  careerIncomes,
  referenceDate,
  40,
  1,
);
assert(
  segEmployee.endAge === 50 && segEmployee.endMonth === 12,
  `employee segment ends 50/12 got ${segEmployee.endAge}/${segEmployee.endMonth}`,
);

const capEmployee = resolveDcContributionEndCap(careerHead, {
  incomeEntries: careerIncomes,
  referenceDate,
  startAge: 40,
  startMonth: 1,
  occupancy: 'employee',
});
assert(
  capEmployee.endAge === 50 && capEmployee.endMonth === 12,
  `cap = segment end got ${capEmployee.endAge}/${capEmployee.endMonth}`,
);

const clampedCareer = clampDcContributionPeriod(
  {
    ...created,
    dcOccupancy: 'employee',
    startAge: 40,
    startMonth: 1,
    endMode: 'until',
    endAge: 65,
    endMonth: 12,
  },
  careerHead,
  careerIncomes,
  referenceDate,
);
assert(
  clampedCareer.endAge === 50 && clampedCareer.endMonth === 12,
  `clamp to career end got ${clampedCareer.endAge}/${clampedCareer.endMonth}`,
);
console.log('OK income segment employee→self_employed');

// 収入なし → 制度上限
const capNoIncome = resolveDcContributionEndCap(careerHead, {
  incomeEntries: [],
  referenceDate,
  startAge: 40,
  startMonth: 1,
});
assert(
  capNoIncome.endAge === 70 && capNoIncome.endMonth === 4,
  `no income → statutory got ${capNoIncome.endAge}/${capNoIncome.endMonth}`,
);
console.log('OK no income → statutory');

// パートも対象・公務員は対象外
const partEntry = createIncomeEntry(
  careerHead.id,
  'part_time',
  40,
  1,
  careerHead,
);
partEntry.periods = [
  {
    ...partEntry.periods[0],
    startAge: 40,
    startMonth: 1,
    endAge: 55,
    endMonth: 6,
  },
];
const segPart = resolveContinuousCorporateDcEmploymentSegmentEnd(
  careerHead,
  [partEntry],
  referenceDate,
  40,
  1,
);
assert(
  segPart.endAge === 55 && segPart.endMonth === 6,
  `part_time segment ends 55/6 got ${segPart.endAge}/${segPart.endMonth}`,
);

const civilEntry = createIncomeEntry(
  careerHead.id,
  'civil_servant',
  40,
  1,
  careerHead,
);
civilEntry.periods = [
  {
    ...civilEntry.periods[0],
    startAge: 40,
    startMonth: 1,
    endAge: 60,
    endMonth: 3,
  },
];
const segCivil = resolveContinuousCorporateDcEmploymentSegmentEnd(
  careerHead,
  [civilEntry],
  referenceDate,
  40,
  1,
);
assert(
  segCivil.endAge === 70 && segCivil.endMonth === 4,
  `civil_servant at start → statutory got ${segCivil.endAge}/${segCivil.endMonth}`,
);
console.log('OK part_time / civil_servant');

// employee → part_time は「対象就労」連続としては続くが、加入区分 employee では切れる
const empThenPart = createIncomeEntry(
  careerHead.id,
  'employee',
  40,
  1,
  careerHead,
);
empThenPart.periods = [
  {
    ...empThenPart.periods[0],
    startAge: 40,
    startMonth: 1,
    endAge: 45,
    endMonth: 12,
  },
];
const partAfter = createIncomeEntry(
  careerHead.id,
  'part_time',
  40,
  1,
  careerHead,
);
partAfter.periods = [
  {
    ...partAfter.periods[0],
    startAge: 46,
    startMonth: 1,
    endAge: 52,
    endMonth: 3,
  },
];
const segEmpPart = resolveContinuousCorporateDcEmploymentSegmentEnd(
  careerHead,
  [empThenPart, partAfter],
  referenceDate,
  40,
  1,
);
assert(
  segEmpPart.endAge === 52 && segEmpPart.endMonth === 3,
  `employee→part_time continuous (any eligible) got ${segEmpPart.endAge}/${segEmpPart.endMonth}`,
);

const capEmployeeOnly = resolveDcContributionEndCap(careerHead, {
  incomeEntries: [empThenPart, partAfter],
  referenceDate,
  startAge: 40,
  startMonth: 1,
  occupancy: 'employee',
});
assert(
  capEmployeeOnly.endAge === 45 && capEmployeeOnly.endMonth === 12,
  `employee occupancy stops before part_time got ${capEmployeeOnly.endAge}/${capEmployeeOnly.endMonth}`,
);
console.log('OK employee→part_time occupancy boundary');

console.log('All DC contribution period checks passed.');
