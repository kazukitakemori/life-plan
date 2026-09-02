import type { FamilyMember } from '../types/family';
import { isEmployeesPensionLiableAtCalendarMonth } from './employeesPensionPremium';
import type {
  MemberSalaryBonusBreakdownYen,
  MonthlyRemunerationBreakdownYen,
} from './memberYearIncome';
import { capHealthStandardBonusTotalYen } from './standardRemuneration';

export interface EmployeeSocialInsuranceDeductionContext {
  member: Pick<FamilyMember, 'age' | 'birthMonth'>;
  referenceDate: Date;
  calendarYear: number;
  /** 給与天引きが発生する暦月（給与支給月） */
  monthStart: number;
  monthEnd: number;
  /** 算定対象年の1～12月の報酬内訳 */
  currentYearSplit: MemberSalaryBonusBreakdownYen;
  /** 前年12月分を1月給与から天引きする場合に使用 */
  previousYearSplit?: MemberSalaryBonusBreakdownYen;
}

export function calcPreviousCalendarMonth(
  calendarYear: number,
  calendarMonth: number,
): { year: number; month: number } {
  if (calendarMonth <= 1) {
    return { year: calendarYear - 1, month: 12 };
  }
  return { year: calendarYear, month: calendarMonth - 1 };
}

function lookupMonthlyRemuneration(
  split: MemberSalaryBonusBreakdownYen | undefined,
  month: number,
): MonthlyRemunerationBreakdownYen | undefined {
  return split?.monthlyRemunerations.find((entry) => entry.month === month);
}

function resolveRemunerationForPaycheckMonth(
  ctx: EmployeeSocialInsuranceDeductionContext,
  paycheckMonth: number,
): { year: number; month: number; entry: MonthlyRemunerationBreakdownYen } | null {
  const { year: remYear, month: remMonth } = calcPreviousCalendarMonth(
    ctx.calendarYear,
    paycheckMonth,
  );
  const split =
    remYear === ctx.calendarYear
      ? ctx.currentYearSplit
      : remYear === ctx.calendarYear - 1
        ? ctx.previousYearSplit
        : undefined;
  const entry = lookupMonthlyRemuneration(split, remMonth);
  if (!entry || entry.remunerationYen <= 0) return null;
  return { year: remYear, month: remMonth, entry };
}

export function isEmployeesPensionLiableAtRemunerationMonth(
  ctx: Pick<EmployeeSocialInsuranceDeductionContext, 'member' | 'referenceDate'>,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  return isEmployeesPensionLiableAtCalendarMonth(
    ctx.member,
    ctx.referenceDate,
    calendarYear,
    calendarMonth,
  );
}

/**
 * 月例給与分の保険料（当月分を翌月給与から天引きする前提・給与支給月ベース）。
 * 月次キャッシュフロー向け。年次試算では {@link calcSalaryInsurancePremiumForSimulationMonthsYen} を使う。
 */
export function calcSalaryInsurancePremiumWithNextMonthDeductionYen(
  ctx: EmployeeSocialInsuranceDeductionContext,
  rate: number,
  purpose: 'health' | 'pension' | 'employment',
  options?: {
    isLiableAtRemunerationMonth?: (
      calendarYear: number,
      calendarMonth: number,
    ) => boolean;
  },
): number {
  const isLiable =
    options?.isLiableAtRemunerationMonth ??
    ((year, month) =>
      purpose !== 'pension' ||
      isEmployeesPensionLiableAtRemunerationMonth(ctx, year, month));

  let total = 0;
  for (
    let paycheckMonth = ctx.monthStart;
    paycheckMonth <= ctx.monthEnd;
    paycheckMonth++
  ) {
    const resolved = resolveRemunerationForPaycheckMonth(ctx, paycheckMonth);
    if (!resolved) continue;
    if (!isLiable(resolved.year, resolved.month)) continue;

    const baseYen =
      purpose === 'health'
        ? resolved.entry.standardHealthYen
        : purpose === 'pension'
          ? resolved.entry.standardPensionYen
          : resolved.entry.remunerationYen;
    total += Math.floor(baseYen * rate);
  }
  return total;
}

