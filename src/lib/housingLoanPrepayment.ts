import type {
  HousingLoanPrepaymentType,
  OwnedPropertyLoanSettings,
} from '../types/housing';

const MAN_TO_YEN = 10_000;

/** ボーナス返済を行う暦月（夏・冬の一般的なボーナス月） */
export const BONUS_REPAYMENT_CALENDAR_MONTHS = [6, 12] as const;

export interface LoanRepaymentCalendarMonth {
  year: number;
  month: number;
}

export interface LoanRepaymentMonthEvent {
  amountYen: number;
  type: HousingLoanPrepaymentType;
  /**
   * true のとき amountYen は「元金＋利息」の合計額。
   * ループ処理時に残高に対する月次利息を差し引き、元金分のみを残高に適用する。
   * false（省略）のときは amountYen をそのまま元金として残高から差し引く。
   */
  isGrossPayment?: boolean;
}

export type LoanRepaymentMonthEventResolver = (
  repaymentMonthIndex: number,
) => LoanRepaymentMonthEvent[];

export interface LoanRepaymentEventOptions {
  repaymentStart?: LoanRepaymentCalendarMonth;
  totalMonths?: number;
}

function calendarMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function addCalendarMonths(
  base: LoanRepaymentCalendarMonth,
  monthsToAdd: number,
): LoanRepaymentCalendarMonth {
  if (monthsToAdd === 0) return { ...base };
  const total = calendarMonthIndex(base.year, base.month) + monthsToAdd;
  const year = Math.floor((total - 1) / 12);
  const month = ((total - 1) % 12) + 1;
  return { year, month };
}

/** 返済開始からの経過年数（0=当初）を返済月インデックス（1始まり）に変換 */
export function prepaymentOffsetToRepaymentMonthIndex(
  offsetYears: number,
): number {
  return Math.max(0, offsetYears) * 12 + 1;
}

function calendarAtRepaymentMonthIndex(
  repaymentStart: LoanRepaymentCalendarMonth,
  repaymentMonthIndex: number,
): LoanRepaymentCalendarMonth {
  return addCalendarMonths(repaymentStart, repaymentMonthIndex - 1);
}

export function isBonusRepaymentMonth(
  repaymentStart: LoanRepaymentCalendarMonth,
  repaymentMonthIndex: number,
): boolean {
  const calendar = calendarAtRepaymentMonthIndex(
    repaymentStart,
    repaymentMonthIndex,
  );
  return (BONUS_REPAYMENT_CALENDAR_MONTHS as readonly number[]).includes(
    calendar.month,
  );
}

function appendEvent(
  map: Map<number, LoanRepaymentMonthEvent[]>,
  month: number,
  event: LoanRepaymentMonthEvent,
): void {
  if (month <= 0 || event.amountYen <= 0) return;
  const existing = map.get(month) ?? [];
  existing.push(event);
  map.set(month, existing);
}

function appendBonusRepaymentEvents(
  map: Map<number, LoanRepaymentMonthEvent[]>,
  settings: OwnedPropertyLoanSettings,
  options: LoanRepaymentEventOptions,
): void {
  if (
    !settings.bonusRepaymentEnabled ||
    settings.bonusRepaymentAmountMan <= 0 ||
    options.repaymentStart == null ||
    options.totalMonths == null ||
    options.totalMonths <= 0
  ) {
    return;
  }

  const amountYen = settings.bonusRepaymentAmountMan * MAN_TO_YEN;
  for (let month = 1; month <= options.totalMonths; month += 1) {
    if (!isBonusRepaymentMonth(options.repaymentStart, month)) continue;
    appendEvent(map, month, {
      amountYen,
      type: settings.bonusRepaymentType,
      isGrossPayment: true,
    });
  }
}

/** ローン設定から月次の繰上げ・ボーナス・一括返済イベントを解決する */
export function buildLoanRepaymentEventMap(
  settings: OwnedPropertyLoanSettings,
  options: LoanRepaymentEventOptions = {},
): Map<number, LoanRepaymentMonthEvent[]> {
  const map = new Map<number, LoanRepaymentMonthEvent[]>();

  if (settings.prepaymentEnabled) {
    for (const entry of settings.prepayments) {
      if (entry.amountMan <= 0) continue;
      appendEvent(map, prepaymentOffsetToRepaymentMonthIndex(entry.offsetYears), {
        amountYen: entry.amountMan * MAN_TO_YEN,
        type: entry.type,
      });
    }
  }

  appendBonusRepaymentEvents(map, settings, options);

  if (settings.lumpSumRepaymentEnabled) {
    appendEvent(
      map,
      prepaymentOffsetToRepaymentMonthIndex(settings.lumpSumRepaymentOffsetYears),
      {
        amountYen: Number.MAX_SAFE_INTEGER,
        type: 'period_shortening',
      },
    );
  }

  return map;
}

export function buildLoanRepaymentEventResolver(
  settings: OwnedPropertyLoanSettings,
  options: LoanRepaymentEventOptions = {},
): LoanRepaymentMonthEventResolver {
  const map = buildLoanRepaymentEventMap(settings, options);
  return (repaymentMonthIndex: number) => map.get(repaymentMonthIndex) ?? [];
}
