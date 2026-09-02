/**
 * プラン書き出し／読み込み（merge）の検証
 * npx tsx scripts/verify-plan-backup.mjs
 */
import {
  createEmptyPlanPayload,
  createPlanRecord,
} from '../src/lib/planDocument.ts';
import {
  buildPlanBackup,
  mergePlanRecords,
  parsePlanBackupJson,
  serializePlanBackup,
} from '../src/lib/planBackup.ts';

const payload = createEmptyPlanPayload(new Date(2026, 7, 1));

const localA = createPlanRecord({
  id: 'plan-a',
  customerName: '顧客A（ローカル）',
  payload,
  now: new Date('2026-08-01T10:00:00.000Z'),
});
const localB = createPlanRecord({
  id: 'plan-b',
  customerName: '顧客B',
  payload,
  now: new Date('2026-08-02T10:00:00.000Z'),
});

const incomingA = createPlanRecord({
  id: 'plan-a',
  customerName: '顧客A（取り込み・新しい）',
  payload,
  now: new Date('2026-08-03T10:00:00.000Z'),
});
const incomingC = createPlanRecord({
  id: 'plan-c',
  customerName: '顧客C',
  payload,
  now: new Date('2026-08-04T10:00:00.000Z'),
});
const olderB = createPlanRecord({
  id: 'plan-b',
  customerName: '顧客B（古い）',
  payload,
  now: new Date('2026-08-01T09:00:00.000Z'),
});

const backup = buildPlanBackup([incomingA, incomingC, olderB]);
const serialized = serializePlanBackup(backup);
const parsed = parsePlanBackupJson(serialized);

if (parsed.format !== 'life-plan-backup') {
  throw new Error('format mismatch');
}
if (parsed.plans.length !== 3) {
  throw new Error('expected 3 plans in backup');
}

const { next, toSave, result } = mergePlanRecords(
  [localA, localB],
  parsed.plans,
  'keep_newer',
);

if (result.added !== 1) throw new Error(`added expected 1, got ${result.added}`);
if (result.updated !== 1) {
  throw new Error(`updated expected 1, got ${result.updated}`);
}
if (result.skipped !== 1) {
  throw new Error(`skipped expected 1, got ${result.skipped}`);
}
if (toSave.length !== 2) throw new Error('toSave expected 2');
if (next.length !== 3) throw new Error('next expected 3');

const mergedA = next.find((p) => p.id === 'plan-a');
const mergedB = next.find((p) => p.id === 'plan-b');
const mergedC = next.find((p) => p.id === 'plan-c');
if (mergedA?.customerName !== '顧客A（取り込み・新しい）') {
  throw new Error('plan-a should keep newer incoming');
}
if (mergedB?.customerName !== '顧客B') {
  throw new Error('plan-b should keep existing newer');
}
if (mergedC?.customerName !== '顧客C') {
  throw new Error('plan-c should be added');
}

let threw = false;
try {
  parsePlanBackupJson('{"format":"other","plans":[]}');
} catch {
  threw = true;
}
if (!threw) throw new Error('expected invalid format to throw');

console.log('verify-plan-backup: ok');
