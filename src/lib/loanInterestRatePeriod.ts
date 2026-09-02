import type {
  HousingLoanPrepaymentEntry,
  LoanInterestRatePeriod,
  LoanInterestRateType,
  OwnedProperty,
  OwnedPropertyLoanSettings,
} from '../types/housing';
import {
  type CalendarYearMonth,
  addCalendarMonths,
  calendarMonthIndex,
  getLoanRepaymentStartCalendar,
  getOwnershipStartCalendar,
} from './housingLoanAmortization';
import {
  getDefaultGroupCreditLifeSurchargeRatePct,
  normalizeGroupCreditLifePlan,
} from './groupCreditLife';
import { LOAN_INTEREST_RATE_TYPE_LABELS } from './loanLabels';
import { roundLoanAmountMan } from './housingLoanAmount';

export interface LoanRepaymentSchedule {
  repaymentStart: CalendarYearMonth;
  repaymentEnd: CalendarYearMonth;
  totalMonths: number;
}

type LegacyLoanSettings = Partial<OwnedPropertyLoanSettings> & {
  interestRateType?: LoanInterestRateType;
  interestRatePct?: number;
  /** @deprecated prepaymentOffsetYears に移行（1始まりの年目） */
  prepaymentRepaymentYear?: number;
  /** @deprecated prepayments に移行 */
  prepaymentType?: OwnedPropertyLoanSettings['prepayments'][number]['type'];
  prepaymentOffsetYears?: number;
  prepaymentAmountMan?: number;
};

function normalizePrepaymentEntry(
  entry: Partial<HousingLoanPrepaymentEntry>,
  loanYears: number,
): HousingLoanPrepaymentEntry {
  const maxOffset = Math.max(0, loanYears - 1);
  return {
    id: entry.id ?? createId(),
    type: entry.type ?? 'period_shortening',
    offsetYears: Math.min(Math.max(0, entry.offsetYears ?? 0), maxOffset),
    amountMan: entry.amountMan ?? 0,
  };
}

function migratePrepayments(
  rest: LegacyLoanSettings,
  loanYears: number,
): HousingLoanPrepaymentEntry[] {
  if (rest.prepayments && rest.prepayments.length > 0) {
    return rest.prepayments.map((entry) =>
      normalizePrepaymentEntry(entry, loanYears),
    );
  }

  if (rest.prepaymentEnabled) {
    return [
      normalizePrepaymentEntry(
        {
          type: rest.prepaymentType,
          offsetYears: resolvePrepaymentOffsetYears(rest, loanYears),
          amountMan: rest.prepaymentAmountMan,
        },
        loanYears,
      ),
    ];
  }

  return [];
}

function resolvePrepaymentOffsetYears(
  rest: LegacyLoanSettings,
  loanYears: number,
): number {
  const maxOffset = Math.max(0, loanYears - 1);
  if (rest.prepaymentOffsetYears != null) {
    return Math.min(Math.max(0, rest.prepaymentOffsetYears), maxOffset);
  }
  if (rest.prepaymentRepaymentYear != null) {
    return Math.min(Math.max(0, rest.prepaymentRepaymentYear - 1), maxOffset);
  }
  return 0;
}

function createId(): string {
  return crypto.randomUUID();
}

export function createLoanInterestRatePeriod(
  overrides: Partial<LoanInterestRatePeriod> = {},
): LoanInterestRatePeriod {
  return {
    id: createId(),
    rateType: 'fixed',
    interestRatePct: 0.5,
    startYear: 0,
    startMonth: 0,
    endYear: 0,
    endMonth: 0,
    ...overrides,
  };
}

export function createHousingLoanPrepaymentEntry(
  loanYears = 35,
  overrides: Partial<HousingLoanPrepaymentEntry> = {},
): HousingLoanPrepaymentEntry {
  return normalizePrepaymentEntry(overrides, loanYears);
}

