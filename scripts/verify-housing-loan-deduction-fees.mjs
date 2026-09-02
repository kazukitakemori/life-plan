/**
 * 諸費用のローン絁E��刁E��住宁E��ーン控除対象外であることを検証
 * npx vite-node scripts/verify-housing-loan-deduction-fees.mjs
 */
import assert from 'node:assert/strict';
import { calcPropertyHousingLoanDeductionYen } from '../src/lib/housingLoanDeduction.ts';
import {
  calcHousingLoanDeductionEligibleYearEndBalanceYen,
  calcHousingLoanYearEndBalanceYen,
} from '../src/lib/housingLoanAmount.ts';

function member(id, role, age, birthMonth = 1) {
  return {
    id,
    role,
    nickname: id,
    age,
    birthMonth,
    gender: 'male',
    expectedLifespan: 90,
    disability: 'none',
    hobbies: [],
    householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
  };
}

const referenceDate = new Date(2026, 0, 1);
const referenceYear = 2026;
const memberAge = 40;
/** 12月�E屁E��ら返済開始�E翌年1朁EↁE入屁E��の年末残高�E借�E額そのまま */
const occupancyYear = referenceYear;
const family = [
  member('head', 'head', memberAge),
  member('spouse', 'spouse', 38),
];

const baseProperty = {
  id: 'p1',
  type: 'detached_house',
  name: 'test',
  usage: 'current',
  startAge: memberAge,
  startMonth: 12,
  endMode: 'lifetime',
  endAge: 90,
  endMonth: 12,
  buildingMan: 3000,
  landMan: 500,
  brokerageFeeMan: 100,
  registrationFeeMan: 50,
  acquisitionTaxMan: 0,
  acquisitionTaxYear: 0,
  acquisitionTaxMonth: 0,
  paymentMethod: 'loan',
  loan: {
    amountMan: 3500,
    interestRatePeriods: [
      {
        id: 'r1',
        rateType: 'fixed',
        interestRatePct: 0,
        startYear: 0,
        startMonth: 0,
        endYear: 0,
        endMonth: 0,
      },
    ],
    years: 35,
    startYear: 0,
    startMonth: 0,
    deductionCategory: 'zeh',
    isNewConstruction: true,
    includeBrokerageFeeInLoan: false,
    includeRegistrationFeeInLoan: false,
    brokerageFeeSurchargeRatePct: 0,
    registrationFeeSurchargeRatePct: 0,
    financingFeeMan: 0,
    guaranteeFeeMan: 0,
    administrativeFeeMan: 0,
    bankFeePaymentTiming: 'initial',
    repaymentMethod: 'equal_payment',
  },
  maintenance: {
    managementFees: [],
    repairReserveFees: [],
    selfRepair: { costMan: 0, nextYear: 0, nextMonth: 0, intervalYears: 0 },
    improvements: [],
    landTaxes: [],
    buildingTaxes: [],
  },
};

const withFees = {
  ...baseProperty,
  loan: {
    ...baseProperty.loan,
    includeBrokerageFeeInLoan: true,
    includeRegistrationFeeInLoan: true,
    financingFeeMan: 30,
    guaranteeFeeMan: 20,
    bankFeePaymentTiming: 'loan',
  },
};

const fullBalanceYen = calcHousingLoanYearEndBalanceYen(
  withFees,
  withFees.loan,
  memberAge,
  referenceYear,
  occupancyYear,
);
const eligibleBalanceYen = calcHousingLoanDeductionEligibleYearEndBalanceYen(
  withFees,
  withFees.loan,
  memberAge,
  referenceYear,
  occupancyYear,
);

assert.equal(fullBalanceYen, 37_000_000, 'full year-end balance includes fees');
assert.equal(
  eligibleBalanceYen,
  35_000_000,
  'eligible balance is property price only before repayment',
);
assert.equal(
  eligibleBalanceYen,
  Math.floor((fullBalanceYen * 3500) / 3700),
  'eligible balance uses property/total ratio',
);

const deductionWithFees = calcPropertyHousingLoanDeductionYen(
  withFees,
  memberAge,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);
const deductionWithoutFees = calcPropertyHousingLoanDeductionYen(
  baseProperty,
  memberAge,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

assert.equal(
  deductionWithFees,
  deductionWithoutFees,
  'deduction matches whether fees are rolled into the loan or paid in cash',
);
assert.equal(
  deductionWithFees,
  Math.floor(35_000_000 * 0.007),
  'deduction is 0.7% of property-price balance',
);

// 借�E限度額！EEH・そ�E他世帯 3500丁E��を趁E��なぁE��ぁE��諸費用込み残高でも控除は物件刁E��で
assert.ok(
  Math.floor(37_000_000 * 0.007) > deductionWithFees,
  'fee-inclusive balance would overstate deduction if used as-is',
);

console.log('OK: housing loan deduction excludes fees in loan');
