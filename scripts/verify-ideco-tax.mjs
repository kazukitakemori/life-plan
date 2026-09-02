/**
 * iDeCo 受取税（退職所得・公的年金等合算）の検証
 * npx tsx scripts/verify-ideco-tax.mjs
 */
import { calcBirthYear } from '../src/lib/birthDate.ts';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import {
  collectIdecoPayoutTaxByMember,
  mergeIdecoAnnuityIntoPensionManByMember,
} from '../src/lib/idecoTax.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { calcPensionMiscIncomeYen } from '../src/lib/publicPensionDeduction.ts';
import {
  calcEnrollmentYearsFromAgeMonths,
  calcRetirementIncomeDeductionYen,
  calcRetirementIncomeTaxBreakdown,
  calcRetirementIncomeYen,
} from '../src/lib/retirementIncomeTax.ts';
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

// ── 加入年数・控除 ──────────────────────────────────────────────
assertEq(
  calcEnrollmentYearsFromAgeMonths(
    { age: 50, month: 1 },
    { age: 60, month: 1 },
  ),
  11,
  '10y1m → 11 years (50/1–60/1 inclusive)',
);
// 50歳1月〜60歳1月 = 10年0か月+1月 = 121か月 → ceil(121/12)=11
assertEq(
  calcEnrollmentYearsFromAgeMonths(
    { age: 50, month: 1 },
    { age: 60, month: 2 },
  ),
  11,
  '10y2m → 11 years',
);
assertEq(
  calcRetirementIncomeDeductionYen(11),
  4_400_000,
  'deduction 11y = 440万',
);
assertEq(
  calcRetirementIncomeDeductionYen(20),
  8_000_000,
  'deduction 20y = 800万',
);
assertEq(
  calcRetirementIncomeDeductionYen(21),
  8_700_000,
  'deduction 21y = 870万',
);
console.log('OK enrollment years & deduction');

// 収入が控除内 → 退職所得0・税0
{
  const bd = calcRetirementIncomeTaxBreakdown(4_000_000, 11);
  assertEq(bd.retirementIncomeYen, 0, 'under deduction → retirement income 0');
  assertEq(bd.incomeTaxYen, 0, 'under deduction → income tax 0');
  assertEq(bd.residentTaxYen, 0, 'under deduction → resident tax 0');
}
{
  const revenue = 10_000_000;
  const years = 11;
  const income = calcRetirementIncomeYen(revenue, years);
  assertEq(income, Math.floor((10_000_000 - 4_400_000) / 2), 'retirement income formula');
  const bd = calcRetirementIncomeTaxBreakdown(revenue, years);
  assert(bd.incomeTaxYen > 0, 'over deduction → income tax > 0');
  assert(bd.residentTaxYen > 0, 'over deduction → resident tax > 0');
  assertEq(bd.residentTaxYen, Math.floor(income * 0.1), 'resident tax 10%');
}
console.log('OK retirement income tax');

// ── 年金合算 = calcPensionMiscIncomeYen ─────────────────────────
const referenceDate = new Date(2026, 5, 1);
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
assert(head, 'head exists');

const memberAt65 = { ...head, age: 65, birthMonth: 1 };
const birthYear = calcBirthYear(
  memberAt65.age,
  memberAt65.birthMonth,
  referenceDate,
);
const payoutYear = birthYear + 66; // 66歳1月に受取開始想定

const annuityEntry = createSavingsEntry('ideco', memberAt65, referenceDate, {
  balanceMan: 120,
  contributionMan: 0,
  contributionMode: 'none',
  endMode: 'until',
  endAge: 65,
  endMonth: 12,
  startAge: 50,
  startMonth: 1,
  expectedReturnRatePct: 0,
  withdrawalMode: 'drawdown',
  idecoAnnuityPeriodMode: 'years',
  withdrawalYears: 10,
  withdrawalStartAge: 66,
  withdrawalStartMonth: 1,
  withdrawalMan: 1, // 月1万円
});

let savingsState = createDefaultSavingsState();
savingsState = updateSavingsByMember(savingsState, memberAt65.id, [
  annuityEntry,
]);

const idecoYear = collectIdecoPayoutTaxByMember({
  familyMembers: [memberAt65],
  savingsState,
  referenceDate,
  calendarYear: payoutYear,
  monthStart: 1,
  monthEnd: 12,
});
assertEq(idecoYear.annuityManByMember[memberAt65.id], 12, 'annuity 12万/年');

