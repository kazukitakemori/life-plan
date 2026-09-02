/**
 * 会社退職金の勤続年数（年数／期間）と選択型DCの標準報酬控除の検証
 * npx tsx scripts/verify-retirement-allowance.mjs
 */
import { calcBirthYear } from '../src/lib/birthDate.ts';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import {
  collectCompanyRetirementLumpByMember,
  createRetirementAllowanceEntry,
  mergeRetirementLumpSums,
  resolveRetirementEnrollmentYears,
} from '../src/lib/retirementAllowance.ts';
import { calcRetirementIncomeTaxBreakdown } from '../src/lib/retirementIncomeTax.ts';
import {
  createDefaultSavingsState,
  createSavingsEntry,
  updateSavingsByMember,
} from '../src/lib/savingsDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { collectIdecoPayoutTaxByMember } from '../src/lib/idecoTax.ts';
import { calcMemberSalaryBonusBreakdownYen } from '../src/lib/memberYearIncome.ts';
import { calcMemberSelectiveDcManForMonth } from '../src/lib/dcContribution.ts';
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
assert(head, 'head exists');

const member = { ...head, age: 40, birthMonth: 1 };
const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
const receiveAge = 60;
const receiveYear = birthYear + receiveAge;

// ── 勤続: 年数入力 ─────────────────────────────────────────────
{
  const yearsMode = createRetirementAllowanceEntry(member, {
    amountMan: 2000,
    receiveAge,
    receiveMonth: 3,
    enrollmentMode: 'years',
    enrollmentYears: 25,
  });
  assertEq(resolveRetirementEnrollmentYears(yearsMode), 25, 'years mode 25');
  console.log('OK enrollment years mode');
}

// ── 勤続: 期間入力 ─────────────────────────────────────────────
{
  const periodMode = createRetirementAllowanceEntry(member, {
    amountMan: 2000,
    receiveAge,
    receiveMonth: 3,
    enrollmentMode: 'period',
    enrollmentStartAge: 30,
    enrollmentStartMonth: 4,
    enrollmentEndAge: 60,
    enrollmentEndMonth: 3,
  });
  const years = resolveRetirementEnrollmentYears(periodMode);
  assert(years >= 29 && years <= 31, `period mode ~30y got ${years}`);
  console.log(`OK enrollment period mode = ${years}`);
}

let incomeEntries = createDefaultHeadIncome(member, 6);
incomeEntries = [
  {
    ...incomeEntries[0],
    periods: incomeEntries[0].periods.map((p, i) =>
      i === 0
        ? { ...p, startAge: 30, startMonth: 4, endAge: 60, endMonth: 3 }
        : p,
    ),
    retirementAllowances: [
      createRetirementAllowanceEntry(member, {
        amountMan: 2000,
        receiveAge,
        receiveMonth: 3,
        enrollmentMode: 'years',
        enrollmentYears: 30,
      }),
    ],
  },
];

const incomeByMember = { [member.id]: incomeEntries };

const company = collectCompanyRetirementLumpByMember({
  familyMembers: [member],
  incomeByMember,
  referenceDate,
  calendarYear: receiveYear,
});
assertEq(company[member.id]?.revenueMan, 2000, 'company lump 2000万');
assertEq(company[member.id]?.enrollmentYears, 30, 'company years 30');
console.log('OK company retirement collect');

const pensionByMember = createDefaultPensionByMember([member]);
const cf = buildCashFlowTable({
  familyMembers: [member],
  incomeByMember,
  livingState: createDefaultLivingState(member, 6),
  housingState: createDefaultHousingState(member, 6),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember,
  taxSocialState: createDefaultTaxSocialState(member.age, 6),
  referenceDate,
});
const row = cf.years.find((y) => y.calendarYear === receiveYear);
assert(row, `CF year ${receiveYear}`);
assertEq(row.incomeBreakdown.retirementAllowance, 2000, 'CF retirementAllowance');
assert(
  row.memberTaxBreakdownByMemberId[member.id]?.incomeTax.retirementIncomeTaxYen >
    0,
  'CF has retirement income tax from company lump',
);
console.log('OK CF retirement allowance + tax');

const ideco = createSavingsEntry('ideco', member, referenceDate, {
  balanceMan: 500,
  contributionMan: 0,
  contributionMode: 'none',
  endMode: 'until',
  endAge: 59,
  endMonth: 12,
  startAge: 40,
  startMonth: 1,
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: receiveAge,
  withdrawalStartMonth: 3,
});
const savingsState = updateSavingsByMember(
  createDefaultSavingsState(),
  member.id,
  [ideco],
);
const idecoCollect = collectIdecoPayoutTaxByMember({
  familyMembers: [member],
  savingsState,
  referenceDate,
  calendarYear: receiveYear,
});
const merged = mergeRetirementLumpSums(company, idecoCollect.lumpSumByMember);
assertEq(merged[member.id].revenueMan, 2500, 'merged revenue 2500');

