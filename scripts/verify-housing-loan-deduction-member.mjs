/**

 * 住宁E��ーン控除のメンバ�E別接続を検証�E�Eode scripts/verify-housing-loan-deduction-member.mjs�E�E

 */

import assert from 'node:assert/strict';

import {
  calcLoanEntryHousingLoanDeductionYen,
  calcMemberHousingLoanDeductionYen,
  calcPropertyHousingLoanDeductionYen,
} from '../src/lib/housingLoanDeduction.ts';
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
  buildingMan: 4000,
  landMan: 1000,
  brokerageFeeMan: 100,
  registrationFeeMan: 20,
  acquisitionTaxMan: 0,
  acquisitionTaxYear: 0,
  acquisitionTaxMonth: 0,
  paymentMethod: 'loan',
  loan: {
    amountMan: 5000,
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

const pairGroupId = 'pair-1';

const headEntry = {
  id: 'loan-head',
  category: 'housing',
  name: '自宅ローン',
  settings: { ...property.loan },
  note: '',
  housingLink: { targetId: HOUSEHOLD_HOUSING_KEY, propertyId: property.id },
  structureType: 'pair',
  pairGroupId,
  pairSharePct: DEFAULT_PAIR_SHARE_PCT,
};

const spouseEntry = {
  id: 'loan-spouse',
  category: 'housing',
  name: '自宅ローン',
  settings: { ...property.loan },
  note: '',
  housingLink: { targetId: HOUSEHOLD_HOUSING_KEY, propertyId: property.id },
  structureType: 'pair',
  pairGroupId,
  pairSharePct: DEFAULT_PAIR_SHARE_PCT,
};

const loanState = {
  byMember: {
    head: [headEntry],
    spouse: [spouseEntry],
  },
};

const headDeduction = calcLoanEntryHousingLoanDeductionYen(
  property,
  headEntry,
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

const spouseDeduction = calcLoanEntryHousingLoanDeductionYen(
  property,
  spouseEntry,
  33,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

assert.ok(headDeduction > 0, 'head pair loan deduction is positive');
assert.ok(spouseDeduction > 0, 'spouse pair loan deduction is positive');
assert.equal(
  headDeduction,
  spouseDeduction,
  '50:50 pair loans yield equal first-year deduction',
);

const fullPropertyDeduction = calcPropertyHousingLoanDeductionYen(
  property,
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

assert.ok(
  headDeduction < fullPropertyDeduction,
  'pair share deduction is less than full-loan deduction',
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

assert.equal(headMemberDeduction, headDeduction, 'member calc uses loan entry');
assert.equal(spouseMemberDeduction, spouseDeduction, 'spouse member calc uses loan entry');

const householdFallback = calcMemberHousingLoanDeductionYen(
  housingState,
  'head',
  35,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

assert.equal(
  householdFallback,
  fullPropertyDeduction,
  'without loanState, household-owned property falls back to head',
);

const spouseWithoutLoanState = calcMemberHousingLoanDeductionYen(
  housingState,
  'spouse',
  33,
  referenceYear,
  occupancyYear,
  family,
  referenceDate,
);

assert.equal(
  spouseWithoutLoanState,
  0,
  'without loanState, spouse gets no household fallback',
);

console.log('verify-housing-loan-deduction-member: all assertions passed');
