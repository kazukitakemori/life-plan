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
} from '../src/lib/pensionOldAge.ts';
import { estimatePost65EmployeesPensionIncreaseMan } from '../src/lib/pensionEnrollmentEstimate.ts';
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


function pensionMember({ birthDay = 2 } = {}) {
  return {
    id: 'member',
    role: 'head',
    nickname: '本人',
    gender: 'male',
    age: 66,
    birthMonth: 4,
    birthDay,
    expectedLifespan: 90,
    disability: 'none',
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

console.log('verify-pension-old-age: all passed');
