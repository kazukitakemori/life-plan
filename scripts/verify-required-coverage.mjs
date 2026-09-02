/**
 * 必要保障額：保障期間の解決と支出累計
 * npx tsx scripts/verify-required-coverage.mjs
 */
import assert from 'node:assert/strict';
import { createEducationExpenseEntry } from '../src/lib/educationDefaults.ts';
import {
  createDefaultHousingState,
  createOwnedAnnualTaxEntry,
  createOwnedMonthlyFeeEntry,
  createOwnedProperty,
  createOwnedPropertyLoanSettings,
  createOwnedPropertyMaintenance,
  createRentalProperty,
} from '../src/lib/housingDefaults.ts';
import { createDefaultInsuranceState } from '../src/lib/insuranceDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import {
  createLivingExpenseItem,
  createLivingExpenseSchedule,
} from '../src/lib/livingDefaults.ts';
import {
  createDefaultLoanState,
  createLoanEntry,
} from '../src/lib/loanDefaults.ts';
import { createDefaultSavingsState, createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createIncomeEntry } from '../src/lib/incomeDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { addCalendarMonths } from '../src/lib/housingLoanAmortization.ts';
import { calcMonthlyPensionEntitlementBreakdownMan } from '../src/lib/pensionIncome.ts';
import { calcPensionPaymentFromEntitlements } from '../src/lib/pensionPaymentSchedule.ts';
import {
  createEmptyPensionBreakdown,
  sumOldAgeBasicDetail,
  sumOldAgeEmployeesPension,
  sumOldAgePension,
  sumSurvivorEmployeesDetail,
} from '../src/types/cashFlow.ts';
import {
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR,
} from '../src/lib/pensionConstants.ts';
import {
  buildRequiredCoverageResult,
  calcDeathTimingCoverageRow,
  calcMedicalRiskCoverage,
  createDefaultRequiredCoverageState,
  migrateRequiredCoverageState,
  pickDeathTimingMilestoneAges,
  resolveHousingLoanPayoffEnd,
  resolveMemberExpectedLifespanEnd,
  resolveSpouseOldAgePensionStart,
  resolveYoungestChildEducationEnd,
} from '../src/lib/requiredCoverage.ts';
import {
  createCoverageWorkIncomeEntry,
  createDefaultWorkDesigns,
} from '../src/lib/requiredCoverageIncome.ts';
import { resolveDeathTimeBalancesMan } from '../src/lib/requiredCoverageYearlyCashFlow.ts';
import {
  calcCoverageSurvivorBasicMonthlyMan,
  calcSurvivorBasicYenPerYear,
} from '../src/lib/survivorBasicPension.ts';
import { calcCoverageSurvivorEmployeesDetail } from '../src/lib/survivorEmployeesPension.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import {
  createDefaultVehicleState,
  createVehicleEntry,
} from '../src/lib/vehicleDefaults.ts';
import {
  coverageLivingLineId,
  coverageLivingTabRateId,
  coverageOwnedHoldingLineId,
  coverageOwnedHoldingPartLineId,
  coverageTabRateId,
  createDefaultCoverageDesigns,
  createDefaultExpenseDesigns,
  filterCoverageLivingLines,
  listCoverageDesignCatalog,
  listHousingHoldingCoverageParts,
  patchCoverageLivingRateFromSimpleDesign,
  patchCoverageCategoryRate,
  patchCoverageTabRate,
} from '../src/lib/requiredCoverageDesign.ts';
import {
  formatOwnedPropertyCreditLifeHint,
  housingLoanCoverageDesignedFactor,
  isHousingLoanCoverageLockedOff,
  isHousingLoanPaidByGroupCreditLife,
  isOwnedHousingLoanInForce,
  resolveOwnedPropertyCreditLifeKind,
} from '../src/lib/housingCreditLifeCoverage.ts';
import { HOUSEHOLD_LIVING_KEY } from '../src/types/living.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

const referenceDate = new Date(2026, 5, 1);

function calendarIndex(year, month) {
  return year * 12 + month;
}

function indexToYearMonth(idx) {
  const year = Math.floor((idx - 1) / 12);
  const month = ((idx - 1) % 12) + 1;
  return { year, month };
}

function prevCalendarIndex(idx) {
  const prev = addCalendarMonths(indexToYearMonth(idx), -1);
  return calendarIndex(prev.year, prev.month);
}

function calcCoverageOldAgePaymentGross({
  household,
  pension,
  incomeByMember,
  start,
  end,
  referenceDate: refDate,
}) {
  const entitlementCache = new Map();
  const getEntitlement = (idx) => {
    if (!entitlementCache.has(idx)) {
      const { year, month } = indexToYearMonth(idx);
      entitlementCache.set(
        idx,
        calcMonthlyPensionEntitlementBreakdownMan(
          household,
          pension,
          incomeByMember,
          refDate,
          year,
          month,
        ),
      );
    }
    return entitlementCache.get(idx);
  };
  let basic = 0;
  let employees = 0;
  const startIdx = calendarIndex(start.year, start.month);
  const endIdx = calendarIndex(end.year, end.month);
  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const { month } = indexToYearMonth(idx);
    const payment = calcPensionPaymentFromEntitlements(
      month,
      getEntitlement(prevCalendarIndex(idx)),
      getEntitlement(prevCalendarIndex(prevCalendarIndex(idx))),
    );
    basic += sumOldAgeBasicDetail(payment.oldAge.basic);
    employees += sumOldAgeEmployeesPension(payment.oldAge);
  }
  return {
    basic: Math.round(basic),
    employees: Math.round(employees),
  };
}

function calcCoverageSurvivorEmployeesPaymentGross({
  familyMembers,
  subject,
  pension,
  originalIncomeByMember,
  coverageIncomeByMember,
  start,
  end,
  referenceDate: refDate,
}) {
  const entitlementCache = new Map();
  const getEntitlement = (idx) => {
    if (!entitlementCache.has(idx)) {
      const { year, month } = indexToYearMonth(idx);
      const breakdown = createEmptyPensionBreakdown();
      breakdown.survivor.employees = calcCoverageSurvivorEmployeesDetail({
        familyMembers,
        subject,
        pensionByMember: pension,
        originalIncomeByMember,
        coverageIncomeByMember,
        referenceDate: refDate,
        death: start,
        year,
        month,
      }).detail;
      entitlementCache.set(idx, breakdown);
    }
    return entitlementCache.get(idx);
  };

  let employees = 0;
  const startIdx = calendarIndex(start.year, start.month);
  const endIdx = calendarIndex(end.year, end.month);
  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const { month } = indexToYearMonth(idx);
    const payment = calcPensionPaymentFromEntitlements(
      month,
      getEntitlement(prevCalendarIndex(idx)),
      getEntitlement(prevCalendarIndex(prevCalendarIndex(idx))),
    );
    employees += sumSurvivorEmployeesDetail(payment.survivor.employees);
  }
  return { employees: Math.round(employees) };
}

function sumCoverageIncomeParts(income) {
  return (
    income.earned +
    income.survivorBasic +
    income.childAllowance +
    income.oldAgeBasic +
    income.oldAgeEmployees +
    income.survivorEmployees
  );
}

function assertNonNegativeCoverageIncome(result, label = 'coverage income') {
  const income = result.income;
  for (const key of [
    'earned',
    'survivorBasic',
    'childAllowance',
    'oldAgeBasic',
    'oldAgeEmployees',
    'survivorEmployees',
    'taxSocial',
  ]) {
    assert.ok(
      income[key] >= 0,
      `${label}: ${key} must be non-negative (got ${income[key]})`,
    );
  }
  for (const point of result.chartPoints) {
    for (const key of [
      'yearEarned',
      'yearSurvivorBasic',
      'yearSurvivorEmployees',
      'yearMiddleAgedWidowAdd',
      'yearChildAllowance',
      'yearOldAgeBasic',
      'yearOldAgeEmployees',
      'yearTaxSocial',
      'remainingEarned',
      'remainingSurvivorBasic',
      'remainingSurvivorEmployees',
      'remainingMiddleAgedWidowAdd',
      'remainingChildAllowance',
      'remainingOldAgeBasic',
      'remainingOldAgeEmployees',
      'remainingTaxSocial',
    ]) {
      assert.ok(
        point[key] >= 0,
        `${label}: chart ${key} must be non-negative (year ${point.calendarYear}, got ${point[key]})`,
      );
    }
  }
}

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
  nickname: '太郎',
  age: 10,
  birthMonth: 4,
  householdPeriod: { mode: 'custom', endAge: 22, endMonth: 3 },
});

const livingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [
      createLivingExpenseSchedule(40, 6, {
        inputMode: 'simple',
        simpleMonthlyExpenseMan: 10,
        simpleIncreaseRate: null,
      }),
    ],
  },
};

function buildInput(overrides = {}) {
  const familyMembers = overrides.familyMembers ?? [head, spouse, child];
  return {
    familyMembers,
    incomeByMember: {},
    livingState,
    housingState: createDefaultHousingState(head, 6),
    vehicleState: createDefaultVehicleState(),
    loanState: createDefaultLoanState(),
    insuranceState: createDefaultInsuranceState(),
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember(familyMembers),
    taxSocialState: createDefaultTaxSocialState(head.age, 6),
    referenceDate,
    ...overrides,
  };
}