export function normalizeOwnedPropertyLoanSettings(
  settings: LegacyLoanSettings,
): OwnedPropertyLoanSettings {
  const {
    interestRateType: legacyRateType,
    interestRatePct: legacyRatePct,
    interestRatePeriods: rawPeriods,
    ...rest
  } = settings;

  const interestRatePeriods =
    rawPeriods && rawPeriods.length > 0
      ? rawPeriods.map((period) => ({
          ...createLoanInterestRatePeriod(),
          ...period,
        }))
      : [
          createLoanInterestRatePeriod({
            rateType: legacyRateType ?? 'fixed',
            interestRatePct: legacyRatePct ?? 0.5,
          }),
        ];

  const years = rest.years ?? 35;
  const repaymentCount =
    rest.repaymentCount != null && rest.repaymentCount > 0
      ? clampLoanRepaymentCount(rest.repaymentCount)
      : undefined;

  return {
    amountMan: roundLoanAmountMan(rest.amountMan ?? 0),
    interestRatePeriods,
    years,
    ...(repaymentCount != null ? { repaymentCount } : {}),
    startYear: rest.startYear ?? 0,
    startMonth: rest.startMonth ?? 0,
    deductionCategory: rest.deductionCategory ?? 'general',
    isNewConstruction: rest.isNewConstruction ?? true,
    includeBrokerageFeeInLoan: rest.includeBrokerageFeeInLoan ?? true,
    includeRegistrationFeeInLoan: rest.includeRegistrationFeeInLoan ?? true,
    brokerageFeeSurchargeRatePct: rest.brokerageFeeSurchargeRatePct ?? 0,
    registrationFeeSurchargeRatePct: rest.registrationFeeSurchargeRatePct ?? 0,
    financingFeeMan: rest.financingFeeMan ?? 0,
    guaranteeFeeMan: rest.guaranteeFeeMan ?? 0,
    administrativeFeeMan: rest.administrativeFeeMan ?? 0,
    bankFeePaymentTiming: rest.bankFeePaymentTiming ?? 'loan',
    groupCreditLifePlan: normalizeGroupCreditLifePlan(
      rest.groupCreditLifePlan,
      undefined,
    ),
    groupCreditLifeSurchargeRatePct:
      rest.groupCreditLifeSurchargeRatePct ??
      getDefaultGroupCreditLifeSurchargeRatePct(
        normalizeGroupCreditLifePlan(rest.groupCreditLifePlan, undefined),
      ),
    repaymentMethod: rest.repaymentMethod ?? 'equal_payment',
    bonusRepaymentEnabled: rest.bonusRepaymentEnabled ?? false,
    bonusRepaymentAmountMan: rest.bonusRepaymentAmountMan ?? 0,
    bonusRepaymentType: rest.bonusRepaymentType ?? 'period_shortening',
    prepaymentEnabled:
      rest.prepaymentEnabled ?? migratePrepayments(rest, years).length > 0,
    prepayments: migratePrepayments(rest, years),
    lumpSumRepaymentEnabled: rest.lumpSumRepaymentEnabled ?? false,
    lumpSumRepaymentOffsetYears: Math.min(
      Math.max(0, rest.lumpSumRepaymentOffsetYears ?? 0),
      Math.max(0, years - 1),
    ),
  };
}

export function resolveLoanOwnershipStartCalendar(
  settings: OwnedPropertyLoanSettings,
  property: OwnedProperty | undefined,
  memberAgeAtReference: number | undefined,
  referenceYear: number,
  referenceMonth: number,
  vehicle?: { startAge: number; startMonth: number },
  birthMonth?: number | null,
): CalendarYearMonth {
  if (settings.startYear > 0 && settings.startMonth > 0) {
    return { year: settings.startYear, month: settings.startMonth };
  }

  if (property && memberAgeAtReference != null) {
    return getOwnershipStartCalendar(
      property,
      memberAgeAtReference,
      referenceYear,
      birthMonth,
      referenceMonth,
    );
  }

  if (vehicle && memberAgeAtReference != null) {
    return getOwnershipStartCalendar(
      { startAge: vehicle.startAge, startMonth: vehicle.startMonth },
      memberAgeAtReference,
      referenceYear,
      birthMonth,
      referenceMonth,
    );
  }

  return {
    year: settings.startYear > 0 ? settings.startYear : referenceYear,
    month: settings.startMonth > 0 ? settings.startMonth : referenceMonth,
  };
}

