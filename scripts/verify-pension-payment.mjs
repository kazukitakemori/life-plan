/**
 * 年金支給スケジュールの簡易検証（node scripts/verify-pension-payment.mjs）
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

// 3月から受給開始（誕生月3月・65歳）→ 3〜12月が資格10か月
const entitlements = Array.from({ length: 13 }, () =>
  createEmptyPensionBreakdown(),
);
for (let month = 3; month <= 12; month++) {
  entitlements[month] = entitlementWithMonthlyMan(1);
}

const received = paidMonthsInYear(entitlements);
console.assert(
  received === 9,
  `受給開始年の入金は9か月分: ${received}`,
);

// 通年受給（前年12月分も資格あり）なら12か月分の入金
const fullYear = Array.from({ length: 13 }, (_, month) =>
  month >= 1 ? entitlementWithMonthlyMan(1) : createEmptyPensionBreakdown(),
);
fullYear[0] = entitlementWithMonthlyMan(1);
let failed = false;
if (received !== 9) {
  console.error(`受給開始年の入金は9か月分: ${received}`);
  failed = true;
}
if (paidMonthsInYear(fullYear) !== 12) {
  console.error(`通年受給は12か月分: ${paidMonthsInYear(fullYear)}`);
  failed = true;
}
if (failed) process.exit(1);

console.log('verify-pension-payment: all checks passed');