// 1. 末子の最終学歴（大学 22歳3月 → 2016年4月生なら 2038年3月）
const educationEntry = createEducationExpenseEntry({
  schoolCategory: 'university',
  schoolType: 'national_other',
  startAge: 18,
  startMonth: 4,
  endAge: 22,
  endMonth: 3,
  schoolName: '国立大学',
});
const childEdu = resolveYoungestChildEducationEnd(
  [head, spouse, child],
  { [child.id]: [educationEntry] },
  referenceDate,
);
assert.ok(childEdu);
assert.equal(childEdu.end.year, 2038);
assert.equal(childEdu.end.month, 3);
assert.match(childEdu.detail, /太郎/);
console.log('OK child education end', childEdu);

// 2. 配偶者の老齢年金開始（38歳・6月生 → 1988年6月生 → 2053年6月）
const spousePension = resolveSpouseOldAgePensionStart(
  [head, spouse, child],
  createDefaultPensionByMember([head, spouse, child]),
  referenceDate,
);
assert.ok(spousePension);
assert.equal(spousePension.end.year, 2053);
assert.equal(spousePension.end.month, 6);
console.log('OK spouse pension start', spousePension);

// 3. 住宅ローン完済（月々返済の終了年月）
const housingLoan = createLoanEntry('housing', {
  name: 'テスト住宅ローン',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 8,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
});
const loanEnd = resolveHousingLoanPayoffEnd(
  [head],
  createDefaultHousingState(head, 6),
  { byMember: { [head.id]: [housingLoan] } },
  referenceDate,
);
assert.ok(loanEnd);
assert.equal(loanEnd.end.year, 2040);
assert.equal(loanEnd.end.month, 3);
console.log('OK housing loan payoff', loanEnd);

// 4. 生活費累計：2026年7月〜2053年6月 = 27年 = 324か月 × 10万 = 3,240万
const spouseOnlyState = {
  ...createDefaultRequiredCoverageState(),
  kind: 'spouse_old_age_pension',
};
const spouseResult = buildRequiredCoverageResult(
  buildInput({ familyMembers: [head, spouse] }),
  spouseOnlyState,
);
assert.ok(spouseResult.coverageEnd);
assert.equal(spouseResult.coverageEnd.year, 2053);
assert.equal(spouseResult.coverageEnd.month, 6);
assert.equal(spouseResult.durationMonths, 324);
assert.equal(spouseResult.expenses.living, 3240);
assert.equal(spouseResult.expenses.total, 3240);
assert.ok(spouseResult.chartPoints.length > 1);
assert.equal(
  spouseResult.chartPoints[0].remainingTotal,
  spouseResult.requiredAmount,
);
assert.equal(
  spouseResult.requiredAmount,
  Math.max(
    0,
    spouseResult.expenses.total +
      spouseResult.income.taxSocial -
      spouseResult.income.total,
  ),
);
assert.equal(spouseResult.yearlyCashFlow.length, spouseResult.chartPoints.length);
assert.ok(spouseResult.minSavingsBalance < 0);
assert.equal(
  spouseResult.requiredAmount,
  Math.abs(spouseResult.minSavingsBalance),
);
console.log('OK living cumulative until spouse pension', spouseResult.expenses);

// 5. 末子学歴のみ：2026年7月〜2038年3月 = 11年9か月 = 141か月 × 10万 = 1,410万
const childOnlyState = {
  ...createDefaultRequiredCoverageState(),
  kind: 'youngest_child_education',
};
const childResult = buildRequiredCoverageResult(
  buildInput({
    educationByMember: { [child.id]: [educationEntry] },
  }),
  childOnlyState,
);
assert.equal(childResult.coverageEnd?.year, 2038);
assert.equal(childResult.coverageEnd?.month, 3);
assert.equal(childResult.durationMonths, 141);
assert.equal(childResult.expenses.living, 1410);
console.log('OK living cumulative until child education', childResult.expenses);

// 6. 期間を直接入力
const customResult = buildRequiredCoverageResult(
  buildInput({ familyMembers: [head, spouse] }),
  {
    ...createDefaultRequiredCoverageState(),
    kind: 'custom',
    customEndYear: 2030,
    customEndMonth: 12,
  },
);
assert.equal(customResult.coverageEnd?.year, 2030);
assert.equal(customResult.coverageEnd?.month, 12);
assert.equal(customResult.durationMonths, 54);
assert.equal(customResult.expenses.living, 540);
console.log('OK custom coverage end', customResult.coverageEnd);

const migratedLegacy = migrateRequiredCoverageState({
  horizons: {
    youngestChildEducation: true,
    spouseOldAgePension: true,
    housingLoanPayoff: false,
  },
});
assert.equal(migratedLegacy.kind, 'spouse_old_age_pension');
assert.equal(migratedLegacy.subject, 'head');
console.log('OK legacy horizons migrate to single kind');

const spouseDiesPension = buildRequiredCoverageResult(
  buildInput({ familyMembers: [head, spouse] }),
  {
    ...createDefaultRequiredCoverageState(),
    subject: 'spouse',
    kind: 'spouse_old_age_pension',
  },
);
assert.equal(spouseDiesPension.coverageEnd?.year, 2051);
assert.equal(spouseDiesPension.coverageEnd?.month, 4);
const survivorPensionRow = spouseDiesPension.horizons.find(
  (row) => row.kind === 'spouse_old_age_pension',
);
assert.ok(survivorPensionRow?.label.includes('世帯主'));
console.log('OK spouse contingency uses head old-age start', spouseDiesPension.coverageEnd);

assert.equal(
  migrateRequiredCoverageState({ kind: 'youngest_child_education' }).simpleDesigns
    .head.living.ratePct,
  100,
);
assert.equal(
  migrateRequiredCoverageState({ kind: 'youngest_child_education' }).detailDesigns
    .head.living.ratePct,
  100,
);
console.log('OK unset designs default to living 100%');
assert.equal(
  migrateRequiredCoverageState({
    kind: 'youngest_child_education',
    designs: {
      head: {
        living: { included: true, ratePct: 64, items: {} },
      },
    },
  }).detailDesigns.head.living.ratePct,
  64,
);
assert.equal(
  migrateRequiredCoverageState({
    kind: 'youngest_child_education',
    designs: {
      head: {
        living: { included: true, ratePct: 64, items: {} },
      },
    },
  }).simpleDesigns.head.living.ratePct,
  100,
);
console.log('OK legacy designs migrate to detail only; simple stays default');

const foodItem = createLivingExpenseItem({
  label: '食費',
  amountMan: 7,
});
const utilityItem = createLivingExpenseItem({
  label: '電気',
  amountMan: 3,
});
const detailLivingState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [
      createLivingExpenseSchedule(40, 6, {
        items: [foodItem, utilityItem],
      }),
    ],
  },
};
const customWindow = {
  kind: 'custom',
  customEndYear: 2030,
  customEndMonth: 12,
};
const living70 = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: { included: true, ratePct: 70, items: {} },
      },
    },
  },
);
assert.equal(living70.baselineExpenses.living, 540);
assert.equal(living70.expenses.living, 378);
assert.equal(living70.chartPoints[0].remainingTotal, 378);
console.log('OK living 70% rate from baseline', living70.expenses.living);

const splitDesignInput = buildInput({
  familyMembers: [head, spouse],
  livingState: detailLivingState,
});
const splitDesignState = {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  simpleDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      living: { included: true, ratePct: 70, items: {} },
    },
  },
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      living: { included: true, ratePct: 50, items: {} },
    },
  },
};
const simpleOnly = buildRequiredCoverageResult(splitDesignInput, splitDesignState, {
  designStage: 'simple',
});
const detailOnly = buildRequiredCoverageResult(splitDesignInput, splitDesignState, {
  designStage: 'detail',
});
assert.equal(simpleOnly.expenses.living, 378);
assert.equal(detailOnly.expenses.living, 270);
console.log('OK simple and detail designs are independent');

let simpleLivingWithTabOverride = {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  simpleDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      living: {
        included: true,
        ratePct: 70,
        items: {
          [coverageLivingTabRateId(HOUSEHOLD_LIVING_KEY)]: { ratePct: 100 },
        },
      },
    },
  },
};
const tabOverrideBlocksCategory = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  simpleLivingWithTabOverride,
  { designStage: 'simple' },
);
assert.equal(tabOverrideBlocksCategory.expenses.living, 540);
simpleLivingWithTabOverride = patchCoverageLivingRateFromSimpleDesign(
  simpleLivingWithTabOverride,
  'head',
  50,
);
const simpleLivingPatched = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  simpleLivingWithTabOverride,
  { designStage: 'simple' },
);
assert.equal(simpleLivingPatched.expenses.living, 270);
const simpleLivingExpenseBase = calcDeathTimingCoverageRow({
  remainingExpenseTotal:
    simpleLivingPatched.chartPoints[0].remainingExpenseTotal,
  remainingEarned: simpleLivingPatched.chartPoints[0].remainingEarned,
  remainingSurvivorBasic:
    simpleLivingPatched.chartPoints[0].remainingSurvivorBasic,
  remainingChildAllowance:
    simpleLivingPatched.chartPoints[0].remainingChildAllowance,
  initialSavings: simpleLivingPatched.initialSavings,
}).expenseBase;
assert.ok(simpleLivingExpenseBase < tabOverrideBlocksCategory.expenses.living);
assert.equal(
  simpleLivingExpenseBase,
  simpleLivingPatched.chartPoints[0].remainingExpenseTotal,
);
console.log('OK simple living rate clears tab override', simpleLivingPatched.expenses.living);

