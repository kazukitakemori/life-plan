/**
 * 老齢年金ロジックの簡易検証（node scripts/verify-pension.mjs）
 */
import {
  calcBasicPensionYenFromCreditedMonths,
  estimateOldAgeAmountsFromIncome,
  getEmployeesEnrollmentMonthCounts,
  getNationalPensionCreditedMonthCount,
} from '../src/lib/pensionEnrollmentEstimate.ts';
import { FULL_BASIC_PENSION_YEN_PER_YEAR } from '../src/lib/pensionConstants.ts';
import {
  interpolateCareerAnnualIncomeYen,
  resolveCurrentWorkProfile,
} from '../src/lib/pensionIncomeProjection.ts';

const referenceDate = new Date(2026, 5, 1);

const member = {
  id: '1',
  role: 'head',
  age: 40,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const entries = [
  {
    id: 'e1',
    memberId: '1',
    category: 'employee',
    spouseContingencyOnly: false,
    periods: [
      {
        id: 'p1',
        startAge: 40,
        startMonth: 6,
        endAge: 60,
        endMonth: 3,
        streamType: 'salary_social_insurance',
        monthlyAmountMan: 50,
        bonuses: [],
        annualAmountMan: 600,
        spouseContingencyRate: null,
        annualIncreaseRate: null,
      },
    ],
    kenpoContinuationYears: 2,
    expenseManPerMonth: null,
    filingType: null,
  },
];

const profile = resolveCurrentWorkProfile(member, entries, referenceDate);
console.assert(profile.situation === 'employee', '現職: 会社員');
console.assert(profile.currentAnnualYen === 6_000_000, '現年収600万円');

const annualAt22 = interpolateCareerAnnualIncomeYen(22, 40, 2_400_000, 6_000_000);
console.assert(annualAt22 === 2_400_000, `22歳年収240万: ${annualAt22}`);

const annualAt31 = interpolateCareerAnnualIncomeYen(31, 40, 2_400_000, 6_000_000);
console.assert(
  annualAt31 === 4_200_000,
  `31歳年収420万: ${annualAt31}`,
);

const est = estimateOldAgeAmountsFromIncome(member, entries, referenceDate);
const monthCounts = getEmployeesEnrollmentMonthCounts(
  member,
  entries,
  referenceDate,
);

const expectedMonths = 9 + 37 * 12 + 3;
console.assert(
  monthCounts.generalMonths === expectedMonths,
  `加入月数: ${monthCounts.generalMonths}`,
);

// 線形補間により、一律50万×456ヶ月より報酬比例は小さくなる
const flatAnnual = expectedMonths * 500_000 * (5.481 / 1000);
console.assert(
  est.generalEmployeesYenPerYear < flatAnnual,
  `補間後 ${est.generalEmployeesYenPerYear} < 一律 ${flatAnnual}`,
);
console.assert(
  est.generalEmployeesYenPerYear > 800_000,
  '報酬比例は80万円/年超',
);

const creditedMonths = getNationalPensionCreditedMonthCount(
  member,
  entries,
  referenceDate,
);
console.assert(
  creditedMonths < 480,
  `老齢基礎は満額未満: ${creditedMonths}か月`,
);
console.assert(
  est.basicYenPerYear < FULL_BASIC_PENSION_YEN_PER_YEAR,
  `老齢基礎減額: ${est.basicYenPerYear}`,
);
console.assert(
  est.basicYenPerYear ===
    calcBasicPensionYenFromCreditedMonths(creditedMonths),
  '老齢基礎は加入月数比例',
);

console.log('verify-pension: all checks passed');
console.log(
  `  厚生加入${expectedMonths}ヶ月, 国民年金${creditedMonths}か月, 老齢基礎 ${(est.basicYenPerYear / 10000).toFixed(1)}万円/年, 報酬比例 ${(est.generalEmployeesYenPerYear / 10000).toFixed(1)}万円/年`,
);
