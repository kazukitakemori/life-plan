/**
 * 老齢年金の制度境界回帰テスト
 * npx tsx scripts/verify-pension-old-age.mjs
 */
import assert from 'node:assert/strict';
import {
  getEarlyClaimReductionPerMonthByBirth,
  getOldAgeAmountFactor,
} from '../src/lib/pensionOldAge.ts';
import {
  EARLY_CLAIM_REDUCTION_PER_MONTH,
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
} from '../src/lib/pensionConstants.ts';

assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, 1),
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, 2),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, null),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 3, 31),
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 5, 1),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);

assert.equal(
  getOldAgeAmountFactor(60, 0, EARLY_CLAIM_REDUCTION_PER_MONTH),
  0.76,
);
assert.equal(
  getOldAgeAmountFactor(60, 0, EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY),
  0.7,
);

console.log('verify-pension-old-age: all passed');
