/**
 * 連帯債務�E双方控除を検証�E�Eode scripts/verify-joint-debt-deduction.mjs�E�E
 */
import assert from 'node:assert/strict';

import {
  calcLoanEntryHousingLoanDeductionYen,
  calcMemberHousingLoanDeductionYen,
  calcPropertyHousingLoanDeductionYen,
} from '../src/lib/housingLoanDeduction.ts';
import { calcHousingLoanTotalAmountMan } from '../src/lib/housingLoanAmount.ts';
import { DEFAULT_PAIR_SHARE_PCT } from '../src/lib/pairLoanShare.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

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

const property = {
  id: 'p1',
  type: 'detached_house',
  name: '自宅',
  usage: 'current',
  startAge: 40,
  startMonth: 4,
  endMode: 'lifetime',
  endAge: 90,
  endMonth: 12,
  buildingMan: 2000,
  landMan: 500,
  brokerageFeeMan: 100,
  registrationFeeMan: 20,
  acquisitionTaxMan: 0,
  acquisitionTaxYear: 0,
  acquisitionTaxMonth: 0,
  paymentMethod: 'loan',
  loan: {
    amountMan: 2500,
    interestRatePeriods: [
      {
        id: 'r1',
        rateType: 'fixed',
        interestRatePct: 1,
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

const occupancyYear = referenceYear + (property.startAge - 35);
const family = [member('head', 'head', 35), member('spouse', 'spouse', 33)];

const housingState = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: {
      rentals: [],
      owned: [property],
    },
  },
};

const jointDebtEntry = {
  id: 'loan-joint',
  category: 'housing',
  name: '自宁E��ローン',
  settings: { ...property.loan },
  note: '',
  housingLink: { targetId: HOUSEHOLD_HOUSING_KEY, propertyId: property.id },
  structureType: 'joint_debt',
  pairSharePct: DEFAULT_PAIR_SHARE_PCT,
};

const loanState = {
  byMember: {
    head: [jointDebtEntry],
  },
};

const fullPropertyDeduction = calcPropertyHousingLoanDeductionYen(
  property,
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

const headPrimaryDeduction = calcLoanEntryHousingLoanDeductionYen(
  property,
  jointDebtEntry,
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

const spouseComplementDeduction = calcLoanEntryHousingLoanDeductionYen(
  property,
  jointDebtEntry,
  33,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
  50,
);

assert.ok(headPrimaryDeduction > 0, 'head joint debt deduction is positive');
assert.ok(spouseComplementDeduction > 0, 'spouse joint debt deduction is positive');
assert.equal(
  headPrimaryDeduction,
  spouseComplementDeduction,
  '50:50 joint debt yields equal deduction per spouse',
);
assert.ok(
  Math.abs(headPrimaryDeduction + spouseComplementDeduction - fullPropertyDeduction) <= 1,
  'joint debt household total matches full-loan deduction (within rounding)',
);

const headMemberDeduction = calcMemberHousingLoanDeductionYen(
  housingState,
  'head',
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
  loanState,
);

const spouseMemberDeduction = calcMemberHousingLoanDeductionYen(
  housingState,
  'spouse',
  33,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
  loanState,
);

assert.equal(headMemberDeduction, headPrimaryDeduction, 'head member calc uses primary share');
assert.equal(
  spouseMemberDeduction,
  spouseComplementDeduction,
  'spouse member calc uses complement share without own entry',
);

const loanAmountMan = calcHousingLoanTotalAmountMan(property, jointDebtEntry.settings);
assert.equal(
  loanAmountMan,
  calcHousingLoanTotalAmountMan(property, property.loan),
  'joint debt loan amount is not split',
);

console.log('verify-joint-debt-deduction: all assertions passed');