const publicPensionMan = 120; // 120万円
const merged = mergeIdecoAnnuityIntoPensionManByMember(
  { [memberAt65.id]: publicPensionMan },
  idecoYear.annuityManByMember,
);
assertEq(merged[memberAt65.id], 132, 'public + ideco annuity');

const combinedYen = merged[memberAt65.id] * 10_000;
const misc = calcPensionMiscIncomeYen(combinedYen, 66, 0);
const expectedMisc = calcPensionMiscIncomeYen(
  (publicPensionMan + 12) * 10_000,
  66,
  0,
);
assertEq(misc, expectedMisc, 'misc income matches calcPensionMiscIncomeYen');
console.log('OK annuity + public pension merge');

// ── 一時金を税エンジンへ ────────────────────────────────────────
const lumpEntry = createSavingsEntry('ideco', memberAt65, referenceDate, {
  balanceMan: 1000,
  contributionMan: 0,
  contributionMode: 'none',
  endMode: 'until',
  endAge: 65,
  endMonth: 12,
  startAge: 50,
  startMonth: 1,
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: 66,
  withdrawalStartMonth: 1,
  withdrawalMan: 1000, // 1000万円
});
savingsState = updateSavingsByMember(savingsState, memberAt65.id, [lumpEntry]);

const lumpCollect = collectIdecoPayoutTaxByMember({
  familyMembers: [memberAt65],
  savingsState,
  referenceDate,
  calendarYear: payoutYear,
});
assertEq(lumpCollect.lumpSumByMember[memberAt65.id]?.revenueMan, 1000, 'lump 1000万');
assertEq(
  lumpCollect.lumpSumByMember[memberAt65.id]?.enrollmentYears,
  16,
  'enrollment 50/1–65/12 contribution only → 16y (not to payout 66)',
);

const incomeByMember = {
  [memberAt65.id]: createDefaultHeadIncome(
    memberAt65,
    referenceDate.getMonth() + 1,
  ),
};
const pensionByMember = createDefaultPensionByMember([memberAt65]);

const taxWithLump = buildMemberTaxBreakdownData({
  familyMembers: [memberAt65],
  incomeByMember,
  referenceDate,
  calendarYear: payoutYear,
  memberId: memberAt65.id,
  monthStart: 1,
  monthEnd: 12,
  levyPaymentFactor: 1,
  simulationStartYear: referenceDate.getFullYear(),
  annualPensionManByMember: { [memberAt65.id]: 0 },
  pensionByMember,
  idecoLumpSumByMember: lumpCollect.lumpSumByMember,
});
assert(taxWithLump, 'tax breakdown with lump');
assert(taxWithLump.incomeTax.retirementIncomeTaxYen > 0, 'retirement income tax in breakdown');
assert(
  taxWithLump.residentTax.retirementResidentTaxYen > 0,
  'retirement resident tax in breakdown',
);
assertEq(
  taxWithLump.incomeTax.idecoEnrollmentYears,
  16,
  'enrollment years in breakdown',
);

const expectedRet = calcRetirementIncomeTaxBreakdown(10_000_000, 16);
assertEq(
  taxWithLump.incomeTax.retirementIncomeTaxYen,
  expectedRet.incomeTaxYen,
  'income tax matches standalone',
);
assertEq(
  taxWithLump.residentTax.retirementResidentTaxYen,
  expectedRet.residentTaxYen,
  'resident tax matches standalone',
);
console.log('OK tax engine lump sum wiring');

// ── CF: グロス→残現金、税は所得税・住民税で増加 ─────────────────
const cfBase = {
  familyMembers: [memberAt65],
  incomeByMember,
  livingState: createDefaultLivingState(
    memberAt65,
    referenceDate.getMonth() + 1,
  ),
  housingState: createDefaultHousingState(
    memberAt65,
    referenceDate.getMonth() + 1,
  ),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember,
  taxSocialState: createDefaultTaxSocialState(
    memberAt65.age,
    referenceDate.getMonth() + 1,
  ),
  referenceDate,
};

const cfWithout = buildCashFlowTable(cfBase);
const cfWith = buildCashFlowTable({
  ...cfBase,
  savingsState,
});

const rowWithout = cfWithout.years.find((y) => y.calendarYear === payoutYear);
const rowWith = cfWith.years.find((y) => y.calendarYear === payoutYear);
assert(rowWithout && rowWith, `payout year ${payoutYear} in CF`);

assert(
  rowWith.taxSocialBreakdown.incomeTax >
    rowWithout.taxSocialBreakdown.incomeTax ||
    rowWith.taxSocialBreakdown.residentTax >
      rowWithout.taxSocialBreakdown.residentTax,
  'CF tax increases with iDeCo lump sum',
);

