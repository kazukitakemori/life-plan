/**
 * 老齢年金の制度境界回帰テスト
 * npx tsx scripts/verify-pension-old-age.mjs
 */
import assert from 'node:assert/strict';
import {
  getEarlyClaimReductionPerMonthByBirth,
  getMaxOldAgeDeferralAgeByBirth,
  getOldAgeAmountFactor,
  normalizeOldAgeBenefitStart,
  applyBasicDetailAdjustment,
  applyGeneralDetailAdjustment,
} from '../src/lib/pensionOldAge.ts';
import {
  estimateOldAgeAmountsFromIncome,
  estimatePost65EmployeesPensionIncreaseMan,
  getEstimatedOldAgeQualifyingMonthCount,
  getNationalPensionCreditedMonthCount,
} from '../src/lib/pensionEnrollmentEstimate.ts';
import { isEmployeesPensionLiableAtAgeMonth } from '../src/lib/employeesPensionPremium.ts';
import { buildPensionBenefitChartPoints } from '../src/lib/pensionBenefitChartData.ts';
import {
  calcMemberAnnualTaxableOldAgePensionPaymentManByMember,
  calcMemberMonthlyPensionBreakdownMan,
  calcMonthlyPensionEntitlementBreakdownMan,
  getDependentSpousePensionYenPerYear,
} from '../src/lib/pensionIncome.ts';
import { createDefaultPensionMemberState } from '../src/lib/pensionDefaults.ts';
import {
  EARLY_CLAIM_REDUCTION_PER_MONTH,
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
} from '../src/lib/pensionConstants.ts';

assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, 1),
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, 2),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 4, null),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 3, 31),
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
);
assert.equal(
  getEarlyClaimReductionPerMonthByBirth(1962, 5, 1),
  EARLY_CLAIM_REDUCTION_PER_MONTH,
);

assert.equal(
  getOldAgeAmountFactor(60, 0, EARLY_CLAIM_REDUCTION_PER_MONTH),
  0.76,
);
assert.equal(
  getOldAgeAmountFactor(60, 0, EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY),
  0.7,
);


// 繰下げの制度境界: 65歳の途中開始はなく、75歳0か月が現行上限。
assert.equal(getOldAgeAmountFactor(65, 5), 1);
assert.equal(getOldAgeAmountFactor(66, 0), 1.084);
assert.equal(getOldAgeAmountFactor(75, 0), 1.84);
assert.equal(getOldAgeAmountFactor(75, 11), 1.84);
assert.deepEqual(
  normalizeOldAgeBenefitStart(65, 5),
  { startAge: 65, startMonth: 0 },
);
assert.deepEqual(
  normalizeOldAgeBenefitStart(75, 11),
  { startAge: 75, startMonth: 0 },
);

// 昭和27年4月1日以前生まれは繰下げ上限70歳。
assert.equal(getMaxOldAgeDeferralAgeByBirth(1952, 4, 1), 70);
assert.equal(getMaxOldAgeDeferralAgeByBirth(1952, 4, 2), 75);
assert.equal(getMaxOldAgeDeferralAgeByBirth(1952, 4, null), 70);
assert.equal(getMaxOldAgeDeferralAgeByBirth(1952, 3, 31), 70);
assert.equal(getMaxOldAgeDeferralAgeByBirth(1952, 5, 1), 75);
assert.equal(
  getOldAgeAmountFactor(
    75,
    0,
    EARLY_CLAIM_REDUCTION_PER_MONTH,
    70,
  ),
  1.42,
);
assert.deepEqual(
  normalizeOldAgeBenefitStart(75, 0, 70),
  { startAge: 70, startMonth: 0 },
);


