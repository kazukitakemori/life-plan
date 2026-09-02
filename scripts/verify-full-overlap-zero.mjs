/**
 * 全期間重複なら退職所得控除は0（ceil/floor差で40万を残さない）
 * npx tsx scripts/verify-full-overlap-zero.mjs
 */
import { calcRetirementDeductionYenAfterOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { calcRetirementIncomeDeductionYen } from '../src/lib/retirementIncomeTax.ts';

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
}

// iDeCo 60 → DC 65、同じ20年拠出（19年1か月＝切り上げ20年）が完全重複
const period = {
  periodStartAge: 40,
  periodStartMonth: 4,
  periodEndAge: 59,
  periodEndMonth: 4,
};
const adj = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2031,
    kind: 'dc',
    revenueMan: 1000,
    enrollmentYears: 20,
    ...period,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 1000,
      enrollmentYears: 20,
      ...period,
    },
  ],
});

assertEq(adj.fullDeductionYen, calcRetirementIncomeDeductionYen(20), 'full 800万');
assertEq(adj.overlapYears, 20, 'full overlap → 20y');
assertEq(adj.deductionYen, 0, 'full overlap → deduction 0');

// ちょうど20年（240か月）も0
const exact = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2031,
    kind: 'dc',
    revenueMan: 1000,
    enrollmentYears: 20,
    periodStartAge: 40,
    periodStartMonth: 4,
    periodEndAge: 60,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 1000,
      enrollmentYears: 20,
      periodStartAge: 40,
      periodStartMonth: 4,
      periodEndAge: 60,
      periodEndMonth: 3,
    },
  ],
});
assertEq(exact.deductionYen, 0, 'exact 20y full overlap → 0');

console.log('OK full-period overlap → deduction 0');
