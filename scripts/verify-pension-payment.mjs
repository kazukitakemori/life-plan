/**
 * 蟷ｴ驥第髪邨ｦ繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ縺ｮ邁｡譏捺､懆ｨｼ・・ode scripts/verify-pension-payment.mjs・・
 */
import { calcPensionPaymentFromEntitlements } from '../src/lib/pensionPaymentSchedule.ts';
import {
  createEmptyPensionBreakdown,
  sumPensionBreakdown,
} from '../src/types/cashFlow.ts';

function entitlementWithMonthlyMan(monthlyMan) {
  const b = createEmptyPensionBreakdown();
  b.oldAge.basic.basic = monthlyMan;
  return b;
}

function paidMonthsInYear(entitlements) {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    const payment = calcPensionPaymentFromEntitlements(
      month,
      entitlements[month - 1] ?? createEmptyPensionBreakdown(),
      entitlements[month - 2] ?? createEmptyPensionBreakdown(),
    );
    total += sumPensionBreakdown(payment);
  }
  return total;
}

// 3譛医°繧牙女邨ｦ髢句ｧ具ｼ郁ｪ慕函譛・譛医・65豁ｳ・俄・ 3縲・2譛医′雉・ｼ10縺区怦
const entitlements = Array.from({ length: 13 }, () =>
  createEmptyPensionBreakdown(),
);
for (let month = 3; month <= 12; month++) {
  entitlements[month] = entitlementWithMonthlyMan(1);
}

const received = paidMonthsInYear(entitlements);
console.assert(
  received === 9,
  `蜿礼ｵｦ髢句ｧ句ｹｴ縺ｮ蜈･驥代・9縺区怦蛻・ ${received}`,
);

// 騾壼ｹｴ蜿礼ｵｦ・亥燕蟷ｴ12譛亥・繧りｳ・ｼ縺ゅｊ・峨↑繧・2縺区怦蛻・・蜈･驥・
const fullYear = Array.from({ length: 13 }, (_, month) =>
  month >= 1 ? entitlementWithMonthlyMan(1) : createEmptyPensionBreakdown(),
);
fullYear[0] = entitlementWithMonthlyMan(1);
let failed = false;
if (received !== 9) {
  console.error(`蜿礼ｵｦ髢句ｧ句ｹｴ縺ｮ蜈･驥代・9縺区怦蛻・ ${received}`);
  failed = true;
}
if (paidMonthsInYear(fullYear) !== 12) {
  console.error(`騾壼ｹｴ蜿礼ｵｦ縺ｯ12縺区怦蛻・ ${paidMonthsInYear(fullYear)}`);
  failed = true;
}
if (failed) process.exit(1);

console.log('verify-pension-payment: all checks passed');