// 増減額は内訳本体と二重計上しない。
// 100万円/年を60歳へ繰上げ（0.4%×60月=24%減）なら合計76万円/年。
{
  const adjusted = applyBasicDetailAdjustment(
    {
      basic: 100,
      children: 0,
      additional: 0,
      transfer: 0,
      earlyPayment: 0,
      fund: 0,
    },
    60,
    0,
    EARLY_CLAIM_REDUCTION_PER_MONTH,
  );
  assert.equal(adjusted.basic, 100);
  assert.ok(Math.abs(adjusted.earlyPayment - (-24)) < 1e-9);
  assert.ok(
    Math.abs(
      Object.values(adjusted).reduce((sum, value) => sum + value, 0) - 76
    ) < 1e-9,
  );
}

// 100万円/年を70歳まで繰下げ（0.7%×60月=42%増）なら合計142万円/年。
{
  const adjusted = applyGeneralDetailAdjustment(
    {
      basic: 100,
      transitional: 0,
      dependent: 0,
      payment: 0,
      earlyPayment: 0,
    },
    70,
    0,
  );
  assert.equal(adjusted.basic, 100);
  assert.ok(Math.abs(adjusted.earlyPayment - 42) < 1e-9);
  assert.ok(
    Math.abs(
      Object.values(adjusted).reduce((sum, value) => sum + value, 0) - 142
    ) < 1e-9,
  );
}


function pensionMember({ birthDay = 2, age = 66 } = {}) {
  return {
    id: 'member',
    role: 'head',
    nickname: '本人',
    gender: 'male',
    age,
    birthMonth: 4,
    birthDay,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
}

function employeeIncome(endAge = 75, endMonth = 12) {
  return [{
    id: 'income',
    memberId: 'member',
    category: 'employee',
    periods: [{
      id: 'period',
      startAge: 65,
      startMonth: 4,
      endAge,
      endMonth,
      streamType: 'salary_social_insurance',
      monthlyAmountMan: 40,
      bonuses: [],
      annualAmountMan: 480,
      dependentStatus: 'none',
      taxDependent: false,
      socialInsuranceDependent: false,
      spouseContingencyRate: null,
      annualIncreaseRate: null,
      lumpSumRestoreEndAge: null,
      lumpSumRestoreEndMonth: null,
    }],
  }];
}

const referenceDate = new Date(2026, 8, 1);

// 在職定時改定: 9月時点では前年8月まで、10月分から当年8月までが反映される。
{
  const member = pensionMember();
  const entries = employeeIncome();
  const sep = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    66,
    9,
  ).generalEmployeesYenPerYear;
  const oct = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    66,
    10,
  ).generalEmployeesYenPerYear;
  assert.ok(oct > sep);
}

// 65〜69歳の退職改定: Q7の終了月の翌月から、その終了月までを反映する。
{
  const member = pensionMember();
  const entries = employeeIncome(67, 3);
  const march = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    67,
    3,
  ).generalEmployeesYenPerYear;
  const april = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    67,
    4,
  ).generalEmployeesYenPerYear;
  assert.ok(april > march);
}

// 翌月も加入が続く場合は退職改定を発生させない。
{
  const member = pensionMember();
  const entries = employeeIncome();
  const march = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    67,
    3,
  ).generalEmployeesYenPerYear;
  const april = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    67,
    4,
  ).generalEmployeesYenPerYear;
  assert.equal(april, march);
}

// 厚生年金の被保険者月境界も70歳到達日（誕生日の前日）に合わせる。
// 4月1日生まれは3月31日に70歳到達となるため3月分は算入しない。
// 4月2日生まれは4月1日到達なので3月分までは算入する。
assert.equal(isEmployeesPensionLiableAtAgeMonth(69, 2, 4, 1), true);
assert.equal(isEmployeesPensionLiableAtAgeMonth(69, 3, 4, 1), false);
assert.equal(isEmployeesPensionLiableAtAgeMonth(69, 3, 4, 2), true);
assert.equal(isEmployeesPensionLiableAtAgeMonth(70, 4, 4, 2), false);
// 生年月日の日が未入力の旧データは過大に早く喪失させず、2日以後相当で概算する。
assert.equal(isEmployeesPensionLiableAtAgeMonth(69, 3, 4, null), true);

