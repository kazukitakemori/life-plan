/**
 * Q6 車検: 1台ずつ登録した買い替えで初回年数が分かれること
 * npx tsx scripts/verify-vehicle-inspection-replacement.mjs
 */
import assert from 'node:assert/strict';
import { duplicateVehicleEntry } from '../src/lib/vehicleDuplicate.ts';
import { isVehicleInspectionDueMonth } from '../src/lib/vehicleInspection.ts';
import { getInspectionValidityYearsForCondition } from '../src/lib/vehicleInspection.ts';

const birthYear = 1986;
const birthMonth = 6;
const member = {
  id: 'm1',
  name: '本人',
  role: 'head',
  age: 40,
  birthMonth: 6,
  expectedLifespan: 90,
};

function car(overrides = {}) {
  return {
    id: 'v1',
    label: '自動車',
    type: 'car',
    kind: 'new',
    condition: 'new',
    paymentMode: 'purchaseAmount',
    monthlyRepaymentMan: 0,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    startAge: 40,
    startMonth: 6,
    endMode: 'until',
    endAge: 90,
    endMonth: 12,
    purchaseAmountMan: 250,
    monthlyCostMan: 0,
    gasolineCostMan: 2,
    parkingCostMan: 1,
    annualCostMan: 5,
    annualCostCycleYears: 1,
    inspectionCostMan: 10,
    insurances: [],
    ...overrides,
  };
}

function calendarToAgeMonth(year, month) {
  let age = year - birthYear;
  if (month < birthMonth) {
    age -= 1;
  }
  return { age, month };
}

function ageMonthIndex(age, month) {
  return age * 12 + month;
}

function isWithinEntryPeriod(entry, year, month) {
  const { age, month: ageMonth } = calendarToAgeMonth(year, month);
  const currentIdx = ageMonthIndex(age, ageMonth);
  const startIdx = ageMonthIndex(entry.startAge, entry.startMonth);
  if (currentIdx < startIdx) return false;

  const endIdx =
    entry.endMode === 'lifetime'
      ? ageMonthIndex(member.expectedLifespan, 12)
      : ageMonthIndex(entry.endAge, entry.endMonth);
  return currentIdx <= endIdx;
}

function collectDue(entry, fromYear, toYear) {
  const due = [];
  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      if (!isWithinEntryPeriod(entry, year, month)) continue;
      if (
        isVehicleInspectionDueMonth(
          entry,
          year,
          month,
          birthYear,
          birthMonth,
        )
      ) {
        due.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    }
  }
  return due;
}

assert.equal(
  getInspectionValidityYearsForCondition(
    { type: 'car', kind: 'new' },
    'new',
  ),
  3,
);
assert.equal(
  getInspectionValidityYearsForCondition(
    { type: 'car', kind: 'used' },
    'used',
  ),
  2,
);
assert.equal(
  getInspectionValidityYearsForCondition(
    { type: 'motorcycle', kind: 'over_250cc' },
    'new',
  ),
  2,
);

// 1. 新車・買い替えなし: 初回 3 年、以後 2 年
const noReplace = collectDue(
  car({ nextInspectionYear: 2029, nextInspectionMonth: 6 }),
  2026,
  2035,
);
assert.deepEqual(noReplace, [
  '2029-06',
  '2031-06',
  '2033-06',
  '2035-06',
]);
console.log('OK new car no replace', noReplace.join(', '));

// 2. 10 年後に新車で複製: 1 台目は 2035 まで、2 台目は 2039 から初回
const firstCar = car({
  nextInspectionYear: 2029,
  nextInspectionMonth: 6,
    endMode: 'until',
    endAge: 50,
    endMonth: 5,
});
const { source: truncatedFirst, duplicate: secondCarNew } = duplicateVehicleEntry(
  firstCar,
  member,
  new Date(2026, 5, 1),
  { condition: 'new' },
);
assert.equal(truncatedFirst.endMode, 'until');
assert.equal(truncatedFirst.endAge, 50);
assert.equal(truncatedFirst.endMonth, 5);
assert.equal(secondCarNew.startAge, 50);
assert.equal(secondCarNew.startMonth, 6);

const replaceNew = [
  ...collectDue(truncatedFirst, 2026, 2045),
  ...collectDue(secondCarNew, 2026, 2045),
];
assert.deepEqual(replaceNew, [
  '2029-06',
  '2031-06',
  '2033-06',
  '2035-06',
  '2039-06',
  '2041-06',
  '2043-06',
  '2045-06',
]);
assert.ok(!replaceNew.includes('2036-06'));
assert.ok(!replaceNew.includes('2037-06'));
console.log('OK duplicate with new', replaceNew.join(', '));

// 3. 既保有 → 10 年後に新車
const ownedFirst = car({
  kind: 'owned',
  condition: 'owned',
  nextInspectionYear: 2027,
  nextInspectionMonth: 6,
  endMode: 'until',
  endAge: 50,
  endMonth: 5,
});
const { source: truncatedOwned, duplicate: secondCarFromOwned } =
  duplicateVehicleEntry(ownedFirst, member, new Date(2026, 5, 1), {
    condition: 'new',
  });
const ownedToNew = [
  ...collectDue(truncatedOwned, 2026, 2041),
  ...collectDue(secondCarFromOwned, 2026, 2041),
];
assert.deepEqual(ownedToNew, [
  '2027-06',
  '2029-06',
  '2031-06',
  '2033-06',
  '2035-06',
  '2039-06',
  '2041-06',
]);
assert.ok(!ownedToNew.includes('2036-06'));
assert.ok(!ownedToNew.includes('2038-06'));
console.log('OK owned then duplicate new', ownedToNew.join(', '));

// 4. 既保有 → 10 年後に中古
const { duplicate: secondCarUsed } = duplicateVehicleEntry(
  ownedFirst,
  member,
  new Date(2026, 5, 1),
  { condition: 'used' },
);
const ownedToUsed = [
  ...collectDue(truncatedOwned, 2026, 2040),
  ...collectDue(secondCarUsed, 2026, 2040),
];
assert.deepEqual(ownedToUsed, [
  '2027-06',
  '2029-06',
  '2031-06',
  '2033-06',
  '2035-06',
  '2038-06',
  '2040-06',
]);
assert.ok(!ownedToUsed.includes('2036-06'));
assert.ok(!ownedToUsed.includes('2039-06'));
console.log('OK owned then duplicate used', ownedToUsed.join(', '));

console.log('OK vehicle inspection duplicate');