const livingExcludeUtility = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: {
          included: true,
          ratePct: 100,
          items: {
            [coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '電気')]: {
              included: false,
            },
          },
        },
      },
    },
  },
);
assert.equal(livingExcludeUtility.expenses.living, 378);
console.log('OK exclude utility living item', livingExcludeUtility.expenses.living);

const livingFoodRate = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: {
          included: true,
          ratePct: 100,
          items: {
            [coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')]: {
              ratePct: 50,
            },
          },
        },
      },
    },
  },
);
assert.equal(livingFoodRate.expenses.living, 351);
console.log('OK living item rate overlay', livingFoodRate.expenses.living);

let livingFoodThenTab = {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      living: {
        included: true,
        ratePct: 100,
        items: {
          [coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')]: {
            ratePct: 50,
          },
        },
      },
    },
  },
};
const foodHalfBeforeTabReset = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  livingFoodThenTab,
);
assert.equal(foodHalfBeforeTabReset.expenses.living, 351);
livingFoodThenTab = patchCoverageTabRate(
  livingFoodThenTab,
  'head',
  'living',
  coverageLivingTabRateId(HOUSEHOLD_LIVING_KEY),
  100,
  [
    coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費'),
    coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '電気'),
  ],
);
const foodResetByTab = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  livingFoodThenTab,
);
assert.equal(foodResetByTab.expenses.living, 540);
console.log('OK tab living rate clears line overrides', foodResetByTab.expenses.living);

let livingFoodThenCategory = {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      living: {
        included: true,
        ratePct: 70,
        items: {
          [coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')]: {
            ratePct: 50,
          },
        },
      },
    },
  },
};
livingFoodThenCategory = patchCoverageCategoryRate(
  livingFoodThenCategory,
  'head',
  'living',
  100,
);
const foodResetByCategory = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  livingFoodThenCategory,
);
assert.equal(foodResetByCategory.expenses.living, 540);
console.log(
  'OK category living rate clears line overrides',
  foodResetByCategory.expenses.living,
);

const householdFood = createLivingExpenseItem({
  label: '食費',
  amountMan: 4,
});
const headFood = createLivingExpenseItem({
  label: '食費',
  amountMan: 3,
});
const splitFoodState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [
      createLivingExpenseSchedule(40, 6, { items: [householdFood] }),
    ],
    [head.id]: [createLivingExpenseSchedule(40, 6, { items: [headFood] })],
  },
};
const livingSplitFood = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: splitFoodState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: {
          included: true,
          ratePct: 100,
          items: {
            [coverageLivingLineId(head.id, '食費')]: { included: false },
          },
        },
      },
    },
  },
);
assert.equal(livingSplitFood.baselineExpenses.living, 378);
assert.equal(livingSplitFood.expenses.living, 216);
console.log('OK living items stay separate across tabs', livingSplitFood.expenses.living);

const splitCatalog = listCoverageDesignCatalog(
  buildInput({
    familyMembers: [head, spouse],
    livingState: splitFoodState,
  }),
);
const splitLivingLines =
  splitCatalog.find((row) => row.kind === 'living')?.lines ?? [];
assert.equal(splitLivingLines.length, 2);
assert.deepEqual(
  splitLivingLines.map((line) => line.targetId),
  [HOUSEHOLD_LIVING_KEY, head.id],
);
console.log('OK living catalog keeps household and head as separate tabs');

const livingTabRate = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: splitFoodState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: {
          included: true,
          ratePct: 100,
          items: {
            [coverageLivingTabRateId(HOUSEHOLD_LIVING_KEY)]: { ratePct: 50 },
          },
        },
      },
    },
  },
);
assert.equal(livingTabRate.baselineExpenses.living, 378);
assert.equal(livingTabRate.expenses.living, 270);
console.log('OK household tab rate does not change head living', livingTabRate.expenses.living);

const period1Food = createLivingExpenseItem({
  label: '食費',
  amountMan: 4,
});
const period2Food = createLivingExpenseItem({
  label: '食費',
  amountMan: 6,
});
const twoPeriodLiving = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [
      createLivingExpenseSchedule(40, 6, {
        endMode: 'until',
        endAge: 42,
        endMonth: 6,
        items: [period1Food],
      }),
      createLivingExpenseSchedule(40, 6, {
        startAge: 42,
        startMonth: 7,
        items: [period2Food],
      }),
    ],
  },
};
const twoPeriodInput = buildInput({
  familyMembers: [head, spouse],
  livingState: twoPeriodLiving,
});
const twoPeriodCatalog = listCoverageDesignCatalog(twoPeriodInput);
const twoPeriodLines =
  twoPeriodCatalog.find((row) => row.kind === 'living')?.lines ?? [];
assert.equal(twoPeriodLines.length, 1);
assert.equal(twoPeriodLines[0]?.label, '食費');
assert.equal(twoPeriodLines[0]?.id, coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費'));
const twoPeriodResult = buildRequiredCoverageResult(twoPeriodInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
});
assert.equal(
  twoPeriodResult.baselineExpenses.livingByItem[
    coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')
  ],
  twoPeriodResult.baselineExpenses.living,
);
assert.ok(twoPeriodResult.baselineExpenses.living > 0);
console.log(
  'OK multiple living schedules merge into one coverage-period total',
  twoPeriodResult.baselineExpenses.living,
);

const bulkAfterHorizon = createLivingExpenseSchedule(40, 6, {
  startAge: 50,
  startMonth: 1,
  inputMode: 'simple',
  simpleMonthlyExpenseMan: 20,
  simpleIncreaseRate: null,
});
const detailPlusBulkState = {
  byTarget: {
    [HOUSEHOLD_LIVING_KEY]: [
      createLivingExpenseSchedule(40, 6, {
        endMode: 'until',
        endAge: 45,
        endMonth: 12,
        items: [foodItem, utilityItem],
      }),
      bulkAfterHorizon,
    ],
  },
};
const detailPlusBulkInput = buildInput({
  familyMembers: [head, spouse],
  livingState: detailPlusBulkState,
});
const detailPlusBulkResult = buildRequiredCoverageResult(detailPlusBulkInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
});
const detailPlusBulkCatalog = listCoverageDesignCatalog(detailPlusBulkInput);
const detailPlusBulkLiving =
  detailPlusBulkCatalog.find((row) => row.kind === 'living')?.lines ?? [];
assert.ok(
  detailPlusBulkLiving.some((line) => line.label === '生活費'),
  'catalog still lists bulk 生活費 before horizon filter',
);
const visibleLiving = filterCoverageLivingLines(
  detailPlusBulkLiving,
  detailPlusBulkResult.baselineExpenses.livingByItem,
);
assert.equal(
  visibleLiving.some((line) => line.label === '生活費'),
  false,
);
assert.deepEqual(
  visibleLiving.map((line) => line.label).sort(),
  ['食費', '電気'].sort(),
);
assert.equal(
  detailPlusBulkResult.baselineExpenses.livingByItem[
    coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '生活費')
  ],
  undefined,
);
console.log('OK out-of-horizon bulk living is hidden from coverage 内訳');

const migratedLivingItems = migrateRequiredCoverageState({
  designs: {
    head: {
      living: {
        included: true,
        ratePct: 80,
        items: {
          'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee': { included: false },
          食費: { amountMan: 5 },
          [coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')]: {
            included: false,
            ratePct: 50,
          },
        },
      },
    },
  },
});
assert.equal(migratedLivingItems.detailDesigns.head.living.ratePct, 80);
assert.equal(migratedLivingItems.detailDesigns.head.living.items['食費'], undefined);
assert.equal(
  migratedLivingItems.detailDesigns.head.living.items[
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  ],
  undefined,
);
assert.equal(
  migratedLivingItems.detailDesigns.head.living.items[
    coverageLivingLineId(HOUSEHOLD_LIVING_KEY, '食費')
  ]?.ratePct,
  50,
);
console.log('OK living item ids discarded; target+label keys kept');

const bike = createVehicleEntry(head, referenceDate, {
  type: 'bicycle',
  label: '自転車',
  paymentMode: 'alreadyOwned',
  monthlyCostMan: 1,
  purchaseAmountMan: 0,
});
const vehicleInput = buildInput({
  familyMembers: [head, spouse],
  vehicleState: { byMember: { [head.id]: [bike] } },
});
const vehicleIncluded = buildRequiredCoverageResult(vehicleInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
});
assert.ok(vehicleIncluded.expenses.vehicle > 0);
const vehicleExcluded = buildRequiredCoverageResult(vehicleInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      vehicle: {
        included: true,
        ratePct: 100,
        items: { [bike.id]: { included: false } },
      },
    },
  },
});
assert.equal(vehicleExcluded.expenses.vehicle, 0);
console.log('OK exclude vehicle from coverage', vehicleExcluded.expenses.vehicle);

const vehicleHalf = buildRequiredCoverageResult(vehicleInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      vehicle: {
        included: true,
        ratePct: 100,
        items: { [bike.id]: { ratePct: 50 } },
      },
    },
  },
});
assert.equal(
  vehicleHalf.expenses.vehicle,
  Math.round(vehicleIncluded.baselineExpenses.vehicle * 0.5),
);
assert.equal(
  vehicleHalf.baselineExpenses.byItem[bike.id],
  vehicleIncluded.baselineExpenses.vehicle,
);
console.log('OK vehicle line rate overlay', vehicleHalf.expenses.vehicle);