// 70歳到達改定: 2日以後生まれは誕生月の翌月分から最終加入月までを反映する。
{
  const member = pensionMember({ birthDay: 2 });
  const entries = employeeIncome();
  const april = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    70,
    4,
  ).generalEmployeesYenPerYear;
  const may = estimatePost65EmployeesPensionIncreaseMan(
    member,
    entries,
    referenceDate,
    70,
    5,
  ).generalEmployeesYenPerYear;
  assert.ok(may > april);
}

// 1日生まれは前月末に70歳到達となるため、誕生月分から改定される。
// また2日以後生まれより最終被保険者月が1か月早い。
{
  const day1 = pensionMember({ birthDay: 1 });
  const day2 = pensionMember({ birthDay: 2 });
  const entries = employeeIncome();

  const day1March = estimatePost65EmployeesPensionIncreaseMan(
    day1,
    entries,
    referenceDate,
    69,
    3,
  ).generalEmployeesYenPerYear;
  const day1April = estimatePost65EmployeesPensionIncreaseMan(
    day1,
    entries,
    referenceDate,
    70,
    4,
  ).generalEmployeesYenPerYear;
  const day2May = estimatePost65EmployeesPensionIncreaseMan(
    day2,
    entries,
    referenceDate,
    70,
    5,
  ).generalEmployeesYenPerYear;

  assert.ok(day1April > day1March);
  assert.ok(day2May > day1April);
}


// 老齢年金は請求月の翌月分から発生。
// 4月1日生まれは3月31日に65歳到達→4月分から、4月2日生まれは4月1日到達→5月分から。
{
  const makeManualState = () => {
    const state = createDefaultPensionMemberState();
    state.benefitSettings.oldAgeBasic = {
      startAge: 65,
      startMonth: 0,
      amountMode: 'manual',
      manualAmountPerYear: 120_000,
    };
    state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
    state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 0;
    state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
    state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;
    return state;
  };

  const day1 = pensionMember({ birthDay: 1, age: 65 });
  const day2 = pensionMember({ birthDay: 2, age: 65 });

  const day1April = calcMemberMonthlyPensionBreakdownMan(
    day1,
    makeManualState(),
    [],
    referenceDate,
    2026,
    4,
  );
  const day2April = calcMemberMonthlyPensionBreakdownMan(
    day2,
    makeManualState(),
    [],
    referenceDate,
    2026,
    4,
  );
  const day2May = calcMemberMonthlyPensionBreakdownMan(
    day2,
    makeManualState(),
    [],
    referenceDate,
    2026,
    5,
  );

  assert.ok(day1April.oldAge.basic.basic > 0);
  assert.equal(day2April.oldAge.basic.basic, 0);
  assert.ok(day2May.oldAge.basic.basic > 0);
}

// 老齢厚生年金の子加算は、老齢厚生年金本体と同じく受給権発生月の翌月分から。
// 4月2日生まれが65歳になる年は、4月分には付けず5月分から加算する。
{
  const pensioner = pensionMember({ birthDay: 2, age: 63 });
  const child = {
    id: 'timing-child',
    role: 'child',
    nickname: '子',
    gender: 'female',
    age: 10,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const state = createDefaultPensionMemberState();
  state.pastEnrollment = 'nenkin-teikibin-over50';
  state.teikibinOver50.employeesPensionGeneralMonths = 240;
  state.benefitSettings.oldAgeBasic.amountMode = 'manual';
  state.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const april = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, child],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    4,
  );
  const may = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, child],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    5,
  );

  assert.equal(april.oldAge.generalEmployees.dependent, 0);
  assert.ok(may.oldAge.generalEmployees.dependent > 0);
}

