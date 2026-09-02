import assert from 'node:assert/strict';
import {
  resolveHousingLoanDeductionHouseholdType,
} from '../src/lib/housingLoanDeductionHousehold.ts';
import {
  calcPropertyHousingLoanDeductionYen,
  GENERAL_NEW_CONSTRUCTION_EXCLUSION_FROM_YEAR,
  NEW_CONSTRUCTION_DEDUCTION_LIMITS,
  USED_DEDUCTION_LIMITS,
} from '../src/lib/housingLoanDeduction.ts';
import { normalizeOwnedPropertyTargetSettings } from '../src/lib/housingLabels.ts';

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

assert.equal(
  resolveHousingLoanDeductionHouseholdType(
    [member('head', 'head', 35), member('spouse', 'spouse', 36), member('child', 'child', 5)],
    referenceDate,
    2028,
  ),
  'child_rearing_young_couple',
  'child under 19 => child_rearing_young_couple',
);

assert.equal(
  resolveHousingLoanDeductionHouseholdType(
    // 入居年（2028年）末時点で夫が39歳以下となるよう、基準日時点の年齢を調整
    [member('head', 'head', 36), member('spouse', 'spouse', 41)],
    referenceDate,
    2028,
  ),
  'child_rearing_young_couple',
  'young couple when head is 39 or younger at occupancy year end',
);

assert.equal(
  resolveHousingLoanDeductionHouseholdType(
    [member('head', 'head', 45), member('spouse', 'spouse', 43)],
    referenceDate,
    2028,
  ),
  'other',
  'older couple without child => other',
);

assert.deepEqual(
  normalizeOwnedPropertyTargetSettings(false, 'zeh'),
  { isNewConstruction: false, deductionCategory: 'certified_long_term' },
  'used maps zeh to certified_long_term',
);

assert.equal(
  NEW_CONSTRUCTION_DEDUCTION_LIMITS.general.childRearingYoungMan,
  0,
  'general new construction limit is zero',
);

assert.equal(
  USED_DEDUCTION_LIMITS.general.limitMan,
  2000,
  'used general limit is 2000',
);

assert.equal(
  USED_DEDUCTION_LIMITS.certified_long_term.limitMan,
  3000,
  'used certified limit is 3000',
);

const property = {
  id: 'p1',
  type: 'detached_house',
  name: 'test',
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
    amountMan: 3500,
    interestRatePeriods: [{ id: 'r1', rateType: 'fixed', interestRatePct: 1, startYear: 0, startMonth: 0, endYear: 0, endMonth: 0 }],
    years: 35,
    startYear: 0,
    startMonth: 0,
    deductionCategory: 'general',
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

const occupancyYear = 2026 + (40 - 35);
assert.ok(
  occupancyYear >= GENERAL_NEW_CONSTRUCTION_EXCLUSION_FROM_YEAR,
  'test occupancy year should be 2024+',
);

assert.equal(
  calcPropertyHousingLoanDeductionYen(
    property,
    35,
    2026,
    occupancyYear,
    [member('head', 'head', 35), member('spouse', 'spouse', 33)],
    referenceDate,
  ),
  0,
  'general new construction from 2024+ yields zero deduction',
);

const zehProperty = {
  ...property,
  loan: {
    ...property.loan,
    deductionCategory: 'zeh',
  },
};

const zehDeduction = calcPropertyHousingLoanDeductionYen(
  zehProperty,
  35,
  2026,
  occupancyYear,
  [member('head', 'head', 35), member('spouse', 'spouse', 33)],
  referenceDate,
);
assert.ok(zehDeduction > 0, 'zeh new construction should have deduction');

console.log('OK: housing loan deduction household + limits');
