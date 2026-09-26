/**
 * 生命保険料控除（任意反映・新旧制度）の検証
 * npx tsx scripts/verify-life-insurance-deduction.mjs
 */
import {
  calcMemberAnnualDeductibleLifeInsurancePremiumManByKind,
  calcMemberLifeInsuranceDeductionYen,
  calcNewSystemLifeInsuranceDeductionForCategoryYen,
  calcNewSystemLifeInsuranceDeductionYen,
  calcOldSystemLifeInsuranceDeductionForCategoryYen,
} from '../src/lib/lifeInsuranceDeduction.ts';
import { createInsuranceEntry } from '../src/lib/insuranceDefaults.ts';
import { createFamilyMember } from '../src/lib/familyDefaults.ts';
import { buildMemberTaxBreakdownData } from '../src/lib/taxCalculator.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

// ── 新制度の区分ごとの控除式 ────────────────────────────────────────
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(24_000, 'income'),
  22_000,
  'new income 24,000 yen',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(100_000, 'income'),
  40_000,
  'new income cap 40,000',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(24_000, 'resident'),
  18_000,
  'new resident 24,000 yen',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(100_000, 'resident'),
  28_000,
  'new resident cap 28,000',
);

// ── 旧制度の区分ごとの控除式 ────────────────────────────────────────
assertEq(
  calcOldSystemLifeInsuranceDeductionForCategoryYen(60_000, 'income'),
  40_000,
  'old income 60,000 yen',
);
assertEq(
  calcOldSystemLifeInsuranceDeductionForCategoryYen(100_000, 'income'),
  50_000,
  'old income cap 50,000',
);
assertEq(
  calcOldSystemLifeInsuranceDeductionForCategoryYen(50_000, 'resident'),
  30_000,
  'old resident 50,000 yen',
);
assertEq(
  calcOldSystemLifeInsuranceDeductionForCategoryYen(100_000, 'resident'),
  35_000,
  'old resident cap 35,000',
);

// ── 新制度3区分合計の上限 ───────────────────────────────────────────
assertEq(
  calcNewSystemLifeInsuranceDeductionYen(
    { general: 8, nursing: 8, pension: 8 },
    'income',
  ),
  120_000,
  'income total cap 120,000',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionYen(
    { general: 8, nursing: 8, pension: 8 },
    'resident',
  ),
  70_000,
  'resident total cap 70,000',
);

const head = {
  ...createFamilyMember('head'),
  age: 40,
  birthMonth: 6,
};
const spouse = {
  ...createFamilyMember('spouse'),
  age: 38,
  birthMonth: 6,
};
const members = [head, spouse];

const referenceDate = new Date(2026, 5, 1);
const emptyHousing = { byTarget: {} };
const emptyVehicle = { inflationRate: 0, byMember: {} };

const life = createInsuranceEntry('life', head, referenceDate, {
  premiumMan: 1.2,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionEnabled: true,
  lifeDeductionPayerMemberId: head.id,
  lifeDeductionSystem: 'new',
  lifeDeductionKind: 'general',
});
const medical = createInsuranceEntry('medical', head, referenceDate, {
  premiumMan: 0.8,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionEnabled: true,
  lifeDeductionPayerMemberId: head.id,
  lifeDeductionSystem: 'new',
  lifeDeductionKind: 'nursing',
});
const disabled = createInsuranceEntry('cancer', head, referenceDate, {
  premiumMan: 3,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionEnabled: false,
  lifeDeductionKind: 'nursing',
});

const insuranceState = {
  byMember: { [head.id]: [life, medical, disabled] },
};

const premiums = calcMemberAnnualDeductibleLifeInsurancePremiumManByKind({
  member: head,
  familyMembers: members,
  insuranceState,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(premiums.general, 1.2, 'enabled general premium man');
assertEq(premiums.nursing, 0.8, 'enabled nursing premium man');

const deductions = calcMemberLifeInsuranceDeductionYen({
  member: head,
  familyMembers: members,
  insuranceState,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2026,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
assertEq(deductions.incomeTaxYen, 20_000, 'member income tax deduction');
assertEq(deductions.residentTaxYen, 20_000, 'member resident tax deduction');

// ── 控除をONにしなければ反映しない ─────────────────────────────────
const noDeduction = calcMemberLifeInsuranceDeductionYen({
  member: head,
  familyMembers: members,
  insuranceState: {
    byMember: {
      [head.id]: [
        createInsuranceEntry('life', head, referenceDate, {
          premiumMan: 10,
          premiumPaymentMode: 'annual',
          periodSource: 'manual',
          startAge: head.age - 10,
          startMonth: 1,
          lifeDeductionEnabled: false,
        }),
      ],
    },
  },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2026,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
assertEq(noDeduction.incomeTaxYen, 0, 'disabled income deduction');
assertEq(noDeduction.residentTaxYen, 0, 'disabled resident deduction');

// ── 旧契約 ───────────────────────────────────────────────────────────
const oldLife = createInsuranceEntry('life', head, referenceDate, {
  premiumMan: 10,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionEnabled: true,
  lifeDeductionPayerMemberId: head.id,
  lifeDeductionSystem: 'old',
  lifeDeductionKind: 'general',
});
const oldDeduction = calcMemberLifeInsuranceDeductionYen({
  member: head,
  familyMembers: members,
  insuranceState: { byMember: { [head.id]: [oldLife] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2026,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
assertEq(oldDeduction.incomeTaxYen, 50_000, 'old contract income deduction');
assertEq(oldDeduction.residentTaxYen, 35_000, 'old contract resident deduction');

// ── 保険料負担者と契約者が異なる場合 ────────────────────────────────
const paidBySpouse = createInsuranceEntry('life', head, referenceDate, {
  premiumMan: 1.2,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionEnabled: true,
  lifeDeductionPayerMemberId: spouse.id,
  lifeDeductionSystem: 'new',
  lifeDeductionKind: 'general',
});
const crossPayerState = { byMember: { [head.id]: [paidBySpouse] } };
const headCross = calcMemberLifeInsuranceDeductionYen({
  member: head,
  familyMembers: members,
  insuranceState: crossPayerState,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2026,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
const spouseCross = calcMemberLifeInsuranceDeductionYen({
  member: spouse,
  familyMembers: members,
  insuranceState: crossPayerState,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2026,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
assertEq(headCross.incomeTaxYen, 0, 'contractor does not receive payer deduction');
assertEq(spouseCross.incomeTaxYen, 12_000, 'payer receives deduction');

// ── 税内訳への接続 ───────────────────────────────────────────────────
const incomeByMember = {};
const pensionByMember = createDefaultPensionByMember(members);
const breakdown = buildMemberTaxBreakdownData({
  familyMembers: members,
  incomeByMember,
  referenceDate,
  calendarYear: 2026,
  memberId: head.id,
  monthStart: 1,
  monthEnd: 12,
  annualPensionManByMember: {},
  pensionByMember,
  simulationStartYear: 2026,
  insuranceState,
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
});
if (!breakdown) throw new Error('no breakdown');
assertEq(
  breakdown.incomeTax.lifeInsuranceDeductionYen,
  20_000,
  'tax breakdown life insurance deduction',
);

console.log('OK life insurance deduction', {
  premiums,
  deductions,
  oldDeduction,
  spouseCross,
  taxableIncomeYen: breakdown.incomeTax.taxableIncomeYen,
});
