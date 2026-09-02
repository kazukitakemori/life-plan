/**

 * ペアローンの借�E刁E��・按�Eを検証�E�Eode scripts/verify-pair-loan-share.mjs�E�E

 */

import assert from 'node:assert/strict';

import {
  calcHousingLoanHouseholdTotalAmountMan,
  calcHousingLoanTotalAmountMan,
} from '../src/lib/housingLoanAmount.ts';
import { calcOwnedLoanDownPaymentMan } from '../src/lib/housingOwnedAmount.ts';
import { calcHouseholdMonthlyHousingDetailMan } from '../src/lib/housingCashFlow.ts';
import {
  calcHousingPropertyBankFeesInitialMan,
  calcHousingPropertyTotalLoanAmountMan,
  calcLoanEntryAmountMan,
  syncPairLoanFeeInclusionInState,
} from '../src/lib/loanResolution.ts';
import { complementPairSharePct, DEFAULT_PAIR_SHARE_PCT } from '../src/lib/pairLoanShare.ts';
import {
  applyHousingLoanFeesInLoanMode,
  applyPairLinkedFeeInclusionSettings,
} from '../src/lib/housingLoanFeeInclusion.ts';
import {
  buildAcquisitionFeeBreakdownFromProperty,
  calcScrivenerFeeMan,
  PAIR_LOAN_SCRIVENER_SURCHARGE_MAN,
} from '../src/lib/housingAcquisitionFees.ts';
import { HOUSEHOLD_HOUSING_KEY } from '../src/types/housing.ts';

const referenceDate = new Date(2026, 5, 1);

const head = {
  id: 'head',
  role: 'head',
  age: 40,
  birthMonth: 3,
  expectedLifespan: 90,
  nickname: '',
  gender: 'male',
  householdPeriod: { mode: 'lifetime', endAge: 90, endMonth: 12 },
};