const expected = calcRetirementIncomeTaxBreakdown(
  2500 * 10_000,
  merged[member.id].enrollmentYears,
);
const tax = buildMemberTaxBreakdownData({
  familyMembers: [member],
  incomeByMember,
  referenceDate,
  calendarYear: receiveYear,
  memberId: member.id,
  monthStart: 1,
  monthEnd: 12,
  levyPaymentFactor: 1,
  simulationStartYear: referenceDate.getFullYear(),
  annualPensionManByMember: { [member.id]: 0 },
  pensionByMember,
  idecoLumpSumByMember: merged,
});
assert(tax, 'tax breakdown');
assertEq(
  tax.incomeTax.retirementIncomeTaxYen,
  expected.incomeTaxYen,
  'merged retirement income tax',
);
console.log('OK company + iDeCo lump merge');

// ── 選択型DC → 標準報酬から控除（給与所得年額は不変） ─────────
{
  const dc = createSavingsEntry('dc', member, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'none',
    employeeContributionMode: 'monthly',
    employeeContributionMan: 2,
    expectedReturnRatePct: 0,
    startAge: member.age - 1,
    startMonth: 1,
    endAge: member.age + 20,
    endMonth: 12,
    withdrawalMode: 'none',
  });
  const dcState = updateSavingsByMember(createDefaultSavingsState(), member.id, [
    dc,
  ]);
  const salaryEntries = createDefaultHeadIncome(member, 6);
  salaryEntries[0] = {
    ...salaryEntries[0],
    periods: salaryEntries[0].periods.map((p) => ({
      ...p,
      startAge: member.age - 5,
      startMonth: 1,
      endAge: member.age + 20,
      endMonth: 12,
      monthlyAmountMan: 50,
      bonuses: [],
    })),
  };

  const without = calcMemberSalaryBonusBreakdownYen(
    member,
    salaryEntries,
    referenceDate,
    2026,
    1,
    12,
  );
  const withDc = calcMemberSalaryBonusBreakdownYen(
    member,
    salaryEntries,
    referenceDate,
    2026,
    1,
    12,
    {
      selectiveDcManForMonth: (month) =>
        calcMemberSelectiveDcManForMonth(
          member,
          dcState,
          referenceDate,
          2026,
          month,
        ),
    },
  );

  assertEq(without.annualSalaryYen, withDc.annualSalaryYen, 'salary income yen unchanged');
  assert(
    withDc.standardMonthlyRemunerationYen < without.standardMonthlyRemunerationYen,
    `standard rem reduced: ${without.standardMonthlyRemunerationYen} → ${withDc.standardMonthlyRemunerationYen}`,
  );
  const janWithout = without.monthlyRemunerations.find((m) => m.month === 1);
  const janWith = withDc.monthlyRemunerations.find((m) => m.month === 1);
  assert(janWithout && janWith, 'jan rem');
  assertEq(
    janWith.remunerationYen,
    janWithout.remunerationYen - 20_000,
    'jan rem -2万',
  );

  const taxWithout = buildMemberTaxBreakdownData({
    familyMembers: [member],
    incomeByMember: { [member.id]: salaryEntries },
    referenceDate,
    calendarYear: 2026,
    memberId: member.id,
    monthStart: 1,
    monthEnd: 12,
    levyPaymentFactor: 1,
    simulationStartYear: 2026,
    annualPensionManByMember: {},
    pensionByMember,
  });
  const taxWith = buildMemberTaxBreakdownData({
    familyMembers: [member],
    incomeByMember: { [member.id]: salaryEntries },
    referenceDate,
    calendarYear: 2026,
    memberId: member.id,
    monthStart: 1,
    monthEnd: 12,
    levyPaymentFactor: 1,
    simulationStartYear: 2026,
    annualPensionManByMember: {},
    pensionByMember,
    savingsState: dcState,
  });
  assert(taxWithout && taxWith, 'tax with/without selective dc');
  const siWithout =
    taxWithout.incomeTax.socialInsuranceDeduction.employeesPension +
    taxWithout.incomeTax.socialInsuranceDeduction.healthInsurance;
  const siWith =
    taxWith.incomeTax.socialInsuranceDeduction.employeesPension +
    taxWith.incomeTax.socialInsuranceDeduction.healthInsurance;
  assert(
    siWith < siWithout,
    `SI premiums decrease with selective DC (${siWithout} → ${siWith})`,
  );
  console.log('OK selective DC reduces standard remuneration / SI');
}

console.log('All retirement allowance + selective DC SI checks passed');
