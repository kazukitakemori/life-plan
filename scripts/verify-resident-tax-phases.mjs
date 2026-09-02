/**
 * 菴乗ｰ醍ｨ弱ヵ繧ｧ繝ｼ繧ｺ讀懆ｨｼ・ｽE・ｽ險育ｮ鈴幕蟋句ｹｴ / 鄙悟ｹｴ / 3蟷ｴ逶ｮ莉･髯・/ 騾閨ｷ蠕鯉ｼ・
 * npx vite-node scripts/verify-resident-tax-phases.mjs
 */
import { calcHouseholdTaxYearResult } from '../src/lib/householdTaxYear.ts';
import { resolveResidentTaxLevyPhase } from '../src/lib/priorYearIncomeResolution.ts';
import { isFirstSimulationYearAssessment } from '../src/lib/otherCashFlowLinkage.ts';

const referenceDate = new Date(2026, 5, 1);
const startYear = 2026;
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

const incomeByMember = {
  head: [
    {
      id: 'e1',
      memberId: 'head',
      category: 'employee',
      spouseContingencyOnly: false,
      periods: [
        {
          id: 'p1',
          startAge: 40,
          startMonth: 6,
          endAge: 60,
          endMonth: 12,
          streamType: 'salary_social_insurance',
          monthlyAmountMan: 50,
          bonuses: [],
          annualAmountMan: 600,
          spouseContingencyRate: null,
          annualIncreaseRate: null,
        },
      ],
      expenseManPerMonth: null,
      filingType: null,
    },
  ],
};

function taxForYear(calendarYear, priorYearIncomeByMember = {}) {
  const monthStart = calendarYear === startYear ? 6 : 1;
  const levyPaymentFactor = calendarYear === startYear ? 7 / 12 : 1;
  const r = calcHouseholdTaxYearResult({
    familyMembers: [head],
    incomeByMember,
    priorYearIncomeByMember,
    referenceDate,
    calendarYear,
    monthStart,
    monthEnd: 12,
    levyPaymentFactor,
    simulationStartYear: startYear,
    annualPensionManByMember: {},
  });
  const bd = r.memberBreakdownByMemberId.head;
  const social = Object.values(
    bd?.residentTax?.socialInsuranceDeduction ?? {},
  ).reduce((a, b) => a + b, 0);
  return {
    calendarYear,
    phase: resolveResidentTaxLevyPhase(calendarYear, startYear),
    cfTax: Math.round(r.household.residentTaxMan * 10_000),
    bdTax: bd?.residentTax?.adjustedResidentTaxYen ?? 0,
    gross: bd?.residentTax?.grossSalaryRevenueYen ?? 0,
    totalIncome: bd?.residentTax?.totalIncomeYen ?? 0,
    social,
    annualBasis: bd?.residentTax?.incomeReferenceUsesAnnualBasis ?? false,
    levyYear: bd?.residentTax?.incomeReferenceYear,
  };
}

console.assert(
  isFirstSimulationYearAssessment(2026, 2026),
  'phase helpers: first year',
);
console.assert(
  resolveResidentTaxLevyPhase(2027, 2026) === 'simulation_start_next',
  'phase helpers: second year',
);
console.assert(
  resolveResidentTaxLevyPhase(2028, 2026) === 'subsequent',
  'phase helpers: subsequent',
);

const rows = [2026, 2027, 2028, 2029, 2046, 2047].map(taxForYear);
for (const row of rows) {
  console.log(JSON.stringify(row));
}

const y2 = rows.find((r) => r.calendarYear === 2027);
const y4 = rows.find((r) => r.calendarYear === 2029);
const age61 = rows.find((r) => r.calendarYear === 2047);
const tolerance = 10_000;

if (y2.gross !== 6_000_000) {
  console.error(`Year 2 gross expected 6000000, got ${y2.gross}`);
  process.exit(1);
}

const y1 = rows.find((r) => r.calendarYear === 2026);
if (y1 && !y1.annualBasis) {
  console.error(`Year 1 should use annual basis flag, got ${y1.annualBasis}`);
  process.exit(1);
}

if (y1 && y1.gross !== 6_000_000) {
  console.error(`Year 1 gross expected 6000000, got ${y1.gross}`);
  process.exit(1);
}

if (Math.abs(y2.bdTax - y4.bdTax) > tolerance) {
  console.error(
    `Year 2 tax ${y2.bdTax} should match year 4 ${y4.bdTax} at 600荳・gross`,
  );
  process.exit(1);
}

if (age61.gross !== 6_000_000) {
  console.error(`Age 61 levy gross expected 6000000, got ${age61.gross}`);
  process.exit(1);
}

if (age61.bdTax < 250_000) {
  console.error(
    `Age 61 resident tax too low (${age61.bdTax}), expected ~300000`,
  );
  process.exit(1);
}

if (age61.social < 800_000) {
  console.error(
    `Age 61 social deduction too low (${age61.social}), expected prior-year social`,
  );
  process.exit(1);
}

console.log('\nOK: resident tax phases verified');

// Q7 蜑榊ｹｴ蠎ｦ蜿趣ｿｽE繧ｪ繝ｼ繝撰ｿｽE繝ｩ繧､繝会ｼ・蜀・・ｽ・ｽ・ｽE隧ｦ邂鈴幕蟋句燕蟷ｴ縺ｮ隱ｲ遞趣ｿｽE縺ｿ縺ｫ驕ｩ逕ｨ縺輔ｌ繧・
const priorYearZeroOverride = {
  head: {
    differsFromCurrentYear: true,
    category: 'employee',
    monthlyAmountMan: 0,
  },
};
const overrideRows = [2026, 2027, 2028].map((y) =>
  taxForYear(y, priorYearZeroOverride),
);
for (const row of overrideRows) {
  console.log('override', JSON.stringify(row));
}

const ovY1 = overrideRows.find((r) => r.calendarYear === 2026);
const ovY2 = overrideRows.find((r) => r.calendarYear === 2027);

if (ovY1.levyYear !== startYear - 1) {
  console.error(
    `Override year 1 levy year expected ${startYear - 1}, got ${ovY1.levyYear}`,
  );
  process.exit(1);
}

if (ovY1.bdTax !== 0) {
  console.error(
    `Override year 1 resident tax expected 0 (prior year income 0), got ${ovY1.bdTax}`,
  );
  process.exit(1);
}

if (ovY2.gross !== 6_000_000) {
  console.error(
    `Override year 2 gross expected 6000000, got ${ovY2.gross}`,
  );
  process.exit(1);
}

if (ovY2.bdTax < 250_000) {
  console.error(
    `Override year 2 resident tax too low (${ovY2.bdTax}), expected ~300000`,
  );
  process.exit(1);
}

console.log('\nOK: prior year income override scoped correctly');
