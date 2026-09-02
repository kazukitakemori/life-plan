import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { calcHouseholdTaxSocialMan } from '../src/lib/taxCalculator.ts';
import { calcDependentDeductionsForChildAge } from '../src/lib/taxCalculator.ts';

const referenceDate = new Date(2026, 5, 1);
const family = createDefaultFamily();
const head = family.find((m) => m.role === 'head');

const incomeByMember = {
  [head.id]: createDefaultHeadIncome(head, referenceDate.getMonth() + 1),
};

const withIncome = calcHouseholdTaxSocialMan({
  familyMembers: family,
  incomeByMember,
  referenceDate,
  calendarYear: 2026,
});

const noIncome = calcHouseholdTaxSocialMan({
  familyMembers: family,
  incomeByMember: {},
  referenceDate,
  calendarYear: 2026,
});

const child16 = calcDependentDeductionsForChildAge(16);
const child10 = calcDependentDeductionsForChildAge(10);

console.log('with head income:', withIncome);
console.log('no income blocks:', noIncome);
console.log('child age 16 deduction:', child16);
console.log('child age 10 deduction:', child10);

if (withIncome.totalMan <= 0) {
  throw new Error('Expected positive tax/social with head income');
}
if (noIncome.totalMan !== 0) {
  throw new Error('Expected zero tax/social without income blocks');
}
if (child16.incomeTaxYen !== 380_000) {
  throw new Error('Unexpected child deduction at age 16');
}
if (child10.incomeTaxYen !== 0) {
  throw new Error('Expected no child deduction at age 10');
}

console.log('verify-tax: ok');