const spouseBike = createVehicleEntry(spouse, referenceDate, {
  type: 'bicycle',
  label: '配偶者の自転車',
  paymentMode: 'alreadyOwned',
  monthlyCostMan: 2,
  purchaseAmountMan: 0,
});
const splitVehicleInput = buildInput({
  familyMembers: [head, spouse],
  vehicleState: {
    byMember: { [head.id]: [bike], [spouse.id]: [spouseBike] },
  },
});
const splitVehicleCatalog = listCoverageDesignCatalog(splitVehicleInput);
const splitVehicleLines =
  splitVehicleCatalog.find((row) => row.kind === 'vehicle')?.lines ?? [];
assert.deepEqual(
  splitVehicleLines.map((line) => line.targetId),
  [head.id, spouse.id],
);
const splitVehicleResult = buildRequiredCoverageResult(splitVehicleInput, {
  ...createDefaultRequiredCoverageState(),
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    head: {
      ...createDefaultExpenseDesigns(),
      vehicle: {
        included: true,
        ratePct: 100,
        items: {
          [coverageLivingTabRateId(head.id)]: { ratePct: 50 },
        },
      },
    },
  },
});
assert.ok(
  splitVehicleResult.expenses.byItem[bike.id] <
    splitVehicleResult.baselineExpenses.byItem[bike.id],
);
assert.equal(
  splitVehicleResult.expenses.byItem[spouseBike.id],
  splitVehicleResult.baselineExpenses.byItem[spouseBike.id],
);
console.log('OK vehicle tab rate applies only to that member');

const spouseKeepsFullLiving = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    livingState: detailLivingState,
  }),
  {
    ...createDefaultRequiredCoverageState(),
    subject: 'spouse',
    ...customWindow,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: { included: true, ratePct: 70, items: {} },
      },
      spouse: {
        ...createDefaultExpenseDesigns(),
        living: { included: true, ratePct: 100, items: {} },
      },
    },
  },
);
assert.equal(spouseKeepsFullLiving.expenses.living, 540);
console.log('OK spouse design independent of head rate');

function linkedLoan(entry, contractorRole) {
  return {
    entry,
    contractorLabel: contractorRole,
    contractorRole,
  };
}

const soleGeneral = createLoanEntry('housing', {
  structureType: 'sole',
});
assert.equal(
  isHousingLoanPaidByGroupCreditLife(soleGeneral, 'head', 'head'),
  true,
);
assert.equal(
  isHousingLoanPaidByGroupCreditLife(soleGeneral, 'head', 'spouse'),
  false,
);

const jointCouple = createLoanEntry('housing', {
  structureType: 'joint_debt',
});
jointCouple.settings.groupCreditLifePlan = 'couple_joint';
assert.equal(
  isHousingLoanPaidByGroupCreditLife(jointCouple, 'head', 'spouse'),
  true,
);

const jointPrimary = createLoanEntry('housing', {
  structureType: 'joint_debt',
});
jointPrimary.settings.groupCreditLifePlan = 'primary_general';
assert.equal(
  isHousingLoanPaidByGroupCreditLife(jointPrimary, 'head', 'spouse'),
  false,
);

const pairHeadLoan = createLoanEntry('housing', {
  structureType: 'pair',
  pairGroupId: 'pair-1',
});
const pairSpouseLoan = createLoanEntry('housing', {
  structureType: 'pair',
  pairGroupId: 'pair-1',
});
assert.equal(
  resolveOwnedPropertyCreditLifeKind(
    [linkedLoan(pairHeadLoan, 'head'), linkedLoan(pairSpouseLoan, 'spouse')],
    'head',
  ),
  'partial',
);
assert.match(
  formatOwnedPropertyCreditLifeHint(
    'partial',
    'head',
    [head, spouse],
    [linkedLoan(pairHeadLoan, 'head'), linkedLoan(pairSpouseLoan, 'spouse')],
  ),
  /ペアローン/,
);
assert.equal(
  formatOwnedPropertyCreditLifeHint('no_loan', 'head', [head, spouse]),
  '団信なし',
);
assert.equal(
  formatOwnedPropertyCreditLifeHint('covered', 'head', [head, spouse]),
  '団信でローン消滅',
);
assert.equal(isOwnedHousingLoanInForce({ usage: 'current' }), true);
assert.equal(isOwnedHousingLoanInForce({ usage: 'upcoming' }), false);
assert.equal(isHousingLoanCoverageLockedOff(true, true), true);
assert.equal(isHousingLoanCoverageLockedOff(true, false), false);
assert.equal(
  housingLoanCoverageDesignedFactor({
    paidByCreditLife: true,
    propertyInForce: true,
    lineFactor: 1,
  }),
  0,
);
assert.equal(
  housingLoanCoverageDesignedFactor({
    paidByCreditLife: true,
    propertyInForce: false,
    lineFactor: 1,
  }),
  1,
);
console.log('OK credit-life coverage from loan structure');

const upcomingHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'home-1',
  name: '新居',
  usage: 'current',
  startAge: 30,
  startMonth: 4,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
});
const housingLinkedLoan = createLoanEntry('housing', {
  name: '新居ローン',
  structureType: 'sole',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 8,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: upcomingHome.id,
  },
});
const housingInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [upcomingHome] },
    },
  },
  loanState: { byMember: { [head.id]: [housingLinkedLoan] } },
});
const housingCatalogHead = listCoverageDesignCatalog(housingInput, 'head');
const ownedLoanLineHead = housingCatalogHead
  .find((category) => category.kind === 'housing')
  ?.lines.find((line) => line.id === housingLinkedLoan.id);
assert.equal(ownedLoanLineHead?.group, '所有');
assert.equal(ownedLoanLineHead?.assumptionHint, undefined);
assert.equal(ownedLoanLineHead?.includeLockedOff, true);
assert.equal(ownedLoanLineHead?.creditLifePaysOff, true);
assert.equal(ownedLoanLineHead?.ownerLabel, '世帯主さん');
const housingCatalogSpouse = listCoverageDesignCatalog(housingInput, 'spouse');
const ownedLoanLineSpouse = housingCatalogSpouse
  .find((category) => category.kind === 'housing')
  ?.lines.find((line) => line.id === housingLinkedLoan.id);
assert.equal(ownedLoanLineSpouse?.assumptionHint, '団信対象外');

const housingHeadResult = buildRequiredCoverageResult(housingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  ...customWindow,
});
const housingSpouseResult = buildRequiredCoverageResult(housingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
});
assert.equal(housingHeadResult.expenses.byItem[housingLinkedLoan.id] ?? 0, 0);
assert.ok(
  (housingHeadResult.baselineExpenses.byItem[housingLinkedLoan.id] ?? 0) > 0,
);
const headYearHousing = housingHeadResult.yearlyCashFlow.reduce(
  (sum, row) => sum + row.housing,
  0,
);
const spouseYearHousing = housingSpouseResult.yearlyCashFlow.reduce(
  (sum, row) => sum + row.housing,
  0,
);
assert.ok(
  spouseYearHousing > headYearHousing,
  'in-force 団信 should drop deceased repayments from yearly housing cash',
);
assert.equal(
  housingSpouseResult.expenses.byItem[housingLinkedLoan.id],
  housingSpouseResult.baselineExpenses.byItem[housingLinkedLoan.id],
);
assert.ok(
  housingHeadResult.expenses.housing <= housingHeadResult.baselineExpenses.housing,
);
console.log('OK owned housing credit-life applied to designed amount');

const futureHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'future-home',
  name: '将来の家',
  usage: 'upcoming',
  startAge: 42,
  startMonth: 4,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
});
const futureLoan = createLoanEntry('housing', {
  name: '将来の家ローン',
  structureType: 'sole',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 8,
  repaymentStartYear: 2028,
  repaymentStartMonth: 4,
  repaymentEndYear: 2048,
  repaymentEndMonth: 3,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: futureHome.id,
  },
});
const futureInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [futureHome] },
    },
  },
  loanState: { byMember: { [head.id]: [futureLoan] } },
});
const futureCatalog = listCoverageDesignCatalog(futureInput, 'head');
const futureLoanLine = futureCatalog
  .find((category) => category.kind === 'housing')
  ?.lines.find((line) => line.id === futureLoan.id);
assert.equal(futureLoanLine?.includeLockedOff, false);
assert.equal(futureLoanLine?.creditLifePaysOff, true);
assert.equal(futureLoanLine?.assumptionHint, undefined);
const futureHeadResult = buildRequiredCoverageResult(futureInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  ...customWindow,
});
assert.equal(
  futureHeadResult.expenses.byItem[futureLoan.id],
  futureHeadResult.baselineExpenses.byItem[futureLoan.id],
);
assert.ok((futureHeadResult.baselineExpenses.byItem[futureLoan.id] ?? 0) > 0);
console.log('OK upcoming housing loan stays in coverage by default');

const pairHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'pair-home',
  name: 'ペア宅',
  usage: 'current',
  startAge: 30,
  startMonth: 4,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
});
const pairLink = {
  targetId: HOUSEHOLD_HOUSING_KEY,
  propertyId: pairHome.id,
};
const pairGroupId = 'pair-group-1';
const pairHomeHeadLoan = createLoanEntry('housing', {
  name: 'ペア宅ローン（夫）',
  structureType: 'pair',
  pairGroupId,
  pairSharePct: 50,
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
  housingLink: pairLink,
});
const pairHomeSpouseLoan = createLoanEntry('housing', {
  name: 'ペア宅ローン（妻）',
  structureType: 'pair',
  pairGroupId,
  pairSharePct: 50,
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
  housingLink: pairLink,
});
const pairInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [pairHome] },
    },
  },
  loanState: {
    byMember: {
      [head.id]: [pairHomeHeadLoan],
      [spouse.id]: [pairHomeSpouseLoan],
    },
  },
});
const pairHeadResult = buildRequiredCoverageResult(pairInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  ...customWindow,
});
assert.equal(pairHeadResult.expenses.byItem[pairHomeHeadLoan.id] ?? 0, 0);
assert.equal(
  pairHeadResult.expenses.byItem[pairHomeSpouseLoan.id],
  pairHeadResult.baselineExpenses.byItem[pairHomeSpouseLoan.id],
);
assert.ok(
  pairHeadResult.expenses.housing < pairHeadResult.baselineExpenses.housing,
);
assert.ok(
  pairHeadResult.baselineExpenses.byItem[pairHomeHeadLoan.id] > 0,
);
assert.ok(
  pairHeadResult.baselineExpenses.byItem[pairHomeSpouseLoan.id] > 0,
);
console.log('OK pair loan coverage keeps only survivor share');

const futurePairHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'future-pair-home',
  name: '5年後の家',
  usage: 'upcoming',
  startAge: 45,
  startMonth: 4,
  buildingMan: 3000,
  landMan: 2000,
  brokerageFeeMan: 0,
  registrationFeeMan: 0,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
});
const futurePairLink = {
  targetId: HOUSEHOLD_HOUSING_KEY,
  propertyId: futurePairHome.id,
};
const futurePairSettings = createOwnedPropertyLoanSettings({
  includeBrokerageFeeInLoan: false,
  includeRegistrationFeeInLoan: false,
  financingFeeMan: 0,
  guaranteeFeeMan: 0,
  administrativeFeeMan: 0,
  bankFeePaymentTiming: 'initial',
  years: 35,
});
const futurePairGroupId = 'future-pair-1';
const futurePairHeadLoan = createLoanEntry('housing', {
  name: '5年後ローン（夫）',
  structureType: 'pair',
  pairGroupId: futurePairGroupId,
  pairSharePct: 50,
  settings: futurePairSettings,
  housingLink: futurePairLink,
});
const futurePairSpouseLoan = createLoanEntry('housing', {
  name: '5年後ローン（妻）',
  structureType: 'pair',
  pairGroupId: futurePairGroupId,
  pairSharePct: 50,
  settings: futurePairSettings,
  housingLink: futurePairLink,
});
const futurePairInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [futurePairHome] },
    },
  },
  loanState: {
    byMember: {
      [head.id]: [futurePairHeadLoan],
      [spouse.id]: [futurePairSpouseLoan],
    },
  },
});
const futurePairCovered = buildRequiredCoverageResult(futurePairInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  kind: 'custom',
  customEndYear: 2045,
  customEndMonth: 12,
});
assert.equal(
  futurePairCovered.baselineExpenses.byItem[futurePairHeadLoan.id],
  2500,
);
assert.equal(
  futurePairCovered.baselineExpenses.byItem[futurePairSpouseLoan.id],
  2500,
);
assert.equal(futurePairCovered.expenses.byItem[futurePairHeadLoan.id], 2500);
assert.equal(futurePairCovered.expenses.byItem[futurePairSpouseLoan.id], 2500);
assert.ok(
  futurePairCovered.yearlyCashFlow[0].expense < 2500,
  'yearly cash flow must not treat remaining principal as year-1 lump repayment',
);
console.log('OK upcoming pair loan uses full principal before origination');

const futurePairBeforePurchase = buildRequiredCoverageResult(futurePairInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  kind: 'custom',
  customEndYear: 2030,
  customEndMonth: 12,
});
assert.equal(
  futurePairBeforePurchase.baselineExpenses.byItem[futurePairHeadLoan.id] ?? 0,
  0,
);
assert.equal(
  futurePairBeforePurchase.baselineExpenses.byItem[futurePairSpouseLoan.id] ?? 0,
  0,
);
console.log('OK loan after coverage horizon is excluded');

const currentPairHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'current-pair-home',
  name: '居住中ペア宅',
  usage: 'current',
  startAge: 30,
  startMonth: 4,
  buildingMan: 3000,
  landMan: 2000,
  brokerageFeeMan: 0,
  registrationFeeMan: 0,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
});
const currentPairLink = {
  targetId: HOUSEHOLD_HOUSING_KEY,
  propertyId: currentPairHome.id,
};
const currentPairHeadLoan = createLoanEntry('housing', {
  name: '居住中ローン（夫）',
  structureType: 'pair',
  pairGroupId: 'current-pair-1',
  pairSharePct: 50,
  settings: futurePairSettings,
  housingLink: currentPairLink,
});
const currentPairSpouseLoan = createLoanEntry('housing', {
  name: '居住中ローン（妻）',
  structureType: 'pair',
  pairGroupId: 'current-pair-1',
  pairSharePct: 50,
  settings: futurePairSettings,
  housingLink: currentPairLink,
});
const currentPairInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [currentPairHome] },
    },
  },
  loanState: {
    byMember: {
      [head.id]: [currentPairHeadLoan],
      [spouse.id]: [currentPairSpouseLoan],
    },
  },
});
const currentPairHeadResult = buildRequiredCoverageResult(currentPairInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'head',
  kind: 'custom',
  customEndYear: 2045,
  customEndMonth: 12,
});
assert.equal(currentPairHeadResult.expenses.byItem[currentPairHeadLoan.id] ?? 0, 0);
assert.ok(
  currentPairHeadResult.expenses.byItem[currentPairSpouseLoan.id] < 2500,
);
assert.ok(
  currentPairHeadResult.expenses.byItem[currentPairSpouseLoan.id] > 0,
);
assert.equal(
  currentPairHeadResult.expenses.byItem[currentPairSpouseLoan.id],
  currentPairHeadResult.baselineExpenses.byItem[currentPairSpouseLoan.id],
);
console.log('OK in-force pair loan uses remaining principal without interest');

const holdingHome = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'holding-home',
  name: '維持費宅',
  usage: 'current',
  startAge: 30,
  startMonth: 4,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
  maintenance: createOwnedPropertyMaintenance(2026, 6, {
    managementFees: [createOwnedMonthlyFeeEntry({ amountManPerMonth: 2 })],
    landTaxes: [
      createOwnedAnnualTaxEntry({
        startYear: 2016,
        fixedAssetTaxMan: 12,
      }),
    ],
  }),
});
const holdingLoan = createLoanEntry('housing', {
  name: '維持費宅ローン',
  structureType: 'sole',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: holdingHome.id,
  },
});
const holdingInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [holdingHome] },
    },
  },
  loanState: { byMember: { [head.id]: [holdingLoan] } },
});
const holdingResult = buildRequiredCoverageResult(holdingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
});
const holdingId = coverageOwnedHoldingLineId(holdingHome.id);
const holdingParts = listHousingHoldingCoverageParts(
  holdingResult.baselineExpenses.holdingDetailByItem[holdingId],
);
assert.ok(
  holdingParts.some((part) => part.key === 'managementFee' && part.amount > 0),
);
assert.ok(
  holdingParts.some(
    (part) => part.key === 'tax.fixedAsset' && part.amount > 0,
  ),
);
assert.equal(
  holdingParts.reduce((sum, part) => sum + part.amount, 0),
  holdingResult.baselineExpenses.byItem[holdingId],
);
console.log('OK housing holding breakdown lists maintenance and tax');

const managementPartId = coverageOwnedHoldingPartLineId(
  holdingId,
  'managementFee',
);
const holdingHalfMgmt = buildRequiredCoverageResult(holdingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    spouse: {
      ...createDefaultExpenseDesigns(),
      housing: {
        included: true,
        ratePct: 100,
        items: { [managementPartId]: { ratePct: 50 } },
      },
    },
  },
});
const baselineMgmt = listHousingHoldingCoverageParts(
  holdingHalfMgmt.baselineExpenses.holdingDetailByItem[holdingId],
).find((part) => part.key === 'managementFee');
const designedMgmt = listHousingHoldingCoverageParts(
  holdingHalfMgmt.expenses.holdingDetailByItem[holdingId],
).find((part) => part.key === 'managementFee');
assert.ok(baselineMgmt && baselineMgmt.amount > 0);
assert.equal(designedMgmt?.amount, Math.round(baselineMgmt.amount * 0.5));
const baselineTax = listHousingHoldingCoverageParts(
  holdingHalfMgmt.baselineExpenses.holdingDetailByItem[holdingId],
).find((part) => part.key === 'tax.fixedAsset');
const designedTax = listHousingHoldingCoverageParts(
  holdingHalfMgmt.expenses.holdingDetailByItem[holdingId],
).find((part) => part.key === 'tax.fixedAsset');
assert.equal(designedTax?.amount, baselineTax?.amount);
console.log('OK housing holding part rate applies only to that item');

