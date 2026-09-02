/**
 * Q2 教育費グラフ：過去分がグレー棒として含まれること
 * npx tsx scripts/verify-education-chart-past.mjs
 */
import assert from 'node:assert/strict';
import {
  EDUCATION_CHART_PAST_COLOR,
  EDUCATION_CHART_PAST_DATA_KEY,
  buildAggregatedEducationChartSeries,
  buildEducationChartSeries,
} from '../src/lib/educationChartData.ts';
import { createEducationExpenseEntry } from '../src/lib/educationDefaults.ts';

const referenceDate = new Date(2026, 5, 1); // 2026年6月

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

const child = {
  id: 'child1',
  role: 'child',
  age: 10,
  birthMonth: 4,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

// 小学校（6〜12歳）: 基準日時点では途中。過去分あり。
const elementary = createEducationExpenseEntry({
  schoolCategory: 'elementary',
  schoolType: 'public',
  startAge: 6,
  startMonth: 4,
  endAge: 12,
  endMonth: 3,
  tuitionAnnual: 120_000,
  tuitionPaymentCycle: 'monthly',
  entranceFee: 0,
  otherExpenses: [],
});

const familyMembers = [head, child];
const entries = [elementary];

const memberSeries = buildEducationChartSeries(
  child,
  head,
  familyMembers,
  entries,
  referenceDate,
);

assert.ok(
  memberSeries.points[0].year < 2026,
  `chart should start before reference year, got ${memberSeries.points[0].year}`,
);

const pastBar = memberSeries.bars.find(
  (bar) => bar.dataKey === EDUCATION_CHART_PAST_DATA_KEY,
);
assert.ok(pastBar, 'past education bar should be present');
assert.equal(pastBar.color, EDUCATION_CHART_PAST_COLOR);
assert.equal(pastBar.label, '過去の教育費');

const year2024 = memberSeries.points.find((p) => p.year === 2024);
assert.ok(year2024, '2024 point should exist');
assert.ok(year2024.pastAnnualMan > 0, '2024 should be past amount');
assert.equal(year2024.annualMan, 0, '2024 future amount should be 0');

const year2026 = memberSeries.points.find((p) => p.year === 2026);
assert.ok(year2026, '2026 point should exist');
assert.ok(
  year2026.pastAnnualMan > 0,
  '2026 Jan-May should count as past within reference year',
);
assert.ok(
  year2026.annualMan > 0,
  '2026 Jun-Dec should count as future within reference year',
);

const year2027 = memberSeries.points.find((p) => p.year === 2027);
assert.ok(year2027, '2027 point should exist');
assert.equal(year2027.pastAnnualMan, 0);
assert.ok(year2027.annualMan > 0);

assert.ok(
  memberSeries.points[memberSeries.points.length - 1].cumulativeMan >
    year2026.cumulativeMan,
  'cumulative should keep growing after reference year',
);

const aggregate = buildAggregatedEducationChartSeries(
  head,
  familyMembers,
  [head, child],
  { [child.id]: entries },
  referenceDate,
);

assert.ok(
  aggregate.bars.some((bar) => bar.dataKey === EDUCATION_CHART_PAST_DATA_KEY),
  'aggregate should include past bar',
);
const agg2024 = aggregate.points.find((p) => p.year === 2024);
assert.ok(agg2024?.pastAnnualMan > 0);
assert.equal(agg2024?.[`annual_${child.id}`], 0);

console.log('verify-education-chart-past: ok');
console.log(
  `  range ${memberSeries.points[0].year}-${memberSeries.points.at(-1).year}`,
);
console.log(
  `  2026 past=${year2026.pastAnnualMan} future=${year2026.annualMan} 万円`,
);
