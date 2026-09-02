/**
 * 資産形成グラフ用: annualBalance / 残高が CF 行と一致することを確認
 * npx tsx scripts/verify-asset-building-charts.mjs
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import { buildLifetimeBalanceChartData } from '../src/lib/lifetimeBalanceChartData.ts';

const referenceDate = new Date(2026, 5, 1);
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
if (!head) throw new Error('no head');

const table = buildCashFlowTable({
  familyMembers: members,
  incomeByMember: {
    [head.id]: createDefaultHeadIncome(head, referenceDate.getMonth() + 1),
  },
  livingState: createDefaultLivingState(head, referenceDate.getMonth() + 1),
  housingState: createDefaultHousingState(head, referenceDate.getMonth() + 1),
  educationByMember: {},
  lifeEventState: createDefaultLifeEventState(),
  pensionByMember: createDefaultPensionByMember(members),
  taxSocialState: createDefaultTaxSocialState(
    head.age,
    referenceDate.getMonth() + 1,
  ),
  referenceDate,
});

const chart = buildLifetimeBalanceChartData(table);

if (chart.points.length !== table.years.length) {
  throw new Error(
    `point count mismatch: chart ${chart.points.length} vs years ${table.years.length}`,
  );
}

for (let i = 0; i < table.years.length; i++) {
  const year = table.years[i];
  const point = chart.points[i];
  if (point.calendarYear !== year.calendarYear) {
    throw new Error(
      `year mismatch at ${i}: ${point.calendarYear} vs ${year.calendarYear}`,
    );
  }
  if (Math.abs(point.annualBalance - year.annualBalance) > 0.01) {
    throw new Error(
      `${year.calendarYear}: annualBalance ${point.annualBalance} !== ${year.annualBalance}`,
    );
  }
  if (Math.abs(point.financialAssets - year.financialAssets) > 0.01) {
    throw new Error(
      `${year.calendarYear}: financialAssets ${point.financialAssets} !== ${year.financialAssets}`,
    );
  }
  if (Math.abs(point.depositBalance - year.savings) > 0.01) {
    throw new Error(
      `${year.calendarYear}: depositBalance ${point.depositBalance} !== savings ${year.savings}`,
    );
  }
  if (Math.abs(point.assetContribution - year.investContribution) > 0.01) {
    throw new Error(
      `${year.calendarYear}: assetContribution ${point.assetContribution} !== investContribution ${year.investContribution}`,
    );
  }
  if (Math.abs(point.income - year.income) > 0.01) {
    throw new Error(
      `${year.calendarYear}: income ${point.income} !== ${year.income}`,
    );
  }
  const incomeParts =
    point.salary +
    point.bonus +
    point.oldAgeBasic +
    point.oldAgeEmployees +
    point.disabilityPension +
    point.survivorBasic +
    point.survivorEmployees +
    point.childAllowance +
    point.insuranceIncome +
    point.retirementAllowance +
    point.businessCf +
    point.realEstateCf +
    point.transferCf +
    point.taxFreeIncome +
    point.otherIncome;
  if (Math.abs(incomeParts - year.income) > 0.05) {
    throw new Error(
      `${year.calendarYear}: income parts ${incomeParts} !== income ${year.income}`,
    );
  }
}

console.log(
  `OK asset-building charts mapping (${chart.points.length} years, annualBalance/balances aligned)`,
);