/** 非住宅ローンの返済回数（月次）。12回（1年）〜120回（10年）、12回刻み */
export const LOAN_REPAYMENT_COUNT_MIN = 12;
export const LOAN_REPAYMENT_COUNT_MAX = 120;
export const LOAN_REPAYMENT_COUNT_STEP = 12;
export const DEFAULT_NON_HOUSING_REPAYMENT_COUNT = 60;

export const LOAN_REPAYMENT_COUNT_OPTIONS: number[] = Array.from(
  {
    length:
      (LOAN_REPAYMENT_COUNT_MAX - LOAN_REPAYMENT_COUNT_MIN) /
        LOAN_REPAYMENT_COUNT_STEP +
      1,
  },
  (_, index) => LOAN_REPAYMENT_COUNT_MIN + index * LOAN_REPAYMENT_COUNT_STEP,
);

export function clampLoanRepaymentCount(count: number): number {
  const clamped = Math.min(
    LOAN_REPAYMENT_COUNT_MAX,
    Math.max(LOAN_REPAYMENT_COUNT_MIN, Math.round(count)),
  );
  const steps = Math.round(
    (clamped - LOAN_REPAYMENT_COUNT_MIN) / LOAN_REPAYMENT_COUNT_STEP,
  );
  return LOAN_REPAYMENT_COUNT_MIN + steps * LOAN_REPAYMENT_COUNT_STEP;
}

/** 返済回数から互換用の years を求める */
export function yearsFromRepaymentCount(repaymentCount: number): number {
  return clampLoanRepaymentCount(repaymentCount) / LOAN_REPAYMENT_COUNT_STEP;
}

/**
 * 総返済月数。repaymentCount があればそれを使い、なければ years × 12。
 */
export function resolveLoanTotalMonths(
  settings: OwnedPropertyLoanSettings,
): number {
  if (settings.repaymentCount != null && settings.repaymentCount > 0) {
    return clampLoanRepaymentCount(settings.repaymentCount);
  }
  return Math.max(0, Math.round(settings.years * 12));
}

/** UI 表示用の返済回数（未設定時は years から推定して 12〜120 に収める） */
export function resolveLoanRepaymentCount(
  settings: OwnedPropertyLoanSettings,
): number {
  if (settings.repaymentCount != null && settings.repaymentCount > 0) {
    return clampLoanRepaymentCount(settings.repaymentCount);
  }
  return clampLoanRepaymentCount(Math.max(1, settings.years) * 12);
}

export function formatLoanRepaymentCountLabel(count: number): string {
  const n = clampLoanRepaymentCount(count);
  return `${n}回（${n / LOAN_REPAYMENT_COUNT_STEP}年）`;
}

export function resolveLoanRepaymentSchedule(
  settings: OwnedPropertyLoanSettings,
  options: {
    property?: OwnedProperty;
    vehicle?: { startAge: number; startMonth: number };
    memberAgeAtReference?: number;
    referenceYear: number;
    referenceMonth?: number;
    birthMonth?: number | null;
  },
): LoanRepaymentSchedule {
  const referenceMonth = options.referenceMonth ?? 1;
  const ownershipStart = resolveLoanOwnershipStartCalendar(
    settings,
    options.property,
    options.memberAgeAtReference,
    options.referenceYear,
    referenceMonth,
    options.vehicle,
    options.birthMonth,
  );
  const repaymentStart = getLoanRepaymentStartCalendar(ownershipStart);
  const totalMonths = resolveLoanTotalMonths(settings);
  const repaymentEnd =
    totalMonths > 0
      ? addCalendarMonths(repaymentStart, totalMonths - 1)
      : repaymentStart;

  return { repaymentStart, repaymentEnd, totalMonths };
}

export function resolveInterestRatePeriodBounds(
  period: LoanInterestRatePeriod,
  schedule: LoanRepaymentSchedule,
): { start: CalendarYearMonth; end: CalendarYearMonth } {
  const start =
    period.startYear > 0 && period.startMonth > 0
      ? { year: period.startYear, month: period.startMonth }
      : schedule.repaymentStart;
  const end =
    period.endYear > 0 && period.endMonth > 0
      ? { year: period.endYear, month: period.endMonth }
      : schedule.repaymentEnd;

  return { start, end };
}

