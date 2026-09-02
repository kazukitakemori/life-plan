/**
 * 高額療養費の自己負担限度額
 * npx tsx scripts/verify-high-cost-medical.mjs
 */
import assert from 'node:assert/strict';
import {
  calcHighCostAnnualMedicalSelfPayYen,
  calcHighCostMonthlySelfPayYen,
  calcHighCostNormalCapYen,
  inferHighCostIncomeBracket,
} from '../src/lib/highCostMedicalExpenses.ts';

assert.equal(inferHighCostIncomeBracket(83), 'A');
assert.equal(inferHighCostIncomeBracket(53), 'B');
assert.equal(inferHighCostIncomeBracket(30), 'C');
assert.equal(inferHighCostIncomeBracket(26), 'D');
assert.equal(inferHighCostIncomeBracket(0), 'D');

const totalYen = 1_000_000;
assert.equal(calcHighCostNormalCapYen('C', totalYen), 92_940);
assert.equal(
  calcHighCostMonthlySelfPayYen({
    bracket: 'C',
    totalMedicalYen: totalYen,
    multipleTimesApplicable: true,
  }),
  44_400,
);

const annual = calcHighCostAnnualMedicalSelfPayYen({
  bracket: 'C',
  totalMedicalYenPerMonth: totalYen,
  hospitalMonths: 6,
});
assert.equal(annual.months.length, 6);
assert.equal(annual.months[0].multipleTimesApplicable, false);
assert.equal(annual.months[3].multipleTimesApplicable, true);
assert.equal(annual.months[0].selfPayYen, 92_940);
assert.equal(annual.months[3].selfPayYen, 44_400);
assert.equal(annual.totalSelfPayYen, 92_940 * 3 + 44_400 * 3);

console.log('verify-high-cost-medical: all passed');
