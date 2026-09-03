/**
 * Q5 住まい / Q4 生活費へのセカンドライフ反映
 * npx tsx scripts/verify-second-life-templates.mjs
 */
import assert from 'node:assert/strict';

import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import {
  createDefaultHousingState,
  createCurrentRentalProperty,
  getHousingTargetData,
} from '../src/lib/housingDefaults.ts';
import { createDefaultSecondLifeState } from '../src/lib/secondLifeDefaults.ts';
import {
  applySecondLifeHousingToHousingState,
  applySecondLifeLivingDesign,
  SECOND_LIFE_OWNED_NAME,
  SECOND_LIFE_RENTAL_NAME,
} from '../src/lib/secondLifeTemplates.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
  syncLivingDetailSummary,
} from '../src/lib/livingDefaults.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';
import { HOUSEHOLD_LIVING_KEY } from '../src/types/living.ts';

const referenceDate = new Date(2026, 5, 1);
const startAge = 70;

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

const baseHousing = createDefaultHousingState();
const currentRental = createCurrentRentalProperty(head, 6, 2026);
currentRental.monthlyRentMan = 10;
baseHousing.byTarget[HOUSEHOLD_HOUSING_KEY] = {
  ...getHousingTargetData(baseHousing, HOUSEHOLD_HOUSING_KEY),
  rentals: [currentRental],
};

const rentDesign = createDefaultSecondLifeState();
rentDesign.startAge = startAge;
rentDesign.housingScenario = 'new_area';
rentDesign.newAreaOption = 'rent';

const housingAfterRent = applySecondLifeHousingToHousingState({
  housingState: baseHousing,
  secondLifeState: rentDesign,
  member: head,
  referenceDate,
});

const rentals =
  housingAfterRent.byTarget[HOUSEHOLD_HOUSING_KEY]?.rentals ?? [];
assert.ok(
  rentals.some((rental) => rental.name === SECOND_LIFE_RENTAL_NAME),
  'second life rental should be added',
);
assert.equal(
  rentals.find((rental) => rental.name === SECOND_LIFE_RENTAL_NAME)
    ?.monthlyRentMan,
  10,
  'rent should reuse current monthly rent',
);
assert.equal(
  rentals.find((rental) => rental.name !== SECOND_LIFE_RENTAL_NAME)?.endMode,
  'until',
  'current housing should end before second life when relocating',
);

const purchaseDesign = createDefaultSecondLifeState();
purchaseDesign.startAge = startAge;
purchaseDesign.housingScenario = 'new_area';
purchaseDesign.newAreaOption = 'purchase';

const housingAfterPurchase = applySecondLifeHousingToHousingState({
  housingState: baseHousing,
  secondLifeState: purchaseDesign,
  member: head,
  referenceDate,
});
assert.ok(
  (housingAfterPurchase.byTarget[HOUSEHOLD_HOUSING_KEY]?.owned ?? []).some(
    (property) => property.name === SECOND_LIFE_OWNED_NAME,
  ),
);

const householdDetail = syncLivingDetailSummary(
  createLivingExpenseSchedule(45, 6, {
    startAge: 45,
    startMonth: 1,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
    inputMode: 'detail',
    items: [
      createLivingExpenseItem({ label: '食費', amountMan: 10 }),
      createLivingExpenseItem({ label: '光熱費', amountMan: 5 }),
    ],
  }),
);

const livingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [householdDetail],
  },
};

const livingDesign = createDefaultSecondLifeState();
livingDesign.startAge = startAge;
livingDesign.livingLevel = 'seventy_percent';
livingDesign.livingSkip = false;

const nextLiving = applySecondLifeLivingDesign({
  livingState,
  secondLifeState: livingDesign,
  familyMembers: [head],
  incomeByMember: {},
  pensionByMember: {},
  referenceDate,
});

const schedules = nextLiving.byTarget[HOUSEHOLD_LIVING_KEY] ?? [];
assert.ok(schedules.some((schedule) => schedule.startAge === startAge));
assert.ok(
  schedules.some(
    (schedule) =>
      schedule.endMode === 'until' && schedule.endAge === startAge - 1,
  ),
);

console.log('verify-second-life-templates: ok');
