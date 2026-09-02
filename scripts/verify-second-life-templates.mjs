/**
 * Q3/Q4/Q5 セカンドライフテンプレート追加
 * npx tsx scripts/verify-second-life-templates.mjs
 */
import assert from 'node:assert/strict';

import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import {
  addSecondLifeLivingSchedule,
  addSecondLifeNursingTemplates,
  addSecondLifeRentalToHousing,
  SECOND_LIFE_LIVING_LABEL,
  SECOND_LIFE_RENTAL_NAME,
} from '../src/lib/secondLifeTemplates.ts';
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

const spouse = {
  id: 'spouse',
  role: 'spouse',
  age: 43,
  birthMonth: 6,
  birthDay: 15,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const housingState = addSecondLifeRentalToHousing({
  housingState: createDefaultHousingState(),
  member: head,
  referenceDate,
  startAge,
});

const rentals = housingState.byTarget[HOUSEHOLD_HOUSING_KEY]?.rentals ?? [];
assert.ok(
  rentals.some((rental) => rental.name === SECOND_LIFE_RENTAL_NAME),
  'second life rental should be added',
);
assert.ok(
  rentals.some((rental) => rental.startAge === startAge),
  'rental should start at second life age',
);

const livingState = addSecondLifeLivingSchedule({
  livingState: { byTarget: {} },
  member: head,
  referenceDate,
  startAge,
  monthlyMan: 21,
});

const schedules = livingState.byTarget[HOUSEHOLD_LIVING_KEY] ?? [];
assert.equal(schedules.length, 1);
assert.equal(schedules[0].startAge, startAge);
assert.ok(
  schedules[0].items.some((item) => item.label === SECOND_LIFE_LIVING_LABEL),
);

const lifeEventState = addSecondLifeNursingTemplates({
  lifeEventState: createDefaultLifeEventState(),
  familyMembers: [head, spouse],
  referenceDate,
});

for (const member of [head, spouse]) {
  const entries = lifeEventState.byMember[member.id] ?? [];
  assert.ok(
    entries.some((entry) => entry.label === 'セカンドライフ介護'),
    `nursing template for ${member.role}`,
  );
}

console.log('verify-second-life-templates: ok');
