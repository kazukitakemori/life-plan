/**
 * 公的年金の偶数月支給スケジュールを検証する。
 * npx tsx scripts/verify-pension-payment.mjs
 */
import assert from 'node:assert/strict';
import { calcPensionPaymentFromEntitlements } from '../src/lib/pensionPaymentSchedule.ts';
import {
  createEmptyPensionBreakdown,
  sumPensionBreakdown,
} from '../src/types/cashFlow.ts';

function oldAgeEntitlement(monthlyMan) {
  const b = createEmptyPensionBreakdown();
  b.oldAge.basic.basic = monthlyMan;
  return b;
}

function survivorBasicEntitlement(monthlyMan) {
  const b = createEmptyPensionBreakdown();
  b.survivor.basic.basic = monthlyMan;
  return b;
}

function payment(month, oneMonthAgo, twoMonthsAgo) {
  return sumPensionBreakdown(
    calcPensionPaymentFromEntitlements(month, oneMonthAgo, twoMonthsAgo),
  );
}

// 奇数月は支給しない。
assert.equal(payment(3, oldAgeEntitlement(1), oldAgeEntitlement(1)), 0);

// 偶数月は直前2か月分を支給する。
assert.equal(payment(4, oldAgeEntitlement(1), oldAgeEntitlement(1)), 2);

// 受給権発生直後は、資格がある月だけを支給する。
assert.equal(payment(4, oldAgeEntitlement(1), createEmptyPensionBreakdown()), 1);

// 遺族基礎年金も老齢年金と同じ支給スケジュールへ載せる。
assert.equal(
  payment(4, survivorBasicEntitlement(1), survivorBasicEntitlement(1)),
  2,
);
assert.equal(
  payment(3, survivorBasicEntitlement(1), survivorBasicEntitlement(1)),
  0,
);

// 内訳が違っても合計額を壊さない。
const mixedOne = oldAgeEntitlement(1);
mixedOne.survivor.basic.basic = 2;
const mixedTwo = oldAgeEntitlement(3);
mixedTwo.survivor.basic.basic = 4;
assert.equal(payment(6, mixedOne, mixedTwo), 10);

console.log('verify-pension-payment: all checks passed');
