/**
 * iDeCo 職業別掛金上限の簡易検証
 * npx tsx scripts/verify-ideco-limit.mjs
 */
import {
  IDECO_LIMIT_NO_CORPORATE_PENSION_YEN,
  IDECO_LIMIT_TYPE1_YEN,
  IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN,
  IDECO_OCCUPANCY_LABELS,
  applyIdecoOccupancySelection,
  calcIdecoMonthlyContributionYen,
  calcMemberCorporateDcMonthlyYen,
  calcMemberDbOtherSystemMonthlyYen,
  clampIdecoContributionPeriod,
  clampIdecoContributionToLimit,
  defaultIdecoCorporatePensionFlags,
  isCorporateDcContributionOverCeiling,
  isIdecoContributionOverLimit,
  listIdecoOccupancyOptionsFromIncome,
  memberHasCorporateDcEntry,
  memberHasDbEntry,
  reconcileMemberIdecoCorporatePensions,
  resolveContinuousIdecoOccupancySegmentEnd,
  resolveCorporateDcCombinedCeilingYen,
  resolveIdecoContributionEndCap,
  resolveIdecoContributionMaxAge,
  resolveIdecoContributionPeriodForOccupancy,
  resolveIdecoCorporatePensionFlags,
  resolveIdecoMonthlyLimitYen,
  resolveIdecoOccupancy,
  resolveIdecoOccupancyAtAgeMonth,
  showsIdecoCorporatePensionFlags,
  syncIdecoCorporateDcFlags,
} from '../src/lib/idecoContributionLimit.ts';
import {
  createSavingsEntry,
  setMemberCorporateDcEnrollment,
  setMemberDbEnrollment,
} from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import {
  createDefaultHeadIncome,
  createIncomeEntry,
} from '../src/lib/incomeDefaults.ts';

