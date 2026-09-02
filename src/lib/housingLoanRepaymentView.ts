import type { LoanInterestRatePeriod, OwnedProperty, OwnedPropertyLoanSettings } from '../types/housing';
import { resolveGroupCreditLifeSurchargeRatePct } from './groupCreditLife';
import {
  calcLoanRegularPaymentAtMonthYen,
  calcLoanRepaymentMonthYen,
  calcRepaymentMonthIndex,
} from './housingLoanAmortization';
import {
  calcHousingLoanBalanceAfterRepaymentMonthsYen,
  calcHousingLoanFeeBreakdown,
  roundLoanAmountMan,
  type HousingLoanAmountOptions,
} from './housingLoanAmount';
import {
  calcBonusPrincipalSplit,
  calcBonusPaymentBreakdownYen,
  calcBonusTrackBalanceBeforePaymentYen,
  countBonusRepaymentMonths,
  countBonusRepaymentsBefore,
  findNextBonusRepaymentMonthIndex,
  shouldUseBonusPrincipalSplitDisplay,
} from './housingLoanBonusSplit.ts';
import { buildLoanRepaymentEventResolver } from './housingLoanPrepayment.ts';
import {
  formatInterestRatePeriodRangeLabel,
  getBaseInterestRateAtRepaymentMonth,
  resolveInterestRatePeriodBounds,
  resolveLoanRepaymentSchedule,
} from './loanInterestRatePeriod';
import { LOAN_INTEREST_RATE_TYPE_LABELS } from './loanLabels';

const MAN_TO_YEN = 10_000;

export interface HousingLoanRepaymentTrackDetail {
  /** 借入額（万円） */
  principalMan: number;
  /** 返済額（円） */
  paymentYen: number;
  /** 返済額のうち元金（円） */
  principalPaymentYen: number;
  /** 返済額のうち利息（円） */
  interestYen: number;
}

export interface HousingLoanRepaymentPeriodAmount {
  period: LoanInterestRatePeriod;
  periodRangeLabel: string;
  rateLabel: string;
  monthlyPaymentYen: number;
  bonusPaymentYen: number | null;
  annualPaymentYen: number;
  monthlyPaymentNote?: string;
  /** ボーナス返済ありのとき、毎月返済分の内訳 */
  monthlyTrack?: HousingLoanRepaymentTrackDetail | null;
  /** ボーナス返済ありのとき、ボーナス返済分の内訳 */
  bonusTrack?: HousingLoanRepaymentTrackDetail | null;
}

function calcAnnualPaymentYen(
  monthlyPaymentYen: number,
  annualBonusPaymentYen: number | null,
): number {
  if (monthlyPaymentYen <= 0) return 0;
  const bonusTotalYen =
    annualBonusPaymentYen != null && annualBonusPaymentYen > 0
      ? annualBonusPaymentYen
      : 0;
  return monthlyPaymentYen * 12 + bonusTotalYen;
}

function buildHousingLoanTrancheParts(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  breakdownOptions?: { pairSharePct?: number },
): Array<{ principalMan: number; surchargeRatePct: number }> {
  const breakdown = calcHousingLoanFeeBreakdown(
    property,
    settings,
    breakdownOptions,
  );
  const parts: Array<{ principalMan: number; surchargeRatePct: number }> = [];
  if (breakdown.propertyPriceMan > 0) {
    parts.push({ principalMan: breakdown.propertyPriceMan, surchargeRatePct: 0 });
  }
  if (breakdown.includedBrokerageMan > 0) {
    parts.push({
      principalMan: breakdown.includedBrokerageMan,
      surchargeRatePct: settings.brokerageFeeSurchargeRatePct,
    });
  }
  if (breakdown.includedRegistrationMan > 0) {
    parts.push({
      principalMan: breakdown.includedRegistrationMan,
      surchargeRatePct: settings.registrationFeeSurchargeRatePct,
    });
  }
  if (breakdown.bankFeesInLoanMan > 0) {
    parts.push({
      principalMan: breakdown.bankFeesInLoanMan,
      surchargeRatePct: 0,
    });
  }
  return parts;
}

