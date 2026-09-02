import type {
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from "../types/housing";
import { resolveGroupCreditLifeSurchargeRatePct } from "./groupCreditLife";
import {
  calcLoanRepaymentBalanceAfterMonthYen,
  calcLoanRepaymentMonthYen,
  calcMonthlyPaymentYen,
  calcRepaymentMonthIndex,
  getLoanRepaymentStartCalendar,
} from "./housingLoanAmortization";
import { buildLoanRepaymentEventResolver } from "./housingLoanPrepayment.ts";
import {
  getBaseInterestRateAtRepaymentMonth,
  resolveLoanOwnershipStartCalendar,
  resolveLoanRepaymentSchedule,
  resolveLoanTotalMonths,
  type LoanRepaymentSchedule,
} from "./loanInterestRatePeriod";

const MAN_TO_YEN = 10_000;

export interface HousingLoanAmountOptions {
  /** ペアローン時の借入分担割合（%）。物件価格・組込諸費用を按分し、銀行手数料は契約ごと */
  pairSharePct?: number;
  /** 連帯債務の控除按分（%）。借入額は按分せず、年末残高の控除計算のみに使用 */
  deductionBalanceSharePct?: number;
  /** 自動車ローン等、物件以外の保有開始から借入開始を求める場合 */
  vehicle?: { startAge: number; startMonth: number };
  /** 所有開始カレンダーを誕生月込みで換算するときの誕生月 */
  birthMonth?: number | null;
  /** 試算基準月（1–12）。未指定時は 1 */
  referenceMonth?: number;
  /**
   * 明示借入額（万円）。複数の非ペア契約など、物件価格から按分しないときに使う。
   * 指定時は単一元本として償却する（諸費用トランシェ分割なし）。
   */
  principalOverrideMan?: number;
}

function toRepaymentScheduleOptions(
  property: OwnedProperty | undefined,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  options?: HousingLoanAmountOptions,
) {
  return {
    property,
    vehicle: options?.vehicle,
    memberAgeAtReference,
    referenceYear,
    referenceMonth: options?.referenceMonth ?? 1,
    birthMonth: options?.birthMonth,
  };
}

/**
 * 諸費用トランシェ分割時、ボーナス・繰上げは借入全体のイベント額を
 * 元本比率で按分する（返済額表示側と同じ）。未按分だと各トランシェに
 * 全額が乗り、ボーナス月のCFが数倍になる。
 */
function buildLoanEventResolver(
  settings: OwnedPropertyLoanSettings,
  schedule: LoanRepaymentSchedule,
  eventScale = 1,
) {
  const resolve = buildLoanRepaymentEventResolver(settings, {
    repaymentStart: schedule.repaymentStart,
    totalMonths: schedule.totalMonths,
  });
  if (eventScale === 1) return resolve;
  return (repaymentMonthIndex: number) =>
    resolve(repaymentMonthIndex).map((event) => ({
      ...event,
      // 一括完済（残債全額）はトランシェごとに残高上限で効くため按分不要
      amountYen:
        event.amountYen >= Number.MAX_SAFE_INTEGER
          ? event.amountYen
          : event.amountYen * eventScale,
    }));
}

/** 借入額を万円単位（整数）に丸める */
export function roundLoanAmountMan(value: number): number {
  return Math.round(value);
}

function applyPairShare(amountMan: number, pairSharePct?: number): number {
  if (pairSharePct == null || pairSharePct >= 100) return amountMan;
  if (pairSharePct <= 0) return 0;
  return roundLoanAmountMan((amountMan * pairSharePct) / 100);
}

function applyDeductionBalanceShare(
  balanceYen: number,
  deductionBalanceSharePct?: number,
): number {
  if (deductionBalanceSharePct == null || deductionBalanceSharePct >= 100) {
    return balanceYen;
  }
  if (deductionBalanceSharePct <= 0) return 0;
  return Math.floor((balanceYen * deductionBalanceSharePct) / 100);
}

export interface HousingLoanTranche {
  principalMan: number;
  annualRatePct: number;
}

export interface HousingLoanFeeBreakdown {
  propertyPriceMan: number;
  brokerageFeeMan: number;
  registrationFeeMan: number;
  includedBrokerageMan: number;
  includedRegistrationMan: number;
  includedFeesTotalMan: number;
  bankFeesInLoanMan: number;
  totalLoanAmountMan: number;
}

/** 物件価格（建物 + 土地） */
export function calcOwnedPropertyPriceMan(property: OwnedProperty): number {
  return property.buildingMan + property.landMan;
}

export function calcHousingLoanBankFeesTotalMan(
  settings: OwnedPropertyLoanSettings,
): number {
  return (
    settings.financingFeeMan +
    settings.guaranteeFeeMan +
    settings.administrativeFeeMan
  );
}

/**
 * ローンに組み込む諸手数料（万円）
 * 銀行・保証会社の手数料の扱いは settings.bankFeePaymentTiming で個別に決まるため、
 * 仲介・登記手数料の組み込み設定と合わせた3設定のモード判定（resolveHousingLoanFeesInLoanMode）
 * には依存しない。中間的な設定（例: 銀行手数料はローン組込・仲介手数料は現金）でも
 * 銀行手数料の扱いを正しく反映する。
 */
export function calcHousingLoanBankFeesInLoanMan(
  settings: OwnedPropertyLoanSettings,
): number {
  return settings.bankFeePaymentTiming === "loan"
    ? calcHousingLoanBankFeesTotalMan(settings)
    : 0;
}

/** 初回支払いの諸手数料（万円） */
export function calcHousingLoanBankFeesInitialMan(
  settings: OwnedPropertyLoanSettings,
): number {
  return settings.bankFeePaymentTiming === "initial"
    ? calcHousingLoanBankFeesTotalMan(settings)
    : 0;
}

export function calcHousingLoanFeeBreakdown(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  options?: HousingLoanAmountOptions,
): HousingLoanFeeBreakdown {
  const propertyPriceMan = calcOwnedPropertyPriceMan(property);
  const brokerageFeeMan = property.brokerageFeeMan;
  const registrationFeeMan = property.registrationFeeMan;
  const fullIncludedBrokerageMan = settings.includeBrokerageFeeInLoan
    ? brokerageFeeMan
    : 0;
  const fullIncludedRegistrationMan = settings.includeRegistrationFeeInLoan
    ? registrationFeeMan
    : 0;
  const bankFeesInLoanMan = calcHousingLoanBankFeesInLoanMan(settings);
  const pairSharePct = options?.pairSharePct;

  const includedBrokerageMan = applyPairShare(
    fullIncludedBrokerageMan,
    pairSharePct,
  );
  const includedRegistrationMan = applyPairShare(
    fullIncludedRegistrationMan,
    pairSharePct,
  );
  const sharedPropertyPriceMan = applyPairShare(propertyPriceMan, pairSharePct);
  const includedFeesTotalMan = includedBrokerageMan + includedRegistrationMan;
  const totalLoanAmountMan = roundLoanAmountMan(
    sharedPropertyPriceMan +
      includedBrokerageMan +
      includedRegistrationMan +
      bankFeesInLoanMan,
  );

  return {
    propertyPriceMan: sharedPropertyPriceMan,
    brokerageFeeMan,
    registrationFeeMan,
    includedBrokerageMan,
    includedRegistrationMan,
    includedFeesTotalMan,
    bankFeesInLoanMan,
    totalLoanAmountMan,
  };
}

export function calcHousingLoanTotalAmountMan(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  options?: HousingLoanAmountOptions,
): number {
  return calcHousingLoanFeeBreakdown(property, settings, options)
    .totalLoanAmountMan;
}

/** 世帯全体の総借入額（ペアローン按分前） */
export function calcHousingLoanHouseholdTotalAmountMan(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
): number {
  return calcHousingLoanFeeBreakdown(property, settings).totalLoanAmountMan;
}

/** 諸手数料（ローン組込分）を除いた借入額。参考値算定の基準額 */
export function calcHousingLoanBaseBorrowingMan(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  options?: HousingLoanAmountOptions,
): number {
  if (property) {
    const breakdown = calcHousingLoanFeeBreakdown(property, settings, options);
    return breakdown.totalLoanAmountMan - breakdown.bankFeesInLoanMan;
  }
  return settings.amountMan;
}

export function formatHousingLoanAmountBreakdownDetail(
  breakdown: HousingLoanFeeBreakdown,
): string {
  let detail = `（物件 ${breakdown.propertyPriceMan}万円`;
  if (breakdown.includedBrokerageMan > 0) {
    detail += ` ＋ 仲介 ${breakdown.includedBrokerageMan}万円`;
  }
  if (breakdown.includedRegistrationMan > 0) {
    detail += ` ＋ 登記 ${breakdown.includedRegistrationMan}万円`;
  }
  if (breakdown.bankFeesInLoanMan > 0) {
    detail += ` ＋ 手数料 ${breakdown.bankFeesInLoanMan}万円`;
  }
  detail += "）";
  return detail;
}

export function buildHousingLoanTranches(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  memberAgeAtReference?: number,
  referenceYear?: number,
  options?: HousingLoanAmountOptions,
): HousingLoanTranche[] {
  const breakdown = calcHousingLoanFeeBreakdown(property, settings, options);
  const schedule =
    referenceYear != null
      ? resolveLoanRepaymentSchedule(
          settings,
          toRepaymentScheduleOptions(
            property,
            memberAgeAtReference,
            referenceYear,
            options,
          ),
        )
      : null;
  const baseRate =
    schedule != null
      ? getBaseInterestRateAtRepaymentMonth(settings, schedule, 1)
      : (settings.interestRatePeriods[0]?.interestRatePct ?? 0);
  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const tranches: HousingLoanTranche[] = [];

  if (breakdown.propertyPriceMan > 0) {
    tranches.push({
      principalMan: breakdown.propertyPriceMan,
      annualRatePct: baseRate + danshinSurchargeRatePct,
    });
  }
  if (breakdown.includedBrokerageMan > 0) {
    tranches.push({
      principalMan: breakdown.includedBrokerageMan,
      annualRatePct:
        baseRate +
        settings.brokerageFeeSurchargeRatePct +
        danshinSurchargeRatePct,
    });
  }
  if (breakdown.includedRegistrationMan > 0) {
    tranches.push({
      principalMan: breakdown.includedRegistrationMan,
      annualRatePct:
        baseRate +
        settings.registrationFeeSurchargeRatePct +
        danshinSurchargeRatePct,
    });
  }
  if (breakdown.bankFeesInLoanMan > 0) {
    tranches.push({
      principalMan: breakdown.bankFeesInLoanMan,
      annualRatePct: baseRate + danshinSurchargeRatePct,
    });
  }

  return tranches;
}

function calcTranchePrincipalInterestAtMonthYen(
  principalMan: number,
  surchargeRatePct: number,
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  memberAgeAtReference: number,
  referenceYear: number,
  eventScale: number,
  options?: HousingLoanAmountOptions,
): { principalYen: number; interestYen: number } {
  const schedule = resolveLoanRepaymentSchedule(
    settings,
    toRepaymentScheduleOptions(
      property,
      memberAgeAtReference,
      referenceYear,
      options,
    ),
  );
  const totalMonths = schedule.totalMonths;
  if (totalMonths <= 0 || repaymentMonthIndex <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  const principalYen = principalMan * MAN_TO_YEN;
  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    surchargeRatePct +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanEventResolver(settings, schedule, eventScale);

  return calcLoanRepaymentMonthYen(
    principalYen,
    totalMonths,
    repaymentMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );
}

function calcTrancheBalanceAfterMonthYen(
  principalMan: number,
  surchargeRatePct: number,
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  afterMonthIndex: number,
  memberAgeAtReference: number,
  referenceYear: number,
  eventScale: number,
  options?: HousingLoanAmountOptions,
): number {
  const schedule = resolveLoanRepaymentSchedule(
    settings,
    toRepaymentScheduleOptions(
      property,
      memberAgeAtReference,
      referenceYear,
      options,
    ),
  );
  const totalMonths = schedule.totalMonths;
  const principalYen = principalMan * MAN_TO_YEN;
  if (totalMonths <= 0 || principalYen <= 0) return 0;
  if (afterMonthIndex <= 0) return principalYen;
  if (afterMonthIndex >= totalMonths) return 0;

  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const getRateForMonth = (month: number) =>
    getBaseInterestRateAtRepaymentMonth(settings, schedule, month) +
    surchargeRatePct +
    danshinSurchargeRatePct;
  const getMonthEvents = buildLoanEventResolver(settings, schedule, eventScale);

  return calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    totalMonths,
    afterMonthIndex,
    settings.repaymentMethod,
    getRateForMonth,
    getMonthEvents,
  );
}

export function calcHousingLoanPrincipalInterestAtMonthYen(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  repaymentMonthIndex: number,
  memberAgeAtReference: number,
  referenceYear: number,
  options?: HousingLoanAmountOptions,
): { principalYen: number; interestYen: number } {
  const totalMonths = resolveLoanTotalMonths(settings);
  if (totalMonths <= 0 || repaymentMonthIndex <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  if (options?.principalOverrideMan != null) {
    const principalMan = options.principalOverrideMan;
    if (principalMan <= 0) return { principalYen: 0, interestYen: 0 };
    return calcTranchePrincipalInterestAtMonthYen(
      principalMan,
      0,
      property,
      settings,
      repaymentMonthIndex,
      memberAgeAtReference,
      referenceYear,
      1,
      options,
    );
  }

  const breakdown = calcHousingLoanFeeBreakdown(property, settings, options);

  const parts: Array<{ principalMan: number; surchargeRatePct: number }> = [];
  if (breakdown.propertyPriceMan > 0) {
    parts.push({
      principalMan: breakdown.propertyPriceMan,
      surchargeRatePct: 0,
    });
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

  if (parts.length === 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  const totalPrincipalMan = parts.reduce(
    (sum, part) => sum + part.principalMan,
    0,
  );
  if (totalPrincipalMan <= 0) {
    return { principalYen: 0, interestYen: 0 };
  }

  return parts.reduce(
    (sum, part) => {
      const { principalYen, interestYen } =
        calcTranchePrincipalInterestAtMonthYen(
          part.principalMan,
          part.surchargeRatePct,
          property,
          settings,
          repaymentMonthIndex,
          memberAgeAtReference,
          referenceYear,
          part.principalMan / totalPrincipalMan,
          options,
        );
      return {
        principalYen: sum.principalYen + principalYen,
        interestYen: sum.interestYen + interestYen,
      };
    },
    { principalYen: 0, interestYen: 0 },
  );
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
    parts.push({
      principalMan: breakdown.propertyPriceMan,
      surchargeRatePct: 0,
    });
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

export function calcHousingLoanBalanceAfterRepaymentMonthsYen(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  afterMonthIndex: number,
  memberAgeAtReference: number,
  referenceYear: number,
  options?: HousingLoanAmountOptions,
): number {
  const schedule = resolveLoanRepaymentSchedule(
    settings,
    toRepaymentScheduleOptions(
      property,
      memberAgeAtReference,
      referenceYear,
      options,
    ),
  );
  if (schedule.totalMonths <= 0) return 0;

  if (options?.principalOverrideMan != null) {
    const principalMan = options.principalOverrideMan;
    if (principalMan <= 0) return 0;
    if (afterMonthIndex <= 0) return principalMan * MAN_TO_YEN;
    if (afterMonthIndex >= schedule.totalMonths) return 0;
    return calcTrancheBalanceAfterMonthYen(
      principalMan,
      0,
      property,
      settings,
      afterMonthIndex,
      memberAgeAtReference,
      referenceYear,
      1,
      options,
    );
  }

  const breakdownOptions =
    options?.pairSharePct != null
      ? { pairSharePct: options.pairSharePct }
      : undefined;
  if (afterMonthIndex <= 0) {
    return (
      calcHousingLoanTotalAmountMan(property, settings, breakdownOptions) *
      MAN_TO_YEN
    );
  }
  if (afterMonthIndex >= schedule.totalMonths) return 0;

  const parts = buildHousingLoanTrancheParts(
    property,
    settings,
    breakdownOptions,
  );
  const totalPrincipalMan = parts.reduce(
    (sum, part) => sum + part.principalMan,
    0,
  );
  if (totalPrincipalMan <= 0) return 0;

  return parts.reduce(
    (sum, part) =>
      sum +
      calcTrancheBalanceAfterMonthYen(
        part.principalMan,
        part.surchargeRatePct,
        property,
        settings,
        afterMonthIndex,
        memberAgeAtReference,
        referenceYear,
        part.principalMan / totalPrincipalMan,
        options,
      ),
    0,
  );
}

/** 返済開始から offsetYears 年後（実行時期）時点の残債（万円） */
export function calcHousingLoanBalanceAtRepaymentOffsetMan(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  offsetYears: number,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  referenceMonth = 1,
  options?: HousingLoanAmountOptions,
): number {
  const scheduleOptions: HousingLoanAmountOptions = {
    ...options,
    referenceMonth: options?.referenceMonth ?? referenceMonth,
  };
  const schedule = resolveLoanRepaymentSchedule(
    settings,
    toRepaymentScheduleOptions(
      property,
      memberAgeAtReference,
      referenceYear,
      scheduleOptions,
    ),
  );
  if (schedule.totalMonths <= 0) return 0;

  const maxOffset = Math.max(0, settings.years - 1);
  const clampedOffset = Math.min(Math.max(0, offsetYears), maxOffset);
  const afterMonthIndex = clampedOffset * 12;
  if (afterMonthIndex >= schedule.totalMonths) return 0;

  if (property && memberAgeAtReference != null) {
    return roundLoanAmountMan(
      calcHousingLoanBalanceAfterRepaymentMonthsYen(
        property,
        settings,
        afterMonthIndex,
        memberAgeAtReference,
        referenceYear,
        scheduleOptions,
      ) / MAN_TO_YEN,
    );
  }

  const principalYen = settings.amountMan * MAN_TO_YEN;
  if (principalYen <= 0) return 0;
  if (afterMonthIndex <= 0) return roundLoanAmountMan(settings.amountMan);

  const annualRatePct =
    getBaseInterestRateAtRepaymentMonth(settings, schedule, 1) +
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const getMonthEvents = buildLoanEventResolver(settings, schedule);
  const balance = calcLoanRepaymentBalanceAfterMonthYen(
    principalYen,
    schedule.totalMonths,
    afterMonthIndex,
    settings.repaymentMethod,
    () => annualRatePct,
    getMonthEvents,
  );

  return roundLoanAmountMan(balance / MAN_TO_YEN);
}

export function calcHousingLoanYearEndBalanceYen(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  memberAgeAtReference: number,
  referenceYear: number,
  calendarYear: number,
  options?: HousingLoanAmountOptions,
): number {
  const breakdownOptions =
    options?.pairSharePct != null
      ? { pairSharePct: options.pairSharePct }
      : undefined;
  const deductionSharePct = options?.deductionBalanceSharePct;

  const schedule = resolveLoanRepaymentSchedule(
    settings,
    toRepaymentScheduleOptions(
      property,
      memberAgeAtReference,
      referenceYear,
      options,
    ),
  );
  if (schedule.totalMonths <= 0) return 0;

  const ownershipStart = resolveLoanOwnershipStartCalendar(
    settings,
    property,
    memberAgeAtReference,
    referenceYear,
    options?.referenceMonth ?? 1,
    options?.vehicle,
    options?.birthMonth,
  );
  const repaymentStart = getLoanRepaymentStartCalendar(ownershipStart);
  const elapsed = calcRepaymentMonthIndex(repaymentStart, calendarYear, 12);
  if (elapsed === null) {
    const totalYen =
      calcHousingLoanTotalAmountMan(property, settings, breakdownOptions) *
      MAN_TO_YEN;
    return applyDeductionBalanceShare(totalYen, deductionSharePct);
  }
  if (elapsed >= schedule.totalMonths) return 0;

  return applyDeductionBalanceShare(
    calcHousingLoanBalanceAfterRepaymentMonthsYen(
      property,
      settings,
      elapsed,
      memberAgeAtReference,
      referenceYear,
      options,
    ),
    deductionSharePct,
  );
}

/**
 * 住宅ローン控除の対象となる年末残高へ按分する。
 * 諸費用（仲介・登記・銀行手数料）のローン組込分は控除対象外のため、
 * 年末残高 ×（物件価格 / 総借入額）とする。
 */
export function applyHousingLoanDeductionEligibleRatioYen(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  yearEndBalanceYen: number,
  options?: HousingLoanAmountOptions,
): number {
  if (yearEndBalanceYen <= 0) return 0;
  const breakdownOptions =
    options?.pairSharePct != null
      ? { pairSharePct: options.pairSharePct }
      : undefined;
  const breakdown = calcHousingLoanFeeBreakdown(
    property,
    settings,
    breakdownOptions,
  );
  if (breakdown.totalLoanAmountMan <= 0 || breakdown.propertyPriceMan <= 0) {
    return 0;
  }
  const feesInLoanMan =
    breakdown.includedFeesTotalMan + breakdown.bankFeesInLoanMan;
  if (feesInLoanMan <= 0) {
    return yearEndBalanceYen;
  }
  return Math.floor(
    (yearEndBalanceYen * breakdown.propertyPriceMan) /
      breakdown.totalLoanAmountMan,
  );
}

/**
 * 住宅ローン控除に用いる年末残高（円）。諸費用のローン組込分を除外する。
 */
export function calcHousingLoanDeductionEligibleYearEndBalanceYen(
  property: OwnedProperty,
  settings: OwnedPropertyLoanSettings,
  memberAgeAtReference: number,
  referenceYear: number,
  calendarYear: number,
  options?: HousingLoanAmountOptions,
): number {
  return applyHousingLoanDeductionEligibleRatioYen(
    property,
    settings,
    calcHousingLoanYearEndBalanceYen(
      property,
      settings,
      memberAgeAtReference,
      referenceYear,
      calendarYear,
      options,
    ),
    options,
  );
}

/**
 * 毎月返済額の初回値（円）。ボーナス返済分は含まない。
 * - 元利均等の場合、金利固定期間は同額。
 * - 元金均等の場合、初回（最大）値。
 * 物件・年齢が未設定の場合は設定額と初期金利で近似計算。
 */
export function calcHousingLoanInitialMonthlyPaymentYen(
  property: OwnedProperty | undefined,
  settings: OwnedPropertyLoanSettings,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  _referenceMonth: number,
  options?: HousingLoanAmountOptions,
): number {
  if (property != null && memberAgeAtReference != null) {
    const { principalYen, interestYen } =
      calcHousingLoanPrincipalInterestAtMonthYen(
        property,
        settings,
        1,
        memberAgeAtReference,
        referenceYear,
        options,
      );
    return principalYen + interestYen;
  }
  const principalYen = settings.amountMan * MAN_TO_YEN;
  const totalMonths = resolveLoanTotalMonths(settings);
  if (totalMonths <= 0 || principalYen <= 0) return 0;
  const danshinSurchargeRatePct =
    resolveGroupCreditLifeSurchargeRatePct(settings);
  const baseRatePct =
    (settings.interestRatePeriods[0]?.interestRatePct ?? 0) +
    danshinSurchargeRatePct;
  if (settings.repaymentMethod === "equal_payment") {
    return calcMonthlyPaymentYen(principalYen, baseRatePct, totalMonths);
  }
  const monthlyPrincipal = principalYen / totalMonths;
  const firstMonthInterest = principalYen * (baseRatePct / 100 / 12);
  return monthlyPrincipal + firstMonthInterest;
}
