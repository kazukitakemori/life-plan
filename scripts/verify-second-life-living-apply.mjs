/**
 * Q12 生活費反映：現時点・セカンドライフ期の二重計上を防ぐ
 * npx tsx scripts/verify-second-life-living-apply.mjs
 */
import assert from 'node:assert/strict';

import { applySecondLifeLiving } from '../src/lib/secondLifeApply.ts';
import {
  getPreSecondLifeMonthlyLivingMan,
  getSecondLifePeriodMonthlyLivingMan,
} from '../src/lib/secondLifeEstimates.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
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

const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 43,
  birthMonth: 6,
  birthDay: 1,
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

const secondLifeState = createDefaultSecondLifeState();
secondLifeState.startAge = 70;
secondLifeState.livingLevel = 'same';

const applyInput = {
  familyMembers,
  incomeByMember: {},
  pensionByMember: createDefaultPensionByMember(familyMembers),
  referenceDate,
};

const beforeCurrent = getPreSecondLifeMonthlyLivingMan({
  livingState,
  familyMembers,
  referenceDate,
  startAge: secondLifeState.startAge,
});
assert.equal(beforeCurrent, 15);

const applied = applySecondLifeLiving(
  livingState,
  secondLifeState,
  applyInput,
);

const afterCurrent = getPreSecondLifeMonthlyLivingMan({
  livingState: applied,
  familyMembers,
  referenceDate,
  startAge: secondLifeState.startAge,
});
assert.equal(
  afterCurrent,
  15,
  `current living should stay 15 after apply, got ${afterCurrent}`,
);

const afterSecondLife = getSecondLifePeriodMonthlyLivingMan({
  livingState: applied,
  familyMembers,
  referenceDate,
  startAge: secondLifeState.startAge,
});
assert.equal(
  afterSecondLife,
  15,
  `second-life living should be consolidated 15, got ${afterSecondLife}`,
);

// ご家族タブのみ・配偶者なしでも現時点が未来スケジュールで膨らまない
const householdOnlyState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
  },
};
const appliedHouseholdOnly = applySecondLifeLiving(
  householdOnlyState,
  secondLifeState,
  { ...applyInput, familyMembers: [head] },
);
const householdOnlyCurrent = getPreSecondLifeMonthlyLivingMan({
  livingState: appliedHouseholdOnly,
  familyMembers: [head],
  referenceDate,
  startAge: secondLifeState.startAge,
});
assert.equal(
  householdOnlyCurrent,
  12,
  `household-only current should stay 12, got ${householdOnlyCurrent}`,
);

console.log('verify-second-life-living-apply: ok');
