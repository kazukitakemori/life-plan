/**
 * ユーザー提示の2パターンが実装どおりかを確認
 * npx tsx scripts/verify-retirement-overlap-examples.mjs
 */
import {
  calcRetirementDeductionYenAfterOverlap,
  resolveRetirementDeductionLookbackYears,
} from '../src/lib/retirementDeductionOverlap.ts';
import { calcRetirementIncomeTaxBreakdown } from '../src/lib/retirementIncomeTax.ts';

function show(label, revenueMan, enrollmentYears, deductionOverride) {
  const b = calcRetirementIncomeTaxBreakdown(
    revenueMan * 10_000,
    enrollmentYears,
    deductionOverride != null
      ? { deductionYenOverride: deductionOverride }
      : undefined,
  );
  console.log(label, {
    deductionMan: b.deductionYen / 10_000,
    retirementIncomeMan: b.retirementIncomeYen / 10_000,
    taxTotalMan: (b.incomeTaxYen + b.residentTaxYen) / 10_000,
  });
  return b;
}

console.log('lookback company→ideco', resolveRetirementDeductionLookbackYears('company', 'ideco'));
console.log('lookback ideco→company', resolveRetirementDeductionLookbackYears('ideco', 'company'));

console.log('\n=== Pattern1: company 60 → ideco 62 (19y) ===');
show('1) company 1500万 / 25年', 1500, 25);
const p1adj = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2028,
    kind: 'ideco',
    revenueMan: 500,
    enrollmentYears: 10,
    periodStartAge: 50,
    periodStartMonth: 1,
    periodEndAge: 60,
    periodEndMonth: 1,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'company',
      revenueMan: 1500,
      enrollmentYears: 25,
      periodStartAge: 35,
      periodStartMonth: 4,
      periodEndAge: 60,
      periodEndMonth: 3,
    },
  ],
});
console.log('iDeCo adjust', {
  fullDeductionMan: p1adj.fullDeductionYen / 10_000,
  overlapYears: p1adj.overlapYears,
  deductionMan: p1adj.deductionYen / 10_000,
});
show('2) ideco 500万 after overlap', 500, 10, p1adj.deductionYen);

console.log('\n=== Pattern2: ideco 60 → company 65 (10y) ===');
show('1) ideco 500万 / 10年', 500, 10);
const p2adj = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2031,
    kind: 'company',
    revenueMan: 1500,
    enrollmentYears: 25,
    periodStartAge: 40,
    periodStartMonth: 4,
    periodEndAge: 65,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 500,
      enrollmentYears: 10,
      periodStartAge: 50,
      periodStartMonth: 1,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});
console.log('company adjust', {
  fullDeductionMan: p2adj.fullDeductionYen / 10_000,
  overlapYears: p2adj.overlapYears,
  deductionMan: p2adj.deductionYen / 10_000,
});
show('2) company 1500万 after overlap', 1500, 25, p2adj.deductionYen);

const p2ok = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2036,
    kind: 'company',
    revenueMan: 1500,
    enrollmentYears: 25,
    periodStartAge: 40,
    periodStartMonth: 4,
    periodEndAge: 65,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 500,
      enrollmentYears: 10,
      periodStartAge: 50,
      periodStartMonth: 1,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});
console.log('\ngap 10y (60→70): overlapYears', p2ok.overlapYears, 'deductionMan', p2ok.deductionYen / 10_000);

// ── UIプレビュー: 会社60→iDeCo62 で控除が減ること ─────────────
import { previewPensionOnceTaxWithOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createRetirementAllowanceEntry } from '../src/lib/retirementAllowance.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';

const referenceDate = new Date(2026, 5, 1);
const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 1 };
const income = createIncomeEntry(member.id, 'employee', 40, 1, member);
income.retirementAllowances = [
  createRetirementAllowanceEntry(member, {
    amountMan: 1500,
    receiveAge: 60,
    receiveMonth: 4,
    enrollmentMode: 'years',
    enrollmentYears: 25,
  }),
];
const ideco = createSavingsEntry('ideco', member, referenceDate, {
  startAge: 50,
  startMonth: 1,
  endMode: 'until',
  endAge: 60,
  endMonth: 1,
  contributionMode: 'monthly',
  contributionMan: 2,
  withdrawalMode: 'once',
  withdrawalStartAge: 62,
  withdrawalStartMonth: 4,
  balanceMan: 500,
});
const preview = previewPensionOnceTaxWithOverlap({
  entry: ideco,
  member,
  incomeEntries: [income],
  memberEntries: [ideco],
  referenceDate,
  revenueMan: 500,
  payoutStart: { age: 62, month: 4 },
});
if (
  !preview?.adjusted ||
  preview.overlapYears !== 11 ||
  preview.breakdown.deductionYen !== 0
) {
  throw new Error(
    `expected full-period overlap → deduction 0, got ${JSON.stringify({
      adjusted: preview?.adjusted,
      deduction: preview?.breakdown.deductionYen,
      full: preview?.fullDeductionYen,
      overlap: preview?.overlapYears,
      rule: preview?.ruleLabel,
    })}`,
  );
}
console.log('OK UI preview company60→ideco62: iDeCo期間がすべて重複 → 控除0');
