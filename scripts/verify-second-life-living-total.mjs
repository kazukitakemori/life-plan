/**
 * Q12 生活水準の集計（ご家族＋配偶者・詳細入力）
 * npx tsx scripts/verify-second-life-living-total.mjs
 */
import assert from 'node:assert/strict';
import {
  buildSecondLifeLivingOptions,
  getPreSecondLifeMonthlyLivingMan,
} from '../src/lib/secondLifeEstimates.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { HOUSEHOLD_LIVING_KEY } from '../src/types/living.ts';

const referenceDate = new Date(2026, 5, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 45,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 43,
  birthMonth: 6,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const familyMembers = [head, spouse];

const householdDetail = syncLivingDetailSummary(
  createLivingExpenseSchedule(45, 6, {
    inputMode: 'detail',
    items: [
      createLivingExpenseItem({ label: '食費', amountMan: 10 }),
      createLivingExpenseItem({ label: '光熱費', amountMan: 2 }),
    ],
  }),
);

const spouseSchedule = createLivingExpenseSchedule(43, 6, {
  inputMode: 'detail',
  items: [createLivingExpenseItem({ label: '被服', amountMan: 3 })],
});

const livingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
    [spouse.id]: [spouseSchedule],
  },
};

const base = {
  livingState,
  familyMembers,
  incomeByMember: {},
  pensionByMember: createDefaultPensionByMember(familyMembers),
  referenceDate,
  startAge: 70,
};

const preSecond = getPreSecondLifeMonthlyLivingMan(base);
assert.equal(preSecond, 15, `expected 12+3=15 household+spouse, got ${preSecond}`);

const options = buildSecondLifeLivingOptions(base);
const same = options.find((o) => o.level === 'same');
assert.equal(same?.monthlyMan, 15, `same level expected 15, got ${same?.monthlyMan}`);

const seventy = options.find((o) => o.level === 'seventy_percent');
assert.equal(seventy?.monthlyMan, 10.5, `70% expected 10.5, got ${seventy?.monthlyMan}`);

assert.equal(same?.breakdownNote, 'Q4 生活費の内訳');
assert.deepEqual(
  same?.breakdown.map((item) => [item.label, item.amountMan]),
  [
    ['食費', 10],
    ['被服', 3],
    ['光熱費', 2],
  ],
);
assert.equal(seventy?.breakdownNote, 'Q4 生活費の内訳（7割）');
assert.equal(seventy?.breakdown[0]?.amountMan, 7);
assert.equal(seventy?.breakdown[1]?.amountMan, 2.1);
assert.equal(seventy?.breakdown[2]?.amountMan, 1.4);

const pension = options.find((o) => o.level === 'pension_based');
assert.equal(pension?.breakdownNote, '年金からの目安配分');
assert.ok((pension?.breakdown.length ?? 0) > 0);

// 配偶者タブの開始年齢が未来でも、入力済みなら合算する
const spouseFutureStart = createLivingExpenseSchedule(50, 6, {
  inputMode: 'detail',
  items: [createLivingExpenseItem({ label: '被服', amountMan: 5 })],
});
const futureState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
    [spouse.id]: [spouseFutureStart],
  },
};
const futureBase = { ...base, livingState: futureState };
const futurePre = getPreSecondLifeMonthlyLivingMan(futureBase);
assert.equal(
  futurePre,
  17,
  `household 12 + spouse tab 5 even if spouse schedule starts later, got ${futurePre}`,
);

console.log('verify-second-life-living-total: all passed');
