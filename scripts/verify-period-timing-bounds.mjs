/**
 * 基準月／試算開始の期間ピッカー制約を検証
 * npx tsx scripts/verify-period-timing-bounds.mjs
 */
import assert from 'node:assert/strict';
import {
  clampFuturePeriodStart,
  clampFutureStartFields,
  clampPastInclusiveStartFields,
  clampPastPeriodEnd,
  filterAgesAtOrAfter,
  filterAgesAtOrBefore,
  filterMonthsAtOrAfter,
  filterMonthsAtOrBefore,
  pinStartToAgeMonth,
  resolveReferenceNowAgeMonth,
  resolveSimulationStartAgeMonth,
} from '../src/lib/periodTimingBounds.ts';
import {
  createCurrentRentalProperty,
  createOwnedProperty,
  createUpcomingRentalProperty,
} from '../src/lib/housingDefaults.ts';
import { calcYearAtAge, calcBirthYear } from '../src/lib/birthDate.ts';

const member = { id: 'h', role: 'head', age: 40, birthMonth: 4 };
const augRef = new Date(2026, 7, 1);
const now = resolveReferenceNowAgeMonth(member, augRef);
const simStart = resolveSimulationStartAgeMonth(member, augRef);

assert.deepEqual(now, { age: 40, month: 8 });
assert.deepEqual(simStart, { age: 40, month: 9 });

assert.deepEqual(
  clampFuturePeriodStart({ age: 40, month: 8 }, simStart),
  { age: 40, month: 9 },
  'これからの開始は試算開始未満なら押し上げ',
);
assert.deepEqual(
  clampPastPeriodEnd({ age: 40, month: 10 }, now),
  { age: 40, month: 8 },
  '過去終了は基準月超なら押し下げ',
);
assert.deepEqual(
  clampPastInclusiveStartFields(
    { startAge: 40, startMonth: 10, endMode: 'lifetime' },
    now,
  ),
  { startAge: 40, startMonth: 8, endMode: 'lifetime' },
  '既保有の開始は基準月超なら基準月へ',
);
assert.deepEqual(
  pinStartToAgeMonth({ startAge: 35, startMonth: 3 }, now),
  { startAge: 40, startMonth: 8 },
);

assert.deepEqual(
  filterAgesAtOrAfter([38, 39, 40, 41], simStart),
  [40, 41],
);
assert.deepEqual(
  filterMonthsAtOrAfter(40, simStart),
  [9, 10, 11, 12],
);
assert.deepEqual(
  filterAgesAtOrBefore([38, 39, 40, 41], now),
  [38, 39, 40],
);
assert.deepEqual(
  filterMonthsAtOrBefore(40, now),
  [1, 2, 3, 4, 5, 6, 7, 8],
);

const clamped = clampFutureStartFields(
  {
    startAge: 40,
    startMonth: 7,
    endMode: 'until',
    endAge: 40,
    endMonth: 8,
  },
  simStart,
);
assert.equal(clamped.startMonth, 9);
assert.equal(clamped.endMonth, 9);

const upcoming = createUpcomingRentalProperty(member, 8, 2026);
assert.equal(upcoming.startAge, 40);
assert.equal(upcoming.startMonth, 9, '入居予定の既定開始は試算開始（翌月）');

const current = createCurrentRentalProperty(member, 8, 2026);
assert.equal(current.startAge, 40);
assert.equal(current.startMonth, 8, '現在住まいは基準月固定');

const ownedSimple = createOwnedProperty('house', member, 8, 2026);
assert.equal(ownedSimple.usage, 'current');
assert.equal(ownedSimple.startMonth, 8, '持ち家居住中の既定は基準月');

const ownedUpcoming = createOwnedProperty('house', member, 8, 2026, {
  usage: 'upcoming',
});
assert.equal(ownedUpcoming.startMonth, 9, '持ち家取得予定の既定は試算開始');

const decRef = new Date(2026, 11, 1);
assert.deepEqual(resolveSimulationStartAgeMonth(member, decRef), {
  age: 41,
  month: 1,
});

// 誕生日が基準月より後: 満年齢ベースだと過去の暦年が下限になってしまう
const lateBirth = { id: 'h2', role: 'head', age: 40, birthMonth: 11 };
const sepRef = new Date(2026, 8, 1);
const lateNow = resolveReferenceNowAgeMonth(lateBirth, sepRef);
const lateSim = resolveSimulationStartAgeMonth(lateBirth, sepRef);
assert.deepEqual(lateNow, { age: 41, month: 9 }, '基準月は暦に対応する期間年齢');
assert.deepEqual(lateSim, { age: 41, month: 10 }, '試算開始も暦に対応');
const birthYear = calcBirthYear(lateBirth.age, lateBirth.birthMonth, sepRef);
assert.equal(
  calcYearAtAge(birthYear, lateBirth.birthMonth, lateSim.age, lateSim.month),
  2026,
  '試算開始の表示年は基準の翌月の暦年',
);
assert.deepEqual(
  clampFuturePeriodStart({ age: 40, month: 10 }, lateSim),
  lateSim,
  '誕生日が遅いとき古い期間開始は試算開始へ押し上げ',
);

console.log('verify-period-timing-bounds: ok');
