/**
 * 乗り物 現金一括 CF
 * npx tsx scripts/verify-vehicle-payment-cf.mjs
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { calcMemberMonthlyVehicleDetailMan } from '../src/lib/vehicleCashFlow.ts';

const referenceDate = new Date(2026, 8, 1); // Sep → 試算開始 Oct

function buildVehicle(overrides = {}) {
  return {
    id: 'v1',
    label: '自動車',
    type: 'car',
    kind: 'new',
    condition: 'new',
    paymentMode: 'cash',
    monthlyRepaymentMan: 0,
    repaymentEndYear: 0,
    repaymentEndMonth: 0,
    startAge: 40,
    startMonth: 10,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
    purchaseAmountMan: 300,
    monthlyCostMan: 0,
    gasolineCostMan: 0,
    parkingCostMan: 0,
    annualCostMan: 0,
    annualCostCycleYears: 1,
    inspectionCostMan: 0,
    insurances: [],
    ...overrides,
  };
}

function assertCfPurchase(head, vehicle, year, expected) {
  const cf = buildCashFlowTable({
    familyMembers: [head],
    incomeByMember: {},
    livingState: createDefaultLivingState(head, 9),
    housingState: createDefaultHousingState(head, 9),
    vehicleState: { byMember: { head: [vehicle] } },
    loanState: createDefaultLoanState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head]),
    taxSocialState: createDefaultTaxSocialState(head.age, 9),
    referenceDate,
  });
  const row = cf.years.find((y) => y.calendarYear === year);
  assert.equal(row?.expenseBreakdown.vehicleDetail.purchase, expected);
  assert.equal(row?.expenseBreakdown.vehicle, expected);
}

// 誕生日が開始月より後: UI 既定の「40歳10月」は試算開始の暦月に購入費を載せる
{
  const head = {
    id: 'head',
    role: 'head',
    age: 40,
    birthMonth: 11,
    expectedLifespan: 90,
    nickname: '',
    gender: 'male',
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
  const vehicle = buildVehicle();
  const oct = calcMemberMonthlyVehicleDetailMan(
    head,
    [vehicle],
    { byMember: {} },
    referenceDate,
    2026,
    10,
  );
  assert.equal(
    oct.purchase,
    300,
    '誕生日11月でも試算開始月に現金一括の購入費を計上',
  );
  assertCfPurchase(head, vehicle, 2026, 300);
}

// 1月生まれ: 期間開始＝試算開始の暦月
{
  const head = {
    id: 'head',
    role: 'head',
    age: 40,
    birthMonth: 1,
    expectedLifespan: 90,
    nickname: '',
    gender: 'male',
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
  const vehicle = buildVehicle();
  const oct = calcMemberMonthlyVehicleDetailMan(
    head,
    [vehicle],
    { byMember: {} },
    referenceDate,
    2026,
    10,
  );
  assert.equal(oct.purchase, 300);
  assertCfPurchase(head, vehicle, 2026, 300);
}

// 期間ラベルを暦の試算開始に合わせた開始（41歳10月・誕生日11月）でも1回だけ
{
  const head = {
    id: 'head',
    role: 'head',
    age: 40,
    birthMonth: 11,
    expectedLifespan: 90,
    nickname: '',
    gender: 'male',
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
  const vehicle = buildVehicle({ startAge: 41, startMonth: 10 });
  const oct = calcMemberMonthlyVehicleDetailMan(
    head,
    [vehicle],
    { byMember: {} },
    referenceDate,
    2026,
    10,
  );
  assert.equal(oct.purchase, 300);
  assertCfPurchase(head, vehicle, 2026, 300);
}

console.log('verify-vehicle-payment-cf: ok');
