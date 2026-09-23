import type { FamilyMember } from '../types/family';
import { getMemberAgeMonth } from './birthDate';
import type { MemberSalaryBonusBreakdownYen } from './memberYearIncome';
import { EMPLOYEES_PENSION_MAX_INSURED_AGE } from './pensionConstants';

/**
 * 厚生年金の被保険者資格が残る月か。
 *
 * 原則は70歳未満だが、年齢は誕生日の前日に到達する。
 * そのため1日生まれは、70歳の誕生月の前月に資格喪失日が到来し、
 * その月は被保険者期間（保険料算定月）へ算入しない。
 *
 * birthDay 未入力の旧データは、月単位で過大に早く資格喪失させないため
 * 2日以後生まれと同じ扱いで概算する。
 */
export function isEmployeesPensionLiableAtAgeMonth(
  age: number,
  month: number,
  birthMonth: number | null | undefined,
  birthDay?: number | null,
): boolean {
  if (age < EMPLOYEES_PENSION_MAX_INSURED_AGE - 1) return true;
  if (age >= EMPLOYEES_PENSION_MAX_INSURED_AGE) return false;

  if (birthDay !== 1) return true;

  const safeBirthMonth = birthMonth ?? 1;
  const age70ReachedMonth = safeBirthMonth === 1 ? 12 : safeBirthMonth - 1;
  return month !== age70ReachedMonth;
}

export function isEmployeesPensionLiableAtCalendarMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'> &
    Partial<Pick<FamilyMember, 'birthDay'>>,
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
    member.birthDay,
  );
}

export function countEmployeesPensionLiableMonthsInRange(
  member: Pick<FamilyMember, 'age' | 'birthMonth'> &
    Partial<Pick<FamilyMember, 'birthDay'>>,
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
