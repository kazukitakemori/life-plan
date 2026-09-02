import { resolveMemberAge, resolveMemberBirthMonth } from "./familyDefaults";
import {
  calcBirthYear,
  calcYearAtAge,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
  isSamePeriodAgeMonth,
} from "./birthDate";
import {
  calcOwnedCashPurchaseInitialMan,
  calcOwnedLoanDownPaymentMan,
} from "./housingOwnedAmount";
import { getOwnedPeriodEnd } from "./housingPeriodChain";
import {
  calcHousingLoanBalanceAfterRepaymentMonthsYen,
  calcHousingLoanPrincipalInterestAtMonthYen,
  calcHousingLoanTotalAmountMan,
} from "./housingLoanAmount";
import type { HousingLoanAmountOptions } from "./housingLoanAmount";
import {
  calcLoanEntryAmountMan,
  getLoansForHousingProperty,
  resolveHousingPropertyFinanceLoans,
  resolveOwnedPropertyLoanSettings,
  toLoanEntryAmountOptions,
} from "./loanResolution";
import {
  isLoanMonthlyRepaymentActiveMonth,
  isLoanMonthlyRepaymentMode,
} from "./loanPaymentMode";
import {
  calcRepaymentMonthIndex,
  getLoanRepaymentStartCalendar,
  getOwnershipStartCalendar,
  yenToMan,
} from "./housingLoanAmortization";
import { resolveLoanOwnershipStartCalendar } from "./loanInterestRatePeriod";
import type { FamilyMember } from "../types/family";
import type {
  HousingState,
  OwnedAnnualTaxEntry,
  OwnedMonthlyFeeEntry,
  OwnedProperty,
  RentalProperty,
} from "../types/housing";
import { HOUSEHOLD_HOUSING_KEY, OWNED_PERIOD_LIFETIME } from "../types/housing";
import type { LoanState } from "../types/loan";
import {
  createEmptyHousingExpenseDetail,
  type HousingExpenseDetail,
} from "../types/cashFlow";

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function getRentalEnd(
  rental: RentalProperty,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (rental.endMode === "lifetime") {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: rental.endAge, endMonth: rental.endMonth };
}

