/**
 * 住まい Phase1/2: ご家族→世帯主 migrate と賃貸負担者
 * npx tsx scripts/verify-housing-rental-payer.mjs
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import {
  createRentalProperty,
  migrateHousingState,
} from '../src/lib/housingDefaults.ts';
import {
  applyRentalPayerModeChange,
  getRentalCfMonthlyRentMan,
  listRentalViewsForTarget,
  migrateHouseholdHousingToHead,
} from '../src/lib/housingRentalPayer.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';
import { fromPlanPayload, toPlanPayload, createEmptyPlanAppState } from '../src/lib/planDocument.ts';

const referenceDate = new Date(2026, 5, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 40,
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
  age: 38,
  birthMonth: 6,
  birthDay: 1,
  expectedLifespan: 90,
  nickname: '',
  gender: 'female',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

// 1. ご家族キーは世帯主へ migrate
{
  const rental = createRentalProperty(head, 6, 2026, {
    monthlyRentMan: 10,
    occupancy: 'current',
  });
  const state = {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [rental], owned: [] },
    },
  };
  const migrated = migrateHousingState(state, head, 6, 2026, {
    headId: head.id,
  });
  assert.equal(migrated.byTarget[HOUSEHOLD_HOUSING_KEY], undefined);
  assert.equal(migrated.byTarget[head.id]?.rentals[0]?.id, rental.id);
}

// 2. 両方負担は家賃合算、配偶者タブにも見える
{
  const rental = createRentalProperty(head, 6, 2026, {
    payerMode: 'both',
    monthlyRentMan: 8,
    spouseMonthlyRentMan: 4,
    occupancy: 'current',
  });
  assert.equal(getRentalCfMonthlyRentMan(rental), 12);

  const housingState = {
    byTarget: { [head.id]: { rentals: [rental], owned: [] } },
  };
  const spouseViews = listRentalViewsForTarget(
    housingState,
    spouse.id,
    head.id,
    spouse.id,
  );
  assert.equal(spouseViews.length, 1);
  assert.equal(spouseViews[0].amountRole, 'spouseShare');
  assert.equal(spouseViews[0].storageTargetId, head.id);
}

// 3. 配偶者のみへ移すと格納タブが変わる
{
  const rental = createRentalProperty(head, 6, 2026, {
    payerMode: 'head',
    monthlyRentMan: 9,
  });
  const housingState = {
    byTarget: { [head.id]: { rentals: [rental], owned: [] } },
  };
  const moved = applyRentalPayerModeChange({
    housingState,
    loanState: createDefaultLoanState(),
    storageTargetId: head.id,
    rentalId: rental.id,
    payerMode: 'spouse',
    headId: head.id,
    spouseId: spouse.id,
  });
  assert.equal(moved.storageTargetId, spouse.id);
  assert.equal(moved.housingState.byTarget[head.id]?.rentals.length, 0);
  assert.equal(
    moved.housingState.byTarget[spouse.id]?.rentals[0]?.payerMode,
    'spouse',
  );
}

// 4. CF: both の合算
{
  const rental = createRentalProperty(head, 6, 2026, {
    payerMode: 'both',
    monthlyRentMan: 7,
    spouseMonthlyRentMan: 3,
    occupancy: 'current',
    startAge: 40,
    startMonth: 6,
    endMode: 'lifetime',
  });
  const table = buildCashFlowTable({
    familyMembers: [head, spouse],
    incomeByMember: {},
    livingState: createDefaultLivingState(head, 6),
    housingState: {
      byTarget: { [head.id]: { rentals: [rental], owned: [] } },
    },
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head, spouse]),
    taxSocialState: createDefaultTaxSocialState(head.age, 6),
    referenceDate,
  });
  const y2027 = table.years.find((y) => y.calendarYear === 2027);
  assert.ok(y2027);
  assert.equal(y2027.expenseBreakdown.housingDetail.monthlyCost, 120);
}

// 5. ご家族キーのローンリンク付け替え + plan 復元でご家族キー消滅
{
  const rental = createRentalProperty(head, 6, 2026, { monthlyRentMan: 5 });
  const remapped = migrateHouseholdHousingToHead({
    housingState: {
      byTarget: {
        [HOUSEHOLD_HOUSING_KEY]: { rentals: [rental], owned: [] },
      },
    },
    loanState: {
      byMember: {
        [head.id]: [
          {
            id: 'loan1',
            category: 'housing',
            name: '住宅ローン',
            settings: {},
            note: '',
            paymentMode: 'monthlyRepayment',
            monthlyRepaymentMan: 10,
            housingLink: {
              targetId: HOUSEHOLD_HOUSING_KEY,
              propertyId: rental.id,
            },
          },
        ],
      },
    },
    headId: head.id,
  });
  assert.equal(
    remapped.loanState.byMember[head.id][0].housingLink.targetId,
    head.id,
  );
  assert.equal(remapped.housingState.byTarget[HOUSEHOLD_HOUSING_KEY], undefined);
  assert.equal(remapped.housingState.byTarget[head.id]?.rentals[0]?.id, rental.id);

  const empty = createEmptyPlanAppState(referenceDate);
  empty.housingState = {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [rental], owned: [] },
    },
  };
  const restored = fromPlanPayload(toPlanPayload(empty), {
    now: referenceDate,
  });
  assert.equal(restored.housingState.byTarget[HOUSEHOLD_HOUSING_KEY], undefined);
}

console.log('verify-housing-rental-payer: ok');
