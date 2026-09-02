/**
 * Q4 生活費 CF（生活費1行 / 項目内訳・合計行）
 * npx tsx scripts/verify-living-simple-cf.mjs
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import {
  createDefaultLivingState,
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { HOUSEHOLD_LIVING_KEY } from '../src/types/living.ts';

const referenceDate = new Date(2026, 5, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

function buildTable(livingState) {
  return buildCashFlowTable({
    familyMembers: [head],
    incomeByMember: {},
    livingState,
    housingState: createDefaultHousingState(head, 6),
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head]),
    taxSocialState: createDefaultTaxSocialState(head.age, 6),
    referenceDate,
  });
}

// 1. 既定は生活費1行（詳細UI）
const defaultState = createDefaultLivingState(head, 6);
assert.equal(
  defaultState.byTarget[HOUSEHOLD_LIVING_KEY][0].inputMode,
  'detail',
);
const singleTable = buildTable(defaultState);
const single2027 = singleTable.years.find((y) => y.calendarYear === 2027);
assert.ok(single2027);
assert.ok(single2027.expenseBreakdown.living > 0);
assert.equal(
  singleTable.expenseLivingItems.map((i) => i.label).join(','),
  '生活費',
);
console.log('OK single living=', single2027.expenseBreakdown.living);

// 2. 項目内訳
const detailSchedule = syncLivingDetailSummary(
  createLivingExpenseSchedule(40, 6, {
    inputMode: 'detail',
    items: [
      createLivingExpenseItem({ label: '食費', amountMan: 10 }),
      createLivingExpenseItem({
        label: '電気',
        amountMan: 2,
        sameIncreaseRateAsFirst: true,
      }),
    ],
  }),
);
const detailState = {
  byTarget: { [HOUSEHOLD_LIVING_KEY]: [detailSchedule] },
};
const detailTable = buildTable(detailState);
const detail2027 = detailTable.years.find((y) => y.calendarYear === 2027);
assert.ok(detail2027);
assert.ok(detail2027.expenseBreakdown.livingByLabel['食費'] > 0);
assert.ok(detail2027.expenseBreakdown.livingByLabel['電気'] > 0);
console.log('OK detail labels', detailTable.expenseLivingItems);

// 3. 合計行は二重計上しない
const withSummary = syncLivingDetailSummary({
  ...createLivingExpenseSchedule(40, 6, { inputMode: 'detail' }),
  items: [
    createLivingExpenseItem({ label: '生活費', amountMan: 30 }),
    createLivingExpenseItem({ label: '食費', amountMan: 8 }),
    createLivingExpenseItem({ label: '電気', amountMan: 2 }),
  ],
});
assert.equal(withSummary.items[0].amountMan, 10);
assert.equal(withSummary.items[0].label, '生活費');

const summaryState = {
  byTarget: { [HOUSEHOLD_LIVING_KEY]: [withSummary] },
};
const summaryTable = buildTable(summaryState);
const summary2027 = summaryTable.years.find((y) => y.calendarYear === 2027);
assert.ok(summary2027);
assert.equal(summary2027.expenseBreakdown.livingByLabel['生活費'], undefined);
const detailSum =
  (summary2027.expenseBreakdown.livingByLabel['食費'] ?? 0) +
  (summary2027.expenseBreakdown.livingByLabel['電気'] ?? 0);
assert.equal(summary2027.expenseBreakdown.living, detailSum);
console.log('OK summary no double count living=', summary2027.expenseBreakdown.living);

console.log('verify-living-simple-cf: all passed');