function isRentalActive(
  rental: RentalProperty,
  member: FamilyMember,
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

  const { endAge, endMonth } = getRentalEnd(rental, member);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return isAgeCalendarMonthInRange(
    ageMonth.age,
    ageMonth.month,
    rental.startAge,
    rental.startMonth,
    endAge,
    endMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

function isRentalStartMonth(
  rental: RentalProperty,
  member: FamilyMember,
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
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return isSamePeriodAgeMonth(
    ageMonth.age,
    ageMonth.month,
    rental.startAge,
    rental.startMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

function isRenewalMonth(
  rental: RentalProperty,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (rental.renewalIntervalYears <= 0 || rental.renewalFeeMan <= 0) {
    return false;
  }

  const firstRenewal = rental.renewalNextYear * 12 + rental.renewalNextMonth;
  const current = calendarYear * 12 + calendarMonth;
  if (current < firstRenewal) return false;

  const monthsSinceFirst = current - firstRenewal;
  const intervalMonths = rental.renewalIntervalYears * 12;
  return monthsSinceFirst % intervalMonths === 0;
}

function isRentalEndMonth(
  rental: RentalProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (rental.endMode !== "until") {
    return false;
  }

  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return isSamePeriodAgeMonth(
    ageMonth.age,
    ageMonth.month,
    rental.endAge,
    rental.endMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

function calcRentalMonthlyHousingDetailMan(
  rental: RentalProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): HousingExpenseDetail {
  const detail = createEmptyHousingExpenseDetail();

  if (
    !isRentalActive(rental, member, referenceDate, calendarYear, calendarMonth)
  ) {
    return detail;
  }

  detail.monthlyCost = rental.monthlyRentMan;

  if (
    rental.occupancy === "upcoming" &&
    isRentalStartMonth(
      rental,
      member,
      referenceDate,
      calendarYear,
      calendarMonth,
    )
  ) {
    detail.rentalInitialCost =
      rental.securityDepositMan +
      rental.keyMoneyMan +
      rental.brokerageFeeMan +
      rental.movingCostMan;
  }

  if (isRenewalMonth(rental, calendarYear, calendarMonth)) {
    detail.renewalCost = rental.renewalFeeMan;
  }

  if (
    rental.occupancy === "current" &&
    isRentalEndMonth(rental, member, referenceDate, calendarYear, calendarMonth)
  ) {
    detail.rentalMoveOutCost = rental.moveOutCostMan;
  }

  // 火災保険などは Q10 保険タブ（insuranceState）から CF に加算

  return detail;
}

export function calcHouseholdMonthlyRentalOtherIncomeMan(
  familyMembers: FamilyMember[],
  housingState: HousingState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  let total = 0;

  for (const [targetId, targetData] of Object.entries(housingState.byTarget)) {
    const member =
      targetId === HOUSEHOLD_HOUSING_KEY
        ? familyMembers.find((m) => m.role === "head")
        : familyMembers.find((m) => m.id === targetId);

    if (!member) continue;

    for (const rental of targetData.rentals) {
      if (
        rental.endMode === "until" &&
        isRentalEndMonth(
          rental,
          member,
          referenceDate,
          calendarYear,
          calendarMonth,
        )
      ) {
        if (rental.occupancy === "upcoming") {
          total += rental.securityDepositMan;
        } else {
          total += rental.securityDepositRefundMan;
        }
      }
    }
  }

  return total;
}

function isOwnedStartMonth(
  property: OwnedProperty,
  member: FamilyMember,
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
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return isSamePeriodAgeMonth(
    ageMonth.age,
    ageMonth.month,
    property.startAge,
    property.startMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

/**
 * 所有終了月（until 指定時のみ）。生涯所有は団信等で残債処理される想定のため
 * CF上の残債一括は行わない。
 */
function isOwnedEarlyEndMonth(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (property.endMode !== "until") return false;
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return isSamePeriodAgeMonth(
    ageMonth.age,
    ageMonth.month,
    property.endAge,
    property.endMonth,
    birthYear,
    resolveMemberBirthMonth(member),
  );
}

function isOwnedActive(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  if (member.age == null) return false;
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const birthMonth = resolveMemberBirthMonth(member);
  const birthYear = calcBirthYear(member.age, birthMonth, referenceDate);

  const start = getOwnershipStartCalendar(
    property,
    member.age,
    referenceYear,
    birthMonth,
    referenceMonth,
  );
  const { age: endAge, month: endMonth } = getOwnedPeriodEnd(property, member);
  const endYear = calcYearAtAge(birthYear, birthMonth, endAge, endMonth);

  const current = calendarYear * 12 + calendarMonth;
  const startIdx = start.year * 12 + start.month;
  const endIdx = endYear * 12 + endMonth;
  return current >= startIdx && current <= endIdx;
}

function calcOwnedYearsElapsed(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number | null {
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return null;
  const monthsElapsed =
    ageMonthIndex(ageMonth.age, ageMonth.month) -
    ageMonthIndex(property.startAge, property.startMonth);
  if (monthsElapsed < 0) return null;
  return Math.floor(monthsElapsed / 12);
}

function isOwnedMonthlyFeeActive(
  entry: OwnedMonthlyFeeEntry,
  yearsElapsed: number,
): boolean {
  if (yearsElapsed < entry.startOffsetYears) return false;
  if (
    entry.endOffsetYears === OWNED_PERIOD_LIFETIME ||
    entry.endOffsetYears < 0
  ) {
    return true;
  }
  return yearsElapsed < entry.endOffsetYears;
}

function sumOwnedMonthlyFeeMan(
  entries: OwnedMonthlyFeeEntry[],
  yearsElapsed: number,
): number {
  let totalMan = 0;
  for (const entry of entries) {
    if (!isOwnedMonthlyFeeActive(entry, yearsElapsed)) continue;
    totalMan += Math.max(0, entry.amountManPerMonth);
  }
  return totalMan;
}

function isOwnedSelfRepairMonth(
  property: OwnedProperty,
  calendarYear: number,
  calendarMonth: number,
): boolean {
  const { selfRepair } = property.maintenance;
  if (selfRepair.costMan <= 0) return false;

  const first = selfRepair.nextYear * 12 + selfRepair.nextMonth;
  const current = calendarYear * 12 + calendarMonth;
  if (current < first) return false;
  if (selfRepair.intervalYears <= 0) return current === first;

  const monthsSinceFirst = current - first;
  const intervalMonths = selfRepair.intervalYears * 12;
  return monthsSinceFirst % intervalMonths === 0;
}

function calcOwnedImprovementCostMan(
  property: OwnedProperty,
  calendarYear: number,
  calendarMonth: number,
): number {
  let totalMan = 0;
  for (const entry of property.maintenance.improvements) {
    if (entry.year === calendarYear && entry.month === calendarMonth) {
      totalMan += Math.max(0, entry.amountMan);
    }
  }
  return totalMan;
}

function getOwnedOwnershipStartYear(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  return calcYearAtAge(
    birthYear,
    resolveMemberBirthMonth(member),
    property.startAge,
    property.startMonth,
  );
}

/** 該当年に適用する税額行（当初=所有開始年。同年以下で最新の開始年を採用） */
function resolveOwnedAnnualTaxEntry(
  entries: OwnedAnnualTaxEntry[],
  ownershipStartYear: number,
  calendarYear: number,
): OwnedAnnualTaxEntry | null {
  let best: OwnedAnnualTaxEntry | null = null;
  let bestStart = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const startYear = entry.startYear ?? ownershipStartYear;
    if (startYear <= calendarYear && startYear >= bestStart) {
      best = entry;
      bestStart = startYear;
    }
  }
  return best;
}

function calcOwnedAnnualPropertyTaxMonthlyMan(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
): { fixedAsset: number; cityPlanning: number } {
  const ownershipStartYear = getOwnedOwnershipStartYear(
    property,
    member,
    referenceDate,
  );
  const land = resolveOwnedAnnualTaxEntry(
    property.maintenance.landTaxes,
    ownershipStartYear,
    calendarYear,
  );
  const building =
    property.type === "land"
      ? null
      : resolveOwnedAnnualTaxEntry(
          property.maintenance.buildingTaxes,
          ownershipStartYear,
          calendarYear,
        );

  const fixedAssetAnnual =
    Math.max(0, land?.fixedAssetTaxMan ?? 0) +
    Math.max(0, building?.fixedAssetTaxMan ?? 0);
  const cityPlanningAnnual =
    Math.max(0, land?.cityPlanningTaxMan ?? 0) +
    Math.max(0, building?.cityPlanningTaxMan ?? 0);

  return {
    fixedAsset: fixedAssetAnnual / 12,
    cityPlanning: cityPlanningAnnual / 12,
  };
}

export interface OwnedHousingLoanCalcOptions {
  /**
   * 返済に含めるローン ID。指定時はリンクなしの property.loan へフォールバックしない。
   * 借入額の按分は物件に紐づく全契約を使う。
   */
  activeLoanIds?: string[];
}

function calcOwnedMonthlyHousingDetailMan(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
  targetId?: string,
  loanCalcOptions?: OwnedHousingLoanCalcOptions,
): HousingExpenseDetail {
  const detail = createEmptyHousingExpenseDetail();

  if (
    !isOwnedActive(property, member, referenceDate, calendarYear, calendarMonth)
  ) {
    return detail;
  }

  if (
    property.usage === "current" &&
    property.currentExpenseMode === "simple"
  ) {
    detail.simpleMonthlyCost = property.simpleMonthlyExpenseMan;
    return detail;
  }

  // 居住中は過去の購入時支出を試算に含めない
  if (
    property.usage !== "current" &&
    isOwnedStartMonth(
      property,
      member,
      referenceDate,
      calendarYear,
      calendarMonth,
    )
  ) {
    detail.purchaseInitial =
      property.paymentMethod === "cash"
        ? calcOwnedCashPurchaseInitialMan(property)
        : calcOwnedLoanDownPaymentMan(
            property,
            loanState && targetId
              ? resolveOwnedPropertyLoanSettings(property, loanState, targetId)
              : property.loan,
            loanState,
            targetId,
          );
  }

  const yearsElapsed = calcOwnedYearsElapsed(
    property,
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (yearsElapsed != null) {
    detail.managementFee = sumOwnedMonthlyFeeMan(
      property.maintenance.managementFees,
      yearsElapsed,
    );
    detail.repairReserve = sumOwnedMonthlyFeeMan(
      property.maintenance.repairReserveFees,
      yearsElapsed,
    );
  }

  if (isOwnedSelfRepairMonth(property, calendarYear, calendarMonth)) {
    detail.selfRepairCost = property.maintenance.selfRepair.costMan;
  }

  detail.improvementCost = calcOwnedImprovementCostMan(
    property,
    calendarYear,
    calendarMonth,
  );

  if (
    property.usage !== "current" &&
    property.acquisitionTaxMan > 0 &&
    calendarYear === property.acquisitionTaxYear &&
    calendarMonth === property.acquisitionTaxMonth
  ) {
    detail.taxDetail.realEstateAcquisition = property.acquisitionTaxMan;
  }

  const annualPropertyTax = calcOwnedAnnualPropertyTaxMonthlyMan(
    property,
    member,
    referenceDate,
    calendarYear,
  );
  detail.taxDetail.fixedAsset = annualPropertyTax.fixedAsset;
  detail.taxDetail.cityPlanning = annualPropertyTax.cityPlanning;

  if (property.paymentMethod === "loan") {
    const linkedLoans =
      loanState && targetId
        ? getLoansForHousingProperty(loanState, targetId, property.id)
        : [];
    const financeLoans = resolveHousingPropertyFinanceLoans(linkedLoans);
    const loanEntries =
      loanCalcOptions?.activeLoanIds != null
        ? financeLoans.filter((entry) =>
            loanCalcOptions.activeLoanIds!.includes(entry.id),
          )
        : financeLoans;

    const referenceYear = referenceDate.getFullYear();
    const referenceMonth = referenceDate.getMonth() + 1;
    const memberAge = resolveMemberAge(member);
    const earlyEndMonth = isOwnedEarlyEndMonth(
      property,
      member,
      referenceDate,
      calendarYear,
      calendarMonth,
    );

    const calcRepaymentMonthIndexForLoan = (
      loan: ReturnType<typeof resolveOwnedPropertyLoanSettings>,
    ): number | null => {
      if (!loan) return null;
      const ownershipStart = resolveLoanOwnershipStartCalendar(
        loan,
        property,
        member.age ?? undefined,
        referenceYear,
        referenceMonth,
        undefined,
        resolveMemberBirthMonth(member),
      );
      const repaymentStart = getLoanRepaymentStartCalendar(ownershipStart);
      return calcRepaymentMonthIndex(
        repaymentStart,
        calendarYear,
        calendarMonth,
      );
    };

    const loanCalendarOptions: HousingLoanAmountOptions = {
      birthMonth: resolveMemberBirthMonth(member),
      referenceMonth,
    };

    const addAmortizedLoanMonth = (
      loan: NonNullable<ReturnType<typeof resolveOwnedPropertyLoanSettings>>,
      loanAmountMan: number,
      amountOptions?: HousingLoanAmountOptions,
    ) => {
      if (loanAmountMan <= 0 || loan.years <= 0) return;

      const options: HousingLoanAmountOptions = {
        ...loanCalendarOptions,
        ...amountOptions,
      };
      const repaymentMonthIndex = calcRepaymentMonthIndexForLoan(loan);

      if (repaymentMonthIndex != null) {
        const { principalYen, interestYen } =
          calcHousingLoanPrincipalInterestAtMonthYen(
            property,
            loan,
            repaymentMonthIndex,
            memberAge,
            referenceYear,
            options,
          );
        detail.loanRepaymentDetail.principal += yenToMan(principalYen);
        detail.loanRepaymentDetail.interest += yenToMan(interestYen);
      }

      // 所有をローン完済前に終了する場合、終了月に残債を一括計上する
      if (!earlyEndMonth) return;
      const residualYen =
        repaymentMonthIndex == null
          ? loanAmountMan * 10_000
          : calcHousingLoanBalanceAfterRepaymentMonthsYen(
              property,
              loan,
              repaymentMonthIndex,
              memberAge,
              referenceYear,
              options,
            );
      if (residualYen > 0) {
        detail.loanRepaymentDetail.principal += yenToMan(residualYen);
      }
    };

    if (loanEntries.length > 0) {
      for (const loanEntry of loanEntries) {
        // 月々返済の簡易入力は元利内訳・残債が無いため元金側に月額のみ計上する
        if (isLoanMonthlyRepaymentMode(loanEntry)) {
          if (
            isLoanMonthlyRepaymentActiveMonth(
              loanEntry,
              referenceDate,
              calendarYear,
              calendarMonth,
            )
          ) {
            detail.loanRepaymentDetail.principal +=
              loanEntry.monthlyRepaymentMan;
          }
          continue;
        }

        const loan = loanEntry.settings;
        if (!loan) continue;
        const loanAmountMan = calcLoanEntryAmountMan(
          property,
          loanEntry,
          financeLoans,
        );
        const amountOptions = toLoanEntryAmountOptions(
          property,
          loanEntry,
          financeLoans,
        );
        addAmortizedLoanMonth(loan, loanAmountMan, amountOptions);
      }
    } else if (loanCalcOptions?.activeLoanIds == null) {
      const loan =
        loanState && targetId
          ? resolveOwnedPropertyLoanSettings(property, loanState, targetId)
          : property.loan;
      if (loan) {
        addAmortizedLoanMonth(
          loan,
          calcHousingLoanTotalAmountMan(property, loan),
        );
      }
    }
  }

  return detail;
}

export function addHousingExpenseDetail(
  target: HousingExpenseDetail,
  source: HousingExpenseDetail,
): void {
  target.purchaseInitial += source.purchaseInitial;
  target.rentalInitialCost += source.rentalInitialCost;
  target.rentalMoveOutCost += source.rentalMoveOutCost;
  target.monthlyCost += source.monthlyCost;
  target.renewalCost += source.renewalCost;
  target.managementFee += source.managementFee;
  target.repairReserve += source.repairReserve;
  target.selfRepairCost += source.selfRepairCost;
  target.improvementCost += source.improvementCost;
  target.taxDetail.realEstateAcquisition +=
    source.taxDetail.realEstateAcquisition;
  target.taxDetail.fixedAsset += source.taxDetail.fixedAsset;
  target.taxDetail.cityPlanning += source.taxDetail.cityPlanning;
  target.loanRepaymentDetail.principal += source.loanRepaymentDetail.principal;
  target.loanRepaymentDetail.interest += source.loanRepaymentDetail.interest;
  target.loanRepaymentDetail.fees += source.loanRepaymentDetail.fees;
  target.loanRepaymentDetail.groupCreditLife +=
    source.loanRepaymentDetail.groupCreditLife;
  target.rentalInsurancePremium += source.rentalInsurancePremium;
  target.ownedInsurancePremium += source.ownedInsurancePremium;
  target.simpleMonthlyCost += source.simpleMonthlyCost;
}

export function calcHouseholdMonthlyHousingDetailMan(
  familyMembers: FamilyMember[],
  housingState: HousingState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  loanState?: LoanState,
  ownedLoanOptions?: OwnedHousingLoanCalcOptions,
): HousingExpenseDetail {
  const detail = createEmptyHousingExpenseDetail();

  for (const [targetId, targetData] of Object.entries(housingState.byTarget)) {
    const member =
      targetId === HOUSEHOLD_HOUSING_KEY
        ? familyMembers.find((m) => m.role === "head")
        : familyMembers.find((m) => m.id === targetId);

    if (!member) continue;

    for (const rental of targetData.rentals) {
      addHousingExpenseDetail(
        detail,
        calcRentalMonthlyHousingDetailMan(
          rental,
          member,
          referenceDate,
          calendarYear,
          calendarMonth,
        ),
      );
    }

    for (const owned of targetData.owned) {
      addHousingExpenseDetail(
        detail,
        calcOwnedMonthlyHousingDetailMan(
          owned,
          member,
          referenceDate,
          calendarYear,
          calendarMonth,
          loanState,
          targetId,
          ownedLoanOptions,
        ),
      );
    }
  }

  return detail;
}
