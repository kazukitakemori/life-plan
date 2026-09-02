/**
 * Q12 → Q3 反映（生活費は Q4 に書き込まない）
 * npx tsx scripts/verify-second-life-q3-apply.mjs
 */
import assert from 'node:assert/strict';

import { applySecondLifeDesign } from '../src/lib/secondLifeApply.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultSecondLifeState } from '../src/lib/secondLifeDefaults.ts';
import { HOUSEHOLD_LIVING_KEY } from '../src/types/living.ts';

const referenceDate = new Date(2026, 5, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 45,
  birthMonth: 3,
  birthDay: 1,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const householdDetail = syncLivingDetailSummary(
  createLivingExpenseSchedule(45, 6, {
    startAge: 45,
    startMonth: 1,
    inputMode: 'detail',
    items: [createLivingExpenseItem({ label: '食費', amountMan: 10 })],
  }),
);

const livingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
  },
};

const secondLifeState = createDefaultSecondLifeState();
secondLifeState.startAge = 70;
secondLifeState.livingLevel = 'seventy_percent';
secondLifeState.livingSkip = false;

const lifeEventState = createDefaultLifeEventState();

const nextLifeEventState = applySecondLifeDesign({
  lifeEventState,
  secondLifeState,
  familyMembers: [head],
  referenceDate,
});

assert.deepEqual(
  livingState,
  livingState,
  'living state object should be untouched by caller',
);

const headEvents = nextLifeEventState.byMember['head'] ?? [];
assert.ok(
  headEvents.some((entry) => entry.label === 'セカンドライフ住まい'),
  'housing life event should be created',
);
assert.ok(
  headEvents.some((entry) => entry.label === 'セカンドライフ介護'),
  'nursing life event should be created',
);

console.log('verify-second-life-q3-apply: ok');
