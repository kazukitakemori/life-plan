import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import { calcBirthYear, getMemberAgeMonth, isAgeCalendarMonthInRange } from './birthDate';
import { yenToMan } from './educationCashFlow';
import { resolveGroupCreditLifeSurchargeRatePct } from './groupCreditLife';
import {
  calcLoanRepaymentMonthYen,
  calcRepaymentMonthIndex,
} from './housingLoanAmortization';
import { buildLoanRepaymentEventResolver } from './housingLoanPrepayment';
import {
  getBaseInterestRateAtRepaymentMonth,
  resolveLoanRepaymentSchedule,
} from './loanInterestRatePeriod';
import { getLoansForVehicle } from './loanResolution';
import {
  isLoanMonthlyRepaymentActiveMonth,
  isLoanMonthlyRepaymentMode,
} from './loanPaymentMode';
import { isVehicleInspectionDueMonth } from './vehicleInspection';
import {
  getVehicleMonthlyMaintCostMan,
  isVehicleAlreadyOwned,
  resolveAnnualCostCycleYears,
} from './vehicleLabels';
import type { FamilyMember } from '../types/family';
import type { OwnedPropertyLoanSettings } from '../types/housing';
import type { LoanEntry, LoanState } from '../types/loan';
import type { VehicleEntry, VehicleState } from '../types/vehicle';
import {
  createEmptyVehicleExpenseDetail,
  sumVehicleExpenseDetail,
  type VehicleExpenseDetail,
} from '../types/cashFlow';