// 配偶者加給も、本人の老齢厚生年金の受給権発生月の翌月分から加算する。
{
  const pensioner = pensionMember({ birthDay: 2, age: 63 });
  const spouse = {
    ...pensionMember({ birthDay: 2, age: 50 }),
    id: 'timing-spouse',
    role: 'spouse',
    gender: 'female',
  };
  const state = createDefaultPensionMemberState();
  state.pastEnrollment = 'nenkin-teikibin-over50';
  state.teikibinOver50.employeesPensionGeneralMonths = 300;
  state.benefitSettings.oldAgeBasic.amountMode = 'manual';
  state.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const april = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, spouse],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    4,
  );
  const may = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, spouse],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    5,
  );

  assert.equal(april.oldAge.generalEmployees.dependent, 0);
  assert.ok(may.oldAge.generalEmployees.dependent > 0);
}

// 配偶者が20年以上の特別支給の老齢厚生年金の受給権を得た場合、
// 配偶者加給はその受給権発生月の翌月分から停止する。
{
  const pensioner = {
    ...pensionMember({ birthDay: 2, age: 66 }),
    id: 'kakyu-timing-head',
    role: 'head',
  };
  const spouse = {
    ...pensionMember({ birthDay: 2, age: 63 }),
    id: 'kakyu-timing-spouse',
    role: 'spouse',
    gender: 'female',
  };
  const pensionerState = createDefaultPensionMemberState();
  pensionerState.pastEnrollment = 'nenkin-teikibin-over50';
  pensionerState.teikibinOver50.employeesPensionGeneralMonths = 300;
  pensionerState.benefitSettings.oldAgeBasic.amountMode = 'manual';
  pensionerState.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  pensionerState.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  pensionerState.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  pensionerState.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  pensionerState.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const spouseState = createDefaultPensionMemberState();
  spouseState.pastEnrollment = 'nenkin-teikibin-over50';
  spouseState.teikibinOver50.employeesPensionGeneralMonths = 300;
  spouseState.benefitSettings.oldAgeGeneralEmployees.startAge = 63;
  spouseState.benefitSettings.oldAgeGeneralEmployees.startMonth = 0;

  const april = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, spouse],
    {
      [pensioner.id]: pensionerState,
      [spouse.id]: spouseState,
    },
    {},
    referenceDate,
    2026,
    4,
  );
  const may = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, spouse],
    {
      [pensioner.id]: pensionerState,
      [spouse.id]: spouseState,
    },
    {},
    referenceDate,
    2026,
    5,
  );

  assert.ok(april.oldAge.generalEmployees.dependent > 0);
  assert.equal(may.oldAge.generalEmployees.dependent, 0);
}

// 繰下げ待機中の在職停止分は増額対象外。
// 報酬比例120万円/年＋経過的加算12万円/年を66歳0か月まで繰下げる例で、
// 高報酬により報酬比例部分が全額停止なら、増額は経過的加算分だけ残る。
{
  const member = pensionMember({ birthDay: 2, age: 66 });

  const makeOver50State = () => {
    const state = createDefaultPensionMemberState();
    state.pastEnrollment = 'nenkin-teikibin-over50';
    state.teikibinOver50.general.oldAge65.proportional = 1_200_000;
    state.teikibinOver50.general.oldAge65.transitionalAddition = 120_000;
    state.benefitSettings.oldAgeBasic.amountMode = 'manual';
    state.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
    state.benefitSettings.oldAgeGeneralEmployees.startAge = 66;
    state.benefitSettings.oldAgeGeneralEmployees.startMonth = 0;
    state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'auto';
    state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
    state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;
    return state;
  };

  const noWork = calcMemberMonthlyPensionBreakdownMan(
    member,
    makeOver50State(),
    [],
    referenceDate,
    2026,
    5,
  );

  const highIncome = employeeIncome();
  highIncome[0].periods[0].monthlyAmountMan = 100;
  const working = calcMemberMonthlyPensionBreakdownMan(
    member,
    makeOver50State(),
    highIncome,
    referenceDate,
    2026,
    5,
  );

  // 在職なし: (10万円 + 1万円) × 8.4% = 0.924万円/月
  assert.ok(
    Math.abs(noWork.oldAge.generalEmployees.earlyPayment - 0.924) < 1e-9,
  );
  // 報酬比例10万円/月が全額停止なら、その増額0.84万円は除外。
  // 経過的加算1万円/月 × 8.4% = 0.084万円/月だけが増額対象。
  assert.ok(
    Math.abs(working.oldAge.generalEmployees.earlyPayment - 0.084) < 1e-9,
  );
}

