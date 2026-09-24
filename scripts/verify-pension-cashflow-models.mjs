/**
 * Q8年金変更がキャッシュフロー表・グラフ元データを壊さないことを
 * 最小入力〜一般的な世帯構成で横断確認する。
 * npx tsx scripts/verify-pension-cashflow-models.mjs
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { createDefaultVehicleState } from '../src/lib/vehicleDefaults.ts';

const referenceDate = new Date(2026, 8, 1);

function member(partial) {
  return {
    nickname: '',
    gender: 'male',
    expectedLifespan: 90,
    disability: 'none',
    hobbies: [],
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
    birthDay: 1,
    ...partial,
  };
}

const head = member({
  id: 'head',
  role: 'head',
  nickname: '世帯主',
  age: 40,
  birthMonth: 4,
});
const spouse = member({
  id: 'spouse',
  role: 'spouse',
  nickname: '配偶者',
  gender: 'female',
  age: 38,
  birthMonth: 6,
});
const child = member({
  id: 'child',
  role: 'child',
  nickname: '子',
  age: 10,
  birthMonth: 4,
  expectedLifespan: 90,
});

function assertFiniteDeep(value, path = 'root') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite: ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertFiniteDeep(item, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, childValue] of Object.entries(value)) {
      assertFiniteDeep(childValue, `${path}.${key}`);
    }
  }
}

function buildInput(familyMembers, incomeByMember = {}) {
  return {
    familyMembers,
    incomeByMember,
    livingState: { byTarget: {} },
    housingState: createDefaultHousingState(
      familyMembers.find((m) => m.role === 'head'),
      9,
    ),
    vehicleState: createDefaultVehicleState(),
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember(familyMembers),
    taxSocialState: createDefaultTaxSocialState(
      familyMembers.find((m) => m.role === 'head')?.age ?? 40,
      9,
    ),
    referenceDate,
  };
}

const salary = createIncomeEntry(head.id, 'employee', head.age, 9, head);
salary.periods[0].monthlyAmountMan = 40;

const cases = [
  { name: '単身・最小入力', members: [head], income: {} },
  { name: '単身・会社員', members: [head], income: { [head.id]: [salary] } },
  { name: '夫婦・最小入力', members: [head, spouse], income: {} },
  { name: '夫婦と子・最小入力', members: [head, spouse, child], income: {} },
];

for (const model of cases) {
  const result = buildCashFlowTable(
    buildInput(model.members, model.income),
  );
  assert.ok(result.years.length > 0, `${model.name}: CF年次データが空`);
  assert.ok(result.endYear >= result.startYear, `${model.name}: 年範囲が逆転`);
  assertFiniteDeep(result, model.name);
  for (const row of result.years) {
    assert.ok(row.calendarYear >= result.startYear && row.calendarYear <= result.endYear);
    assert.ok(Number.isFinite(row.income));
    assert.ok(Number.isFinite(row.expenditure));
    assert.ok(Number.isFinite(row.annualBalance));
    assert.ok(Number.isFinite(row.financialAssets));
  }
  console.log(`OK ${model.name}: ${result.startYear}-${result.endYear} (${result.years.length}年)`);
}

console.log('verify-pension-cashflow-models: all checks passed');