function calcTrancheRegularPaymentAtMonthYen(
  principalMan: number,
  surchargeRatePct: number,
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  memberAgeAtReference: number,
  referenceYear: number,
): number {
  const schedule = resolveLoanRepaymentSchedule(settings, {
    property,
    memberAgeAtReference,
    referenceYear,
  });
  const totalMonths = schedule.totalMonths;
  if (totalMonths <= 0 || repaymentMonthIndex <= 0 || repaymentMonthIndex > totalMonths) {
    return 0;
  }

  const principalYen = principalMan * MAN_TO_YEN;
  if (principalYen <= 0) return 0;

  const danshinSurchargeRatePct = resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    surchargeRatePct +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanRepaymentEventResolver(settings, {
    repaymentStart: schedule.repaymentStart,
    totalMonths: schedule.totalMonths,
  });

  return calcLoanRegularPaymentAtMonthYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );
}

function calcFallbackRegularPaymentAtMonthYen(
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  referenceYear: number,
  referenceMonth: number,
  vehicle?: { startAge: number; startMonth: number },
  memberAgeAtReference?: number,
): number {
  const schedule = resolveLoanRepaymentSchedule(settings, {
    vehicle,
    memberAgeAtReference,
    referenceYear,
    referenceMonth,
  });
  const totalMonths = schedule.totalMonths;
  if (totalMonths <= 0 || repaymentMonthIndex <= 0 || repaymentMonthIndex > totalMonths) {
    return 0;
  }

  const principalYen = settings.amountMan * MAN_TO_YEN;
  if (principalYen <= 0) return 0;

  const danshinSurchargeRatePct = resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanRepaymentEventResolver(settings, {
    repaymentStart: schedule.repaymentStart,
    totalMonths: schedule.totalMonths,
  });

  return calcLoanRegularPaymentAtMonthYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );
}

function calcHousingLoanRegularPaymentAtMonthYen(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  referenceMonth: number,
  options?: HousingLoanAmountOptions,
): number {
  if (property != null && memberAgeAtReference != null) {
    const breakdownOptions =
      options?.pairSharePct != null
        ? { pairSharePct: options.pairSharePct }
        : undefined;
    return buildHousingLoanTrancheParts(property, settings, breakdownOptions).reduce(
      (sum, part) =>
        sum +
        calcTrancheRegularPaymentAtMonthYen(
          part.principalMan,
          part.surchargeRatePct,
          property,
          settings,
          repaymentMonthIndex,
          memberAgeAtReference,
          referenceYear,
        ),
      0,
    );
  }

  return calcFallbackRegularPaymentAtMonthYen(
    settings,
    repaymentMonthIndex,
    referenceYear,
    referenceMonth,
    options?.vehicle,
    memberAgeAtReference,
  );
}

function calcMonthlyTrackPaymentBreakdownAtMonthYen(
  monthlyPrincipalYen: number,
  repaymentMonthIndex: number,
  totalMonths: number,
  repaymentMethod: OwnedPropertyLoanSettings['repaymentMethod'],
  getRateForMonth: (month: number) => number,
): { principalYen: number; interestYen: number } {
  return calcLoanRepaymentMonthYen(
    monthlyPrincipalYen,
    totalMonths,
    repaymentMonthIndex,
    repaymentMethod,
    getRateForMonth,
  );
}

function buildRepaymentTrackDetail(
  principalMan: number,
  principalPaymentYen: number,
  interestYen: number,
  paymentYenOverride?: number,
): HousingLoanRepaymentTrackDetail {
  return {
    principalMan,
    paymentYen: paymentYenOverride ?? principalPaymentYen + interestYen,
    principalPaymentYen,
    interestYen,
  };
}