// 定期便なし: Q7から見積もる場合も、老齢年金は受給資格期間10年以上が前提。
// 学生納付特例の想定期間は資格期間には入るが、追納なし前提では年金額に反映しない。
{
  const young = pensionMember({ age: 25 });
  const noIncome = [];
  assert.equal(
    getEstimatedOldAgeQualifyingMonthCount(young, noIncome, referenceDate),
    24,
  );
  assert.equal(
    getNationalPensionCreditedMonthCount(young, noIncome, referenceDate),
    0,
  );
  const amount = estimateOldAgeAmountsFromIncome(
    young,
    noIncome,
    referenceDate,
  );
  assert.equal(amount.basicYenPerYear, 0);
  assert.equal(amount.generalEmployeesYenPerYear, 0);
  assert.equal(amount.publicServantYenPerYear, 0);
}

// 20〜59歳までQ7に厚生年金加入が明示されている場合は、大学在学想定の24月を
// 二重に差し引かず、老齢基礎年金の算定月数は480月まで積み上がる。
{
  const fullCareer = pensionMember({ age: 60 });
  const entries = [{
    id: 'full-career',
    memberId: fullCareer.id,
    category: 'employee',
    periods: [{
      id: 'full-career-period',
      startAge: 20,
      startMonth: 1,
      endAge: 59,
      endMonth: 12,
      streamType: 'salary_social_insurance',
      monthlyAmountMan: 40,
      bonuses: [],
      annualAmountMan: 480,
      dependentStatus: 'none',
      taxDependent: false,
      socialInsuranceDependent: false,
      spouseContingencyRate: null,
      annualIncreaseRate: null,
      lumpSumRestoreEndAge: null,
      lumpSumRestoreEndMonth: null,
    }],
  }];
  assert.equal(
    getEstimatedOldAgeQualifyingMonthCount(
      fullCareer,
      entries,
      referenceDate,
    ),
    480,
  );
  assert.equal(
    getNationalPensionCreditedMonthCount(
      fullCareer,
      entries,
      referenceDate,
    ),
    480,
  );
  const amount = estimateOldAgeAmountsFromIncome(
    fullCareer,
    entries,
    referenceDate,
  );
  assert.ok(amount.basicYenPerYear > 0);
  assert.ok(amount.generalEmployeesYenPerYear > 0);
}

// 2028年4月: 老齢基礎年金にも子の加算を新設。
// 納付済・免除期間が300月未満なら月数/300で按分する。
{
  const pensioner = pensionMember({ age: 63 });
  const child = {
    id: 'child-2028',
    role: 'child',
    nickname: '子',
    gender: 'female',
    age: 10,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const state = createDefaultPensionMemberState();
  state.pastEnrollment = 'nenkin-teikibin-over50';
  state.teikibinOver50.nationalPensionType1Months = 150;
  state.teikibinOver50.recentMonthlyYear = 2026;
  state.teikibinOver50.recentMonthlyMonth = 8;
  state.benefitSettings.oldAgeBasic.amountMode = 'manual';
  state.benefitSettings.oldAgeBasic.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 0;
  state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const result = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, child],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    5,
  );
  assert.ok(
    Math.abs(
      result.oldAge.basic.children -
        (292_500 * (150 / 300)) / 12 / 10_000,
    ) < 1e-9,
  );
}

