/**
 * Q12 反映状態の判定（Q3 のみ）
 * npx tsx scripts/verify-second-life-apply-status.mjs
 */
import assert from 'node:assert/strict';

import {
  captureSecondLifeQ3ApplySnapshot,
  getSecondLifeApplyStatus,
  markSecondLifeQ3Applied,
} from '../src/lib/secondLifeApplyStatus.ts';
import { createDefaultSecondLifeState } from '../src/lib/secondLifeDefaults.ts';

let state = createDefaultSecondLifeState();

assert.equal(getSecondLifeApplyStatus(state), 'never_applied');

state = markSecondLifeQ3Applied(state);
assert.equal(getSecondLifeApplyStatus(state), 'applied');

state = { ...state, startAge: 72 };
assert.equal(getSecondLifeApplyStatus(state), 'dirty');

state = markSecondLifeQ3Applied(state);
state = { ...state, livingLevel: 'same' };
assert.equal(
  getSecondLifeApplyStatus(state),
  'applied',
  'living level changes should not mark Q3 apply as dirty',
);

const snapshot = captureSecondLifeQ3ApplySnapshot(state);
assert.equal(snapshot.livingLevel, undefined);

console.log('verify-second-life-apply-status: ok');
