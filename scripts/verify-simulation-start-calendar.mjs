/**
 * 基準月／試算開始の暦整合を検証
 * npx tsx scripts/verify-simulation-start-calendar.mjs
 *
 * - 試算開始 = 基準月の翌月（12月 → 翌年1月）
 * - CF の startYear は試算開始暦年
 * - ローン既定開始と一致
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import {
  formatReferenceMonthLabel,
  formatReferenceSimSubtitle,
  formatSimulationStartLabel,
  resolveDefaultStartCalendar,
  resolveSimulationMonthStart,
  resolveSimulationStartCalendar,
  resolveSimulationStartYear,
} from '../src/lib/simulationTiming.ts';

const augRef = new Date(2026, 7, 1); // August
assert.deepEqual(resolveSimulationStartCalendar(augRef), {
  year: 2026,
  month: 9,
});
assert.equal(resolveSimulationStartYear(augRef), 2026);
assert.equal(formatReferenceMonthLabel(augRef), '2026年8月現在');
assert.equal(formatSimulationStartLabel(augRef), '試算は2026年9月から');
assert.equal(
  formatReferenceSimSubtitle(augRef),
  '2026年8月現在／試算は9月から',
);

const decRef = new Date(2026, 11, 1); // December
assert.deepEqual(resolveSimulationStartCalendar(decRef), {
  year: 2027,
  month: 1,
});
assert.equal(resolveSimulationStartYear(decRef), 2027);
assert.equal(
  formatReferenceSimSubtitle(decRef),
  '2026年12月現在／試算は2027年1月から',
);
assert.deepEqual(
  resolveSimulationStartCalendar(decRef),
  resolveDefaultStartCalendar(decRef),
  'ローン既定開始と試算開始暦が一致',
);

function buildMinimalCf(referenceDate) {
  const refMonth = referenceDate.getMonth() + 1;
  const head = {
    id: 'head',
    role: 'head',
    age: 40,
    birthMonth: 4,
    expectedLifespan: 90,
    nickname: '',
    gender: 'male',
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
  return buildCashFlowTable({
    familyMembers: [head],
    incomeByMember: {},
    livingState: createDefaultLivingState(head, refMonth),
    housingState: createDefaultHousingState(head, refMonth),
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head]),
    taxSocialState: createDefaultTaxSocialState(head.age, refMonth),
    referenceDate,
  });
}

const augCf = buildMinimalCf(augRef);
assert.equal(augCf.startYear, 2026);
assert.equal(augCf.simulationMonthStart, 9);

const decCf = buildMinimalCf(decRef);
assert.equal(decCf.startYear, 2027, '12月基準の CF 開始年は翌年');
assert.equal(decCf.simulationMonthStart, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 40,
};
assert.equal(
  resolveSimulationMonthStart(head, { [head.id]: [] }, decRef),
  1,
);

console.log('verify-simulation-start-calendar: ok');
