/**
 * 生命保険料控除（新制度）の検証
 * npx tsx scripts/verify-life-insurance-deduction.mjs
 */
import {
  calcMemberAnnualLifeInsurancePremiumManByKind,
  calcMemberLifeInsuranceDeductionYen,
  calcNewSystemLifeInsuranceDeductionForCategoryYen,
  calcNewSystemLifeInsuranceDeductionYen,
} from '../src/lib/lifeInsuranceDeduction.ts';
import { createInsuranceEntry } from '../src/lib/insuranceDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { buildMemberTaxBreakdownData } from '../src/lib/taxCalculator.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

// ── 区分ごとの控除式（所得税）────────────────────────────────────────
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(24_000, 'income'),
  22_000,
  'income 24,000 yen',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(100_000, 'income'),
  40_000,
  'income cap 40,000',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(24_000, 'resident'),
  19_000,
  'resident 24,000 yen',
);
assertEq(
  calcNewSystemLifeInsuranceDeductionForCategoryYen(100_000, 'resident'),
  28_000,
  'resident cap 28,000',
);

// ── 3区分合計の上限 ────────────────────────────────────────────────────
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
  84_000,
  'resident total cap 84,000',
);

// ── 年間払込保険料の集計 ─────────────────────────────────────────────
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
if (!head) throw new Error('no head');

const referenceDate = new Date(2026, 5, 1);
const life = createInsuranceEntry('life', head, referenceDate, {
  premiumMan: 1.2,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
  lifeDeductionKind: 'general',
});
const medical = createInsuranceEntry('medical', head, referenceDate, {
  premiumMan: 0.8,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startAge: head.age - 10,
  startMonth: 1,
});

const emptyHousing = { byTarget: {} };
const emptyVehicle = { inflationRate: 0, byMember: {} };

const premiums = calcMemberAnnualLifeInsurancePremiumManByKind({
  member: head,
  entries: [life, medical],
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(premiums.general, 1.2, 'general premium man');
assertEq(premiums.nursing, 0.8, 'nursing premium man');

const deductions = calcMemberLifeInsuranceDeductionYen({
  member: head,
  insuranceState: { byMember: { [head.id]: [life, medical] } },
  housingState: emptyHousing,
  vehicleState: emptyVehicle,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  levyCalendarYear: 2025,
  levyMonthStart: 1,
  levyMonthEnd: 12,
});
assertEq(deductions.incomeTaxYen, 20_000, 'member income tax deduction');
assertEq(deductions.residentTaxYen, 20_000, 'member resident tax deduction');

// ── 税内訳への接続 ─────────────────────────────────────────────────────
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
  insuranceState: { byMember: { [head.id]: [life, medical] } },
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
  taxableIncomeYen: breakdown.incomeTax.taxableIncomeYen,
});
