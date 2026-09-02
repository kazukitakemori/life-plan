/**
 * CF表の年次集計で simpleMonthlyCost が欠落すると所有物件合計が NaN になるのを検証
 * （npx tsx scripts/verify-housing-simple-monthly-cf.mjs）
 */
import assert from 'node:assert/strict';
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createOwnedProperty } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultLoanState } from '../src/lib/loanDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';
import {
  sumHousingExpenseDetail,
  sumHousingOwnedExpenseDetail,
} from '../src/types/cashFlow.ts';

const referenceDate = new Date(2026, 5, 1);

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

const owned = createOwnedProperty(
  'detached_house',
  head,
  6,
  2026,
  {
    usage: 'current',
    startAge: 40,
    startMonth: 6,
    currentExpenseMode: 'simple',
    simpleMonthlyExpenseMan: 12,
  },
  { rentals: [], owned: [] },
);

const table = buildCashFlowTable({
  familyMembers: [head],
  incomeByMember: {},
  livingState: createDefaultLivingState(head, 6),
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [owned] },
    },
  },
  loanState: createDefaultLoanState(),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember([head]),
  taxSocialState: createDefaultTaxSocialState(head.age, 6),
  referenceDate,
});

const year2026 = table.years.find((y) => y.calendarYear === 2026);
assert.ok(year2026, '2026年の行がある');

const detail = year2026.expenseBreakdown.housingDetail;
assert.equal(
  typeof detail.simpleMonthlyCost,
  'number',
  'simpleMonthlyCost が number であること',
);
assert.ok(
  Number.isFinite(detail.simpleMonthlyCost),
  `simpleMonthlyCost が有限数: ${detail.simpleMonthlyCost}`,
);

// 2026年はシミュレーション開始月〜12月。開始が6月なら 7か月分 × 12万円
const monthCount = 13 - table.simulationMonthStart;
assert.equal(
  detail.simpleMonthlyCost,
  monthCount * 12,
  `簡易住居費(年): ${detail.simpleMonthlyCost} (months=${monthCount}, start=${table.simulationMonthStart})`,
);

const ownedSum = sumHousingOwnedExpenseDetail(detail);
const housingSum = sumHousingExpenseDetail(detail);
assert.ok(Number.isFinite(ownedSum), `所有物件合計が有限数: ${ownedSum}`);
assert.ok(Number.isFinite(housingSum), `家合計が有限数: ${housingSum}`);
assert.equal(ownedSum, detail.simpleMonthlyCost);
assert.equal(year2026.expenseBreakdown.housing, detail.simpleMonthlyCost);

// analysis モードでも housingDetail に simpleMonthlyCost: 0 が入っており NaN にならないこと
const analysisOwned = createOwnedProperty(
  'detached_house',
  head,
  6,
  2026,
  {
    usage: 'current',
    startAge: 40,
    startMonth: 6,
    currentExpenseMode: 'analysis',
    landTaxes: undefined,
    maintenance: {
      managementFees: [
        {
          id: 'm1',
          startOffsetYears: 0,
          endOffsetYears: -1,
          amountManPerMonth: 1,
        },
      ],
      repairReserveFees: [],
      selfRepair: { costMan: 0, nextYear: 2030, nextMonth: 6, intervalYears: 0 },
      improvements: [],
      landTaxes: [{ id: 't1', startYear: 2026, fixedAssetTaxMan: 12, cityPlanningTaxMan: 0 }],
      buildingTaxes: [],
    },
    paymentMethod: 'cash',
  },
  { rentals: [], owned: [] },
);

// createOwnedProperty spreads overrides after maintenance — ensure maintenance sticks
const analysisProperty = {
  ...analysisOwned,
  maintenance: {
    managementFees: [
      {
        id: 'm1',
        startOffsetYears: 0,
        endOffsetYears: -1,
        amountManPerMonth: 1,
      },
    ],
    repairReserveFees: [],
    selfRepair: { costMan: 0, nextYear: 2030, nextMonth: 6, intervalYears: 0 },
    improvements: [],
    landTaxes: [
      {
        id: 't1',
        startYear: 2026,
        fixedAssetTaxMan: 12,
        cityPlanningTaxMan: 0,
      },
    ],
    buildingTaxes: [],
  },
};

const tableAnalysis = buildCashFlowTable({
  familyMembers: [head],
  incomeByMember: {},
  livingState: createDefaultLivingState(head, 6),
  housingState: {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [analysisProperty] },
    },
  },
  loanState: createDefaultLoanState(),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember([head]),
  taxSocialState: createDefaultTaxSocialState(head.age, 6),
  referenceDate,
});

const analysisYear = tableAnalysis.years.find((y) => y.calendarYear === 2026);
assert.ok(analysisYear);
assert.equal(analysisYear.expenseBreakdown.housingDetail.simpleMonthlyCost, 0);
assert.ok(
  Number.isFinite(analysisYear.expenseBreakdown.housing),
  `analysis モード家合計: ${analysisYear.expenseBreakdown.housing}`,
);
assert.ok(analysisYear.expenseBreakdown.housing > 0);

console.log('verify-housing-simple-monthly-cf: OK');