const rentalOnly = createRentalProperty(head, 6, 2026, {
  id: 'rent-1',
  name: '賃貸',
  monthlyRentMan: 10,
});
const ownedForSplit = createOwnedProperty('detached_house', head, 6, 2026, {
  id: 'owned-split',
  name: '持ち家',
  usage: 'current',
  startAge: 30,
  startMonth: 4,
  paymentMethod: 'loan',
  currentExpenseMode: 'analysis',
  maintenance: createOwnedPropertyMaintenance(2026, 6, {
    managementFees: [createOwnedMonthlyFeeEntry({ amountManPerMonth: 3 })],
  }),
});
const ownedSplitLoan = createLoanEntry('housing', {
  name: '持ち家ローン',
  structureType: 'sole',
  paymentMode: 'monthlyRepayment',
  monthlyRepaymentMan: 5,
  repaymentStartYear: 2026,
  repaymentStartMonth: 7,
  repaymentEndYear: 2040,
  repaymentEndMonth: 3,
  housingLink: {
    targetId: HOUSEHOLD_HOUSING_KEY,
    propertyId: ownedForSplit.id,
  },
});
const splitHousingInput = buildInput({
  familyMembers: [head, spouse],
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: {
        rentals: [rentalOnly],
        owned: [ownedForSplit],
      },
    },
  },
  loanState: { byMember: { [head.id]: [ownedSplitLoan] } },
});
const rentalTabId = coverageTabRateId(HOUSEHOLD_HOUSING_KEY, '賃貸');
const ownedHoldingId = coverageOwnedHoldingLineId(ownedForSplit.id);
const splitHousingBase = buildRequiredCoverageResult(splitHousingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
});
const splitHousingRental50 = buildRequiredCoverageResult(splitHousingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    spouse: {
      ...createDefaultExpenseDesigns(),
      housing: {
        included: true,
        ratePct: 100,
        items: { [rentalTabId]: { ratePct: 50 } },
      },
    },
  },
});
assert.equal(
  splitHousingRental50.expenses.byItem[rentalOnly.id],
  Math.round((splitHousingBase.baselineExpenses.byItem[rentalOnly.id] ?? 0) * 0.5),
);
assert.equal(
  splitHousingRental50.expenses.byItem[ownedHoldingId],
  splitHousingBase.expenses.byItem[ownedHoldingId],
);
console.log('OK rental tab rate does not change owned housing');

const splitHousingRentalLine50 = buildRequiredCoverageResult(splitHousingInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...customWindow,
  detailDesigns: {
    ...createDefaultCoverageDesigns(),
    spouse: {
      ...createDefaultExpenseDesigns(),
      housing: {
        included: true,
        ratePct: 100,
        items: {
          [rentalTabId]: { ratePct: 80 },
          [rentalOnly.id]: { ratePct: 50 },
        },
      },
    },
  },
});
assert.equal(
  splitHousingRentalLine50.expenses.byItem[rentalOnly.id],
  Math.round((splitHousingBase.baselineExpenses.byItem[rentalOnly.id] ?? 0) * 0.5),
);
assert.equal(
  splitHousingRentalLine50.expenses.byItem[ownedHoldingId],
  splitHousingBase.expenses.byItem[ownedHoldingId],
);
console.log('OK rental line rate overrides tab like living items');

const shortWindow = {
  kind: 'custom',
  customEndYear: 2026,
  customEndMonth: 12,
};
const spousePartTime = createIncomeEntry(spouse.id, 'part_time', 38, 6, spouse);
spousePartTime.periods[0].monthlyAmountMan = 10;
const headEmployee = createIncomeEntry(head.id, 'employee', 40, 6, head);
headEmployee.periods[0].monthlyAmountMan = 50;
const incomeInput = buildInput({
  familyMembers: [head, spouse],
  incomeByMember: {
    [head.id]: [headEmployee],
    [spouse.id]: [spousePartTime],
  },
});

const keepWork = buildRequiredCoverageResult(incomeInput, {
  ...createDefaultRequiredCoverageState(),
  ...shortWindow,
});
assert.equal(keepWork.durationMonths, 6);
assert.equal(keepWork.income.earnedGross, 60);
assert.ok(keepWork.income.taxSocial > 0);
assert.equal(
  keepWork.income.earned,
  keepWork.income.earnedGross,
);
assert.ok(keepWork.income.survivorEmployeesGross > 0);
assert.equal(keepWork.income.total, sumCoverageIncomeParts(keepWork.income));
assert.equal(
  keepWork.requiredAmount,
  Math.max(0, keepWork.expenses.total + keepWork.income.taxSocial - keepWork.income.total),
);
assert.equal(keepWork.chartPoints[0].remainingTotal, keepWork.requiredAmount);
assert.equal(keepWork.chartPoints[0].remainingIncome, keepWork.income.total);
assert.equal(
  keepWork.chartPoints[0].remainingTaxSocial,
  keepWork.income.taxSocial,
);
console.log('OK keep work uses gross income and tax as expense like cash flow');

const stopWork = buildRequiredCoverageResult(incomeInput, {
  ...createDefaultRequiredCoverageState(),
  ...shortWindow,
  workDesigns: {
    ...createDefaultWorkDesigns(),
    head: {
      [spouse.id]: { mode: 'stop', entries: [] },
    },
  },
});
assert.equal(stopWork.income.earnedGross, 0);
assert.ok(stopWork.income.survivorEmployeesGross > 0);
assert.equal(stopWork.income.total, sumCoverageIncomeParts(stopWork.income));
assert.equal(
  stopWork.requiredAmount,
  Math.max(0, stopWork.expenses.total + stopWork.income.taxSocial - stopWork.income.total),
);
console.log('OK stop work zeros survivor earned income and keeps tax/social');

const redesigned = createCoverageWorkIncomeEntry(
  spouse,
  { category: 'employee' },
  keepWork.coverageStart,
  referenceDate,
);
redesigned.periods[0].monthlyAmountMan = 40;
redesigned.periods[0].bonuses = [];
const changeWork = buildRequiredCoverageResult(incomeInput, {
  ...createDefaultRequiredCoverageState(),
  ...shortWindow,
  workDesigns: {
    ...createDefaultWorkDesigns(),
    head: {
      [spouse.id]: { mode: 'redesign', entries: [redesigned] },
    },
  },
});
assert.equal(changeWork.income.earnedGross, 240);
assert.equal(changeWork.income.total, sumCoverageIncomeParts(changeWork.income));
assert.equal(
  changeWork.requiredAmount,
  Math.max(0, changeWork.expenses.total + changeWork.income.taxSocial - changeWork.income.total),
);
console.log('OK redesign replaces part-time with employee income');

const spouseDiesKeep = buildRequiredCoverageResult(incomeInput, {
  ...createDefaultRequiredCoverageState(),
  subject: 'spouse',
  ...shortWindow,
});
assert.equal(spouseDiesKeep.income.earnedGross, 300);
assert.equal(spouseDiesKeep.income.survivorEmployees, 0);
assert.equal(spouseDiesKeep.income.total, sumCoverageIncomeParts(spouseDiesKeep.income));
console.log('OK spouse death keeps head Q7 take-home income');

assert.equal(calcSurvivorBasicYenPerYear(0, true), 0);
assert.equal(
  calcSurvivorBasicYenPerYear(1, true),
  FULL_BASIC_PENSION_YEN_PER_YEAR + SURVIVOR_BASIC_CHILD_ADD_FIRST_TWO_YEN_PER_YEAR,
);
assert.equal(
  calcSurvivorBasicYenPerYear(1, false),
  FULL_BASIC_PENSION_YEN_PER_YEAR,
);
console.log('OK survivor basic yen by child count');

const survivorFamilyInput = buildInput({
  familyMembers: [head, spouse, child],
  incomeByMember: {
    [head.id]: [headEmployee],
    [spouse.id]: [spousePartTime],
  },
});
const survivorBasicResult = buildRequiredCoverageResult(survivorFamilyInput, {
  ...createDefaultRequiredCoverageState(),
  ...shortWindow,
});
const expectedBasicMonthly = calcCoverageSurvivorBasicMonthlyMan(
  [head, spouse, child],
  'head',
  referenceDate,
  2026,
  7,
);
assert.ok(expectedBasicMonthly > 0);
assert.equal(
  survivorBasicResult.income.survivorBasic,
  Math.round(expectedBasicMonthly * 6),
);
assert.ok(survivorBasicResult.income.survivorEmployeesGross > 0);
assert.equal(
  survivorBasicResult.income.survivorEmployees,
  survivorBasicResult.income.survivorEmployeesGross,
);
assert.equal(
  survivorBasicResult.income.total,
  sumCoverageIncomeParts(survivorBasicResult.income),
);
assert.equal(survivorBasicResult.income.eligibleChildCountStart, 1);
assert.ok(
  survivorBasicResult.chartPoints.some((point) => point.yearSurvivorBasic > 0),
);
console.log('OK coverage survivor basic from eligible child');

const noChildBasic = buildRequiredCoverageResult(incomeInput, {
  ...createDefaultRequiredCoverageState(),
  ...shortWindow,
});
assert.equal(noChildBasic.income.survivorBasic, 0);
console.log('OK no eligible child means no survivor basic');

const q8Ignored = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    incomeByMember: {
      [head.id]: [headEmployee],
      [spouse.id]: [spousePartTime],
    },
    pensionByMember: (() => {
      const pension = createDefaultPensionByMember([head, spouse]);
      pension[spouse.id].benefitSettings.survivorBasicPerYear = 1_200_000;
      pension[spouse.id].benefitSettings.survivorEmployeesMutualPerYear = 2_400_000;
      return pension;
    })(),
  }),
  {
    ...createDefaultRequiredCoverageState(),
    ...shortWindow,
  },
);
assert.equal(q8Ignored.income.survivorBasic, 0);
assert.ok(q8Ignored.income.survivorEmployeesGross > 0);
assert.ok(q8Ignored.income.survivorEmployeesGross < 240);
console.log('OK Q8 receiving survivor amounts are not used for coverage');

