/**
 * 個人タブ出し分けルールの検証
 * npx tsx scripts/verify-member-tab-visibility.mjs
 */
import { createFamilyMember } from '../src/lib/familyDefaults.ts';
import {
  addMemberTabExtra,
  canRemoveMemberTab,
  listAddableTabMembers,
  memberHasIncomeData,
  memberHasLivingData,
  normalizeMemberTabExtras,
  pruneMemberTabExtras,
  resolveVisibleTabMembers,
} from '../src/lib/memberTabVisibility.ts';
import {
  createEmptyPlanAppState,
  fromPlanPayload,
  toPlanPayload,
} from '../src/lib/planDocument.ts';
import { PLAN_SCHEMA_VERSION } from '../src/types/plan.ts';

const head = createFamilyMember('head');
const spouse = createFamilyMember('spouse');
const child = createFamilyMember('child');
child.nickname = '太郎';
const withChild = [head, spouse, child];

// living: head+spouse always; child only via extras/data
{
  const visible = resolveVisibleTabMembers({
    domain: 'living',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  const ids = visible.map((m) => m.id);
  if (!ids.includes(head.id) || !ids.includes(spouse.id)) {
    throw new Error('living must always show head and spouse');
  }
  if (ids.includes(child.id)) {
    throw new Error('living must hide child without extras/data');
  }
}

// living: extras or hasData shows child
{
  const viaExtra = resolveVisibleTabMembers({
    domain: 'living',
    members: withChild,
    extras: { living: [child.id] },
    memberHasData: () => false,
  });
  if (!viaExtra.map((m) => m.id).includes(child.id)) {
    throw new Error('living extras should show child');
  }

  const viaData = resolveVisibleTabMembers({
    domain: 'living',
    members: withChild,
    extras: {},
    memberHasData: (id) => id === child.id,
  });
  if (!viaData.map((m) => m.id).includes(child.id)) {
    throw new Error('living hasData should show child');
  }
}

// income: head+spouse always; child only via extras/data
{
  const visible = resolveVisibleTabMembers({
    domain: 'income',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  const ids = visible.map((m) => m.id);
  if (!ids.includes(head.id) || !ids.includes(spouse.id)) {
    throw new Error('income must always show head and spouse');
  }
  if (ids.includes(child.id)) {
    throw new Error('income must hide child without extras/data');
  }
}

// education: children always; head only with data/extras
{
  const visible = resolveVisibleTabMembers({
    domain: 'education',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  const ids = visible.map((m) => m.id);
  if (!ids.includes(child.id)) {
    throw new Error('education must always show child');
  }
  if (ids.includes(head.id)) {
    throw new Error('education should hide head without data');
  }
}

// lifeEvent: head/spouse/child always
{
  const visible = resolveVisibleTabMembers({
    domain: 'lifeEvent',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  const ids = new Set(visible.map((m) => m.id));
  if (!ids.has(head.id) || !ids.has(spouse.id) || !ids.has(child.id)) {
    throw new Error('lifeEvent must show head, spouse, child');
  }
}

// housing: head+spouse always (ご家族タブ廃止)
{
  const visible = resolveVisibleTabMembers({
    domain: 'housing',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  const ids = visible.map((m) => m.id);
  if (!ids.includes(head.id) || !ids.includes(spouse.id)) {
    throw new Error('housing must always show head and spouse');
  }
  if (ids.includes(child.id)) {
    throw new Error('housing must hide child without extras/data');
  }
}

// addable / remove
{
  const addable = listAddableTabMembers({
    domain: 'income',
    members: withChild,
    extras: {},
    memberHasData: () => false,
  });
  if (!addable.some((m) => m.id === child.id)) {
    throw new Error('child should be addable on income');
  }

  const extras = addMemberTabExtra({}, 'income', child.id);
  if (
    !canRemoveMemberTab({
      domain: 'income',
      member: child,
      extras,
      memberHasData: () => false,
    })
  ) {
    throw new Error('empty extras tab should be removable');
  }
  if (
    canRemoveMemberTab({
      domain: 'income',
      member: child,
      extras,
      memberHasData: () => true,
    })
  ) {
    throw new Error('tab with data must not be removable');
  }
}

// prune removes deleted members
{
  const pruned = pruneMemberTabExtras(
    { income: [child.id, 'gone'] },
    withChild,
  );
  if (JSON.stringify(pruned) !== JSON.stringify({ income: [child.id] })) {
    throw new Error(`unexpected prune result: ${JSON.stringify(pruned)}`);
  }
}

// plan payload roundtrip keeps memberTabExtras
{
  const state = createEmptyPlanAppState(new Date(2026, 8, 1));
  state.memberTabExtras = { living: [child.id] };
  // child not in family — normalize/prune on restore
  const payload = toPlanPayload(state);
  if (payload.memberTabExtras?.living?.[0] !== child.id) {
    throw new Error('toPlanPayload should keep extras');
  }
  const restored = fromPlanPayload(payload, { now: new Date(2026, 8, 1) });
  // child id not in familyMembers → pruned
  if (restored.memberTabExtras.living) {
    throw new Error('fromPlanPayload should prune unknown member ids');
  }
  if (PLAN_SCHEMA_VERSION < 8) {
    throw new Error('schema version should be at least 8');
  }
}

// hasData helpers
{
  const livingEmpty = { byTarget: {} };
  if (memberHasLivingData(livingEmpty, 'x')) {
    throw new Error('empty living should be false');
  }
  if (
    !memberHasLivingData(
      { byTarget: { x: [{ id: '1' }] } },
      'x',
    )
  ) {
    throw new Error('living with schedule should be true');
  }
  if (memberHasIncomeData({}, 'x')) {
    throw new Error('empty income should be false');
  }
  if (!memberHasIncomeData({ x: [{ id: '1' }] }, 'x')) {
    throw new Error('income with entry should be true');
  }
}

if (normalizeMemberTabExtras(undefined) == null) {
  throw new Error('normalize should return object');
}

console.log('verify-member-tab-visibility: ok');
