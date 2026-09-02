/**
 * iDeCo 受取（一括／年金）の簡易検証
 * npx tsx scripts/verify-ideco-payout.mjs
 */
import {
  IDECO_ANNUITY_MAX_YEARS,
  IDECO_ANNUITY_MIN_YEARS,
  IDECO_PAYOUT_MAX_AGE,
  IDECO_PAYOUT_MIN_AGE,
  calcInclusiveMonthCount,
  clampIdecoPayoutFields,
  getIdecoPayoutAgeOptions,
  resolveEarliestPayoutAgeFromJoin,
  resolveIdecoPayoutStart,
  resolveMinPayoutAgeFromEnrollmentYears,
  resolvePensionEnrollmentPayoutFloorAge,
} from '../src/lib/idecoPayout.ts';
import { projectSavingsForYear, estimateInvestBalanceManAt, resolveIdecoOncePayoutMan } from '../src/lib/savingsCashFlow.ts';
import {
  collectIdecoPayoutForMemberYear,
} from '../src/lib/idecoTax.ts';
import {
  createDefaultSavingsState,
  createSavingsEntry,
  updateSavingsByMember,
} from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { supportsSavingsWithdrawal } from '../src/lib/savingsLabels.ts';

const referenceDate = new Date(2026, 0, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(supportsSavingsWithdrawal('ideco') === true, 'ideco supports withdrawal');

const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
assert(head, 'head exists');

const member65 = { ...head, age: 65, birthMonth: 1 };

const baseEntry = createSavingsEntry('ideco', member65, referenceDate, {
  balanceMan: 100,
  contributionMan: 0,
  contributionMode: 'none',
  endMode: 'until',
  endAge: 65,
  endMonth: 1,
  startAge: 40,
  startMonth: 1,
  expectedReturnRatePct: 0,
  withdrawalMode: 'none',
});

// 開始年齢クランプ: 60未満は引き上げ、積立終了翌月以降
const early = clampIdecoPayoutFields(
  {
    ...baseEntry,
    withdrawalMode: 'once',
    withdrawalStartAge: 50,
    withdrawalStartMonth: 1,
    withdrawalMan: 100,
  },
  member65,
  100,
);
assert(
  early.withdrawalStartAge >= IDECO_PAYOUT_MIN_AGE,
  `start >= 60 got ${early.withdrawalStartAge}`,
);
assert(
  early.withdrawalStartAge > 65 ||
    (early.withdrawalStartAge === 65 && early.withdrawalStartMonth >= 2),
  `start after contrib end: ${early.withdrawalStartAge}/${early.withdrawalStartMonth}`,
);

const tooLate = clampIdecoPayoutFields(
  {
    ...baseEntry,
    withdrawalMode: 'once',
    withdrawalStartAge: 80,
    withdrawalStartMonth: 1,
    withdrawalMan: 100,
  },
  member65,
  100,
);
assert(
  tooLate.withdrawalStartAge <= IDECO_PAYOUT_MAX_AGE,
  `start <= 75 got ${tooLate.withdrawalStartAge}`,
);
console.log('OK payout start clamp');

const yearsLow = clampIdecoPayoutFields(
  {
    ...baseEntry,
    withdrawalMode: 'drawdown',
    idecoAnnuityPeriodMode: 'years',
    withdrawalStartAge: 66,
    withdrawalStartMonth: 1,
    withdrawalYears: 2,
  },
  member65,
  120,
);
assert(
  yearsLow.withdrawalYears === IDECO_ANNUITY_MIN_YEARS,
  `years min ${yearsLow.withdrawalYears}`,
);

const yearsHigh = clampIdecoPayoutFields(
  {
    ...baseEntry,
    withdrawalMode: 'drawdown',
    idecoAnnuityPeriodMode: 'years',
    withdrawalStartAge: 66,
    withdrawalStartMonth: 1,
    withdrawalYears: 30,
  },
  member65,
  120,
);
assert(
  yearsHigh.withdrawalYears === IDECO_ANNUITY_MAX_YEARS,
  `years max ${yearsHigh.withdrawalYears}`,
);
console.log('OK annuity years clamp');

const untilAge = clampIdecoPayoutFields(
  {
    ...baseEntry,
    withdrawalMode: 'drawdown',
    idecoAnnuityPeriodMode: 'until_age',
    withdrawalStartAge: 65,
    withdrawalStartMonth: 1,
    withdrawalEndMode: 'until',
    withdrawalEndAge: 75,
    withdrawalEndMonth: 1,
  },
  member65,
  120,
);
assert(untilAge.idecoAnnuityPeriodMode === 'until_age', 'until_age mode');
assert(untilAge.withdrawalEndAge === 75, 'end age 75');
const months = calcInclusiveMonthCount(65, 1, 75, 1);
assert(months === 10 * 12 + 1, `months ${months}`);
assert(untilAge.withdrawalMan > 0, 'monthly amount > 0');
console.log('OK until_age annuity');

const start = resolveIdecoPayoutStart(baseEntry, member65, {
  age: 40,
  month: 1,
});
assert(start.age >= IDECO_PAYOUT_MIN_AGE, 'resolve start >= 60');
console.log('OK resolveIdecoPayoutStart');

// 受給開始未設定のまま assetsMan を現在年齢で渡すと一括額が0近くになる問題の回帰防止:
// resolveIdecoPayoutStart 後の年月で見積もった額を渡すと一致する
{
  const fresh = createSavingsEntry('ideco', head, referenceDate);
  assert(fresh.withdrawalMode === 'once', 'default once');
  const start = resolveIdecoPayoutStart(fresh, head);
  const assets = Math.round(
    estimateInvestBalanceManAt({
      entry: fresh,
      member: head,
      memberEntries: [fresh],
      referenceDate,
      targetAge: start.age,
      targetMonth: start.month,
    }),
  );
  const clamped = clampIdecoPayoutFields(fresh, head, assets);
  assert(
    clamped.withdrawalMan === assets,
    `lump equals estimated assets (${clamped.withdrawalMan} vs ${assets})`,
  );
  assert(clamped.withdrawalMan > 0, 'default contrib → lump > 0');
  console.log('OK lump sync with payout start assets');
}

// withdrawalMan=0 でも税・CF は残高見込みベース
{
  const fresh = createSavingsEntry('ideco', head, referenceDate, {
    withdrawalMode: 'once',
    withdrawalMan: 0,
  });
  const start = resolveIdecoPayoutStart(fresh, head);
  const assets = resolveIdecoOncePayoutMan(fresh, head, [fresh], referenceDate);
  assert(assets > 0, `estimated once payout > 0 got ${assets}`);

  const payoutYear =
    referenceDate.getFullYear() + (start.age - head.age);
  const taxDetail = collectIdecoPayoutForMemberYear(
    head,
    [
      {
        ...fresh,
        withdrawalStartAge: start.age,
        withdrawalStartMonth: start.month,
        withdrawalMan: 0,
      },
    ],
    referenceDate,
    payoutYear,
  );
  assert(
    Math.abs(taxDetail.lumpSumMan - assets) < 0.5,
    `tax lump uses estimate (${taxDetail.lumpSumMan} vs ${assets})`,
  );
  assert(
    taxDetail.retirement != null && taxDetail.retirement.revenueYen === assets * 10_000,
    'retirement revenue from estimate',
  );
  console.log('OK tax uses estimate when withdrawalMan=0');
}

// CF: 一括受取（65歳1月）
const lump = clampIdecoPayoutFields(
  {
    ...baseEntry,
    balanceMan: 200,
    contributionMode: 'none',
    contributionMan: 0,
    expectedReturnRatePct: 0,
    withdrawalMode: 'once',
    withdrawalStartAge: 65,
    withdrawalStartMonth: 1,
  },
  member65,
  200,
);

let state = updateSavingsByMember(createDefaultSavingsState(), head.id, [lump]);

const y0 = projectSavingsForYear({
  savingsState: state,
  familyMembers: [member65],
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

assert(
  Math.abs(y0.withdrawalMan - 200) < 0.5,
  `lump withdrawal ${y0.withdrawalMan}`,
);
assert(Math.abs(y0.residualCash - 200) < 0.5, `lump residual ${y0.residualCash}`);
assert(
  Math.abs(y0.investBreakdown.ideco.balance) < 0.5,
  `lump ideco balance ${y0.investBreakdown.ideco.balance}`,
);
assert(Math.abs(y0.capitalGainsTaxMan) < 0.01, 'lump tax 0');
console.log('OK CF lump sum');

// CF: 年金受取
const annuity = clampIdecoPayoutFields(
  {
    ...baseEntry,
    balanceMan: 120,
    contributionMode: 'none',
    contributionMan: 0,
    expectedReturnRatePct: 0,
    withdrawalMode: 'drawdown',
    idecoAnnuityPeriodMode: 'years',
    withdrawalStartAge: 65,
    withdrawalStartMonth: 1,
    withdrawalYears: 10,
  },
  member65,
  120,
);

state = updateSavingsByMember(createDefaultSavingsState(), head.id, [annuity]);
const yAnnuity = projectSavingsForYear({
  savingsState: state,
  familyMembers: [member65],
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

assert(yAnnuity.withdrawalMan > 0, `annuity withdrawal ${yAnnuity.withdrawalMan}`);
assert(
  yAnnuity.investBreakdown.ideco.balance < 120,
  `annuity balance ${yAnnuity.investBreakdown.ideco.balance}`,
);
assert(yAnnuity.residualCash > 0, `annuity residual ${yAnnuity.residualCash}`);
assert(Math.abs(yAnnuity.capitalGainsTaxMan) < 0.01, 'annuity tax 0');
console.log('OK CF annuity');

// 現在残高＋積立＋想定利回り: 年初残高に年率、当年積立は翌年から利回り対象
{
  const grower = createSavingsEntry('ideco', head, referenceDate, {
    balanceMan: 100,
    contributionMode: 'monthly',
    contributionMan: 1,
    expectedReturnRatePct: 10,
    startAge: head.age,
    startMonth: 1,
    endMode: 'until',
    endAge: Math.min(65, head.age + 20),
    endMonth: 12,
    withdrawalMode: 'once',
    withdrawalStartAge: 65,
    withdrawalStartMonth: 1,
    withdrawalMan: 0,
  });
  let growState = updateSavingsByMember(
    createDefaultSavingsState(),
    head.id,
    [grower],
  );
  const year = referenceDate.getFullYear();
  const yGrow1 = projectSavingsForYear({
    savingsState: growState,
    familyMembers: [head],
    referenceDate,
    calendarYear: year,
    monthStart: 1,
    monthEnd: 12,
    accountBalances: {},
    investPrincipalByEntry: {},
    residualCash: 0,
    annualBalance: 0,
    initialize: true,
  });
  assert(
    Math.abs(yGrow1.returnMan - 10) < 0.01,
    `y1 return on opening 100 → 10 got ${yGrow1.returnMan}`,
  );
  assert(
    Math.abs(yGrow1.contributionMan - 12) < 0.01,
    `y1 contrib 12 got ${yGrow1.contributionMan}`,
  );
  assert(
    Math.abs(yGrow1.investBreakdown.ideco.balance - 122) < 0.01,
    `y1 end 100*1.1+12=122 got ${yGrow1.investBreakdown.ideco.balance}`,
  );

  const yGrow2 = projectSavingsForYear({
    savingsState: growState,
    familyMembers: [head],
    referenceDate,
    calendarYear: year + 1,
    monthStart: 1,
    monthEnd: 12,
    accountBalances: yGrow1.accountBalances,
    investPrincipalByEntry: yGrow1.investPrincipalByEntry,
    residualCash: yGrow1.residualCash,
    annualBalance: 0,
    initialize: false,
  });
  assert(
    Math.abs(yGrow2.returnMan - 12.2) < 0.01,
    `y2 return on 122 → 12.2 got ${yGrow2.returnMan}`,
  );
  assert(
    Math.abs(yGrow2.investBreakdown.ideco.balance - 146.2) < 0.01,
    `y2 end 122*1.1+12=146.2 got ${yGrow2.investBreakdown.ideco.balance}`,
  );
  console.log('OK balance + contribution compound return');
}

// --- 通算加入者等期間 → 最早受給年齢（税の10年ルールとは別） ---
const ladder = [
  [10, 60],
  [9.9, 61],
  [8, 61],
  [7.9, 62],
  [6, 62],
  [5.9, 63],
  [4, 63],
  [3.9, 64],
  [2, 64],
  [1.9, 65],
  [0, 65],
];
for (const [years, expected] of ladder) {
  const got = resolveMinPayoutAgeFromEnrollmentYears(years);
  assert(
    got === expected,
    `10y rule ${years}y → ${expected}, got ${got}`,
  );
}
console.log('OK payout-age ladder');

// 加入50歳 → 60歳時点で10年以上 → 最早60
assert(
  resolveEarliestPayoutAgeFromJoin({ age: 50, month: 1 }, 1) === 60,
  'join 50 → earliest 60',
);

// 加入58歳4月・誕生日4月: 60歳時点で約2年 → 段階的に最早が上がる
const lateJoinEarliest = resolveEarliestPayoutAgeFromJoin(
  { age: 58, month: 4 },
  4,
);
assert(
  lateJoinEarliest >= 63 && lateJoinEarliest <= 65,
  `join 58/4 earliest in 63–65 got ${lateJoinEarliest}`,
);

const shortEntry = createSavingsEntry('ideco', member65, referenceDate, {
  balanceMan: 50,
  contributionMan: 0,
  contributionMode: 'none',
  startAge: 58,
  startMonth: 4,
  endMode: 'until',
  endAge: 58,
  endMonth: 4,
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: 60,
  withdrawalStartMonth: 1,
  withdrawalMan: 50,
});
const shortFloor = resolvePensionEnrollmentPayoutFloorAge(shortEntry, {
  birthMonth: 4,
});
assert(
  shortFloor != null && shortFloor > 60,
  `short enrollment floor > 60 got ${shortFloor}`,
);
const shortClamped = clampIdecoPayoutFields(shortEntry, member65, 50);
assert(
  shortClamped.withdrawalStartAge >= shortFloor,
  `short clamp start ${shortClamped.withdrawalStartAge} >= floor ${shortFloor}`,
);
const ageOpts = getIdecoPayoutAgeOptions(shortFloor);
assert(
  ageOpts[0] === shortFloor,
  `age options start at floor ${shortFloor} got ${ageOpts[0]}`,
);
console.log('OK enrollment-period payout clamp');

// DC にも通算加入者等期間＋60歳下限
const shortDc = createSavingsEntry('dc', member65, referenceDate, {
  balanceMan: 50,
  contributionMan: 0,
  contributionMode: 'none',
  startAge: 58,
  startMonth: 4,
  endMode: 'until',
  endAge: 58,
  endMonth: 4,
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: 55,
  withdrawalStartMonth: 1,
  withdrawalMan: 50,
});
const dcStart = resolveIdecoPayoutStart(shortDc, member65, {
  age: 55,
  month: 1,
});
assert(dcStart.age >= 60, `DC start >= 60 got ${dcStart.age}`);
assert(
  dcStart.age >= (resolvePensionEnrollmentPayoutFloorAge(shortDc, member65) ?? 60),
  `DC respects enrollment floor got ${dcStart.age}`,
);
console.log('OK DC enrollment-period + age-60 floor');

console.log('All iDeCo payout checks passed.');