// 2028年4月以降に老齢厚生年金の受給権を得る人は、子の加給が10年要件。
// 厚生側に子の加給が付く場合、老齢基礎側へ同じ子を二重加算しない。
{
  const pensioner = pensionMember({ age: 63 });
  const child = {
    id: 'child-employee-add',
    role: 'child',
    nickname: '子',
    gender: 'female',
    age: 10,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const state = createDefaultPensionMemberState();
  state.pastEnrollment = 'nenkin-teikibin-over50';
  state.teikibinOver50.employeesPensionGeneralMonths = 120;
  state.teikibinOver50.nationalPensionType1Months = 120;
  state.teikibinOver50.recentMonthlyYear = 2026;
  state.teikibinOver50.recentMonthlyMonth = 8;
  state.benefitSettings.oldAgeBasic.amountMode = 'manual';
  state.benefitSettings.oldAgeBasic.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const result = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, child],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2028,
    5,
  );
  assert.equal(result.oldAge.basic.children, 0);
  assert.ok(
    Math.abs(
      result.oldAge.generalEmployees.dependent -
        292_500 / 12 / 10_000,
    ) < 1e-9,
  );
}

// 加給年金は世帯主固定ではなく、配偶者側が年金受給者でも計算する。
{
  const youngerHead = {
    ...pensionMember({ age: 50 }),
    id: 'younger-head',
    role: 'head',
  };
  const olderSpouse = {
    ...pensionMember({ age: 63 }),
    id: 'older-spouse',
    role: 'spouse',
    gender: 'female',
  };
  const child = {
    id: 'reverse-child',
    role: 'child',
    nickname: '子',
    gender: 'male',
    age: 8,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const spouseState = createDefaultPensionMemberState();
  spouseState.pastEnrollment = 'nenkin-teikibin-over50';
  spouseState.teikibinOver50.employeesPensionGeneralMonths = 120;
  spouseState.benefitSettings.oldAgeBasic.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  spouseState.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  spouseState.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  spouseState.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const result = calcMonthlyPensionEntitlementBreakdownMan(
    [youngerHead, olderSpouse, child],
    { [olderSpouse.id]: spouseState },
    {},
    referenceDate,
    2028,
    5,
  );
  assert.ok(result.oldAge.generalEmployees.dependent > 0);
}

// 2028年4月以降に新たに配偶者加給の対象となる人は新額。
// 施行前から加算されていた人は経過措置で旧額を維持する。
assert.equal(
  getDependentSpousePensionYenPerYear(
    pensionMember({ age: 63 }),
    referenceDate,
    true,
  ),
  381_300,
);
assert.equal(
  getDependentSpousePensionYenPerYear(
    pensionMember({ age: 64 }),
    referenceDate,
    false,
  ),
  423_700,
);

// 配偶者が障害年金を受給している間は配偶者加給を停止する。
{
  const pensioner = {
    ...pensionMember({ age: 66 }),
    id: 'kakyu-head',
    role: 'head',
  };
  const spouse = {
    ...pensionMember({ age: 60 }),
    id: 'kakyu-spouse',
    role: 'spouse',
    gender: 'female',
    disability: 'has',
    disabilityGrade: 'grade2',
    disabilityPension: 'basic_grade2',
  };
  const state = createDefaultPensionMemberState();
  state.pastEnrollment = 'nenkin-teikibin-over50';
  state.teikibinOver50.employeesPensionGeneralMonths = 300;
  state.benefitSettings.oldAgeBasic.amountMode = 'manual';
  state.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  state.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  state.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  state.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  state.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const result = calcMonthlyPensionEntitlementBreakdownMan(
    [pensioner, spouse],
    { [pensioner.id]: state },
    {},
    referenceDate,
    2026,
    10,
  );
  assert.equal(result.oldAge.generalEmployees.dependent, 0);
  assert.equal(result.oldAge.publicServant.dependent, 0);
}

// 世帯単位の加給・子加算は、実際の年金受給者本人へ税務上も帰属する。
{
  const youngerHead = {
    ...pensionMember({ age: 50 }),
    id: 'tax-head',
    role: 'head',
  };
  const olderSpouse = {
    ...pensionMember({ age: 63 }),
    id: 'tax-spouse',
    role: 'spouse',
    gender: 'female',
  };
  const child = {
    id: 'tax-child',
    role: 'child',
    nickname: '子',
    gender: 'male',
    age: 8,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const spouseState = createDefaultPensionMemberState();
  spouseState.pastEnrollment = 'nenkin-teikibin-over50';
  spouseState.teikibinOver50.employeesPensionGeneralMonths = 120;
  spouseState.benefitSettings.oldAgeBasic.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  spouseState.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  spouseState.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  spouseState.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const withoutChild =
    calcMemberAnnualTaxableOldAgePensionPaymentManByMember({
      familyMembers: [youngerHead, olderSpouse],
      incomeByMember: {},
      pensionByMember: { [olderSpouse.id]: spouseState },
      referenceDate,
      calendarYear: 2028,
    });
  const withChild =
    calcMemberAnnualTaxableOldAgePensionPaymentManByMember({
      familyMembers: [youngerHead, olderSpouse, child],
      incomeByMember: {},
      pensionByMember: { [olderSpouse.id]: spouseState },
      referenceDate,
      calendarYear: 2028,
    });

  assert.equal(withChild[youngerHead.id] ?? 0, withoutChild[youngerHead.id] ?? 0);
  assert.ok(
    (withChild[olderSpouse.id] ?? 0) >
      (withoutChild[olderSpouse.id] ?? 0),
  );
}

// Q8の本人別グラフも、税計算と同じ受給者帰属で子の加算を反映する。
{
  const head = {
    ...pensionMember({ age: 50 }),
    id: 'chart-head',
    role: 'head',
  };
  const spouse = {
    ...pensionMember({ age: 63 }),
    id: 'chart-spouse',
    role: 'spouse',
    gender: 'female',
  };
  const child = {
    id: 'chart-child',
    role: 'child',
    nickname: '子',
    gender: 'male',
    age: 8,
    birthMonth: 4,
    birthDay: 2,
    expectedLifespan: 90,
    disability: 'none',
    pensionChildResidence: 'japan',
    hobbies: [],
    householdPeriod: { mode: 'by_education', endAge: 22, endMonth: 3 },
  };
  const spouseState = createDefaultPensionMemberState();
  spouseState.pastEnrollment = 'nenkin-teikibin-over50';
  spouseState.teikibinOver50.employeesPensionGeneralMonths = 120;
  spouseState.benefitSettings.oldAgeBasic.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeBasic.manualAmountPerYear = 0;
  spouseState.benefitSettings.oldAgeGeneralEmployees.amountMode = 'manual';
  spouseState.benefitSettings.oldAgeGeneralEmployees.manualAmountPerYear = 120_000;
  spouseState.benefitSettings.oldAgePublicPrivate.amountMode = 'manual';
  spouseState.benefitSettings.oldAgePublicPrivate.manualAmountPerYear = 0;

  const withoutChild = buildPensionBenefitChartPoints({
    member: spouse,
    memberState: spouseState,
    incomeEntries: [],
    familyMembers: [head, spouse],
    pensionByMember: { [spouse.id]: spouseState },
    incomeByMember: {},
    referenceDate,
  }).find((point) => point.calendarYear === 2028);

  const withChild = buildPensionBenefitChartPoints({
    member: spouse,
    memberState: spouseState,
    incomeEntries: [],
    familyMembers: [head, spouse, child],
    pensionByMember: { [spouse.id]: spouseState },
    incomeByMember: {},
    referenceDate,
  }).find((point) => point.calendarYear === 2028);

  assert.ok(withoutChild);
  assert.ok(withChild);
  assert.ok(
    withChild.oldAgeEmployeesGeneral >
      withoutChild.oldAgeEmployeesGeneral,
  );
}

console.log('verify-pension-old-age: all passed');
