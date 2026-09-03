/**
 * Q12 ガイド（チェックリスト）の集計
 * npx tsx scripts/verify-second-life-guide.mjs
 */
import assert from 'node:assert/strict';

import { buildSecondLifeGuide } from '../src/lib/secondLifeGuide.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import {
  createCurrentRentalProperty,
  createDefaultHousingState,
  getHousingTargetData,
} from '../src/lib/housingDefaults.ts';
import { createDefaultSecondLifeState } from '../src/lib/secondLifeDefaults.ts';
import { applySecondLifeHousingToHousingState } from '../src/lib/secondLifeTemplates.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';
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

const startAge = 70;

const emptyGuide = buildSecondLifeGuide({
  startAge,
  familyMembers: [head],
  housingState: createDefaultHousingState(),
  livingState: { byTarget: {} },
  lifeEventState: createDefaultLifeEventState(),
  referenceDate,
});

assert.equal(emptyGuide.items.length, 3);
assert.equal(emptyGuide.items.find((item) => item.id === 'housing')?.status, 'missing');
assert.equal(emptyGuide.items.find((item) => item.id === 'living')?.status, 'missing');
assert.equal(emptyGuide.items.find((item) => item.id === 'nursing')?.status, 'missing');

const householdDetail = syncLivingDetailSummary(
  createLivingExpenseSchedule(45, 6, {
    startAge: 45,
    startMonth: 1,
    endMode: 'until',
    endAge: 69,
    endMonth: 12,
    inputMode: 'detail',
    items: [createLivingExpenseItem({ label: '食費', amountMan: 10 })],
  }),
);

const livingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
  },
};

const partialGuide = buildSecondLifeGuide({
  startAge,
  familyMembers: [head],
  housingState: createDefaultHousingState(),
  livingState,
  lifeEventState: createDefaultLifeEventState(),
  referenceDate,
});

assert.equal(
  partialGuide.items.find((item) => item.id === 'living')?.status,
  'partial',
  'pre-second-life living only should be partial',
);

const baseHousing = createDefaultHousingState();
const currentRental = createCurrentRentalProperty(head, 6, 2026);
currentRental.monthlyRentMan = 8;
baseHousing.byTarget[HOUSEHOLD_HOUSING_KEY] = {
  ...getHousingTargetData(baseHousing, HOUSEHOLD_HOUSING_KEY),
  rentals: [currentRental],
};

const rentDesign = createDefaultSecondLifeState();
rentDesign.startAge = startAge;
rentDesign.housingScenario = 'new_area';
rentDesign.newAreaOption = 'rent';

const housingState = applySecondLifeHousingToHousingState({
  housingState: baseHousing,
  secondLifeState: rentDesign,
  member: head,
  referenceDate,
});

const doneHousingGuide = buildSecondLifeGuide({
  startAge,
  familyMembers: [head],
  housingState,
  livingState,
  lifeEventState: createDefaultLifeEventState(),
  referenceDate,
});

assert.equal(
  doneHousingGuide.items.find((item) => item.id === 'housing')?.status,
  'done',
);

console.log('verify-second-life-guide: ok');
