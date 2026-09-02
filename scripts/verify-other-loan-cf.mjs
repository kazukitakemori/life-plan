/**
 * Q9 未リンクローンの CF「ローン返済(その他)」反映を検証
 * npx tsx scripts/verify-other-loan-cf.mjs
 *
 * - フリーローン（未リンク）→ expenseBreakdown.loanRepayment に計上
 * - 自動車ローン（車両リンク）→ vehicleDetail.loanRepayment のみ（その他は増えない）
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createOwnedPropertyLoanSettings } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import {
  createDefaultLoanState,
  createLoanEntry,
  createVehicleLoanEntry,
  updateLoanByMember,
} from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import {
  createDefaultVehicleState,
  createVehicleEntry,
} from '../src/lib/vehicleDefaults.ts';
import { DEFAULT_NON_HOUSING_REPAYMENT_COUNT } from '../src/lib/loanInterestRatePeriod.ts';
import { yearsFromRepaymentCount } from '../src/lib/loanInterestRatePeriod.ts';

const referenceDate = new Date(2026, 5, 1); // 2026-06-01

const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const loanSettings = createOwnedPropertyLoanSettings({
  amountMan: 300,
  repaymentCount: DEFAULT_NON_HOUSING_REPAYMENT_COUNT,
  years: yearsFromRepaymentCount(DEFAULT_NON_HOUSING_REPAYMENT_COUNT),
  startYear: 2026,
  startMonth: 6,
  interestRatePeriods: [
    {
      id: 'rate-1',
      rateType: 'fixed',
      interestRatePct: 2,
      startYear: 0,
      startMonth: 0,
      endYear: 0,
      endMonth: 0,
    },
  ],
});

function buildTable(loanState, vehicleState) {
  return buildCashFlowTable({
    familyMembers: [head],
    incomeByMember: {},
    livingState: createDefaultLivingState(head, 6),
    housingState: createDefaultHousingState(head, 6),
    vehicleState,
    loanState,
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head]),
    taxSocialState: createDefaultTaxSocialState(head.age, 6),
    referenceDate,
  });
}

// ── 1. フリーローン（未リンク）→ ローン返済(その他) ─────────────────────────
const freeLoan = createLoanEntry('free', {
  settings: loanSettings,
  settingsConfigured: true,
});
const freeLoanState = updateLoanByMember(
  createDefaultLoanState(),
  head.id,
  [freeLoan],
);

const freeTable = buildTable(freeLoanState, createDefaultVehicleState());
const free2027 = freeTable.years.find((y) => y.calendarYear === 2027);
assert.ok(free2027, '2027年の行がある');
assert.ok(
  free2027.expenseBreakdown.loanRepayment > 0,
  `フリーローンがその他に計上: ${free2027.expenseBreakdown.loanRepayment}`,
);
assert.ok(
  free2027.expenseBreakdown.loanRepaymentDetail.free > 0,
  `フリー内訳: ${free2027.expenseBreakdown.loanRepaymentDetail.free}`,
);
assert.equal(
  free2027.expenseBreakdown.loanRepaymentDetail.education,
  0,
);
assert.equal(
  free2027.expenseBreakdown.vehicleDetail.loanRepayment,
  0,
  'フリーローンは乗り物内訳に出ない',
);
console.log(
  'OK free loan → loanRepayment(その他)=',
  free2027.expenseBreakdown.loanRepayment,
);

// ── 2. 自動車ローン（車両リンク）→ 乗り物のみ、その他は増えない ─────────────
const vehicle = createVehicleEntry(head, referenceDate, {
  id: 'vehicle-1',
  label: '車',
  type: 'car',
  purchaseAmountMan: 300,
  startAge: 40,
  startMonth: 6,
});
const vehicleState = {
  inflationRate: 0,
  byMember: { [head.id]: [vehicle] },
};
const linkedVehicleLoan = createVehicleLoanEntry(
  vehicle.label,
  { memberId: head.id, vehicleId: vehicle.id },
  300,
  {
    settings: {
      ...loanSettings,
      amountMan: 300,
    },
    settingsConfigured: true,
  },
);
const linkedLoanState = updateLoanByMember(
  createDefaultLoanState(),
  head.id,
  [linkedVehicleLoan],
);

const linkedTable = buildTable(linkedLoanState, vehicleState);
const linked2027 = linkedTable.years.find((y) => y.calendarYear === 2027);
assert.ok(linked2027, '2027年の行がある');
assert.ok(
  linked2027.expenseBreakdown.vehicleDetail.loanRepayment > 0,
  `リンク自動車ローンが乗り物に計上: ${linked2027.expenseBreakdown.vehicleDetail.loanRepayment}`,
);
assert.equal(
  linked2027.expenseBreakdown.loanRepayment,
  0,
  `リンク済みはローン返済(その他)に出ない: ${linked2027.expenseBreakdown.loanRepayment}`,
);
console.log(
  'OK linked vehicle loan → vehicleDetail.loanRepayment=',
  linked2027.expenseBreakdown.vehicleDetail.loanRepayment,
  ' / other=',
  linked2027.expenseBreakdown.loanRepayment,
);

// ── 3. フリー＋リンク自動車を同時 → その他はフリー分のみ ───────────────────
const bothLoanState = updateLoanByMember(
  createDefaultLoanState(),
  head.id,
  [freeLoan, linkedVehicleLoan],
);
const bothTable = buildTable(bothLoanState, vehicleState);
const both2027 = bothTable.years.find((y) => y.calendarYear === 2027);
assert.ok(both2027);
assert.equal(
  both2027.expenseBreakdown.loanRepayment,
  free2027.expenseBreakdown.loanRepayment,
  'その他はフリー分のみ（二重計上なし）',
);
assert.ok(
  both2027.expenseBreakdown.vehicleDetail.loanRepayment > 0,
  '乗り物側も別途計上',
);
console.log('OK no double count');

// ── 4. 月々返済モード（未リンク）→ フラット額をローン返済(その他)に計上 ───
const monthlyLoan = createLoanEntry('education', {
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 6,
  repaymentEndYear: 2028,
  repaymentEndMonth: 5,
  settingsConfigured: true,
});
const monthlyLoanState = updateLoanByMember(
  createDefaultLoanState(),
  head.id,
  [monthlyLoan],
);
const monthlyTable = buildTable(monthlyLoanState, createDefaultVehicleState());
const monthly2027 = monthlyTable.years.find((y) => y.calendarYear === 2027);
assert.ok(monthly2027, '2027年の行がある');
assert.equal(
  monthly2027.expenseBreakdown.loanRepayment,
  60,
  `月々5万×12=60: ${monthly2027.expenseBreakdown.loanRepayment}`,
);
assert.equal(
  monthly2027.expenseBreakdown.loanRepaymentDetail.education,
  60,
);
const monthly2029 = monthlyTable.years.find((y) => y.calendarYear === 2029);
assert.ok(monthly2029);
assert.equal(
  monthly2029.expenseBreakdown.loanRepayment,
  0,
  '終了後は計上しない',
);
console.log('OK monthly repayment mode → education=60 / after end=0');

console.log('verify-other-loan-cf: all passed');
