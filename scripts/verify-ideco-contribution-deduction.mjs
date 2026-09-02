/**
 * iDeCo 掛金の所得控除（小規模企業共済等掛金控除）の検証
 * npx tsx scripts/verify-ideco-contribution-deduction.mjs
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import {
  calcMemberAnnualIdecoContributionMan,
  calcMemberAnnualSelectiveDcContributionMan,
  calcMemberIdecoContributionDeductionYen,
} from '../src/lib/idecoContributionDeduction.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import {
  createDefaultSavingsState,
  createSavingsEntry,
  updateSavingsByMember,
} from '../src/lib/savingsDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { buildMemberTaxBreakdownData } from '../src/lib/taxCalculator.ts';

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
}

const referenceDate = new Date(2026, 5, 1);
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
if (!head) throw new Error('no head');

const calendarYear = 2026;
const monthlyMan = 2.3;

const entry = createSavingsEntry('ideco', head, referenceDate, {
  contributionMan: monthlyMan,
  contributionMode: 'monthly',
  startAge: head.age - 5,
  startMonth: 1,
  endMode: 'until',
  endAge: head.age + 20,
  endMonth: 12,
  expectedReturnRatePct: 0,
  balanceMan: 0,
});

const savingsState = updateSavingsByMember(
  createDefaultSavingsState(),
  head.id,
  [entry],
);

// ── 月2.3万×12＝27.6万 → 控除 276,000円 ─────────────────────────
const contributionMan = calcMemberAnnualIdecoContributionMan({
  member: head,
  savingsState,
  referenceDate,
  calendarYear,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(Math.round(contributionMan * 1000) / 1000, 27.6, 'annual contribution man');

const deductions = calcMemberIdecoContributionDeductionYen({
  member: head,
  savingsState,
  referenceDate,
  calendarYear,
  monthStart: 1,
  monthEnd: 12,
  simulationStartYear: calendarYear,
});
assertEq(deductions.incomeTaxYen, 276_000, 'income tax deduction yen');
assertEq(deductions.residentTaxYen, 276_000, 'resident tax deduction yen (levy full year)');
console.log('OK 2.3万×12 → 276,000円');

// ── 積立期間外の月は 0 ───────────────────────────────────────────
const outside = createSavingsEntry('ideco', head, referenceDate, {
  contributionMan: monthlyMan,
  contributionMode: 'monthly',
  startAge: head.age + 5,
  startMonth: 1,
  endMode: 'until',
  endAge: head.age + 20,
  endMonth: 12,
});
const outsideState = updateSavingsByMember(
  createDefaultSavingsState(),
  head.id,
  [outside],
);
const outsideMan = calcMemberAnnualIdecoContributionMan({
  member: head,
  savingsState: outsideState,
  referenceDate,
  calendarYear,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(outsideMan, 0, 'outside contribution period → 0');
console.log('OK outside period → 0');

// ── 税内訳への接続 ───────────────────────────────────────────────
const incomeByMember = {
  [head.id]: createDefaultHeadIncome(head, referenceDate.getMonth() + 1),
};
const pensionByMember = createDefaultPensionByMember(members);

const breakdown = buildMemberTaxBreakdownData({
  familyMembers: members,
  incomeByMember,
  referenceDate,
  calendarYear,
  memberId: head.id,
  monthStart: 1,
  monthEnd: 12,
  annualPensionManByMember: {},
  pensionByMember,
  simulationStartYear: calendarYear,
  savingsState,
});
assert(breakdown, 'tax breakdown');
assertEq(
  breakdown.incomeTax.idecoContributionDeductionYen,
  276_000,
  'breakdown income tax ideco deduction',
);
assertEq(
  breakdown.residentTax.idecoContributionDeductionYen,
  276_000,
  'breakdown resident tax ideco deduction',
);
console.log('OK tax breakdown wiring');

// ── CF: 掛金ありで所得税または住民税が減少 ───────────────────────
const cfBase = {
  familyMembers: members,
  incomeByMember,
  livingState: createDefaultLivingState(
    head,
    referenceDate.getMonth() + 1,
  ),
  housingState: createDefaultHousingState(
    head,
    referenceDate.getMonth() + 1,
  ),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember,
  taxSocialState: createDefaultTaxSocialState(
    head.age,
    referenceDate.getMonth() + 1,
  ),
  referenceDate,
};

const cfWithout = buildCashFlowTable(cfBase);
const cfWith = buildCashFlowTable({
  ...cfBase,
  savingsState,
});

const rowWithout = cfWithout.years.find((y) => y.calendarYear === calendarYear);
const rowWith = cfWith.years.find((y) => y.calendarYear === calendarYear);
assert(rowWithout && rowWith, `CF year ${calendarYear}`);

const taxLower =
  rowWith.taxSocialBreakdown.incomeTax <
    rowWithout.taxSocialBreakdown.incomeTax ||
  rowWith.taxSocialBreakdown.residentTax <
    rowWithout.taxSocialBreakdown.residentTax;
assert(
  taxLower,
  `CF tax should decrease with iDeCo contribution (income: ${rowWithout.taxSocialBreakdown.incomeTax}→${rowWith.taxSocialBreakdown.incomeTax}, resident: ${rowWithout.taxSocialBreakdown.residentTax}→${rowWith.taxSocialBreakdown.residentTax})`,
);
console.log('OK CF tax decreases with contributions');

// ── 選択型DC加入者掛金も同控除に含む（事業主は含まない） ─────────
{
  const dc = createSavingsEntry('dc', head, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'monthly',
    employerContributionMan: 5,
    employeeContributionMode: 'monthly',
    employeeContributionMan: 1.5,
    expectedReturnRatePct: 0,
    startAge: head.age - 5,
    startMonth: 1,
    endMode: 'until',
    endAge: head.age + 20,
    endMonth: 12,
    withdrawalMode: 'none',
  });
  const dcState = updateSavingsByMember(
    createDefaultSavingsState(),
    head.id,
    [dc],
  );

  const selectiveMan = calcMemberAnnualSelectiveDcContributionMan({
    member: head,
    savingsState: dcState,
    referenceDate,
    calendarYear,
    monthStart: 1,
    monthEnd: 12,
  });
  assertEq(Math.round(selectiveMan * 1000) / 1000, 18, 'selective dc 1.5×12');

  const dcDed = calcMemberIdecoContributionDeductionYen({
    member: head,
    savingsState: dcState,
    referenceDate,
    calendarYear,
    monthStart: 1,
    monthEnd: 12,
    simulationStartYear: calendarYear,
  });
  // 加入者のみ 18万 → 180,000円（事業主 60万は控除対象外）
  assertEq(dcDed.incomeTaxYen, 180_000, 'selective dc income tax deduction');
  assertEq(dcDed.residentTaxYen, 180_000, 'selective dc resident tax deduction');

  const employerOnly = createSavingsEntry('dc', head, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'monthly',
    employerContributionMan: 5,
    employeeContributionMode: 'none',
    employeeContributionMan: 0,
    expectedReturnRatePct: 0,
    startAge: head.age - 5,
    startMonth: 1,
    endMode: 'until',
    endAge: head.age + 20,
    endMonth: 12,
    withdrawalMode: 'none',
  });
  const employerState = updateSavingsByMember(
    createDefaultSavingsState(),
    head.id,
    [employerOnly],
  );
  const employerDed = calcMemberIdecoContributionDeductionYen({
    member: head,
    savingsState: employerState,
    referenceDate,
    calendarYear,
    monthStart: 1,
    monthEnd: 12,
    simulationStartYear: calendarYear,
  });
  assertEq(employerDed.incomeTaxYen, 0, 'employer-only dc → no deduction');
  console.log('OK selective DC deduction (employer excluded)');
}

console.log('All iDeCo contribution deduction checks passed');
