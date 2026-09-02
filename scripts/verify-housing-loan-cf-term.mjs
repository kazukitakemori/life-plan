/**
 * 住宅ローン返済期間が CF 表で何年分計上されるかを検証する。
 * npx tsx scripts/verify-housing-loan-cf-term.mjs
 */
import { buildCashFlowTable } from '../src/lib/cashFlow.ts';
import {
  createOwnedProperty,
  createOwnedPropertyLoanSettings,
} from '../src/lib/housingDefaults.ts';
import { createDefaultLifeEventState } from '../src/lib/lifeEventDefaults.ts';
import { createDefaultLivingState } from '../src/lib/livingDefaults.ts';
import {
  createDefaultLoanState,
  createLoanEntry,
  updateLoanByMember,
} from '../src/lib/loanDefaults.ts';
import { createLoanInterestRatePeriod } from '../src/lib/loanInterestRatePeriod.ts';
import { createDefaultPensionByMember } from '../src/lib/pensionDefaults.ts';
import { createDefaultTaxSocialState } from '../src/lib/taxSocialDefaults.ts';
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

function rate() {
  return createLoanInterestRatePeriod({ interestRatePct: 1.0 });
}

function loanYearsInCf(table) {
  return table.years
    .filter((y) => {
      const d = y.expenseBreakdown?.housingDetail?.loanRepaymentDetail;
      return d && d.principal + d.interest > 0;
    })
    .map((y) => y.calendarYear);
}

function buildTable({ property, loanState }) {
  const familyMembers = [head];
  return buildCashFlowTable({
    familyMembers,
    incomeByMember: {},
    livingState: createDefaultLivingState(head, 6),
    housingState: {
      byTarget: {
        [HOUSEHOLD_HOUSING_KEY]: { rentals: [], owned: [property] },
      },
    },
    loanState,
    educationByMember: {},
    lifeEventState: createDefaultLifeEventState(),
    pensionByMember: createDefaultPensionByMember([head]),
    taxSocialState: createDefaultTaxSocialState(head.age, 6),
    referenceDate,
  });
}

function runCase(label, { propertyYears, loanYears, startAge, linkLoan = true }) {
  const property = createOwnedProperty(
    'detached_house',
    head,
    6,
    2026,
    {
      usage: 'future_purchase',
      paymentMethod: 'loan',
      buildingMan: 3000,
      landMan: 2000,
      startAge,
      startMonth: 6,
      loan: createOwnedPropertyLoanSettings({
        years: propertyYears,
        amountMan: 5000,
        interestRatePeriods: [rate()],
      }),
    },
    { rentals: [], owned: [] },
  );

  let loanState = createDefaultLoanState();
  if (linkLoan) {
    const loanEntry = createLoanEntry('housing', {
      settings: createOwnedPropertyLoanSettings({
        years: loanYears,
        amountMan: 5000,
        startYear: 0,
        startMonth: 0,
        interestRatePeriods: [rate()],
      }),
      housingLink: {
        targetId: HOUSEHOLD_HOUSING_KEY,
        propertyId: property.id,
      },
    });
    loanState = updateLoanByMember(loanState, head.id, [loanEntry]);
  }

  const table = buildTable({ property, loanState });
  const years = loanYearsInCf(table);
  const first = years[0];
  const last = years[years.length - 1];
  console.log(`\n=== ${label} ===`);
  console.log(
    `loanYears=${loanYears} propertyYears=${propertyYears} startAge=${startAge} linked=${linkLoan}`,
  );
  console.log(
    `first=${first} last=${last} count=${years.length} calendarSpan=${last - first + 1}`,
  );
}

runCase('linked Q9=25, property.loan=35 (stale)', {
  propertyYears: 35,
  loanYears: 25,
  startAge: 40,
});

runCase('linked Q9=25, property.loan=25', {
  propertyYears: 25,
  loanYears: 25,
  startAge: 40,
});

runCase('linked Q9=25, startAge deferred +10', {
  propertyYears: 25,
  loanYears: 25,
  startAge: 50,
});

runCase('no Q9 link, fallback property.loan=35', {
  propertyYears: 35,
  loanYears: 25,
  startAge: 40,
  linkLoan: false,
});

runCase('linked Q9=35 default', {
  propertyYears: 35,
  loanYears: 35,
  startAge: 40,
});
