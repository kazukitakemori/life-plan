/**
 * 企業型DC / DB 受取の CF 現金化検証
 * npx tsx scripts/verify-dc-db-payout.mjs
 */
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import {
  calcSavingsWithdrawalManForMonth,
  projectSavingsForYear,
} from '../src/lib/savingsCashFlow.ts';
import { clampPensionPayoutFields } from '../src/lib/idecoPayout.ts';
import { reclassifySalaryForSelectiveDc } from '../src/lib/dcContribution.ts';

const referenceDate = new Date(2026, 0, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
assert(head, 'head exists');
const member = { ...head, age: 40, birthMonth: 1 };

// --- DC 一括: 残高見込みを受給開始月に現金化 ---
{
  let dc = createSavingsEntry('dc', member, referenceDate, {
    balanceMan: 100,
    contributionMan: 0,
    contributionMode: 'none',
    employerContributionMode: 'none',
    employerContributionMan: 0,
    employeeContributionMode: 'none',
    employeeContributionMan: 0,
    expectedReturnRatePct: 0,
    startAge: 40,
    startMonth: 1,
    endAge: 60,
    endMonth: 12,
    withdrawalMode: 'once',
    withdrawalStartAge: 61,
    withdrawalStartMonth: 1,
  });
  dc = clampPensionPayoutFields(dc, member, 100);
  assert(dc.withdrawalMode === 'once', 'dc once mode');
  assert(dc.withdrawalStartAge === 61, `dc start 61 got ${dc.withdrawalStartAge}`);

  const atStart = calcSavingsWithdrawalManForMonth(
    dc,
    member,
    referenceDate,
    2047, // age 61 in 2047 if age 40 in 2026
    1,
    [dc],
  );
  // age at 2047/1: birth year = 2026-40 = 1986, so 2047-1986=61 if month>=birthMonth
  assert(atStart === 100, `dc once payout 100 got ${atStart}`);

  const notYet = calcSavingsWithdrawalManForMonth(
    dc,
    member,
    referenceDate,
    2046,
    1,
    [dc],
  );
  assert(notYet === 0, 'dc no payout before start');
  console.log('OK DC once payout');
}

// --- DB 一時金: 残高0でも見込み額を現金化 ---
{
  let db = createSavingsEntry('db', member, referenceDate, {
    withdrawalMode: 'once',
    withdrawalMan: 500,
    withdrawalStartAge: 60,
    withdrawalStartMonth: 1,
  });
  db = clampPensionPayoutFields(db, member);
  assert(db.withdrawalMan === 500, 'db keeps lump estimate');

  const state = { byMember: { [member.id]: [db] } };
  let balances = {};
  let principals = {};
  let residual = 0;

  // run years until payout
  for (let year = 2026; year <= 2046; year++) {
    const result = projectSavingsForYear({
      savingsState: state,
      familyMembers: [member],
      referenceDate,
      calendarYear: year,
      monthStart: 1,
      monthEnd: 12,
      accountBalances: balances,
      investPrincipalByEntry: principals,
      residualCash: residual,
      annualBalance: 0,
      initialize: year === 2026,
    });
    balances = result.accountBalances;
    principals = result.investPrincipalByEntry;
    residual = result.residualCash;
    if (year === 2046) {
      assert(
        result.investBreakdown.db.withdrawal === 500,
        `db withdrawal 500 got ${result.investBreakdown.db.withdrawal}`,
      );
      assert(residual >= 500, `residual includes db payout got ${residual}`);
    }
  }
  console.log('OK DB lump CF');
}

// --- DB 年金: 月額×期間 ---
{
  let db = createSavingsEntry('db', member, referenceDate, {
    withdrawalMode: 'drawdown',
    withdrawalMan: 10,
    idecoAnnuityPeriodMode: 'years',
    withdrawalYears: 5,
    withdrawalStartAge: 60,
    withdrawalStartMonth: 1,
  });
  db = clampPensionPayoutFields(db, member);
  const monthly = calcSavingsWithdrawalManForMonth(
    db,
    member,
    referenceDate,
    2046,
    1,
    [db],
  );
  assert(monthly === 10, `db annuity monthly 10 got ${monthly}`);
  console.log('OK DB annuity month');
}

// --- 企業型DC積立は残現金を減らさない（事業主掛金） ---
{
  const dc = createSavingsEntry('dc', member, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'annual',
    employerContributionMan: 12,
    employeeContributionMode: 'none',
    employeeContributionMan: 0,
    expectedReturnRatePct: 0,
    startAge: 40,
    startMonth: 1,
    endAge: 65,
    endMonth: 12,
    withdrawalMode: 'once',
    withdrawalStartAge: 65,
    withdrawalStartMonth: 12,
  });
  const state = { byMember: { [member.id]: [dc] } };
  const result = projectSavingsForYear({
    savingsState: state,
    familyMembers: [member],
    referenceDate,
    calendarYear: 2026,
    monthStart: 1,
    monthEnd: 12,
    accountBalances: {},
    investPrincipalByEntry: {},
    residualCash: 100,
    annualBalance: 50,
    initialize: true,
  });
  assert(
    result.investBreakdown.dc.contribution === 12,
    `dc contribution on asset got ${result.investBreakdown.dc.contribution}`,
  );
  assert(
    result.personalInvestContributionMan === 0,
    `employer dc personal invest contrib 0 got ${result.personalInvestContributionMan}`,
  );
  // initialize 時は residual を 0 から開始し、年間収支のみ加算（DC掛金は控除しない）
  assert(
    result.residualCash === 50,
    `employer dc does not reduce cash: residual ${result.residualCash} (expect 50)`,
  );
  console.log('OK DC employer contribution cash-neutral');
}