function calcHousingLoanSplitDisplayAtMonth(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  referenceMonth: number,
  options?: HousingLoanAmountOptions,
): {
  monthlyTrack: HousingLoanRepaymentTrackDetail;
  bonusTrack: HousingLoanRepaymentTrackDetail;
} | null {
  if (!shouldUseBonusPrincipalSplitDisplay(settings)) return null;

  const schedule = resolveLoanRepaymentSchedule(settings, {
    property,
    vehicle: options?.vehicle,
    memberAgeAtReference,
    referenceYear,
    referenceMonth,
  });
  if (
    schedule.totalMonths <= 0 ||
    repaymentMonthIndex <= 0 ||
    repaymentMonthIndex > schedule.totalMonths
  ) {
    return null;
  }

  const breakdownOptions =
    options?.pairSharePct != null ? { pairSharePct: options.pairSharePct } : undefined;
  const bonusPerTimeYen = settings.bonusRepaymentAmountMan * MAN_TO_YEN;
  const totalBonusPayments = countBonusRepaymentMonths(
    schedule.repaymentStart,
    schedule.totalMonths,
  );
  if (totalBonusPayments <= 0 || bonusPerTimeYen <= 0) return null;

  const danshinSurchargeRatePct = resolveGroupCreditLifeSurchargeRatePct(settings);
  const repaymentMethod = settings.repaymentMethod;
  const bonusMonthIndex = findNextBonusRepaymentMonthIndex(
    schedule.repaymentStart,
    repaymentMonthIndex,
    schedule.totalMonths,
  );
  const bonusPaymentsBefore =
    bonusMonthIndex != null
      ? countBonusRepaymentsBefore(schedule.repaymentStart, bonusMonthIndex)
      : 0;

  if (property != null && memberAgeAtReference != null) {
    const parts = buildHousingLoanTrancheParts(property, settings, breakdownOptions);
    const totalPrincipalYen = parts.reduce(
      (sum, part) => sum + part.principalMan * MAN_TO_YEN,
      0,
    );
    if (totalPrincipalYen <= 0) return null;

    let monthlyPrincipalYen = 0;
    let bonusPrincipalYen = 0;
    let monthlyPrincipalPaymentYen = 0;
    let monthlyInterestYen = 0;
    let bonusPrincipalPaymentYen = 0;
    let bonusInterestYen = 0;

    for (const part of parts) {
      const principalYen = part.principalMan * MAN_TO_YEN;
      const trancheBonusPerTimeYen = bonusPerTimeYen * (principalYen / totalPrincipalYen);
      const rate =
        getBaseInterestRateAtRepaymentMonth(settings, schedule, repaymentMonthIndex) +
        part.surchargeRatePct +
        danshinSurchargeRatePct;
      const split = calcBonusPrincipalSplit(
        principalYen,
        trancheBonusPerTimeYen,
        rate,
        totalBonusPayments,
        repaymentMethod,
      );
      monthlyPrincipalYen += split.monthlyPrincipalYen;
      bonusPrincipalYen += split.bonusPrincipalYen;

      const getRateForMonth = (month: number) =>
        getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
        part.surchargeRatePct +
        danshinSurchargeRatePct;
      const monthlyBreakdown = calcMonthlyTrackPaymentBreakdownAtMonthYen(
        split.monthlyPrincipalYen,
        repaymentMonthIndex,
        schedule.totalMonths,
        repaymentMethod,
        getRateForMonth,
      );
      monthlyPrincipalPaymentYen += monthlyBreakdown.principalYen;
      monthlyInterestYen += monthlyBreakdown.interestYen;

      if (bonusMonthIndex != null) {
        const bonusBalance = calcBonusTrackBalanceBeforePaymentYen(
          split.bonusPrincipalYen,
          rate,
          bonusPaymentsBefore,
          trancheBonusPerTimeYen,
          totalBonusPayments,
          repaymentMethod,
        );
        const bonusBreakdown = calcBonusPaymentBreakdownYen(
          bonusBalance,
          split.bonusPrincipalYen,
          trancheBonusPerTimeYen,
          totalBonusPayments,
          rate,
          repaymentMethod,
        );
        bonusPrincipalPaymentYen += bonusBreakdown.principalYen;
        bonusInterestYen += bonusBreakdown.interestYen;
      }
    }

    return {
      monthlyTrack: buildRepaymentTrackDetail(
        roundLoanAmountMan(monthlyPrincipalYen / MAN_TO_YEN),
        monthlyPrincipalPaymentYen,
        monthlyInterestYen,
      ),
      bonusTrack: buildRepaymentTrackDetail(
        roundLoanAmountMan(bonusPrincipalYen / MAN_TO_YEN),
        bonusPrincipalPaymentYen,
        bonusInterestYen,
        bonusPerTimeYen,
      ),
    };
  }

  const totalPrincipalYen = settings.amountMan * MAN_TO_YEN;
  if (totalPrincipalYen <= 0) return null;

  const rate =
    getBaseInterestRateAtRepaymentMonth(settings, schedule, repaymentMonthIndex) +
    danshinSurchargeRatePct;
  const split = calcBonusPrincipalSplit(
    totalPrincipalYen,
    bonusPerTimeYen,
    rate,
    totalBonusPayments,
    repaymentMethod,
  );
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    danshinSurchargeRatePct;
  const monthlyBreakdown = calcMonthlyTrackPaymentBreakdownAtMonthYen(
    split.monthlyPrincipalYen,
    repaymentMonthIndex,
    schedule.totalMonths,
    repaymentMethod,
    getRateForMonth,
  );
  const bonusBalance =
    bonusMonthIndex != null
      ? calcBonusTrackBalanceBeforePaymentYen(
          split.bonusPrincipalYen,
          rate,
          bonusPaymentsBefore,
          bonusPerTimeYen,
          totalBonusPayments,
          repaymentMethod,
        )
      : 0;
  const bonusBreakdown = calcBonusPaymentBreakdownYen(
    bonusBalance,
    split.bonusPrincipalYen,
    bonusPerTimeYen,
    totalBonusPayments,
    rate,
    repaymentMethod,
  );

  return {
    monthlyTrack: buildRepaymentTrackDetail(
      roundLoanAmountMan(split.monthlyPrincipalYen / MAN_TO_YEN),
      monthlyBreakdown.principalYen,
      monthlyBreakdown.interestYen,
    ),
    bonusTrack: buildRepaymentTrackDetail(
      roundLoanAmountMan(split.bonusPrincipalYen / MAN_TO_YEN),
      bonusBreakdown.principalYen,
      bonusBreakdown.interestYen,
      bonusPerTimeYen,
    ),
  };
}

