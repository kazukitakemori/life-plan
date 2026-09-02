/**
 * Q11 貯蓄・運用 CF 反映の簡易検証
 * npx tsx scripts/verify-savings-cf.mjs
 *
 * - 口座未登録時: 貯蓄額 = 年間収支の累積（普通預金ストック）
 * - 貯蓄額は毎年の年末残高（ストック）。2年目以降も消えない
 * - 投資残高・リターンは貯蓄額に含めない
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { createDefaultHeadIncome } from '../src/lib/incomeDefaults.ts';
import { createDefaultHousingState } from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
import {
  createDefaultSavingsState,
  createSavingsEntry,
  updateSavingsByMember,
} from '../src/lib/savingsDefaults.ts';
import { projectSavingsForYear, estimateInvestBalanceManAt } from '../src/lib/savingsCashFlow.ts';
import { resolveDefaultSavingsContributionEndAge } from '../src/lib/savingsLabels.ts';
import {
  calcDrawdownAmounts,
  doContributionWithdrawalPeriodsOverlap,
  getContributionWithdrawalOverlapKind,
  suggestWithdrawalStart,
} from '../src/lib/savingsWithdrawalPeriod.ts';
import {
  calcTimeDepositMaturityProceeds,
  TIME_DEPOSIT_INTEREST_TAX_RATE,
} from '../src/lib/timeDeposit.ts';
import {
  sumInvestCategoryDetail,
  sumSavingsBreakdown,
} from '../src/types/cashFlow.ts';

const referenceDate = new Date(2026, 5, 1);
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
if (!head) throw new Error('no head');
head.age = 40;
head.birthMonth = 3;
head.birthDay = 15;

const baseInput = {
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
};

const emptyCf = buildCashFlowTable(baseInput);
const y0 = emptyCf.years[0];
const y1 = emptyCf.years[1];
if (!y0 || !y1) throw new Error('missing years');

if (Math.abs(y0.savings - y0.annualBalance) > 0.01) {
  throw new Error(
    `empty y0: savings should equal annualBalance (${y0.savings} vs ${y0.annualBalance})`,
  );
}
if (Math.abs(y0.savingsBreakdown.deposit - y0.savings) > 0.01) {
  throw new Error('empty y0: deposit breakdown should equal savings');
}
if (Math.abs(y1.savings - (y0.savings + y1.annualBalance)) > 0.01) {
  throw new Error(
    `empty y1: savings should accumulate (${y1.savings} vs ${y0.savings + y1.annualBalance})`,
  );
}
console.log('OK empty savings → cumulative stock');

const deposit = createSavingsEntry('deposit', head, referenceDate, {
  balanceMan: 500,
  contributionMode: 'none',
  expectedReturnRatePct: 0,
});
const timeDeposit = createSavingsEntry('time_deposit', head, referenceDate, {
  balanceMan: 200,
  contributionMode: 'none',
  expectedReturnRatePct: 0.2,
  termYears: 5,
  startAge: head.age,
  startMonth: referenceDate.getMonth() + 1,
});
const nisa = createSavingsEntry('nisa_tsumitate', head, referenceDate, {
  nisaUtilization: 'active',
  principalMan: 80,
  nisaValuationMode: 'gains',
  gainsMan: 20,
  contributionMan: 3,
  contributionMode: 'monthly',
  expectedReturnRatePct: 4,
  startAge: head.age,
  startMonth: 1,
  endMode: 'until',
  endAge: 65,
  endMonth: 12,
});

let state = createDefaultSavingsState();
state = updateSavingsByMember(state, head.id, [deposit, timeDeposit, nisa]);

const withSavings = buildCashFlowTable({
  ...baseInput,
  savingsState: state,
});
const s0 = withSavings.years[0];
const s1 = withSavings.years[1];
if (!s0 || !s1) throw new Error('missing years with savings');

const monthsInYear0 = 12 - (emptyCf.simulationMonthStart - 1);
const expectedNisaContribution0 = 3 * monthsInYear0;
const preInvestSurplus0 = s0.annualBalance + s0.investContribution;
const projected0 = projectSavingsForYear({
  savingsState: state,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: emptyCf.simulationMonthStart,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: preInvestSurplus0,
  initialize: true,
});

const timeDepositEnd0 = 200; // 期中は元本のみ（満期まで利息なし）
const residual0 = preInvestSurplus0 - expectedNisaContribution0;
const expectedDeposit0 = 500 + residual0;
const expectedTimeDeposit0 = timeDepositEnd0;
const expectedSavings0 = expectedDeposit0 + expectedTimeDeposit0;

if (Math.abs(s0.investContribution - expectedNisaContribution0) > 0.05) {
  throw new Error(
    `y0 investContribution ${s0.investContribution} != ${expectedNisaContribution0}`,
  );
}
if (
  Math.abs(s0.expenditure - (s0.disposableIncome - s0.annualBalance)) > 0.05
) {
  throw new Error(
    `y0 expenditure should equal disposable - annualBalance (${s0.expenditure} vs ${s0.disposableIncome - s0.annualBalance})`,
  );
}

if (Math.abs(projected0.savingsBreakdown.deposit - expectedDeposit0) > 0.05) {
  throw new Error(
    `y0 deposit ${projected0.savingsBreakdown.deposit} != ${expectedDeposit0}`,
  );
}
if (
  Math.abs(projected0.savingsBreakdown.timeDeposit - expectedTimeDeposit0) >
  0.05
) {
  throw new Error(
    `y0 timeDeposit ${projected0.savingsBreakdown.timeDeposit} != ${expectedTimeDeposit0}`,
  );
}
if (Math.abs(s0.savings - expectedSavings0) > 0.05) {
  throw new Error(`y0 CF savings ${s0.savings} != ${expectedSavings0}`);
}
if (Math.abs(sumSavingsBreakdown(s0.savingsBreakdown) - s0.savings) > 0.01) {
  throw new Error('y0 savings != sum breakdown');
}

// 2年目も残高が残る（フローではない）
if (s1.savingsBreakdown.timeDeposit < 200) {
  throw new Error(
    `y1 timeDeposit disappeared: ${s1.savingsBreakdown.timeDeposit}`,
  );
}
if (Math.abs(s1.savings) < 100) {
  throw new Error(`y1 savings too small / disappeared: ${s1.savings}`);
}

const projected1 = projectSavingsForYear({
  savingsState: state,
  familyMembers: members,
  referenceDate,
  calendarYear: 2027,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: projected0.accountBalances,
  investPrincipalByEntry: projected0.investPrincipalByEntry,
  residualCash: projected0.residualCash,
  annualBalance: s1.annualBalance + s1.investContribution,
  initialize: false,
});

if (Math.abs(s1.savings - projected1.savingsMan) > 0.05) {
  throw new Error(
    `y1 CF savings ${s1.savings} != projected ${projected1.savingsMan}`,
  );
}
// 定期は期中元本据置（満期一括の単利＋課税）
const expectedTimeDeposit1 = 200;
if (
  Math.abs(projected1.savingsBreakdown.timeDeposit - expectedTimeDeposit1) >
  0.05
) {
  throw new Error(
    `y1 timeDeposit should stay at principal: ${projected1.savingsBreakdown.timeDeposit} != ${expectedTimeDeposit1}`,
  );
}

console.log('OK savings stock persists year2+ (time deposit principal held)');
console.log(
  `  y0 savings=${s0.savings} y1 savings=${s1.savings} timeDeposit y0=${s0.savingsBreakdown.timeDeposit} y1=${s1.savingsBreakdown.timeDeposit}`,
);

// 運用は貯蓄額と別行。親＝年末残高、子＝当年積立／当年運用益
const expectedNisaReturn0 = 100 * 0.04;
const expectedNisaBalance0 = 100 + expectedNisaReturn0 + expectedNisaContribution0;
if (
  Math.abs(s0.investBreakdown.nisaTsumitate.balance - expectedNisaBalance0) >
  0.05
) {
  throw new Error(
    `y0 invest nisa balance ${s0.investBreakdown.nisaTsumitate.balance} != ${expectedNisaBalance0}`,
  );
}
if (
  Math.abs(
    s0.investBreakdown.nisaTsumitate.contribution - expectedNisaContribution0,
  ) > 0.05
) {
  throw new Error(
    `y0 nisa contribution ${s0.investBreakdown.nisaTsumitate.contribution} != ${expectedNisaContribution0}`,
  );
}
if (
  Math.abs(s0.investBreakdown.nisaTsumitate.annualReturn - expectedNisaReturn0) >
  0.05
) {
  throw new Error(
    `y0 nisa annualReturn ${s0.investBreakdown.nisaTsumitate.annualReturn} != ${expectedNisaReturn0}`,
  );
}
if (
  Math.abs(
    sumInvestCategoryDetail(s0.investBreakdown.nisaTsumitate) -
      expectedNisaBalance0,
  ) > 0.05
) {
  throw new Error('y0 category parent should equal balance');
}
if (Math.abs(s0.invest - expectedNisaBalance0) > 0.05) {
  throw new Error(`y0 invest ${s0.invest} != ${expectedNisaBalance0}`);
}
if (Math.abs(emptyCf.years[0].investBreakdown.nisaTsumitate.balance) > 0.01) {
  throw new Error('empty CF should still expose investBreakdown.nisaTsumitate.balance as 0');
}
if (Math.abs(emptyCf.years[0].investBreakdown.nisaGrowth.annualReturn) > 0.01) {
  throw new Error('empty CF should still expose investBreakdown.nisaGrowth.annualReturn as 0');
}
if (Math.abs(s0.savings + s0.invest - s0.financialAssets) > 0.1) {
  throw new Error(
    `y0 savings+invest ${s0.savings + s0.invest} != financialAssets ${s0.financialAssets}`,
  );
}
if (
  Math.abs(s0.investContribution - expectedNisaContribution0) > 0.05
) {
  throw new Error(
    `y0 investContribution ${s0.investContribution} != ${expectedNisaContribution0}`,
  );
}
if (
  Math.abs(
    s0.investBreakdown.nisaTsumitate.personalContribution -
      expectedNisaContribution0,
  ) > 0.05
) {
  throw new Error(
    `y0 nisa personalContribution ${s0.investBreakdown.nisaTsumitate.personalContribution} != ${expectedNisaContribution0}`,
  );
}
console.log('OK invest stock separate from savings (balance/contribution/return)');
// 生涯枠を超える積立はキャップされる
const nearLimitNisa = createSavingsEntry('nisa_tsumitate', head, referenceDate, {
  nisaUtilization: 'active',
  principalMan: 1780,
  nisaValuationMode: 'gains',
  gainsMan: 0,
  contributionMan: 10,
  contributionMode: 'monthly',
  expectedReturnRatePct: 0,
  startAge: head.age,
  startMonth: 1,
  endMode: 'lifetime',
  endAge: 100,
  endMonth: 12,
});
let cappedState = createDefaultSavingsState();
cappedState = updateSavingsByMember(cappedState, head.id, [nearLimitNisa]);
const cappedProjected = projectSavingsForYear({
  savingsState: cappedState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 1000,
  initialize: true,
});
// 残枠20万、月10万でも年上限120→だが生涯は20まで → 20万円のみ
if (Math.abs(cappedProjected.contributionMan - 20) > 0.05) {
  throw new Error(
    `lifetime quota cap failed: contribution ${cappedProjected.contributionMan} != 20`,
  );
}
if (
  Math.abs((cappedProjected.investPrincipalByEntry[nearLimitNisa.id] ?? 0) - 1800) >
  0.05
) {
  throw new Error('lifetime principal should reach 1800');
}
if (Math.abs(cappedProjected.investBreakdown.nisaTsumitate.balance - 1800) > 0.05) {
  throw new Error(
    `capped nisa balance ${cappedProjected.investBreakdown.nisaTsumitate.balance} != 1800`,
  );
}
if (Math.abs(cappedProjected.investBreakdown.nisaTsumitate.contribution - 20) > 0.05) {
  throw new Error(
    `capped nisa contribution ${cappedProjected.investBreakdown.nisaTsumitate.contribution} != 20`,
  );
}
if (Math.abs(cappedProjected.investBreakdown.nisaTsumitate.annualReturn) > 0.05) {
  throw new Error('capped nisa annualReturn should be 0');
}
console.log('OK NISA lifetime quota caps contributions');

// 特定口座: 取崩し時に売却益 × 20.315%
const taxable = createSavingsEntry('taxable', head, referenceDate, {
  taxableUtilization: 'active',
  principalMan: 100,
  nisaValuationMode: 'gains',
  gainsMan: 0,
  contributionMode: 'none',
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalMan: 40,
  withdrawalStartAge: head.age,
  withdrawalStartMonth: 1,
});
let taxableState = createDefaultSavingsState();
taxableState = updateSavingsByMember(taxableState, head.id, [taxable]);
const taxableProjected = projectSavingsForYear({
  savingsState: taxableState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 0,
  initialize: true,
});
// 残高100・簿価100 → 益0 → 税0、取崩40、残60、残現金40
if (Math.abs(taxableProjected.withdrawalMan - 40) > 0.05) {
  throw new Error(
    `taxable withdrawal ${taxableProjected.withdrawalMan} != 40`,
  );
}
if (Math.abs(taxableProjected.capitalGainsTaxMan) > 0.05) {
  throw new Error(
    `taxable tax should be 0 when no gain: ${taxableProjected.capitalGainsTaxMan}`,
  );
}
if (Math.abs(taxableProjected.investBreakdown.taxable.balance - 60) > 0.05) {
  throw new Error(
    `taxable balance ${taxableProjected.investBreakdown.taxable.balance} != 60`,
  );
}
if (Math.abs(taxableProjected.residualCash - 40) > 0.05) {
  throw new Error(
    `taxable residual ${taxableProjected.residualCash} != 40`,
  );
}
console.log('OK taxable withdrawal with zero gain → no tax');

const taxableGain = createSavingsEntry('taxable', head, referenceDate, {
  taxableUtilization: 'active',
  principalMan: 100,
  nisaValuationMode: 'gains',
  gainsMan: 100,
  contributionMode: 'none',
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalMan: 100,
  withdrawalStartAge: head.age,
  withdrawalStartMonth: 1,
});
let taxableGainState = createDefaultSavingsState();
taxableGainState = updateSavingsByMember(taxableGainState, head.id, [
  taxableGain,
]);
const taxableGainProjected = projectSavingsForYear({
  savingsState: taxableGainState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 0,
  initialize: true,
});
// 評価200・簿価100 → 売却100のうち簿価50、益50 → 税 50*0.20315
const expectedGain = 50;
const expectedTax = expectedGain * 0.20315;
const expectedNet = 100 - expectedTax;
if (Math.abs(taxableGainProjected.withdrawalMan - 100) > 0.05) {
  throw new Error(
    `taxable gain withdrawal ${taxableGainProjected.withdrawalMan} != 100`,
  );
}
if (Math.abs(taxableGainProjected.capitalGainsTaxMan - expectedTax) > 0.01) {
  throw new Error(
    `taxable gain tax ${taxableGainProjected.capitalGainsTaxMan} != ${expectedTax}`,
  );
}
if (
  Math.abs(taxableGainProjected.investBreakdown.taxable.capitalGainsTax - expectedTax) >
  0.01
) {
  throw new Error('CF capitalGainsTax mismatch');
}
if (
  Math.abs(taxableGainProjected.investBreakdown.taxable.withdrawal - 100) > 0.05
) {
  throw new Error('CF withdrawal mismatch');
}
if (Math.abs(taxableGainProjected.residualCash - expectedNet) > 0.01) {
  throw new Error(
    `taxable net residual ${taxableGainProjected.residualCash} != ${expectedNet}`,
  );
}
if (
  Math.abs((taxableGainProjected.investPrincipalByEntry[taxableGain.id] ?? 0) - 50) >
  0.05
) {
  throw new Error('taxable principal should reduce proportionally to 50');
}
console.log(
  `OK taxable withdrawal capital gains tax 20.315% (tax=${expectedTax.toFixed(4)})`,
);

// 一括売却は指定年齢・月に一度だけ
const taxableOnce = createSavingsEntry('taxable', head, referenceDate, {
  taxableUtilization: 'active',
  principalMan: 100,
  nisaValuationMode: 'gains',
  gainsMan: 0,
  contributionMode: 'none',
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalMan: 30,
  withdrawalStartAge: head.age,
  withdrawalStartMonth: 6,
});
let taxableOnceState = createDefaultSavingsState();
taxableOnceState = updateSavingsByMember(taxableOnceState, head.id, [
  taxableOnce,
]);
const onceY0 = projectSavingsForYear({
  savingsState: taxableOnceState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 0,
  initialize: true,
});
if (Math.abs(onceY0.withdrawalMan - 30) > 0.05) {
  throw new Error(`once y0 withdrawal ${onceY0.withdrawalMan} != 30`);
}
const onceY1 = projectSavingsForYear({
  savingsState: taxableOnceState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2027,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: onceY0.accountBalances,
  investPrincipalByEntry: onceY0.investPrincipalByEntry,
  residualCash: onceY0.residualCash,
  annualBalance: 0,
  initialize: false,
});
if (Math.abs(onceY1.withdrawalMan) > 0.05) {
  throw new Error(
    `once should not withdraw again in y1: ${onceY1.withdrawalMan}`,
  );
}
console.log('OK taxable once withdrawal fires only at start age/month');

// NISA 取崩しは非課税。簿価按分で生涯枠が空く
const nisaWithdraw = createSavingsEntry('nisa_tsumitate', head, referenceDate, {
  nisaUtilization: 'active',
  principalMan: 100,
  nisaValuationMode: 'gains',
  gainsMan: 100,
  contributionMode: 'none',
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalMan: 100,
  withdrawalStartAge: head.age,
  withdrawalStartMonth: 1,
});
let nisaWithdrawState = createDefaultSavingsState();
nisaWithdrawState = updateSavingsByMember(nisaWithdrawState, head.id, [
  nisaWithdraw,
]);
const nisaWithdrawProjected = projectSavingsForYear({
  savingsState: nisaWithdrawState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 0,
  initialize: true,
});
if (Math.abs(nisaWithdrawProjected.withdrawalMan - 100) > 0.05) {
  throw new Error(
    `nisa withdrawal ${nisaWithdrawProjected.withdrawalMan} != 100`,
  );
}
if (Math.abs(nisaWithdrawProjected.capitalGainsTaxMan) > 0.05) {
  throw new Error(
    `nisa tax should be 0: ${nisaWithdrawProjected.capitalGainsTaxMan}`,
  );
}
if (Math.abs(nisaWithdrawProjected.residualCash - 100) > 0.05) {
  throw new Error(
    `nisa residual should receive full amount: ${nisaWithdrawProjected.residualCash}`,
  );
}
if (
  Math.abs((nisaWithdrawProjected.investPrincipalByEntry[nisaWithdraw.id] ?? 0) - 50) >
  0.05
) {
  throw new Error('nisa principal should reduce proportionally to 50');
}
if (
  Math.abs(nisaWithdrawProjected.investBreakdown.nisaTsumitate.withdrawal - 100) >
  0.05
) {
  throw new Error('nisa CF withdrawal mismatch');
}
if (
  Math.abs(nisaWithdrawProjected.investBreakdown.nisaTsumitate.capitalGainsTax) >
  0.05
) {
  throw new Error('nisa CF capitalGainsTax should be 0');
}
console.log('OK NISA withdrawal is tax-free and reduces principal');

// これから開始でも、取崩時点の見込み残高（積立＋運用益）を推計できる
const taxableNew = createSavingsEntry('taxable', head, referenceDate, {
  taxableUtilization: 'new',
  contributionMode: 'annual',
  contributionMan: 100,
  expectedReturnRatePct: 0,
  startAge: head.age,
  startMonth: 1,
  endMode: 'until',
  endAge: head.age + 2,
  endMonth: 12,
});
const estimatedAtWithdraw = estimateInvestBalanceManAt({
  entry: taxableNew,
  member: head,
  memberEntries: [taxableNew],
  referenceDate,
  targetAge: head.age + 3,
  targetMonth: 1,
});
// 年額100を開始月に2回（age+0, age+1?）— startAge/startMonth=head.age/1, end age+2/12
// annual at startMonth each year in range: years where age reaches startMonth
// Actually contribution months: when age/month in range and calendarMonth === startMonth
// estimate walks calendar years from 2026. head age 40. startMonth 1.
// Years: 2026 (partial from June ref - referenceDate is June 1 2026!)
// referenceDate = new Date(2026, 5, 1) → month 6
// So 2026 only months 6-12, annual contrib only if startMonth===6 - but startMonth is 1, so no contrib in 2026
// 2027: full year, contrib in month 1 when age is 40? getMemberAgeMonth for 2027/1...
// This gets messy. Use expectedReturnRatePct 0 and monthly for clearer math.

const taxableNewMonthly = createSavingsEntry('taxable', head, referenceDate, {
  taxableUtilization: 'new',
  contributionMode: 'monthly',
  contributionMan: 10,
  expectedReturnRatePct: 0,
  startAge: head.age,
  startMonth: referenceDate.getMonth() + 1,
  endMode: 'until',
  endAge: head.age,
  endMonth: 12,
});
const estMonthly = estimateInvestBalanceManAt({
  entry: taxableNewMonthly,
  member: head,
  memberEntries: [taxableNewMonthly],
  referenceDate,
  targetAge: head.age,
  targetMonth: 12,
});
// from ref month to Dec inclusive: (12 - refMonth + 1) * 10
const months = 12 - (referenceDate.getMonth() + 1) + 1;
const expectedEst = months * 10;
if (Math.abs(estMonthly - expectedEst) > 0.05) {
  throw new Error(
    `estimate from new account ${estMonthly} != ${expectedEst} (${months} months)`,
  );
}
console.log('OK estimateInvestBalanceManAt for new taxable with contributions');

// 積立終了翌月が取崩開始の推奨／期間重複判定
const periodEntry = createSavingsEntry('taxable', head, referenceDate, {
  contributionMode: 'monthly',
  contributionMan: 1,
  endMode: 'until',
  endAge: 65,
  endMonth: 12,
  withdrawalMode: 'drawdown',
  withdrawalYears: 20,
  withdrawalMan: 1,
  withdrawalStartAge: 66,
  withdrawalStartMonth: 1,
});
const suggested = suggestWithdrawalStart(periodEntry, head);
if (suggested.age !== 66 || suggested.month !== 1) {
  throw new Error(
    `suggestWithdrawalStart expected 66/1 got ${suggested.age}/${suggested.month}`,
  );
}
if (doContributionWithdrawalPeriodsOverlap(periodEntry, head)) {
  throw new Error('should not overlap when withdrawal starts after contribution');
}
const overlapping = {
  ...periodEntry,
  withdrawalStartAge: 60,
  withdrawalStartMonth: 1,
};
if (!doContributionWithdrawalPeriodsOverlap(overlapping, head)) {
  throw new Error('should overlap when withdrawal starts during contribution');
}
// NISA「枠が埋まるまで」は一生涯扱いにしない
const nisaLifetimeLike = createSavingsEntry('nisa_tsumitate', head, referenceDate, {
  contributionMode: 'monthly',
  contributionMan: 3,
  endMode: 'lifetime',
  withdrawalMode: 'drawdown',
  withdrawalYears: 20,
  withdrawalMan: 1,
  withdrawalStartAge: head.age,
  withdrawalStartMonth: 1,
});
const nisaFill = { age: 55, month: 6 };
if (
  getContributionWithdrawalOverlapKind(nisaLifetimeLike, head, nisaFill) ===
  'both_lifetime'
) {
  throw new Error('NISA quota-fill mode must not be flagged as both_lifetime');
}
// 枠埋まり後開始なら重複なし
const nisaAfterFill = {
  ...nisaLifetimeLike,
  withdrawalStartAge: 55,
  withdrawalStartMonth: 7,
};
if (doContributionWithdrawalPeriodsOverlap(nisaAfterFill, head, nisaFill)) {
  throw new Error('NISA withdrawal after fill should not overlap');
}
const drawdownPace = calcDrawdownAmounts(1200, 20);
if (drawdownPace.annualMan !== 60 || Math.abs(drawdownPace.monthlyMan - 5) > 0.05) {
  throw new Error(
    `drawdown pace ${drawdownPace.annualMan}/${drawdownPace.monthlyMan} != 60/5`,
  );
}
console.log('OK contribution/withdrawal period defaults and overlap warnings');

if (resolveDefaultSavingsContributionEndAge({ age: 40, expectedLifespan: 90 }) !== 65) {
  throw new Error('default end age under 65 should be 65');
}
if (resolveDefaultSavingsContributionEndAge({ age: 65, expectedLifespan: 90 }) !== 75) {
  throw new Error('default end age at 65 should be +10');
}
if (resolveDefaultSavingsContributionEndAge({ age: 70, expectedLifespan: 90 }) !== 80) {
  throw new Error('default end age over 65 should be +10');
}
if (resolveDefaultSavingsContributionEndAge({ age: 85, expectedLifespan: 90 }) !== 90) {
  throw new Error('default end age should clamp to lifespan');
}
const defaultPeriodEntry = createSavingsEntry('taxable', head, referenceDate);
if (defaultPeriodEntry.endMode !== 'until' || defaultPeriodEntry.endAge !== 65) {
  throw new Error(
    `new taxable entry should end at 65 until, got ${defaultPeriodEntry.endMode}/${defaultPeriodEntry.endAge}`,
  );
}
console.log('OK contribution end age defaults (65 / age+10)');

// 定期預金: 満期一括の単利＋20.315%課税 → 残現金へ
const maturityDeposit = createSavingsEntry('time_deposit', head, referenceDate, {
  balanceMan: 100,
  expectedReturnRatePct: 1,
  termYears: 1,
  startAge: head.age,
  startMonth: referenceDate.getMonth() + 1,
});
let maturityState = createDefaultSavingsState();
maturityState = updateSavingsByMember(maturityState, head.id, [maturityDeposit]);

const maturityY0 = projectSavingsForYear({
  savingsState: maturityState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2026,
  monthStart: emptyCf.simulationMonthStart,
  monthEnd: 12,
  accountBalances: {},
  investPrincipalByEntry: {},
  residualCash: 0,
  annualBalance: 0,
  initialize: true,
});
if (Math.abs(maturityY0.savingsBreakdown.timeDeposit - 100) > 0.05) {
  throw new Error(
    `maturity y0 timeDeposit ${maturityY0.savingsBreakdown.timeDeposit} != 100`,
  );
}

const maturityY1 = projectSavingsForYear({
  savingsState: maturityState,
  familyMembers: members,
  referenceDate,
  calendarYear: 2027,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: maturityY0.accountBalances,
  investPrincipalByEntry: maturityY0.investPrincipalByEntry,
  residualCash: maturityY0.residualCash,
  annualBalance: 0,
  initialize: false,
});
const expectedProceeds = calcTimeDepositMaturityProceeds(100, 1, 1);
// interest 1, tax 1*0.20315, net 100+1-tax
if (Math.abs(expectedProceeds.interestMan - 1) > 0.001) {
  throw new Error(`interest ${expectedProceeds.interestMan} != 1`);
}
if (
  Math.abs(expectedProceeds.taxMan - 1 * TIME_DEPOSIT_INTEREST_TAX_RATE) > 0.001
) {
  throw new Error(`tax ${expectedProceeds.taxMan}`);
}
if (Math.abs(maturityY1.savingsBreakdown.timeDeposit) > 0.05) {
  throw new Error(
    `maturity y1 timeDeposit should be 0, got ${maturityY1.savingsBreakdown.timeDeposit}`,
  );
}
if (
  Math.abs(maturityY1.residualCash - expectedProceeds.netProceedsMan) > 0.05
) {
  throw new Error(
    `maturity residual ${maturityY1.residualCash} != ${expectedProceeds.netProceedsMan}`,
  );
}
if (Math.abs(maturityY1.returnMan - 1) > 0.05) {
  throw new Error(`maturity returnMan ${maturityY1.returnMan} != 1`);
}
if (
  Math.abs(maturityY1.capitalGainsTaxMan - expectedProceeds.taxMan) > 0.05
) {
  throw new Error(
    `maturity tax ${maturityY1.capitalGainsTaxMan} != ${expectedProceeds.taxMan}`,
  );
}
console.log('OK time deposit maturity: simple interest + 20.315% tax → residual');

console.log('OK savings CF');