const migratedWork = migrateRequiredCoverageState({
  kind: 'custom',
  customEndYear: 2030,
  customEndMonth: 12,
});
assert.deepEqual(migratedWork.workDesigns, createDefaultWorkDesigns());
console.log('OK workDesigns migrate to empty keep defaults');

assert.equal(
  createDefaultRequiredCoverageState().kind,
  'survivor_expected_lifespan',
);
const spouseLifespan = resolveMemberExpectedLifespanEnd(spouse, referenceDate);
assert.ok(spouseLifespan);
assert.equal(spouseLifespan.end.year, 2078);
assert.equal(spouseLifespan.end.month, 12);
const defaultHorizon = buildRequiredCoverageResult(
  buildInput({ familyMembers: [head, spouse] }),
  createDefaultRequiredCoverageState(),
);
assert.equal(defaultHorizon.coverageEnd?.year, 2078);
assert.equal(defaultHorizon.coverageEnd?.month, 12);
console.log('OK default horizon is survivor expected lifespan');

const lateIncome = createIncomeEntry(spouse.id, 'part_time', 40, 1, spouse);
lateIncome.periods[0].monthlyAmountMan = 100;
lateIncome.periods[0].bonuses = [];
const troughResult = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    incomeByMember: { [spouse.id]: [lateIncome] },
  }),
  {
    ...createDefaultRequiredCoverageState(),
    kind: 'custom',
    customEndYear: 2028,
    customEndMonth: 12,
  },
);
assert.equal(troughResult.yearlyCashFlow.length, 3);
assert.ok(troughResult.minSavingsBalance < 0);
assert.equal(troughResult.requiredAmount, Math.abs(troughResult.minSavingsBalance));
assert.ok(
  troughResult.requiredAmount >
    Math.max(0, troughResult.expenses.total - troughResult.income.total),
);
const troughYear = troughResult.yearlyCashFlow.reduce((worst, row) =>
  row.savingsBalance < worst.savingsBalance ? row : worst,
);
assert.equal(troughYear.calendarYear, 2027);
console.log('OK required amount uses savings trough not period totals');

const deposit = createSavingsEntry('deposit', spouse, referenceDate, {
  balanceMan: 400,
});
const savingsCover = buildRequiredCoverageResult(
  buildInput({
    familyMembers: [head, spouse],
    savingsState: {
      ...createDefaultSavingsState(),
      byMember: { [spouse.id]: [deposit] },
    },
  }),
  {
    ...createDefaultRequiredCoverageState(),
    kind: 'custom',
    customEndYear: 2030,
    customEndMonth: 12,
    detailDesigns: {
      ...createDefaultCoverageDesigns(),
      head: {
        ...createDefaultExpenseDesigns(),
        living: { included: true, ratePct: 100, items: {} },
      },
    },
  },
);
assert.equal(savingsCover.initialSavings, 400);
assert.equal(savingsCover.initialFinancialAssets, 400);
assert.equal(savingsCover.chartPoints[0].deathTimeDepositMan, 400);
assert.equal(savingsCover.chartPoints[0].deathTimeFinancialAssetsMan, 400);
assert.equal(savingsCover.yearlyCashFlow[0].savingsBalance, 400 - 60);
assert.equal(savingsCover.expenses.living, 540);
assert.equal(savingsCover.requiredAmount, 140);
assert.equal(
  savingsCover.requiredAmount,
  Math.abs(Math.min(0, savingsCover.minSavingsBalance)),
);
console.log('OK initial savings reduce required coverage');

{
  const nisa = createSavingsEntry('nisa_growth', spouse, referenceDate, {
    nisaUtilization: 'active',
    nisaValuationMode: 'gains',
    principalMan: 200,
    gainsMan: 0,
    contributionMode: 'none',
    contributionMan: 0,
  });
  const mixedAssets = buildRequiredCoverageResult(
    buildInput({
      familyMembers: [head, spouse],
      savingsState: {
        ...createDefaultSavingsState(),
        byMember: { [spouse.id]: [deposit, nisa] },
      },
    }),
    {
      ...createDefaultRequiredCoverageState(),
      kind: 'custom',
      customEndYear: 2030,
      customEndMonth: 12,
      detailDesigns: {
        ...createDefaultCoverageDesigns(),
        head: {
          ...createDefaultExpenseDesigns(),
          living: { included: true, ratePct: 100, items: {} },
        },
      },
    },
  );
  assert.equal(mixedAssets.initialSavings, 400);
  assert.equal(mixedAssets.initialFinancialAssets, 600);
  assert.equal(mixedAssets.chartPoints[0].deathTimeDepositMan, 400);
  assert.equal(mixedAssets.chartPoints[0].deathTimeFinancialAssetsMan, 600);
}
{
  const opening = { deposit: 100, financialAssets: 250 };
  const years = [
    { calendarYear: 2026, savings: 110, financialAssets: 270 },
    { calendarYear: 2027, savings: 90, financialAssets: 300 },
  ];
  assert.deepEqual(
    resolveDeathTimeBalancesMan(2026, years, opening),
    opening,
  );
  assert.deepEqual(resolveDeathTimeBalancesMan(2027, years, opening), {
    deposit: 110,
    financialAssets: 270,
  });
  assert.deepEqual(resolveDeathTimeBalancesMan(2028, years, opening), {
    deposit: 90,
    financialAssets: 300,
  });
}
console.log('OK death-time balances use year-start (prior year-end)');

assert.ok(survivorBasicResult.income.childAllowance > 0);
assert.ok(
  survivorBasicResult.yearlyCashFlow.some((row) => row.childAllowance > 0),
);
console.log('OK child allowance is included in coverage income');

{
  const covered = calcDeathTimingCoverageRow({
    remainingExpenseTotal: 9000,
    remainingEarned: 3000,
    remainingSurvivorBasic: 2000,
    remainingChildAllowance: 500,
    initialSavings: 4000,
  });
  assert.equal(covered.preparedTotal, 9500);
  assert.equal(covered.shortfall, 0);
  assert.equal(covered.sufficiencyPct, 106);

  const short = calcDeathTimingCoverageRow({
    remainingExpenseTotal: 9000,
    remainingEarned: 1000,
    remainingSurvivorBasic: 500,
    remainingChildAllowance: 0,
    initialSavings: 2000,
  });
  assert.equal(short.preparedTotal, 3500);
  assert.equal(short.shortfall, 5500);
  assert.equal(short.sufficiencyPct, 39);

  const hiddenIncome = calcDeathTimingCoverageRow({
    remainingExpenseTotal: 9000,
    remainingEarned: 1000,
    remainingSurvivorBasic: 500,
    remainingChildAllowance: 0,
    initialSavings: 2000,
    includeEarned: false,
    includeSurvivor: false,
  });
  assert.equal(hiddenIncome.preparedTotal, 2000);
  assert.equal(hiddenIncome.shortfall, 7000);

  assert.deepEqual(pickDeathTimingMilestoneAges([33, 34, 45, 55, 65, 75, 87]), [
    33, 45, 55, 65, 75, 87,
  ]);
  assert.deepEqual(pickDeathTimingMilestoneAges([50, 51, 55, 65, 80]), [
    50, 55, 65, 80,
  ]);
  console.log('OK death-timing coverage row and milestone ages');
}

