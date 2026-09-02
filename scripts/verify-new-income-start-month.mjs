/**
 * 新しい収�EチェチE��の表示条件を検証
 * npx tsx scripts/verify-new-income-start-month.mjs
 */
import assert from 'node:assert/strict';
import {
  isPeriodStartEligibleForNewIncomeFlag,
  resolveNewIncomeStartMonth,
} from '../src/lib/incomeStartFlags.ts';

const simStart = { startAge: 40, startMonth: 9 };

assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(40, 9, simStart),
  true,
  '試算開始月そ�Eも�Eは対象',
);
assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(40, 10, simStart),
  true,
  '試算開始�E翌月も�E年度冁E��ら対象',
);
assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(40, 12, simStart),
  true,
  '初年度12月まで対象',
);
assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(40, 8, simStart),
  false,
  '試算開始より前は対象夁E,
);
assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(41, 1, simStart),
  false,
  '翌暦年は対象夁E,
);
assert.equal(
  isPeriodStartEligibleForNewIncomeFlag(25, 4, simStart),
  false,
  '過去の就労開始�E対象夁E,
);

const member = { id: 'm1', role: 'head', age: 40 };
const basePeriod = {
  id: 'p1',
  startAge: 40,
  startMonth: 10,
  endAge: 60,
  endMonth: 3,
  streamType: 'salary_social_insurance',
  monthlyAmountMan: 50,
  bonuses: [],
  annualAmountMan: 600,
  dependentStatus: 'none',
  taxDependent: false,
  socialInsuranceDependent: false,
  spouseContingencyRate: null,
  annualIncreaseRate: null,
  lumpSumRestoreEndAge: null,
  lumpSumRestoreEndMonth: null,
};
const entry = {
  id: 'e1',
  memberId: 'm1',
  category: 'employee',
  isNewIncomeFromStart: false,
  periods: [basePeriod],
  retirementAllowances: [],
  expenseManPerMonth: null,
  filingType: null,
};

assert.equal(
  resolveNewIncomeStartMonth(entry, member, 8),
  10,
  '基準月8→試算開姁Eのとき、E0月開始でもチェチE��用の月が取れめE,
);

assert.equal(
  resolveNewIncomeStartMonth(
    {
      ...entry,
      periods: [{ ...basePeriod, startAge: 25, startMonth: 4 }],
    },
    member,
    8,
  ),
  null,
  '過去開始�Eみの収�EではチェチE��非表示',
);

assert.equal(
  resolveNewIncomeStartMonth(
    {
      ...entry,
      periods: [{ ...basePeriod, startMonth: 9 }],
    },
    member,
    8,
  ),
  9,
  '試算開始月ぴったりも従来どおり対象',
);

console.log('verify-new-income-start-month: ok');