export function isCalendarInRange(
  target: CalendarYearMonth,
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): boolean {
  const targetIdx = calendarMonthIndex(target.year, target.month);
  const startIdx = calendarMonthIndex(start.year, start.month);
  const endIdx = calendarMonthIndex(end.year, end.month);
  return targetIdx >= startIdx && targetIdx <= endIdx;
}

export function calendarAtRepaymentMonthIndex(
  repaymentStart: CalendarYearMonth,
  repaymentMonthIndex: number,
): CalendarYearMonth {
  return addCalendarMonths(repaymentStart, repaymentMonthIndex - 1);
}

export function getApplicableInterestRatePeriod(
  periods: LoanInterestRatePeriod[],
  schedule: LoanRepaymentSchedule,
  repaymentMonthIndex: number,
): LoanInterestRatePeriod | undefined {
  if (periods.length === 0 || repaymentMonthIndex <= 0) return undefined;

  const calendar = calendarAtRepaymentMonthIndex(
    schedule.repaymentStart,
    repaymentMonthIndex,
  );

  const applicable = periods.find((period) => {
    const { start, end } = resolveInterestRatePeriodBounds(period, schedule);
    return isCalendarInRange(calendar, start, end);
  });

  return applicable ?? periods[periods.length - 1];
}

export function getBaseInterestRateAtRepaymentMonth(
  settings: OwnedPropertyLoanSettings,
  schedule: LoanRepaymentSchedule,
  repaymentMonthIndex: number,
): number {
  const period = getApplicableInterestRatePeriod(
    settings.interestRatePeriods,
    schedule,
    repaymentMonthIndex,
  );
  return period?.interestRatePct ?? 0;
}

export function formatInterestRatePeriodRangeLabel(
  period: LoanInterestRatePeriod,
  schedule: LoanRepaymentSchedule,
): string {
  const { start, end } = resolveInterestRatePeriodBounds(period, schedule);
  const startLabel =
    period.startYear <= 0 || period.startMonth <= 0
      ? '借入開始'
      : `${start.year}年${start.month}月`;
  const endLabel =
    period.endYear <= 0 || period.endMonth <= 0
      ? '完済'
      : `${end.year}年${end.month}月`;
  return `${startLabel}～${endLabel}`;
}

export function formatLoanInterestRateSummary(
  settings: OwnedPropertyLoanSettings,
  schedule?: LoanRepaymentSchedule,
): string {
  const periods = settings.interestRatePeriods;
  if (periods.length === 0) return '金利未入力';

  const primary = periods[0];
  const rateLabel = `${LOAN_INTEREST_RATE_TYPE_LABELS[primary.rateType]}${primary.interestRatePct}%`;
  if (!schedule) return rateLabel;
  if (periods.length === 1) {
    return `${rateLabel}（${formatInterestRatePeriodRangeLabel(primary, schedule)}）`;
  }
  return `${rateLabel}ほか${periods.length - 1}件`;
}

export function resolvePrepaymentExecutionCalendar(
  settings: OwnedPropertyLoanSettings,
  offsetYears: number,
  options: {
    property?: OwnedProperty;
    vehicle?: { startAge: number; startMonth: number };
    memberAgeAtReference?: number;
    referenceYear: number;
    referenceMonth?: number;
    birthMonth?: number | null;
  },
): CalendarYearMonth {
  const schedule = resolveLoanRepaymentSchedule(settings, options);
  const maxOffset = Math.max(0, settings.years - 1);
  const clampedOffset = Math.min(Math.max(0, offsetYears), maxOffset);
  const monthIndex = clampedOffset * 12 + 1;
  return calendarAtRepaymentMonthIndex(schedule.repaymentStart, monthIndex);
}

export function formatPrepaymentExecutionTimingLabel(
  age: number | null,
  calendarYear: number,
): string {
  const ageLabel = age != null ? `${age}歳` : '—';
  return `（${ageLabel} / ${calendarYear}年）`;
}