const MAN_TO_YEN = 10_000;

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function getEntryEnd(
  entry: VehicleEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (entry.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

function calendarMonthIdx(year: number, month: number): number {
  return year * 12 + month;
}

function isVehicleMonthlyRepaymentMonth(
  entry: VehicleEntry,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  const endYear = entry.repaymentEndYear;
  const endMonth = entry.repaymentEndMonth;
  if (!endYear || !endMonth) return true;

  return calendarMonthIdx(calendarYear, calendarMonth) <=
    calendarMonthIdx(endYear, endMonth);
}

function resolveVehicleLoanOwnershipStart(
  settings: OwnedPropertyLoanSettings,
  entry: VehicleEntry,
  member: FamilyMember,
  referenceDate: Date,
): { year: number; month: number } {
  if (settings.startYear > 0 && settings.startMonth > 0) {
    return { year: settings.startYear, month: settings.startMonth };
  }

  const referenceYear = referenceDate.getFullYear();
  return {
    year: referenceYear + (entry.startAge - resolveMemberAge(member)),
    month: entry.startMonth,
  };
}

function calcVehicleLoanRepaymentMan(
  loan: LoanEntry,
  entry: VehicleEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (isLoanMonthlyRepaymentMode(loan)) {
    return isLoanMonthlyRepaymentActiveMonth(
      loan,
      referenceDate,
      calendarYear,
      calendarMonth,
    )
      ? loan.monthlyRepaymentMan
      : 0;
  }

  const settings = loan.settings;
  const amountMan = settings.amountMan ?? 0;
  if (amountMan <= 0) return 0;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const ownershipStart = resolveVehicleLoanOwnershipStart(
    settings,
    entry,
    member,
    referenceDate,
  );
  const schedule = resolveLoanRepaymentSchedule(
    {
      ...settings,
      startYear: ownershipStart.year,
      startMonth: ownershipStart.month,
    },
    { referenceYear, referenceMonth },
  );
  if (schedule.totalMonths <= 0) return 0;

  const repaymentMonthIndex = calcRepaymentMonthIndex(
    schedule.repaymentStart,
    calendarYear,
    calendarMonth,
  );
  if (
    repaymentMonthIndex == null ||
    repaymentMonthIndex <= 0 ||
    repaymentMonthIndex > schedule.totalMonths
  ) {
    return 0;
  }

  const principalYen = amountMan * MAN_TO_YEN;
  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanRepaymentEventResolver(settings, {
    repaymentStart: schedule.repaymentStart,
    totalMonths: schedule.totalMonths,
  });

  const { principalYen: principalPaid, interestYen } = calcLoanRepaymentMonthYen(
    principalYen,
    schedule.totalMonths,
    repaymentMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );

  return yenToMan(principalPaid + interestYen);
}

function calcEntryMonthlyDetailMan(
  entry: VehicleEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
): VehicleExpenseDetail {
  const detail = createEmptyVehicleExpenseDetail();
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return detail;

  const { endAge, endMonth } = getEntryEnd(entry, member);
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      entry.startAge,
      entry.startMonth,
      endAge,
      endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return detail;
  }

  const monthsFromStart =
    ageMonthIndex(ageMonth.age, ageMonth.month) -
    ageMonthIndex(entry.startAge, entry.startMonth);
  if (monthsFromStart < 0) return detail;

  const isMonthlyRepayment = entry.paymentMode === 'monthlyRepayment';
  const isAlreadyOwned = isVehicleAlreadyOwned(entry);
  const hasLinkedLoans = Boolean(
    loanState && getLoansForVehicle(loanState, member.id, entry.id).length > 0,
  );

  let maintenance = getVehicleMonthlyMaintCostMan(entry);

  if (entry.annualCostMan > 0) {
    const cycleMonths = resolveAnnualCostCycleYears(entry) * 12;
    if (monthsFromStart % cycleMonths === 0) {
      maintenance += entry.annualCostMan;
    }
  }

  if (
    isVehicleInspectionDueMonth(
      entry,
      calendarYear,
      calendarMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    maintenance += entry.inspectionCostMan ?? 0;
  }

  let insurance = 0;
  if (monthsFromStart % 12 === 0) {
    for (const item of entry.insurances ?? []) {
      insurance += item.premiumMan ?? 0;
    }
  }

  // 既に保有・ローン追加時・月々返済額入力時は購入費を一括計上しない
  // （既に固定資産／借入額の基準／返済額入力のみ）
  let purchase = 0;
  if (
    !isAlreadyOwned &&
    !isMonthlyRepayment &&
    !hasLinkedLoans &&
    entry.purchaseAmountMan > 0
  ) {
    if (monthsFromStart === 0) {
      purchase = entry.purchaseAmountMan;
    }
  }

  let loanRepayment = 0;
  if (isMonthlyRepayment) {
    loanRepayment = isVehicleMonthlyRepaymentMonth(
      entry,
      calendarYear,
      calendarMonth,
    )
      ? entry.monthlyRepaymentMan
      : 0;
  } else if (loanState) {
    const linkedLoans = getLoansForVehicle(loanState, member.id, entry.id);
    for (const loan of linkedLoans) {
      loanRepayment += calcVehicleLoanRepaymentMan(
        loan,
        entry,
        member,
        referenceDate,
        calendarYear,
        calendarMonth,
      );
    }
  }

  detail.purchase = purchase;
  detail.maintenance = maintenance;
  detail.insurance = insurance;
  detail.loanRepayment = loanRepayment;
  return detail;
}

export function calcMemberMonthlyVehicleDetailMan(
  member: FamilyMember,
  entries: VehicleEntry[],
  _state: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
): VehicleExpenseDetail {
  const detail = createEmptyVehicleExpenseDetail();
  for (const entry of entries) {
    const entryDetail = calcEntryMonthlyDetailMan(
      entry,
      member,
      referenceDate,
      calendarYear,
      calendarMonth,
      loanState,
    );
    detail.purchase += entryDetail.purchase;
    detail.maintenance += entryDetail.maintenance;
    detail.loanRepayment += entryDetail.loanRepayment;
    detail.insurance += entryDetail.insurance;
  }
  return detail;
}

export function calcHouseholdMonthlyVehicleDetailMan(
  familyMembers: FamilyMember[],
  state: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
): VehicleExpenseDetail {
  const detail = createEmptyVehicleExpenseDetail();
  for (const member of familyMembers) {
    if (member.role === 'pet') continue;
    const entries = state.byMember[member.id] ?? [];
    const memberDetail = calcMemberMonthlyVehicleDetailMan(
      member,
      entries,
      state,
      referenceDate,
      calendarYear,
      calendarMonth,
      loanState,
    );
    detail.purchase += memberDetail.purchase;
    detail.maintenance += memberDetail.maintenance;
    detail.loanRepayment += memberDetail.loanRepayment;
    detail.insurance += memberDetail.insurance;
  }
  return detail;
}

export function calcHouseholdMonthlyVehicleMan(
  familyMembers: FamilyMember[],
  state: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
): number {
  return sumVehicleExpenseDetail(
    calcHouseholdMonthlyVehicleDetailMan(
      familyMembers,
      state,
      referenceDate,
      calendarYear,
      calendarMonth,
      loanState,
    ),
  );
}