export function calcHousingLoanRepaymentAmountsByPeriod(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  referenceMonth: number,
  options?: HousingLoanAmountOptions,
): HousingLoanRepaymentPeriodAmount[] {
  const schedule = resolveLoanRepaymentSchedule(settings, {
    property,
    vehicle: options?.vehicle,
    memberAgeAtReference,
    referenceYear,
    referenceMonth,
  });
  const bonusPaymentYen =
    settings.bonusRepaymentEnabled && settings.bonusRepaymentAmountMan > 0
      ? settings.bonusRepaymentAmountMan * MAN_TO_YEN
      : null;
  const monthlyPaymentNote =
    settings.repaymentMethod === 'equal_principal' ? '初回・以降逓減' : undefined;

  return settings.interestRatePeriods.map((period) => {
    const bounds = resolveInterestRatePeriodBounds(period, schedule);
    const repaymentMonthIndex = calcRepaymentMonthIndex(
      schedule.repaymentStart,
      bounds.start.year,
      bounds.start.month,
    );

    let monthlyPaymentYen = 0;
    let splitDisplay: ReturnType<typeof calcHousingLoanSplitDisplayAtMonth> = null;
    if (
      repaymentMonthIndex != null &&
      repaymentMonthIndex > 0 &&
      repaymentMonthIndex <= schedule.totalMonths
    ) {
      const balanceBeforePeriod =
        property != null && memberAgeAtReference != null
          ? calcHousingLoanBalanceAfterRepaymentMonthsYen(
              property,
              settings,
              repaymentMonthIndex - 1,
              memberAgeAtReference,
              referenceYear,
              options,
            )
          : settings.amountMan * MAN_TO_YEN;

      if (balanceBeforePeriod > 0) {
        splitDisplay = calcHousingLoanSplitDisplayAtMonth(
          property,
          settings,
          repaymentMonthIndex,
          memberAgeAtReference,
          referenceYear,
          referenceMonth,
          options,
        );
        if (splitDisplay) {
          monthlyPaymentYen = splitDisplay.monthlyTrack.paymentYen;
        } else {
          monthlyPaymentYen = calcHousingLoanRegularPaymentAtMonthYen(
            property,
            settings,
            repaymentMonthIndex,
            memberAgeAtReference,
            referenceYear,
            referenceMonth,
            options,
          );
        }
      }
    }

    const annualBonusPaymentYen =
      bonusPaymentYen != null ? bonusPaymentYen * 2 : null;

    return {
      period,
      periodRangeLabel: formatInterestRatePeriodRangeLabel(period, schedule),
      rateLabel: `${LOAN_INTEREST_RATE_TYPE_LABELS[period.rateType]}${period.interestRatePct}%`,
      monthlyPaymentYen,
      bonusPaymentYen,
      annualPaymentYen: calcAnnualPaymentYen(
        monthlyPaymentYen,
        annualBonusPaymentYen,
      ),
      monthlyPaymentNote,
      monthlyTrack: splitDisplay?.monthlyTrack ?? null,
      bonusTrack: splitDisplay?.bonusTrack ?? null,
    };
  });
}

export function formatHousingLoanRepaymentAmountYen(yen: number): string {
  if (yen <= 0) return '---';
  return `${Math.round(yen).toLocaleString('ja-JP')}円`;
}
