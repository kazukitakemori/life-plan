/**
 * Q12 介護：世帯主・配偶者別反映と旧形式マイグレーション
 * npx tsx scripts/verify-second-life-nursing.mjs
 */
import assert from 'node:assert/strict';

import { applySecondLifeNursing } from '../src/lib/secondLifeApply.ts';
import {
  createDefaultSecondLifeState,
  migrateSecondLifeState,
} from '../src/lib/secondLifeDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';

const head = {
  id: 'head-1',
  role: 'head',
  age: 65,
  birthMonth: 3,
  birthDay: 1,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const spouse = {
  id: 'spouse-1',
  role: 'spouse',
  age: 63,
  birthMonth: 6,
  birthDay: 1,
  expectedLifespan: 92,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 92, endMonth: 12 },
};

const members = [head, spouse];
const referenceMonth = 4;

const baseState = createDefaultSecondLifeState();
baseState.nursingByTarget.head = {
  skip: false,
  scenario: 'home',
  startAge: 82,
  annualCostMan: 60,
};
baseState.nursingByTarget.spouse = {
  skip: false,
  scenario: 'facility',
  startAge: 85,
  annualCostMan: 120,
};

let lifeEventState = createDefaultLifeEventState();
lifeEventState = applySecondLifeNursing(
  lifeEventState,
  baseState,
  members,
  referenceMonth,
);

const headEvents = lifeEventState.byMember['head-1'] ?? [];
const spouseEvents = lifeEventState.byMember['spouse-1'] ?? [];
const headNursing = headEvents.find((entry) => entry.label === 'セカンドライフ介護');
const spouseNursing = spouseEvents.find((entry) => entry.label === 'セカンドライフ介護');

assert.ok(headNursing, 'head nursing event should exist');
assert.equal(headNursing.startAge, 82);
assert.equal(headNursing.amountMan, 60);

assert.ok(spouseNursing, 'spouse nursing event should exist');
assert.equal(spouseNursing.startAge, 85);
assert.equal(spouseNursing.amountMan, 120);

const skippedState = createDefaultSecondLifeState();
skippedState.nursingByTarget.spouse.skip = true;

lifeEventState = applySecondLifeNursing(
  lifeEventState,
  skippedState,
  members,
  referenceMonth,
);

assert.equal(
  (lifeEventState.byMember['spouse-1'] ?? []).some(
    (entry) => entry.label === 'セカンドライフ介護',
  ),
  false,
  'skipped spouse nursing should be removed',
);

const migrated = migrateSecondLifeState({
  nursingSkip: true,
  nursingScenario: 'day_service',
  nursingStartAge: 79,
  nursingAnnualCostMan: 70,
});

assert.equal(migrated.nursingByTarget.head.skip, true);
assert.equal(migrated.nursingByTarget.head.scenario, 'day_service');
assert.equal(migrated.nursingByTarget.head.startAge, 79);
assert.equal(migrated.nursingByTarget.head.annualCostMan, 70);
assert.equal(migrated.nursingByTarget.spouse.skip, false);

console.log('verify-second-life-nursing: ok');