const referenceDate = new Date(2026, 5, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- 上限マトリクス（企業型DCなし／事業主0のときは従来どおり） ---
const limitCases = [
  ['self_employed', false, false, IDECO_LIMIT_TYPE1_YEN],
  ['self_employed', true, true, IDECO_LIMIT_TYPE1_YEN],
  ['spouse_no_income', false, false, IDECO_LIMIT_NO_CORPORATE_PENSION_YEN],
  ['spouse_no_income', true, true, IDECO_LIMIT_NO_CORPORATE_PENSION_YEN],
  ['employee', false, false, IDECO_LIMIT_NO_CORPORATE_PENSION_YEN],
  ['employee', true, false, IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN],
  ['employee', false, true, IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN],
  ['employee', true, true, IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN],
  ['civil_servant', false, false, IDECO_LIMIT_NO_CORPORATE_PENSION_YEN],
  ['civil_servant', false, true, IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN],
  ['civil_servant', true, false, IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN],
];

for (const [occupancy, hasDc, hasDb, expected] of limitCases) {
  const got = resolveIdecoMonthlyLimitYen(occupancy, {
    hasCorporateDc: hasDc,
    hasDb,
  });
  assert(
    got === expected,
    `limit ${occupancy} dc=${hasDc} db=${hasDb}: got ${got}, expected ${expected}`,
  );
}
console.log('OK limit matrix');

// --- 残余方式: 事業主掛金に応じて iDeCo 上限が減る ---
assert(
  resolveIdecoMonthlyLimitYen(
    'employee',
    { hasCorporateDc: true, hasDb: false },
    { employerDcMonthlyYen: 40_000 },
  ) === 15_000,
  'employer 4万 → iDeCo 1.5万',
);
assert(
  resolveIdecoMonthlyLimitYen(
    'employee',
    { hasCorporateDc: true, hasDb: false },
    { employerDcMonthlyYen: 50_000 },
  ) === 5_000,
  'employer 5万 → iDeCo 0.5万',
);
assert(
  resolveIdecoMonthlyLimitYen(
    'employee',
    { hasCorporateDc: true, hasDb: false },
    { employerDcMonthlyYen: 55_000 },
  ) === 0,
  'employer 5.5万 → iDeCo 0',
);
assert(
  resolveIdecoMonthlyLimitYen(
    'employee',
    { hasCorporateDc: true, hasDb: true },
    {
      employerDcMonthlyYen: 20_000,
      dbOtherSystemMonthlyYen: 27_500,
    },
  ) === 7_000,
  'DC+DB employer 2万 other 2.75万 → residual 0.75万 → floor 7000',
);
assert(
  resolveIdecoMonthlyLimitYen(
    'employee',
    { hasCorporateDc: true, hasDb: true },
    {
      employerDcMonthlyYen: 20_000,
      dbOtherSystemMonthlyYen: 10_000,
    },
  ) === 20_000,
  'DC+DB other 1万 → residual 2.5万 → cap 2万',
);
console.log('OK residual iDeCo limit from employer DC');

// --- 企業型DC合計枠 ---
{
  const members = createDefaultFamily();
  const head = members.find((m) => m.role === 'head');
  assert(head, 'head');
  const dc = createSavingsEntry('dc', head, referenceDate, {
    employerContributionMode: 'monthly',
    employerContributionMan: 3,
    employeeContributionMode: 'monthly',
    employeeContributionMan: 3,
  });
  const monthly = calcMemberCorporateDcMonthlyYen([dc]);
  assert(monthly.employerYen === 30_000, `employer 3万 got ${monthly.employerYen}`);
  assert(monthly.employeeYen === 30_000, `employee 3万 got ${monthly.employeeYen}`);
  assert(monthly.totalYen === 60_000, 'total 6万');
  assert(
    isCorporateDcContributionOverCeiling(monthly, false) === true,
    '6万 > 5.5万 ceiling',
  );
  assert(
    resolveCorporateDcCombinedCeilingYen(true, 27_500) === 27_500,
    'DB other 2.75万 → DC ceiling 2.75万',
  );
  assert(
    resolveCorporateDcCombinedCeilingYen(true, 10_000) === 45_000,
    'DB other 1万 → DC ceiling 4.5万',
  );

  const db = createSavingsEntry('db', head, referenceDate, {
    otherSystemContributionMan: 1.5,
  });
  assert(
    calcMemberDbOtherSystemMonthlyYen([db]) === 15_000,
    'db other input 1.5万',
  );
  console.log('OK corporate DC combined ceiling + DB other input');
}
assert(
  showsIdecoCorporatePensionFlags('employee') === true,
  'employee should show flags',
);
assert(
  showsIdecoCorporatePensionFlags('civil_servant') === true,
  'civil_servant should show flags',
);
assert(
  showsIdecoCorporatePensionFlags('self_employed') === false,
  'self_employed should hide flags',
);
assert(
  showsIdecoCorporatePensionFlags('spouse_no_income') === false,
  'spouse should hide flags',
);
console.log('OK flag visibility');

const civilDefaults = defaultIdecoCorporatePensionFlags({
  occupancy: 'civil_servant',
  memberHasCorporateDcEntry: false,
});
assert(civilDefaults.hasDb === true, 'civil servant default hasDb');
assert(civilDefaults.hasCorporateDc === false, 'civil servant default no DC');

const employeeWithDc = defaultIdecoCorporatePensionFlags({
  occupancy: 'employee',
  memberHasCorporateDcEntry: true,
});
assert(employeeWithDc.hasCorporateDc === true, 'employee with dc entry');
assert(employeeWithDc.hasDb === false, 'employee default no DB');

const unresolvedCivil = resolveIdecoCorporatePensionFlags(
  {},
  'civil_servant',
);
assert(unresolvedCivil.hasDb === true, 'undefined hasDb → true for civil');
console.log('OK defaults');

assert(
  calcIdecoMonthlyContributionYen({
    contributionMode: 'monthly',
    contributionMan: 2,
  }) === 20_000,
  'monthly 2万 → 20000 yen',
);
assert(
  calcIdecoMonthlyContributionYen({
    contributionMode: 'annual',
    contributionMan: 24,
  }) === 20_000,
  'annual 24万 → 20000 yen/mo',
);
assert(
  isIdecoContributionOverLimit(
    { contributionMode: 'monthly', contributionMan: 2.3 },
    IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN,
  ) === true,
  '2.3万/月 over 2万 limit',
);
assert(
  isIdecoContributionOverLimit(
    { contributionMode: 'monthly', contributionMan: 2 },
    IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN,
  ) === false,
  '2万/月 at limit',
);
console.log('OK contribution compare');

// --- 職業自動判定 ---
const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
const spouse = members.find((m) => m.role === 'spouse');
assert(head, 'head exists');

function occupancyFor(member, category) {
  const entries =
    category == null
      ? []
      : [
          createIncomeEntry(
            member.id,
            category,
            member.age,
            // 基準月（6月）をカバーするよう年初開始にする
            1,
            member,
          ),
        ];
  return resolveIdecoOccupancy(member, entries, referenceDate);
}

assert(
  occupancyFor(head, 'self_employed') === 'self_employed',
  `self_employed → ${IDECO_OCCUPANCY_LABELS.self_employed}`,
);
assert(
  occupancyFor(head, 'employee') === 'employee',
  `employee → ${IDECO_OCCUPANCY_LABELS.employee}`,
);
assert(
  occupancyFor(head, 'civil_servant') === 'civil_servant',
  `civil_servant → ${IDECO_OCCUPANCY_LABELS.civil_servant}`,
);
assert(
  occupancyFor(head, 'part_time') === 'employee',
  'part_time → employee',
);

const headDefault = createDefaultHeadIncome(
  head,
  referenceDate.getMonth() + 1,
);
assert(
  resolveIdecoOccupancy(head, headDefault, referenceDate) === 'employee',
  'default head income → employee',
);

if (spouse) {
  assert(
    resolveIdecoOccupancy(spouse, [], referenceDate) === 'spouse_no_income',
    'spouse no income → spouse_no_income',
  );
}
console.log('OK occupancy resolve');

// --- 拠出上限年齢 ---
assert(resolveIdecoContributionMaxAge('employee') === 65, 'employee max 65');
assert(resolveIdecoContributionMaxAge('civil_servant') === 65, 'civil max 65');
assert(resolveIdecoContributionMaxAge('self_employed') === 65, 'self max 65');
assert(
  resolveIdecoContributionMaxAge('spouse_no_income') === 60,
  'spouse max 60',
);

const capEmployee = resolveIdecoContributionEndCap('employee', {
  birthMonth: 6,
});
assert(capEmployee.endAge === 65 && capEmployee.endMonth === 6, 'cap 65歳6月');

const capped = clampIdecoContributionPeriod(
  {
    id: 't',
    category: 'ideco',
    name: 'iDeCo',
    balanceMan: 0,
    contributionMan: 2,
    contributionMode: 'monthly',
    expectedReturnRatePct: 3,
    startAge: 40,
    startMonth: 1,
    endMode: 'lifetime',
    endAge: 90,
    endMonth: 12,
  },
  { birthMonth: 3, age: 40 },
  'employee',
);
assert(capped.endMode === 'until', 'lifetime → until');
assert(capped.endAge === 65 && capped.endMonth === 3, 'clamped to 65到達月');

const overAge = clampIdecoContributionPeriod(
  {
    ...capped,
    endMode: 'until',
    endAge: 70,
    endMonth: 12,
  },
  { birthMonth: 3, age: 40 },
  'employee',
);
assert(overAge.endAge === 65 && overAge.endMonth === 3, '70歳 → 65歳3月');

const spouseCap = clampIdecoContributionPeriod(
  {
    ...capped,
    idecoOccupancy: 'spouse_no_income',
    endMode: 'until',
    endAge: 65,
    endMonth: 12,
  },
  { birthMonth: 8, age: 40 },
  'spouse_no_income',
);
assert(
  spouseCap.endAge === 60 && spouseCap.endMonth === 8,
  'spouse clamped to 60到達月',
);
console.log('OK contribution end age');

// --- 職歴切替: 会社員 40–50 → 自営業 51〜 ---
{
  const careerHead = {
    ...head,
    age: 40,
    birthMonth: 1,
  };
  const employeeEntry = createIncomeEntry(
    careerHead.id,
    'employee',
    40,
    1,
    careerHead,
  );
  employeeEntry.periods = [
    {
      ...employeeEntry.periods[0],
      startAge: 40,
      startMonth: 1,
      endAge: 50,
      endMonth: 12,
    },
  ];
  const selfEntry = createIncomeEntry(
    careerHead.id,
    'self_employed',
    40,
    1,
    careerHead,
  );
  selfEntry.periods = [
    {
      ...selfEntry.periods[0],
      startAge: 51,
      startMonth: 1,
      endAge: 65,
      endMonth: 12,
    },
  ];
  const careerIncomes = [employeeEntry, selfEntry];

  assert(
    resolveIdecoOccupancyAtAgeMonth(
      careerHead,
      careerIncomes,
      referenceDate,
      40,
      1,
    ) === 'employee',
    'at 40/1 → employee',
  );
  assert(
    resolveIdecoOccupancyAtAgeMonth(
      careerHead,
      careerIncomes,
      referenceDate,
      51,
      1,
    ) === 'self_employed',
    'at 51/1 → self_employed',
  );

  const segEmployee = resolveContinuousIdecoOccupancySegmentEnd(
    careerHead,
    careerIncomes,
    referenceDate,
    40,
    1,
  );
  assert(
    segEmployee.endAge === 50 && segEmployee.endMonth === 12,
    `employee segment ends 50/12 got ${segEmployee.endAge}/${segEmployee.endMonth}`,
  );

  const capEmployeeCareer = resolveIdecoContributionEndCap(
    'employee',
    careerHead,
    {
      incomeEntries: careerIncomes,
      referenceDate,
      startAge: 40,
      startMonth: 1,
    },
  );
  assert(
    capEmployeeCareer.endAge === 50 && capEmployeeCareer.endMonth === 12,
    'employee account end cap = segment end',
  );

  const capSelf = resolveIdecoContributionEndCap('self_employed', careerHead, {
    incomeEntries: careerIncomes,
    referenceDate,
    startAge: 51,
    startMonth: 1,
  });
  assert(
    capSelf.endAge === 65 && capSelf.endMonth === 1,
    `self_employed cap statutory 65/birth got ${capSelf.endAge}/${capSelf.endMonth}`,
  );
  assert(
    resolveIdecoMonthlyLimitYen('self_employed', {
      hasCorporateDc: false,
      hasDb: false,
    }) === IDECO_LIMIT_TYPE1_YEN,
    'self_employed limit 6.8万',
  );

  const clampedEmployee = clampIdecoContributionPeriod(
    {
      id: 'ideco-emp',
      category: 'ideco',
      name: 'iDeCo',
      balanceMan: 0,
      contributionMan: 2,
      contributionMode: 'monthly',
      expectedReturnRatePct: 3,
      startAge: 40,
      startMonth: 1,
      endMode: 'until',
      endAge: 65,
      endMonth: 12,
    },
    careerHead,
    'employee',
    careerIncomes,
    referenceDate,
  );
  assert(
    clampedEmployee.endAge === 50 && clampedEmployee.endMonth === 12,
    `clamp employee account to 50/12 got ${clampedEmployee.endAge}/${clampedEmployee.endMonth}`,
  );

  const clampedSelf = clampIdecoContributionPeriod(
    {
      id: 'ideco-self',
      category: 'ideco',
      name: 'iDeCo',
      balanceMan: 0,
      contributionMan: 6,
      contributionMode: 'monthly',
      expectedReturnRatePct: 3,
      startAge: 51,
      startMonth: 1,
      endMode: 'until',
      endAge: 70,
      endMonth: 12,
    },
    careerHead,
    'self_employed',
    careerIncomes,
    referenceDate,
  );
  assert(
    clampedSelf.endAge === 65 && clampedSelf.endMonth === 1,
    `clamp self account to 65/1 got ${clampedSelf.endAge}/${clampedSelf.endMonth}`,
  );

  const options = listIdecoOccupancyOptionsFromIncome(
    careerHead,
    careerIncomes,
  );
  assert(options.includes('employee'), 'options include employee');
  assert(options.includes('self_employed'), 'options include self_employed');

  const periodSelf = resolveIdecoContributionPeriodForOccupancy(
    'self_employed',
    careerHead,
    careerIncomes,
    referenceDate,
  );
  assert(
    periodSelf.startAge === 51 && periodSelf.startMonth === 1,
    `self period start 51/1 got ${periodSelf.startAge}/${periodSelf.startMonth}`,
  );
  assert(
    periodSelf.endAge === 65 && periodSelf.endMonth === 1,
    `self period end capped got ${periodSelf.endAge}/${periodSelf.endMonth}`,
  );

  const selected = applyIdecoOccupancySelection(
    {
      id: 'ideco-pick',
      category: 'ideco',
      name: 'iDeCo',
      balanceMan: 0,
      contributionMan: 3,
      contributionMode: 'monthly',
      expectedReturnRatePct: 3,
      startAge: 40,
      startMonth: 1,
      endMode: 'until',
      endAge: 65,
      endMonth: 12,
      idecoOccupancy: 'employee',
    },
    'self_employed',
    careerHead,
    careerIncomes,
    referenceDate,
  );
  assert(selected.idecoOccupancy === 'self_employed', 'selected occupancy');
  assert(
    selected.startAge === 51 && selected.startMonth === 1,
    `select self → start 51/1 got ${selected.startAge}/${selected.startMonth}`,
  );
  assert(
    selected.endAge === 65 && selected.endMonth === 1,
    `select self → end 65/1 got ${selected.endAge}/${selected.endMonth}`,
  );

  const selectedEmp = applyIdecoOccupancySelection(
    selected,
    'employee',
    careerHead,
    careerIncomes,
    referenceDate,
  );
  assert(
    selectedEmp.startAge === 40 &&
      selectedEmp.endAge === 50 &&
      selectedEmp.endMonth === 12,
    `select employee → 40–50/12 got ${selectedEmp.startAge}-${selectedEmp.endAge}/${selectedEmp.endMonth}`,
  );
  console.log('OK occupancy dropdown period sync');
}

// --- DC口座 ↔ iDeCo 双方向同期・DB同期・掛金クランプ ---
{
  const empHead = {
    ...head,
    age: 40,
    birthMonth: 1,
  };
  const empIncome = [
    createIncomeEntry(empHead.id, 'employee', 40, 1, empHead),
  ];

  let ideco = createSavingsEntry('ideco', empHead, referenceDate, {
    idecoOccupancy: 'employee',
    hasCorporateDc: false,
    hasDb: false,
    contributionMan: 2.3,
    contributionMode: 'monthly',
  });
  let entries = [ideco];

  // あり → DC口座作成＋フラグON＋掛金クランプ（2.3→2.0）
  entries = setMemberCorporateDcEnrollment(
    entries,
    true,
    empHead,
    empIncome,
    referenceDate,
  );
  assert(memberHasCorporateDcEntry(entries), 'DC enrollment creates dc entry');
  const idecoAfterOn = entries.find((e) => e.category === 'ideco');
  assert(idecoAfterOn?.hasCorporateDc === true, 'hasCorporateDc synced on');
  assert(
    idecoAfterOn?.contributionMan === 2,
    `contribution clamped to 2 got ${idecoAfterOn?.contributionMan}`,
  );

  // なし → DC削除＋フラグOFF
  entries = setMemberCorporateDcEnrollment(
    entries,
    false,
    empHead,
    empIncome,
    referenceDate,
  );
  assert(!memberHasCorporateDcEntry(entries), 'DC off removes dc entries');
  const idecoAfterOff = entries.find((e) => e.category === 'ideco');
  assert(idecoAfterOff?.hasCorporateDc === false, 'hasCorporateDc synced off');

  // 片方向崩れの修復: フラグtrueだが口座なし → syncでfalse
  entries = [
    {
      ...idecoAfterOff,
      hasCorporateDc: true,
      contributionMan: 2.3,
    },
  ];
  entries = syncIdecoCorporateDcFlags(entries);
  assert(
    entries[0].hasCorporateDc === false,
    'sync clears stale hasCorporateDc when no dc',
  );

  // 口座追加のみ → syncでtrue、reconcileでクランプ
  const dc = createSavingsEntry('dc', empHead, referenceDate, {
    contributionMode: 'none',
    contributionMan: 0,
  });
  entries = syncIdecoCorporateDcFlags([
    { ...entries[0], contributionMan: 2.3 },
    dc,
  ]);
  assert(entries[0].hasCorporateDc === true, 'sync sets hasCorporateDc from dc');
  entries = reconcileMemberIdecoCorporatePensions(
    entries,
    empHead,
    empIncome,
    referenceDate,
  );
  assert(
    entries.find((e) => e.category === 'ideco')?.contributionMan === 2,
    'reconcile clamps after dc add',
  );

  // DB同期: 口座作成＋全 iDeCo の hasDb
  const idecoA = createSavingsEntry('ideco', empHead, referenceDate, {
    idecoOccupancy: 'employee',
    hasCorporateDc: false,
    hasDb: false,
    contributionMan: 2.3,
    contributionMode: 'monthly',
    name: 'iDeCo A',
  });
  const idecoB = createSavingsEntry('ideco', empHead, referenceDate, {
    idecoOccupancy: 'employee',
    hasCorporateDc: false,
    hasDb: false,
    contributionMan: 2.3,
    contributionMode: 'monthly',
    name: 'iDeCo B',
  });
  entries = setMemberDbEnrollment(
    [idecoA, idecoB],
    true,
    empHead,
    empIncome,
    referenceDate,
  );
  assert(memberHasDbEntry(entries), 'DB enrollment creates db entry');
  const idecon = entries.filter((e) => e.category === 'ideco');
  assert(idecon.length === 2, 'two ideco remain');
  assert(
    idecon.every((e) => e.hasDb === true),
    'hasDb synced to all ideco',
  );
  assert(
    idecon.every((e) => e.contributionMan === 2),
    'db on clamps all ideco contributions',
  );

  entries = setMemberDbEnrollment(
    entries,
    false,
    empHead,
    empIncome,
    referenceDate,
  );
  assert(!memberHasDbEntry(entries), 'DB off removes db entries');
  assert(
    entries.filter((e) => e.category === 'ideco').every((e) => e.hasDb === false),
    'hasDb cleared when db removed',
  );

  // clampIdecoContributionToLimit 単体
  const clamped = clampIdecoContributionToLimit(
    {
      ...idecoA,
      contributionMan: 3,
      contributionMode: 'monthly',
    },
    'employee',
    { hasCorporateDc: true, hasDb: false },
  );
  assert(clamped.contributionMan === 2, 'clamp monthly to 2');

  console.log('OK DC/DB sync and clamp');
}

console.log('All iDeCo limit checks passed.');
