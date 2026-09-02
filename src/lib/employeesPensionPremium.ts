import type { FamilyMember } from '../types/family';
import { getMemberAgeMonth } from './birthDate';
import type { MemberSalaryBonusBreakdownYen } from './memberYearIncome';
import { EMPLOYEES_PENSION_MAX_INSURED_AGE } from './pensionConstants';

/**
 * 厚生年金の被保険者資格が残る年齢か。
 * 各月の満年齢が 70 歳未満の間だけ保険料を計上する。
 */
export function isEmployeesPensionLiableAtAgeMonth(
  age: number,
  _month: number,
  _birthMonth: number | null | undefined,
): boolean {
  return age < EMPLOYEES_PENSION_MAX_INSURED_AGE;
}

export function isEmployeesPensionLiableAtCalendarMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  return isEmployeesPensionLiableAtAgeMonth(
    ageMonth.age,
    ageMonth.month,
    member.birthMonth,
  );
}

export function countEmployeesPensionLiableMonthsInRange(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
): number {
  let count = 0;
  for (let month = monthStart; month <= monthEnd; month++) {
    if (
      isEmployeesPensionLiableAtCalendarMonth(
        member,
        referenceDate,
        calendarYear,
        month,
      )
    ) {
      count++;
    }
  }
  return count;
}

/** 厚生年金保険料（被用者負担・年額円）を月単位で集計する。 */
export function calcEmployeesPensionPremiumYen(
  incomeSplit: MemberSalaryBonusBreakdownYen,
  rate: number,
  isLiableMonth: (calendarMonth: number) => boolean,
  monthStart = 1,
  monthEnd = 12,
): number {
  if (incomeSplit.monthlyRemunerations.length > 0) {
    const salaryPart = incomeSplit.monthlyRemunerations.reduce((sum, month) => {
      if (!isLiableMonth(month.month)) return sum;
      return sum + Math.floor(month.standardPensionYen * rate);
    }, 0);

    const bonusPart =
      incomeSplit.bonusTreatedAsRemuneration
        ? 0
        : incomeSplit.bonusPayments.reduce((sum, payment) => {
            if (!isLiableMonth(payment.month)) return sum;
            return sum + Math.floor(payment.standardPensionYen * rate);
          }, 0);

    return salaryPart + bonusPart;
  }

  const standardMonthly = incomeSplit.standardMonthlyRemunerationYen;
  let liableMonthCount = 0;
  for (let month = monthStart; month <= monthEnd; month++) {
    if (isLiableMonth(month)) liableMonthCount++;
  }

  if (liableMonthCount <= 0 || standardMonthly <= 0) {
    return 0;
  }

  const bonusBaseYen = incomeSplit.bonusTreatedAsRemuneration
    ? 0
    : incomeSplit.bonusPayments.reduce(
        (sum, payment) =>
          isLiableMonth(payment.month)
            ? sum + payment.standardPensionYen
            : sum,
        0,
      );

  return (
    Math.floor(standardMonthly * rate) * liableMonthCount +
    Math.floor(bonusBaseYen * rate)
  );
}
