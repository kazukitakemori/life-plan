/**
 * PlanPayload の往復とレコード作成を検証
 * npx tsx scripts/verify-plan-document.mjs
 */
import {
  createEmptyPlanAppState,
  createPlanRecord,
  fromPlanPayload,
  migratePlanRecord,
  toPlanPayload,
} from '../src/lib/planDocument.ts';
import { PLAN_SCHEMA_VERSION, formatCustomerNameWithHonorific } from '../src/types/plan.ts';
import { getDefaultPlanPurposes } from '../src/lib/planPurpose.ts';

const state = createEmptyPlanAppState(new Date(2026, 7, 15));
const payload = toPlanPayload(state);

if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.referenceDate)) {
  throw new Error(`Bad referenceDate format: ${payload.referenceDate}`);
}
if (payload.referenceDate !== '2026-08-01') {
  throw new Error(`Expected 2026-08-01, got ${payload.referenceDate}`);
}

const restored = fromPlanPayload(payload);
if (restored.familyMembers.length !== state.familyMembers.length) {
  throw new Error('Family member count mismatch after roundtrip');
}
if (restored.familyMembers[0]?.id !== state.familyMembers[0]?.id) {
  throw new Error('Family member id lost after roundtrip');
}
if (restored.referenceDate.getFullYear() !== 2026) {
  throw new Error('referenceDate year lost');
}
if (restored.referenceDate.getMonth() !== 7) {
  throw new Error('referenceDate month lost');
}
if (!restored.requiredCoverageState?.kind) {
  throw new Error('requiredCoverageState lost after roundtrip');
}
if (restored.requiredCoverageState.kind !== 'survivor_expected_lifespan') {
  throw new Error('default kind should be survivor_expected_lifespan');
}
if (restored.requiredCoverageState.subject !== 'head') {
  throw new Error('default subject should be head');
}
if (restored.requiredCoverageState.detailDesigns?.head?.living?.ratePct !== 100) {
  throw new Error('default living design rate should be 100');
}

const restoredLegacy = fromPlanPayload({
  ...payload,
  requiredCoverageState: undefined,
});
if (restoredLegacy.requiredCoverageState.kind !== 'youngest_child_education') {
  throw new Error('legacy payload should migrate requiredCoverageState');
}

const record = createPlanRecord({
  customerName: '  山田太郎  ',
  phone: ' 090-1111-2222 ',
  email: ' a@example.com ',
  payload,
  now: new Date('2026-08-07T12:00:00.000Z'),
});
if (record.customerName !== '山田太郎') {
  throw new Error(`Expected trimmed name, got ${record.customerName}`);
}
if (record.phone !== '090-1111-2222' || record.email !== 'a@example.com') {
  throw new Error('phone/email not trimmed');
}
if (record.schemaVersion !== PLAN_SCHEMA_VERSION) {
  throw new Error('schemaVersion mismatch');
}
if (record.status !== 'in_progress') {
  throw new Error('default status should be in_progress');
}
if (
  !Array.isArray(record.purposes) ||
  record.purposes.length !== 1 ||
  record.purposes[0] !== getDefaultPlanPurposes()[0]
) {
  throw new Error('default purposes should be [life_plan]');
}
if (record.note !== '') {
  throw new Error('default note should be empty string');
}
if (!record.id) throw new Error('missing id');
if (formatCustomerNameWithHonorific(record.customerName) !== '山田太郎 様') {
  throw new Error('honorific failed');
}
if (formatCustomerNameWithHonorific('山田太郎様') !== '山田太郎 様') {
  throw new Error('honorific normalize failed');
}

const migrated = migratePlanRecord({
  ...record,
  schemaVersion: 0,
  status: 'completed',
  purposes: undefined,
  purpose: undefined,
});
if (migrated.schemaVersion !== PLAN_SCHEMA_VERSION) {
  throw new Error('migratePlanRecord did not bump schemaVersion');
}
if (migrated.status !== 'simulated') {
  throw new Error('old completed should migrate to simulated');
}
if (
  !Array.isArray(migrated.purposes) ||
  migrated.purposes[0] !== 'life_plan'
) {
  throw new Error('missing purpose should migrate to [life_plan]');
}

const educationRecord = createPlanRecord({
  customerName: '教育費',
  purpose: 'education',
  payload,
});
if (
  !educationRecord.purposes?.includes('education') ||
  educationRecord.purposes.length !== 1
) {
  throw new Error('legacy purpose should migrate to purposes array');
}

const multiRecord = createPlanRecord({
  customerName: '複合',
  purposes: ['education', 'pension', 'life_plan'],
  payload,
});
if (
  multiRecord.purposes.length !== 1 ||
  multiRecord.purposes[0] !== 'life_plan'
) {
  throw new Error('life_plan should exclusivize purposes');
}

const comboRecord = createPlanRecord({
  customerName: '教育と年金',
  purposes: ['pension', 'education'],
  payload,
});
if (
  comboRecord.purposes.join(',') !== 'education,pension'
) {
  throw new Error('partial purposes should combine and sort');
}

const legacyMigrated = migratePlanRecord({
  ...record,
  schemaVersion: 4,
  purposes: undefined,
  purpose: 'pension',
});
if (legacyMigrated.purposes?.join(',') !== 'pension') {
  throw new Error('legacy single purpose should migrate');
}

const deathRecord = createPlanRecord({
  customerName: '万が一保障',
  purposes: ['death_coverage'],
  payload,
});
if (deathRecord.purposes?.join(',') !== 'death_coverage') {
  throw new Error('death_coverage purpose should persist');
}

const deathMedicalRecord = createPlanRecord({
  customerName: '保障コンボ',
  purposes: ['medical_coverage', 'death_coverage'],
  payload,
});
if (deathMedicalRecord.purposes?.join(',') !== 'death_coverage,medical_coverage') {
  throw new Error('death+medical purposes should sort');
}

const emptyName = createPlanRecord({
  customerName: '   ',
  payload,
});
if (emptyName.customerName !== '名称未設定') {
  throw new Error('empty name fallback failed');
}

console.log('verify-plan-document: ok');
console.log({
  referenceDate: payload.referenceDate,
  members: restored.familyMembers.length,
  schemaVersion: record.schemaVersion,
});