// --- 選択型DC（加入者掛金）: 残高増・残現金減 ---
{
  const dc = createSavingsEntry('dc', member, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'none',
    employerContributionMan: 0,
    employeeContributionMode: 'monthly',
    employeeContributionMan: 1,
    expectedReturnRatePct: 0,
    startAge: 40,
    startMonth: 1,
    endAge: 65,
    endMonth: 12,
    withdrawalMode: 'none',
  });
  const state = { byMember: { [member.id]: [dc] } };
  const result = projectSavingsForYear({
    savingsState: state,
    familyMembers: [member],
    referenceDate,
    calendarYear: 2026,
    monthStart: 1,
    monthEnd: 12,
    accountBalances: {},
    investPrincipalByEntry: {},
    residualCash: 100,
    annualBalance: 50,
    initialize: true,
  });
  assert(
    result.investBreakdown.dc.contribution === 12,
    `selective dc asset +12 got ${result.investBreakdown.dc.contribution}`,
  );
  assert(
    result.personalInvestContributionMan === 12,
    `selective dc personal invest contrib 12 got ${result.personalInvestContributionMan}`,
  );
  // initialize: residual = 0 + annualBalance - personalContribution(12)
  assert(
    result.residualCash === 38,
    `selective dc reduces cash: residual ${result.residualCash} (expect 38)`,
  );
  console.log('OK DC selective (employee) contribution reduces cash');
}

// --- 事業主＋選択型 併用 ---
{
  const dc = createSavingsEntry('dc', member, referenceDate, {
    balanceMan: 0,
    employerContributionMode: 'annual',
    employerContributionMan: 24,
    employeeContributionMode: 'monthly',
    employeeContributionMan: 2,
    expectedReturnRatePct: 0,
    startAge: 40,
    startMonth: 1,
    endAge: 65,
    endMonth: 12,
    withdrawalMode: 'none',
  });
  const state = { byMember: { [member.id]: [dc] } };
  const result = projectSavingsForYear({
    savingsState: state,
    familyMembers: [member],
    referenceDate,
    calendarYear: 2026,
    monthStart: 1,
    monthEnd: 12,
    accountBalances: {},
    investPrincipalByEntry: {},
    residualCash: 100,
    annualBalance: 50,
    initialize: true,
  });
  // 24 employer + 24 employee = 48 on balance
  assert(
    result.investBreakdown.dc.contribution === 48,
    `combined dc contrib 48 got ${result.investBreakdown.dc.contribution}`,
  );
  assert(
    result.personalInvestContributionMan === 24,
    `combined personal invest contrib 24 got ${result.personalInvestContributionMan}`,
  );
  // only employee 24 deducted from cash
  assert(
    result.residualCash === 26,
    `combined: only employee reduces cash: residual ${result.residualCash} (expect 26)`,
  );
  console.log('OK DC employer+selective combined');
}

// --- 収入内訳: selectiveDc 振替（合計不変） ---
{
  const salary = {
    socialInsurance: 400,
    civilMutual: 0,
    nationalInsurance: 50,
    selectiveDc: 0,
  };
  const next = reclassifySalaryForSelectiveDc(salary, 24);
  const before =
    salary.socialInsurance +
    salary.civilMutual +
    salary.nationalInsurance +
    salary.selectiveDc;
  const after =
    next.socialInsurance +
    next.civilMutual +
    next.nationalInsurance +
    next.selectiveDc;
  assert(after === before, `salary sum unchanged ${before} -> ${after}`);
  assert(next.selectiveDc === 24, `selectiveDc 24 got ${next.selectiveDc}`);
  assert(
    next.socialInsurance === 376,
    `socialInsurance reduced to 376 got ${next.socialInsurance}`,
  );
  console.log('OK selectiveDc salary reclassify');
}

console.log('All DC/DB payout checks passed.');
