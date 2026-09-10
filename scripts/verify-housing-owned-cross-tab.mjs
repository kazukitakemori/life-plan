/**
 * 住まい Phase3: 持ち家のローン契約に連動したクロスタブ表示
 * npx tsx scripts/verify-housing-owned-cross-tab.mjs
 */
import assert from 'node:assert/strict';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import {
  isMemberInvolvedInOwnedLoans,
  listOwnedViewsForTarget,
} from '../src/lib/housingOwnedViews.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';

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

const members = [head, spouse];
const property = createOwnedProperty('detached_house', head, 6, 2026);

const housingState = {
  byTarget: {
    [head.id]: { rentals: [], owned: [property] },
  },
};

function loanEntry(overrides) {
  return {
    id: overrides.id ?? 'loan',
    category: 'housing',
    name: '住宅ローン',
    settings: {},
    note: '',
    paymentMode: 'monthlyRepayment',
    monthlyRepaymentMan: 10,
    structureType: overrides.structureType ?? 'sole',
    housingLink: {
      targetId: head.id,
      propertyId: property.id,
    },
    ...overrides,
  };
}

// 1. 単独・世帯主契約 → 配偶者タブには出ない
{
  const loanState = {
    byMember: {
      [head.id]: [loanEntry({ id: 'sole', structureType: 'sole' })],
    },
  };
  const spouseViews = listOwnedViewsForTarget(
    housingState,
    loanState,
    members,
    spouse.id,
    head.id,
    spouse.id,
  );
  assert.equal(spouseViews.length, 0);
  assert.equal(
    isMemberInvolvedInOwnedLoans({
      loanState,
      members,
      storageTargetId: head.id,
      propertyId: property.id,
      memberId: spouse.id,
      headId: head.id,
      spouseId: spouse.id,
    }),
    false,
  );
}

// 2. ペアローン → 配偶者タブに linked 表示
{
  const loanState = {
    byMember: {
      [head.id]: [
        loanEntry({
          id: 'pair-h',
          structureType: 'pair',
          pairGroupId: 'g1',
          pairSharePct: 50,
        }),
      ],
      [spouse.id]: [
        loanEntry({
          id: 'pair-s',
          structureType: 'pair',
          pairGroupId: 'g1',
          pairSharePct: 50,
        }),
      ],
    },
  };
  const spouseViews = listOwnedViewsForTarget(
    housingState,
    loanState,
    members,
    spouse.id,
    head.id,
    spouse.id,
  );
  assert.equal(spouseViews.length, 1);
  assert.equal(spouseViews[0].viewRole, 'linked');
  assert.equal(spouseViews[0].storageTargetId, head.id);
}

// 3. 連帯債務（契約者=世帯主）→ 配偶者にも見える
{
  const loanState = {
    byMember: {
      [head.id]: [
        loanEntry({
          id: 'joint',
          structureType: 'joint_debt',
          pairSharePct: 50,
        }),
      ],
    },
  };
  const spouseViews = listOwnedViewsForTarget(
    housingState,
    loanState,
    members,
    spouse.id,
    head.id,
    spouse.id,
  );
  assert.equal(spouseViews.length, 1);
  assert.equal(spouseViews[0].viewRole, 'linked');
}

// 4. 所有者タブは常に owner
{
  const loanState = createDefaultLoanState();
  const headViews = listOwnedViewsForTarget(
    housingState,
    loanState,
    members,
    head.id,
    head.id,
    spouse.id,
  );
  assert.equal(headViews.length, 1);
  assert.equal(headViews[0].viewRole, 'owner');
}

console.log('verify-housing-owned-cross-tab: ok');