{
  const pension = createDefaultPensionByMember([head, spouse]);
  pension[spouse.id].benefitSettings.oldAgeBasic = {
    ...pension[spouse.id].benefitSettings.oldAgeBasic,
    startAge: 65,
    startMonth: 0,
    amountMode: 'manual',
    manualAmountPerYear: 800_000,
  };
  pension[spouse.id].benefitSettings.oldAgeGeneralEmployees = {
    ...pension[spouse.id].benefitSettings.oldAgeGeneralEmployees,
    startAge: 65,
    startMonth: 0,
    amountMode: 'manual',
    manualAmountPerYear: 1_200_000,
  };
  pension[spouse.id].benefitSettings.survivorEmployeesMutualPerYear = 900_000;
  const oldAgeResult = buildRequiredCoverageResult(
    buildInput({
      familyMembers: [head, spouse],
      incomeByMember: {
        [head.id]: [headEmployee],
      },
      pensionByMember: pension,
    }),
    {
      ...createDefaultRequiredCoverageState(),
      kind: 'custom',
      customEndYear: 2055,
      customEndMonth: 12,
    },
  );
  assert.ok(oldAgeResult.income.oldAgeBasicGross > 0);
  assert.ok(oldAgeResult.income.oldAgeBasic > 0);
  assert.ok(oldAgeResult.income.oldAgeBasic === oldAgeResult.income.oldAgeBasicGross);
  assert.ok(oldAgeResult.income.oldAgeEmployeesGross > 0);
  assert.ok(oldAgeResult.income.oldAgeEmployees > 0);
  assert.ok(
    oldAgeResult.income.oldAgeEmployees ===
      oldAgeResult.income.oldAgeEmployeesGross,
  );
  assert.ok(
    oldAgeResult.chartPoints.some((point) => point.yearOldAgeBasic > 0),
  );
  assert.ok(
    oldAgeResult.chartPoints.some((point) => point.yearOldAgeEmployees > 0),
  );

  const expectedPaymentGross = calcCoverageOldAgePaymentGross({
    household: [spouse],
    pension,
    incomeByMember: {},
    start: oldAgeResult.coverageStart,
    end: oldAgeResult.coverageEnd,
    referenceDate,
  });
  assert.equal(oldAgeResult.income.oldAgeBasicGross, expectedPaymentGross.basic);
  assert.equal(
    oldAgeResult.income.oldAgeEmployeesGross,
    expectedPaymentGross.employees,
  );

  const expectedSurvivorEmployeesPaymentGross =
    calcCoverageSurvivorEmployeesPaymentGross({
      familyMembers: [head, spouse],
      subject: 'head',
      pension,
      originalIncomeByMember: { [head.id]: [headEmployee] },
      coverageIncomeByMember: {},
      start: oldAgeResult.coverageStart,
      end: oldAgeResult.coverageEnd,
      referenceDate,
    });
  assert.ok(expectedSurvivorEmployeesPaymentGross.employees > 0);
  assert.equal(
    oldAgeResult.income.survivorEmployeesGross,
    expectedSurvivorEmployeesPaymentGross.employees,
  );
  assert.equal(
    oldAgeResult.income.survivorEmployees,
    oldAgeResult.income.survivorEmployeesGross,
  );
  assertNonNegativeCoverageIncome(oldAgeResult, 'old-age coverage');

  const oddMonthPayment = calcPensionPaymentFromEntitlements(
    7,
    calcMonthlyPensionEntitlementBreakdownMan(
      [spouse],
      pension,
      {},
      referenceDate,
      2055,
      6,
    ),
    calcMonthlyPensionEntitlementBreakdownMan(
      [spouse],
      pension,
      {},
      referenceDate,
      2055,
      5,
    ),
  );
  assert.equal(sumOldAgePension(oddMonthPayment.oldAge), 0);
  console.log('OK surviving spouse old-age basic and employees pension in coverage income');
  console.log('OK coverage old-age pension uses payment schedule not monthly entitlement');
}

{
  const defaultMedical = createDefaultRequiredCoverageState().medicalDesigns.head;
  assert.equal(defaultMedical.hospitalMonthsPerYear, 6);
  assert.equal(defaultMedical.inpatientDays, 28);
  const defaultResult = calcMedicalRiskCoverage({
    ...defaultMedical,
    monthlyIncomeMan: 30,
  });
  assert.equal(defaultResult.incomeBracket, 'C');
  assert.equal(defaultResult.monthlyTotalMedicalCostMan, 9);
  assert.equal(defaultResult.normalMonthlySelfPayMan, 9);
  assert.equal(defaultResult.multipleTimesMonthlySelfPayMan, 4.44);
  assert.equal(defaultResult.annualMedicalSelfPayMan, 40.32);
  assert.equal(defaultResult.inpatientDays, 28);
  assert.ok(defaultResult.extraCosts.totalMan > 0);
  assert.ok(defaultResult.requiredAmountMan > 0);
  console.log('OK medical risk high-cost default scenario', defaultResult);

  const covered = calcMedicalRiskCoverage({
    ...defaultMedical,
    hospitalMonthsPerYear: 0,
    extraBedCostYenPerDay: 0,
    mealCostYenPerDay: 0,
    clothingCostYenPerDay: 0,
    transportCostYenPerDay: 0,
    consumablesCostYenPerDay: 0,
    incomeLossManPerMonth: 0,
    existingBenefitMan: 100,
  });
  assert.equal(covered.annualMedicalSelfPayMan, 0);
  assert.equal(covered.requiredAmountMan, 0);
  console.log('OK medical risk fully covered by benefit', covered);

  const partial = calcMedicalRiskCoverage({
    ...defaultMedical,
    hospitalMonthsPerYear: 0,
    existingBenefitMan: 12,
    extraBedCostYenPerDay: 0,
    mealCostYenPerDay: 0,
    clothingCostYenPerDay: 0,
    transportCostYenPerDay: 0,
    consumablesCostYenPerDay: 0,
    incomeLossManPerMonth: 0,
  });
  assert.equal(partial.requiredAmountMan, 0);
  console.log('OK medical risk extra covered by benefit', partial);

  const migratedMissing = migrateRequiredCoverageState({
    kind: 'youngest_child_education',
  });
  assert.equal(migratedMissing.riskKind, 'death');
  assert.equal(migratedMissing.medicalDesigns.head.hospitalMonthsPerYear, 6);
  assert.equal(migratedMissing.medicalDesigns.head.extraBedCostYenPerDay, 8_000);
  assert.equal(migratedMissing.medicalDesigns.head.mealCostYenPerDay, 1_380);
  assert.equal(migratedMissing.medicalDesigns.head.clothingCostYenPerDay, 500);

  const migratedLegacy = migrateRequiredCoverageState({
    medicalDesigns: {
      head: {
        extraBedCostManPerMonth: 3,
        mealCostManPerMonth: 1.5,
        clothingCostMan: 1,
        existingBenefitMan: 5,
      },
    },
  });
  assert.equal(migratedLegacy.medicalDesigns.head.extraBedCostYenPerDay, 1_000);
  assert.equal(migratedLegacy.medicalDesigns.head.mealCostYenPerDay, 500);
  assert.equal(migratedLegacy.medicalDesigns.head.clothingCostYenPerDay, 500);
  assert.equal(migratedLegacy.medicalDesigns.head.existingBenefitMan, 5);

  const highIncome = calcMedicalRiskCoverage({
    ...defaultMedical,
    monthlyIncomeMan: 83,
  });
  assert.equal(highIncome.incomeBracket, 'A');
  const quoted = calcMedicalRiskCoverage(
    { ...defaultMedical, monthlyIncomeMan: 0 },
    30,
  );
  assert.equal(quoted.incomeBracket, 'C');
  const lowIncome = calcMedicalRiskCoverage({
    ...defaultMedical,
    monthlyIncomeMan: 83,
    isLowIncome: true,
  });
  assert.equal(lowIncome.incomeBracket, 'E');
  console.log('OK medical risk income brackets');

  const migratedMedical = migrateRequiredCoverageState({
    riskKind: 'medical',
    medicalDesigns: {
      head: {
        hospitalMonthsPerYear: 8,
        inpatientMonthsPerYear: 1,
      },
    },
  });
  assert.equal(migratedMedical.riskKind, 'medical');
  assert.equal(migratedMedical.medicalDesigns.head.hospitalMonthsPerYear, 8);
  assert.equal(migratedMedical.medicalDesigns.head.inpatientDays, 30);
  console.log('OK medical risk state migrate');

  const netLossCovered = calcMedicalRiskCoverage({
    ...defaultMedical,
    hospitalMonthsPerYear: 6,
    inpatientDays: 0,
    extraBedCostYenPerDay: 0,
    mealCostYenPerDay: 0,
    clothingCostYenPerDay: 0,
    transportCostYenPerDay: 0,
    consumablesCostYenPerDay: 0,
    incomeLossManPerMonth: 10,
    stoppableExpensesYen: {
      ...defaultMedical.stoppableExpensesYen,
      pocketMoney: 50_000,
      eatingOut: 40_000,
      hobby: 30_000,
    },
    existingBenefitMan: 0,
    monthlyIncomeMan: 30,
  });
  assert.equal(netLossCovered.extraCosts.incomeLossGrossMan, 60);
  assert.equal(netLossCovered.extraCosts.stoppableExpenseMan, 72);
  assert.equal(netLossCovered.extraCosts.incomeLossMan, 0);
  assert.equal(netLossCovered.extraCosts.incidentalMan, 0);

  const netLossPartial = calcMedicalRiskCoverage({
    ...defaultMedical,
    hospitalMonthsPerYear: 6,
    inpatientDays: 0,
    extraBedCostYenPerDay: 0,
    mealCostYenPerDay: 0,
    clothingCostYenPerDay: 0,
    transportCostYenPerDay: 0,
    consumablesCostYenPerDay: 0,
    incomeLossManPerMonth: 10,
    stoppableExpensesYen: {
      ...defaultMedical.stoppableExpensesYen,
      entertainment: 20_000,
      socializing: 20_000,
    },
    existingBenefitMan: 0,
    monthlyIncomeMan: 30,
  });
  assert.equal(netLossPartial.extraCosts.incomeLossMan, 36);
  assert.equal(
    migratedMissing.medicalDesigns.head.stoppableExpensesYen.other,
    0,
  );

  const migratedLegacyStoppable = migrateRequiredCoverageState({
    medicalDesigns: {
      head: {
        stoppableExpenseManPerMonth: 3.5,
      },
    },
  });
  assert.equal(
    migratedLegacyStoppable.medicalDesigns.head.stoppableExpensesYen.other,
    35_000,
  );

  const migratedManBreakdown = migrateRequiredCoverageState({
    medicalDesigns: {
      head: {
        stoppableExpenses: {
          pocketMoney: 1,
          commuting: 0.5,
        },
      },
    },
  });
  assert.equal(
    migratedManBreakdown.medicalDesigns.head.stoppableExpensesYen.pocketMoney,
    10_000,
  );
  assert.equal(
    migratedManBreakdown.medicalDesigns.head.stoppableExpensesYen.other,
    5_000,
  );
  console.log('OK medical risk net income loss vs stoppable expense');
}

console.log('verify-required-coverage: all passed');