const owned = {
  id: 'owned-1',
  type: 'detached_house',
  name: '自宅',
  usage: 'current',
  startAge: 45,
  startMonth: 6,
  endMode: 'lifetime',
  endAge: 90,
  endMonth: 12,
  buildingMan: 3000,
  landMan: 2000,
  brokerageFeeMan: 100,
  registrationFeeMan: 50,
  acquisitionTaxMan: 0,
  acquisitionTaxYear: 0,
  acquisitionTaxMonth: 0,
  paymentMethod: 'loan',
  loan: {
    amountMan: 0,
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
    bankFeePaymentTiming: 'loan',
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

const pairGroupId = 'pair-group-1';

const headLoanEntry = {
  id: 'loan-head',
  category: 'housing',
  name: '自宅ローン',
  settings: { ...owned.loan, financingFeeMan: 30 },
  note: '',
  housingLink: { targetId: HOUSEHOLD_HOUSING_KEY, propertyId: owned.id },
  structureType: 'pair',
  pairGroupId,
  pairSharePct: DEFAULT_PAIR_SHARE_PCT,
};

const spouseLoanEntry = {
  id: 'loan-spouse',
  category: 'housing',
  name: '自宅ローン',
  settings: { ...owned.loan, financingFeeMan: 30 },
  note: '',
  housingLink: { targetId: HOUSEHOLD_HOUSING_KEY, propertyId: owned.id },
  structureType: 'pair',
  pairGroupId,
  pairSharePct: DEFAULT_PAIR_SHARE_PCT,
};

const loanState = {
  byMember: {
    head: [headLoanEntry],
    spouse: [spouseLoanEntry],
  },
};

const householdTotal = calcHousingLoanHouseholdTotalAmountMan(owned, owned.loan);
assert.equal(householdTotal, 5000, 'household total loan is 5000');

const headAmount = calcLoanEntryAmountMan(owned, headLoanEntry);
const spouseAmount = calcLoanEntryAmountMan(owned, spouseLoanEntry);
assert.equal(headAmount, 2530, 'head borrows half of property plus own bank fees');
assert.equal(spouseAmount, 2530, 'spouse borrows half of property plus own bank fees');

const propertyTotal = calcHousingPropertyTotalLoanAmountMan(
  owned,
  loanState,
  HOUSEHOLD_HOUSING_KEY,
);
assert.equal(propertyTotal, 5060, 'household pair total equals sum of both contracts');

assert.equal(
  calcHousingLoanTotalAmountMan(owned, owned.loan, { pairSharePct: 50 }),
  2500,
  '50% share of property-only loan',
);

assert.equal(
  complementPairSharePct(40),
  60,
  'partner share complements edited share',
);

const downPayment = calcOwnedLoanDownPaymentMan(
  owned,
  owned.loan,
  loanState,
  HOUSEHOLD_HOUSING_KEY,
);
assert.equal(downPayment, 90, 'down payment uses household pair total, not doubled loan');

const cashFeeLoanState = {
  byMember: {
    head: [
      {
        ...headLoanEntry,
        settings: {
          ...headLoanEntry.settings,
          bankFeePaymentTiming: 'initial',
          financingFeeMan: 30,
          guaranteeFeeMan: 10,
          administrativeFeeMan: 5,
        },
      },
    ],
    spouse: [
      {
        ...spouseLoanEntry,
        settings: {
          ...spouseLoanEntry.settings,
          bankFeePaymentTiming: 'initial',
          financingFeeMan: 25,
          guaranteeFeeMan: 8,
          administrativeFeeMan: 2,
        },
      },
    ],
  },
};

assert.equal(
  calcHousingPropertyBankFeesInitialMan(
    owned,
    cashFeeLoanState,
    HOUSEHOLD_HOUSING_KEY,
  ),
  80,
  'pair loan initial bank fees sum both contracts (45 + 35)',
);

const cashFeePairLoanTotal = calcHousingPropertyTotalLoanAmountMan(
  owned,
  cashFeeLoanState,
  HOUSEHOLD_HOUSING_KEY,
);
assert.equal(
  cashFeePairLoanTotal,
  5000,
  'cash-paid bank fees are excluded from pair loan principal',
);

const downPaymentWithCashFees = calcOwnedLoanDownPaymentMan(
  owned,
  owned.loan,
  cashFeeLoanState,
  HOUSEHOLD_HOUSING_KEY,
);
assert.equal(
  downPaymentWithCashFees,
  230,
  'down payment includes both contracts initial fees (5150 + 80 - 5000)',
);

const soleCashFeeLoanState = {
  byMember: {
    head: [
      {
        ...headLoanEntry,
        structureType: 'sole',
        pairGroupId: undefined,
        pairSharePct: undefined,
        settings: {
          ...owned.loan,
          bankFeePaymentTiming: 'initial',
          financingFeeMan: 45,
        },
      },
    ],
  },
};
assert.equal(
  calcHousingPropertyBankFeesInitialMan(
    owned,
    soleCashFeeLoanState,
    HOUSEHOLD_HOUSING_KEY,
  ),
  45,
  'sole loan still uses single contract initial fees',
);

const housingState = {
  byTarget: {
    [HOUSEHOLD_HOUSING_KEY]: {
      rentals: [],
      owned: [owned],
    },
  },
};

const repaymentYear = 2031;
const repaymentMonth = 7;
const detail = calcHouseholdMonthlyHousingDetailMan(
  [head],
  housingState,
  referenceDate,
  repaymentYear,
  repaymentMonth,
  loanState,
);

const soleDetail = calcHouseholdMonthlyHousingDetailMan(
  [head],
  {
    byTarget: {
      [HOUSEHOLD_HOUSING_KEY]: {
        rentals: [],
        owned: [
          {
            ...owned,
            loan: {
              ...owned.loan,
              financingFeeMan: 60,
            },
          },
        ],
      },
    },
  },
  referenceDate,
  repaymentYear,
  repaymentMonth,
  {
    byMember: {
      head: [
        {
          ...headLoanEntry,
          structureType: 'sole',
          pairGroupId: undefined,
          pairSharePct: undefined,
          settings: { ...owned.loan, financingFeeMan: 60 },
        },
      ],
    },
  },
);

assert.ok(
  detail.loanRepaymentDetail.principal > 0,
  'pair loan repayment is calculated',
);
assert.ok(
  Math.abs(
    detail.loanRepaymentDetail.principal +
      detail.loanRepaymentDetail.interest -
      (soleDetail.loanRepaymentDetail.principal + soleDetail.loanRepaymentDetail.interest),
  ) < 0.2,
  'pair loan monthly repayment roughly matches single loan with same household total',
);

console.log('verify-pair-loan-share: all assertions passed');

assert.equal(calcScrivenerFeeMan(false), 8, 'base scrivener fee');
assert.equal(
  calcScrivenerFeeMan(true),
  8 + PAIR_LOAN_SCRIVENER_SURCHARGE_MAN,
  'pair loan scrivener surcharge',
);

const regBreakdown = buildAcquisitionFeeBreakdownFromProperty(
  owned,
  2031,
  6,
  { hasPairLoan: true },
);
assert.equal(
  regBreakdown.registrationDetail.pairLoanScrivenerSurchargeMan,
  PAIR_LOAN_SCRIVENER_SURCHARGE_MAN,
  'registration breakdown includes pair surcharge',
);
assert.ok(
  regBreakdown.registrationFeeMan >
    buildAcquisitionFeeBreakdownFromProperty(owned, 2031, 6).registrationFeeMan,
  'pair loan increases total registration fee',
);

console.log('verify-pair-loan-share: scrivener surcharge assertions passed');

const mismatchedLoanState = {
  byMember: {
    head: [
      {
        ...headLoanEntry,
        settings: {
          ...headLoanEntry.settings,
          ...applyHousingLoanFeesInLoanMode('loan'),
        },
      },
    ],
    spouse: [
      {
        ...spouseLoanEntry,
        settings: {
          ...spouseLoanEntry.settings,
          ...applyHousingLoanFeesInLoanMode('cash'),
        },
      },
    ],
  },
};

const syncedState = syncPairLoanFeeInclusionInState(
  mismatchedLoanState,
  mismatchedLoanState.byMember.head[0],
);

assert.equal(
  syncedState.byMember.spouse[0].settings.bankFeePaymentTiming,
  'loan',
  'pair fee inclusion syncs to partner',
);
assert.equal(
  syncedState.byMember.spouse[0].settings.includeBrokerageFeeInLoan,
  true,
  'pair brokerage inclusion syncs to partner',
);

const spouseSettings = applyPairLinkedFeeInclusionSettings(
  mismatchedLoanState.byMember.spouse[0].settings,
  mismatchedLoanState.byMember.head[0].settings,
);
assert.equal(
  spouseSettings.bankFeePaymentTiming,
  mismatchedLoanState.byMember.head[0].settings.bankFeePaymentTiming,
  'applyPairLinkedFeeInclusionSettings copies linked fields only',
);

console.log('verify-pair-loan-share: fee inclusion sync assertions passed');
