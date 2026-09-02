import { calcRetirementDeductionYenAfterOverlap } from '../src/lib/retirementDeductionOverlap.ts';
import { calcEnrollmentYearsFromAgeMonths } from '../src/lib/retirementIncomeTax.ts';

const years = calcEnrollmentYearsFromAgeMonths(
  { age: 50, month: 1 },
  { age: 60, month: 1 },
);

const idecoFull = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2028,
    kind: 'ideco',
    revenueMan: 500,
    enrollmentYears: years,
    periodStartAge: 50,
    periodStartMonth: 1,
    periodEndAge: 60,
    periodEndMonth: 1,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'company',
      revenueMan: 1500,
      enrollmentYears: 25,
      periodStartAge: 35,
      periodStartMonth: 4,
      periodEndAge: 60,
      periodEndMonth: 3,
    },
  ],
});

const partial = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2031,
    kind: 'company',
    revenueMan: 1500,
    enrollmentYears: 25,
    periodStartAge: 40,
    periodStartMonth: 4,
    periodEndAge: 65,
    periodEndMonth: 3,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 500,
      enrollmentYears: 10,
      periodStartAge: 50,
      periodStartMonth: 1,
      periodEndAge: 60,
      periodEndMonth: 1,
    },
  ],
});

const same20 = calcRetirementDeductionYenAfterOverlap({
  current: {
    memberId: 'm',
    calendarYear: 2031,
    kind: 'dc',
    revenueMan: 1000,
    enrollmentYears: 20,
    periodStartAge: 40,
    periodStartMonth: 4,
    periodEndAge: 59,
    periodEndMonth: 4,
  },
  priors: [
    {
      memberId: 'm',
      calendarYear: 2026,
      kind: 'ideco',
      revenueMan: 1000,
      enrollmentYears: 20,
      periodStartAge: 40,
      periodStartMonth: 4,
      periodEndAge: 59,
      periodEndMonth: 4,
    },
  ],
});

console.log('A company→ideco full cover', {
  enrollmentYears: years,
  overlapYears: idecoFull.overlapYears,
  dedMan: idecoFull.deductionYen / 10_000,
});
console.log('B partial ideco→company', {
  overlapYears: partial.overlapYears,
  fullMan: partial.fullDeductionYen / 10_000,
  dedMan: partial.deductionYen / 10_000,
});
console.log('C ideco→dc same period', {
  overlapYears: same20.overlapYears,
  dedMan: same20.deductionYen / 10_000,
});

if (idecoFull.deductionYen !== 0) throw new Error('A should be 0');
if (same20.deductionYen !== 0) throw new Error('C should be 0');
if (partial.deductionYen <= 0) throw new Error('B should keep some deduction');
console.log('OK current logic');