const bd = rowWith.memberTaxBreakdownByMemberId[memberAt65.id];
assert(bd, 'member tax cached on CF row');
assert(bd.incomeTax.retirementIncomeTaxYen > 0, 'CF row has retirement income tax');

// 残現金にグロス受取が載る（貯蓄 breakdown）
assert(
  rowWith.savingsBreakdown.deposit > rowWithout.savingsBreakdown.deposit ||
    rowWith.savings > rowWithout.savings,
  'gross payout increases residual cash / savings',
);
console.log('OK CF gross residual + tax via income/resident');

// ── 企業型DC 一時金 → 退職所得 ─────────────────────────────────
{
  const dcLump = createSavingsEntry('dc', memberAt65, referenceDate, {
    balanceMan: 2000,
    contributionMan: 0,
    contributionMode: 'none',
    employerContributionMode: 'none',
    employerContributionMan: 0,
    employeeContributionMode: 'none',
    employeeContributionMan: 0,
    endMode: 'until',
    endAge: 65,
    endMonth: 12,
    startAge: 50,
    startMonth: 1,
    expectedReturnRatePct: 0,
    withdrawalMode: 'once',
    withdrawalStartAge: 66,
    withdrawalStartMonth: 1,
  });
  const dcState = updateSavingsByMember(createDefaultSavingsState(), memberAt65.id, [
    dcLump,
  ]);
  const dcCollect = collectIdecoPayoutTaxByMember({
    familyMembers: [memberAt65],
    savingsState: dcState,
    referenceDate,
    calendarYear: payoutYear,
  });
  assertEq(dcCollect.lumpSumByMember[memberAt65.id]?.revenueMan, 2000, 'DC lump 2000万');
  const dcTax = buildMemberTaxBreakdownData({
    familyMembers: [memberAt65],
    incomeByMember,
    referenceDate,
    calendarYear: payoutYear,
    memberId: memberAt65.id,
    monthStart: 1,
    monthEnd: 12,
    levyPaymentFactor: 1,
    simulationStartYear: referenceDate.getFullYear(),
    annualPensionManByMember: { [memberAt65.id]: 0 },
    pensionByMember,
    idecoLumpSumByMember: dcCollect.lumpSumByMember,
  });
  assert(dcTax, 'DC tax breakdown');
  assert(dcTax.incomeTax.retirementIncomeTaxYen > 0, 'DC retirement income tax');
  console.log('OK DC lump → retirement income tax');
}

// ── DB 一時金 → 退職所得／年金 → 公的年金合算 ─────────────────
{
  const dbLump = createSavingsEntry('db', memberAt65, referenceDate, {
    withdrawalMode: 'once',
    withdrawalMan: 500,
    withdrawalStartAge: 66,
    withdrawalStartMonth: 1,
    startAge: 40,
    startMonth: 1,
  });
  const dbLumpState = updateSavingsByMember(
    createDefaultSavingsState(),
    memberAt65.id,
    [dbLump],
  );
  const dbLumpCollect = collectIdecoPayoutTaxByMember({
    familyMembers: [memberAt65],
    savingsState: dbLumpState,
    referenceDate,
    calendarYear: payoutYear,
  });
  assertEq(
    dbLumpCollect.lumpSumByMember[memberAt65.id]?.revenueMan,
    500,
    'DB lump 500万',
  );

  const dbAnnuity = createSavingsEntry('db', memberAt65, referenceDate, {
    withdrawalMode: 'drawdown',
    withdrawalMan: 2,
    idecoAnnuityPeriodMode: 'years',
    withdrawalYears: 10,
    withdrawalStartAge: 66,
    withdrawalStartMonth: 1,
    startAge: 40,
    startMonth: 1,
  });
  const dbAnnState = updateSavingsByMember(
    createDefaultSavingsState(),
    memberAt65.id,
    [dbAnnuity],
  );
  const dbAnnCollect = collectIdecoPayoutTaxByMember({
    familyMembers: [memberAt65],
    savingsState: dbAnnState,
    referenceDate,
    calendarYear: payoutYear,
  });
  assertEq(dbAnnCollect.annuityManByMember[memberAt65.id], 24, 'DB annuity 2×12');
  const mergedDb = mergeIdecoAnnuityIntoPensionManByMember(
    { [memberAt65.id]: 100 },
    dbAnnCollect.annuityManByMember,
  );
  assertEq(mergedDb[memberAt65.id], 124, 'public + DB annuity');
  console.log('OK DB lump + annuity tax collection');
}

console.log('All iDeCo / DC / DB tax checks passed');