/**
 * 月例給与分の保険料（試算対象月の報酬月ベース）。
 *
 * 年次キャッシュフローでは収入を monthStart～monthEnd の報酬で集計するため、
 * 社保も同じ月の報酬に対応づけて計上する。翌月天引きのため最終月分は翌年1月給与から
 * 差し引かれるが、年次では当該年の手取り計算に含める。
 */
export function calcSalaryInsurancePremiumForSimulationMonthsYen(
  ctx: EmployeeSocialInsuranceDeductionContext,
  rate: number,
  purpose: 'health' | 'pension' | 'employment',
  options?: {
    isLiableAtRemunerationMonth?: (
      calendarYear: number,
      calendarMonth: number,
    ) => boolean;
  },
): number {
  const isLiable =
    options?.isLiableAtRemunerationMonth ??
    ((year, month) =>
      purpose !== 'pension' ||
      isEmployeesPensionLiableAtRemunerationMonth(ctx, year, month));

  let total = 0;
  for (
    let remMonth = ctx.monthStart;
    remMonth <= ctx.monthEnd;
    remMonth++
  ) {
    const entry = lookupMonthlyRemuneration(ctx.currentYearSplit, remMonth);
    if (!entry || entry.remunerationYen <= 0) continue;
    if (!isLiable(ctx.calendarYear, remMonth)) continue;

    const baseYen =
      purpose === 'health'
        ? entry.standardHealthYen
        : purpose === 'pension'
          ? entry.standardPensionYen
          : entry.remunerationYen;
    total += Math.floor(baseYen * rate);
  }
  return total;
}

/** 賞与分の保険料（賞与支給月に天引き） */
export function calcBonusInsurancePremiumYen(
  incomeSplit: MemberSalaryBonusBreakdownYen,
  rate: number,
  purpose: 'health' | 'pension' | 'employment',
  isLiableAtBonusMonth?: (calendarMonth: number) => boolean,
  monthStart = 1,
  monthEnd = 12,
): number {
  if (
    incomeSplit.bonusTreatedAsRemuneration &&
    (purpose === 'health' || purpose === 'pension')
  ) {
    return 0;
  }

  if (purpose === 'health') {
    const bonusStandardYen = incomeSplit.bonusPayments
      .filter(
        (payment) =>
          payment.month >= monthStart && payment.month <= monthEnd,
      )
      .reduce((sum, payment) => sum + payment.standardHealthYen, 0);
    return Math.floor(
      capHealthStandardBonusTotalYen(bonusStandardYen) * rate,
    );
  }

  if (purpose === 'pension') {
    return incomeSplit.bonusPayments.reduce((sum, payment) => {
      if (payment.month < monthStart || payment.month > monthEnd) return sum;
      if (isLiableAtBonusMonth && !isLiableAtBonusMonth(payment.month)) {
        return sum;
      }
      return sum + Math.floor(payment.standardPensionYen * rate);
    }, 0);
  }

  const annualBonusYen = incomeSplit.bonusPayments.reduce(
    (sum, payment) =>
      payment.month >= monthStart && payment.month <= monthEnd
        ? sum + payment.remunerationYen
        : sum,
    0,
  );
  return Math.floor(annualBonusYen * rate);
}

/** 被用者保険料（年次試算：月例給与は報酬月ベース、賞与は支給月天引き） */
export function calcEmployeeInsurancePremiumFromSalaryAndBonusYen(
  ctx: EmployeeSocialInsuranceDeductionContext,
  rate: number,
  purpose: 'health' | 'pension' | 'employment',
): number {
  const isPensionLiableAtBonusMonth = (calendarMonth: number) =>
    isEmployeesPensionLiableAtRemunerationMonth(
      ctx,
      ctx.calendarYear,
      calendarMonth,
    );

  const salaryPart = calcSalaryInsurancePremiumForSimulationMonthsYen(
    ctx,
    rate,
    purpose,
  );
  const bonusPart = calcBonusInsurancePremiumYen(
    ctx.currentYearSplit,
    rate,
    purpose,
    purpose === 'pension' ? isPensionLiableAtBonusMonth : undefined,
    ctx.monthStart,
    ctx.monthEnd,
  );
  return salaryPart + bonusPart;
}
