import { resolveMemberBirthMonth } from './familyDefaults';
import {
  absoluteMonthIndexFromPeriodAgeMonth,
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import {
  resolveBonusStreamKey,
  resolveOtherIncomeKey,
  resolveSalaryStreamKey,
  treatsPeriodAsBusinessIncome,
  treatsPeriodAsSalaryIncome,
} from './incomeBreakdown';
import type { IncomeBreakdown } from '../types/cashFlow';
import {
  addPensionBreakdown,
  addInsuranceIncomeBreakdown,
  createEmptyIncomeBreakdown,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry, IncomePeriod } from '../types/income';
import { calcRetirementAllowanceManForMonth } from './retirementAllowance';

export interface EarnedIncomeCalcInput {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
}

export function yearsElapsedSince(
  birthYear: number,
  _birthMonth: number | null | undefined,
  fromAge: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  const fromMonths = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    fromAge,
    fromMonth,
  );
  const toMonths = toYear * 12 + toMonth;
  return Math.max(0, Math.floor((toMonths - fromMonths) / 12));
}

function getPeriodIncomeFactor(
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return 0;
  }

  const yearsElapsed = yearsElapsedSince(
    birthYear,
    member.birthMonth,
    period.startAge,
    period.startMonth,
    calendarYear,
    calendarMonth,
  );

  const increaseRate = period.annualIncreaseRate ?? 0;
  return Math.pow(1 + increaseRate / 100, yearsElapsed);
}

export function calcIncomeBreakdownManForMonth(
  entry: IncomeEntry,
  period: IncomePeriod,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): IncomeBreakdown {
  const result = createEmptyIncomeBreakdown();
  const factor = getPeriodIncomeFactor(
    period,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (factor === 0) return result;

  if (treatsPeriodAsSalaryIncome(entry.category, period.streamType)) {
    const salaryKey = resolveSalaryStreamKey(period.streamType);
    if (salaryKey) {
      result.salary[salaryKey] += Math.max(0, period.monthlyAmountMan * factor);
    }

    const bonusKey = resolveBonusStreamKey(period.streamType);
    if (bonusKey) {
      for (const bonus of period.bonuses) {
        if (bonus.paymentMonth === calendarMonth) {
          result.bonus[bonusKey] += bonus.amountMan * factor;
        }
      }
    }
    return result;
  }

  const otherKey = resolveOtherIncomeKey(entry.category, period.streamType);
  if (otherKey) {
    let monthlyMan = period.monthlyAmountMan * factor;
    if (
      treatsPeriodAsBusinessIncome(entry.category, period.streamType) &&
      entry.expenseManPerMonth != null
    ) {
      monthlyMan -= entry.expenseManPerMonth * factor;
    }
    result[otherKey] += Math.max(0, monthlyMan);
  }

  return result;
}

function addBreakdown(target: IncomeBreakdown, source: IncomeBreakdown): void {
  target.salary.socialInsurance += source.salary.socialInsurance;
  target.salary.civilMutual += source.salary.civilMutual;
  target.salary.nationalInsurance += source.salary.nationalInsurance;
  target.salary.selectiveDc += source.salary.selectiveDc;
  target.bonus.socialInsurance += source.bonus.socialInsurance;
  target.bonus.civilMutual += source.bonus.civilMutual;
  target.bonus.nationalInsurance += source.bonus.nationalInsurance;
  target.retirementAllowance += source.retirementAllowance;
  target.businessCf += source.businessCf;
  target.realEstateCf += source.realEstateCf;
  addPensionBreakdown(target.pension, source.pension);
  addInsuranceIncomeBreakdown(target.insurance, source.insurance);
  target.childAllowance += source.childAllowance ?? 0;
  target.transferCf += source.transferCf;
  target.taxFreeIncome += source.taxFreeIncome;
  target.otherIncome += source.otherIncome;
}

export function calcMemberMonthlyEarnedIncomeBreakdown(
  input: EarnedIncomeCalcInput,
  member: FamilyMember,
  calendarYear: number,
  calendarMonth: number,
): IncomeBreakdown {
  const result = createEmptyIncomeBreakdown();
  const entries = input.incomeByMember[member.id] ?? [];

  for (const entry of entries) {
    for (const period of entry.periods) {
      addBreakdown(
        result,
        calcIncomeBreakdownManForMonth(
          entry,
          period,
          member,
          input.referenceDate,
          calendarYear,
          calendarMonth,
        ),
      );
    }
    const retirementMan = calcRetirementAllowanceManForMonth(
      entry,
      member,
      input.referenceDate,
      calendarYear,
      calendarMonth,
    );
    if (retirementMan > 0) {
      result.retirementAllowance += retirementMan;
    }
  }

  return result;
}

export function calcMonthlyIncomeBreakdown(
  input: EarnedIncomeCalcInput,
  calendarYear: number,
  calendarMonth: number,
): IncomeBreakdown {
  const total = createEmptyIncomeBreakdown();

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;

    addBreakdown(
      total,
      calcMemberMonthlyEarnedIncomeBreakdown(
        input,
        member,
        calendarYear,
        calendarMonth,
      ),
    );
  }

  return total;
}
