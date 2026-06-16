import { tuitionAnnualToMonthly } from './educationAmount';
import {
  ENROLLMENT_YEAR_EVERY,
  countEnrollmentYears,
} from './educationPeriod';
import { getMemberAgeMonth } from './birthDate';
import type { FamilyMember } from '../types/family';
import type {
  EducationExpenseEntry,
  EducationOtherExpense,
} from '../types/education';

const YEN_PER_MAN = 10_000;

function toAbsoluteMonths(age: number, month: number): number {
  return age * 12 + (month - 1);
}

function isInEnrollmentPeriod(
  age: number,
  month: number,
  entry: Pick<
    EducationExpenseEntry,
    'startAge' | 'startMonth' | 'endAge' | 'endMonth'
  >,
): boolean {
  const current = toAbsoluteMonths(age, month);
  const start = toAbsoluteMonths(entry.startAge, entry.startMonth);
  const end = toAbsoluteMonths(entry.endAge, entry.endMonth);
  return current >= start && current <= end;
}

function getSchoolYearStartMonths(
  startAge: number,
  startMonth: number,
): number {
  return startMonth >= 4
    ? toAbsoluteMonths(startAge, 4)
    : toAbsoluteMonths(startAge - 1, 4);
}

/** 在籍期間内の何年目か（1始まり）。在籍外は null */
export function getEnrollmentYearIndexAt(
  age: number,
  month: number,
  entry: Pick<
    EducationExpenseEntry,
    'startAge' | 'startMonth' | 'endAge' | 'endMonth'
  >,
): number | null {
  if (!isInEnrollmentPeriod(age, month, entry)) return null;

  const current = toAbsoluteMonths(age, month);
  const schoolYearStart = getSchoolYearStartMonths(
    entry.startAge,
    entry.startMonth,
  );
  const enrollmentStart = toAbsoluteMonths(entry.startAge, entry.startMonth);

  if (current < enrollmentStart) return null;

  const effectiveStart = Math.max(schoolYearStart, enrollmentStart);
  return Math.floor((current - effectiveStart) / 12) + 1;
}

function isFirstEnrollmentMonth(
  age: number,
  month: number,
  entry: Pick<EducationExpenseEntry, 'startAge' | 'startMonth'>,
): boolean {
  return age === entry.startAge && month === entry.startMonth;
}

function calcTuitionYenForMonth(
  entry: EducationExpenseEntry,
  age: number,
  month: number,
): number {
  if (!isInEnrollmentPeriod(age, month, entry)) return 0;

  const monthly = tuitionAnnualToMonthly(entry.tuitionAnnual);

  switch (entry.tuitionPaymentCycle) {
    case 'monthly':
      return monthly;
    case 'yearly':
      return month === 4 ? entry.tuitionAnnual : 0;
    case 'semiannual':
      return month === 4 || month === 10 ? entry.tuitionAnnual / 2 : 0;
    default:
      return monthly;
  }
}

function calcOtherExpenseYenForMonth(
  item: EducationOtherExpense,
  entry: EducationExpenseEntry,
  age: number,
  month: number,
): number {
  const yearIndex = getEnrollmentYearIndexAt(age, month, entry);
  if (yearIndex === null) return 0;

  const maxYear = countEnrollmentYears(
    entry.startAge,
    entry.startMonth,
    entry.endAge,
    entry.endMonth,
  );
  if (yearIndex > maxYear) return 0;

  const applies =
    item.enrollmentYear === ENROLLMENT_YEAR_EVERY ||
    item.enrollmentYear === yearIndex;
  if (!applies) return 0;

  if (item.paymentCycle === 'monthly') return item.amount;
  return month === 4 ? item.amount : 0;
}

function calcEntryMonthlyEducationYen(
  entry: EducationExpenseEntry,
  age: number,
  month: number,
): number {
  if (!isInEnrollmentPeriod(age, month, entry)) return 0;

  let total = calcTuitionYenForMonth(entry, age, month);

  if (isFirstEnrollmentMonth(age, month, entry)) {
    total += entry.entranceFee;
  }

  for (const other of entry.otherExpenses) {
    total += calcOtherExpenseYenForMonth(other, entry, age, month);
  }

  return total;
}

export function calcMemberMonthlyEducationYen(
  member: FamilyMember,
  entries: EducationExpenseEntry[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  return entries.reduce(
    (sum, entry) =>
      sum +
      calcEntryMonthlyEducationYen(
        entry,
        ageMonth.age,
        ageMonth.month,
      ),
    0,
  );
}

export function yenToMan(yen: number): number {
  return yen / YEN_PER_MAN;
}
