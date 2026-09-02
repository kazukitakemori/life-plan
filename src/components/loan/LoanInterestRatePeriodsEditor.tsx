import { LOAN_INTEREST_RATE_TYPE_LABELS } from '../../lib/loanLabels';
import { createOwnedPropertyLoanSettings } from '../../lib/housingDefaults';
import {
  createLoanInterestRatePeriod,
  resolveInterestRatePeriodBounds,
  resolveLoanRepaymentSchedule,
} from '../../lib/loanInterestRatePeriod';
import {
  addCalendarMonths,
  calendarMonthIndex,
} from '../../lib/housingLoanAmortization';
import type { CalendarYearMonth } from '../../lib/housingLoanAmortization';
import type { LoanInterestRatePeriod, OwnedProperty } from '../../types/housing';
import type { VehicleEntry } from '../../types/vehicle';
import { HousingManInput } from '../housing/HousingManInput';
import { HousingRenewalDateFields } from '../housing/HousingRenewalDateFields';
import type { LoanRepaymentSchedule } from '../../lib/loanInterestRatePeriod';

interface LoanInterestRatePeriodsEditorProps {
  periods: LoanInterestRatePeriod[];
  fieldIdPrefix: string;
  referenceYear: number;
  referenceMonth: number;
  loanYears: number;
  loanStartYear: number;
  loanStartMonth: number;
  linkedHousingProperty?: OwnedProperty;
  linkedVehicle?: VehicleEntry;
  memberAgeAtReference?: number;
  memberBirthMonth?: number | null;
  /** false のとき金利期間の追加ボタンを出さない（非住宅ローン向け） */
  allowAddPeriod?: boolean;
  onChange: (periods: LoanInterestRatePeriod[]) => void;
}

function isLoanStartBoundary(period: LoanInterestRatePeriod): boolean {
  return period.startYear <= 0 || period.startMonth <= 0;
}

function isLoanEndBoundary(period: LoanInterestRatePeriod): boolean {
  return period.endYear <= 0 || period.endMonth <= 0;
}

function computeEndOffsetYears(
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): number {
  const months = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  return Math.max(1, Math.round(months / 12));
}

function computeMaxEndYears(
  start: CalendarYearMonth,
  schedule: LoanRepaymentSchedule,
  periodsAfter: number,
): number {
  const loanStartIdx = calendarMonthIndex(
    schedule.repaymentStart.year,
    schedule.repaymentStart.month,
  );
  const startIdx = calendarMonthIndex(start.year, start.month);
  const monthOffset = startIdx - loanStartIdx;
  const remainingMonths = schedule.totalMonths - monthOffset;
  const reservedMonths = Math.max(0, periodsAfter);
  const availableMonths = remainingMonths - reservedMonths;
  return Math.max(1, Math.floor(availableMonths / 12));
}

function normalizeInterestRatePeriodChain(
  periods: LoanInterestRatePeriod[],
  schedule: LoanRepaymentSchedule,
): LoanInterestRatePeriod[] {
  if (periods.length === 0) return periods;

  const normalized: LoanInterestRatePeriod[] = [];
  for (let index = 0; index < periods.length; index++) {
    const period = periods[index];
    if (index === 0) {
      normalized.push({ ...period });
      continue;
    }

    const prevBounds = resolveInterestRatePeriodBounds(
      normalized[index - 1],
      schedule,
    );
    const nextStart = addCalendarMonths(prevBounds.end, 1);
    normalized.push({
      ...period,
      startYear: nextStart.year,
      startMonth: nextStart.month,
    });
  }

  return normalized;
}

function LoanInterestRatePeriodRow({
  period,
  index,
  fieldIdPrefix,
  referenceYear,
  loanYears,
  schedule,
  isSinglePeriod,
  isLast,
  canRemove,
  allowAddPeriod,
  periodsAfter,
  onChange,
  onRemove,
  onAdd,
}: {
  period: LoanInterestRatePeriod;
  index: number;
  fieldIdPrefix: string;
  referenceYear: number;
  loanYears: number;
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>;
  isSinglePeriod: boolean;
  isLast: boolean;
  canRemove: boolean;
  allowAddPeriod: boolean;
  periodsAfter: number;
  onChange: (period: LoanInterestRatePeriod) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const bounds = resolveInterestRatePeriodBounds(period, schedule);
  const startIsLoanStart = isLoanStartBoundary(period);
  const endIsLoanEnd = isLoanEndBoundary(period);
  const maxEndYears = Math.min(
    loanYears,
    computeMaxEndYears(bounds.start, schedule, periodsAfter),
  );
  const showStartEditor = isSinglePeriod && index === 0;

  return (
    <div className="loan-rate-period">
      <div className="loan-rate-period-body">
        <div className="loan-rate-period-rate-group">
          <div className="loan-rate-type-options housing-owned-payment-options housing-owned-payment-options--compact">
            <label className="housing-owned-payment-option">
              <input
                type="radio"
                name={`${fieldIdPrefix}-rate-type-${period.id}`}
                checked={period.rateType === 'fixed'}
                onChange={() => onChange({ ...period, rateType: 'fixed' })}
              />
              <span>{LOAN_INTEREST_RATE_TYPE_LABELS.fixed}</span>
            </label>
            <label className="housing-owned-payment-option loan-rate-period-variable-option">
              <input
                type="radio"
                name={`${fieldIdPrefix}-rate-type-${period.id}`}
                checked={period.rateType === 'variable'}
                onChange={() => onChange({ ...period, rateType: 'variable' })}
              />
              <span>{LOAN_INTEREST_RATE_TYPE_LABELS.variable}</span>
            </label>
          </div>
          <div className="loan-rate-period-pct-input">
            <HousingManInput
              compact
              value={period.interestRatePct}
              onChange={(interestRatePct) => onChange({ ...period, interestRatePct })}
              unit="%"
              min={0}
              step={0.01}
            />
          </div>
        </div>

        <div className="loan-rate-period-range-group">
          {showStartEditor ? (
            <div className="loan-rate-period-boundary">
              <select
                className="select-input select-input--compact loan-rate-period-boundary-select"
                value={startIsLoanStart ? 'loan_start' : 'custom'}
                onChange={(event) => {
                  if (event.target.value === 'loan_start') {
                    onChange({ ...period, startYear: 0, startMonth: 0 });
                    return;
                  }
                  onChange({
                    ...period,
                    startYear: bounds.start.year,
                    startMonth: bounds.start.month,
                  });
                }}
              >
                <option value="loan_start">借入開始</option>
                <option value="custom">日付を指定</option>
              </select>
              {!startIsLoanStart ? (
                <HousingRenewalDateFields
                  year={period.startYear}
                  month={period.startMonth}
                  referenceYear={referenceYear}
                  minYear={schedule.repaymentStart.year}
                  onChange={(startYear, startMonth) =>
                    onChange({ ...period, startYear, startMonth })
                  }
                />
              ) : null}
            </div>
          ) : index === 0 ? (
            <span className="loan-rate-period-range-prefix">
              {startIsLoanStart
                ? '借入開始から'
                : `（${bounds.start.year}年${bounds.start.month}月から）`}
            </span>
          ) : (
            <span className="loan-rate-period-boundary-date-hint">
              （{bounds.start.year}年{bounds.start.month}月から）
            </span>
          )}
          {showStartEditor ? (
            <span className="loan-rate-period-range-separator">～</span>
          ) : null}
          <div className="loan-rate-period-boundary">
            <select
              className="select-input select-input--compact loan-rate-period-boundary-select"
              value={
                endIsLoanEnd
                  ? 'loan_end'
                  : String(computeEndOffsetYears(bounds.start, bounds.end))
              }
              onChange={(event) => {
                if (event.target.value === 'loan_end') {
                  onChange({ ...period, endYear: 0, endMonth: 0 });
                  return;
                }
                const years = parseInt(event.target.value, 10);
                const end = addCalendarMonths(bounds.start, years * 12 - 1);
                onChange({ ...period, endYear: end.year, endMonth: end.month });
              }}
            >
              {isLast ? <option value="loan_end">完済</option> : null}
              {Array.from({ length: maxEndYears }, (_, i) => i + 1).map((y) => (
                <option key={y} value={String(y)}>
                  {y}年間
                </option>
              ))}
            </select>
            {!endIsLoanEnd ? (
              <span className="loan-rate-period-boundary-date-hint">
                （{bounds.end.year}年{bounds.end.month}月まで）
              </span>
            ) : null}
          </div>
        </div>

        {isLast && (allowAddPeriod || canRemove) ? (
          <div className="loan-rate-period-actions">
            {allowAddPeriod ? (
              <button type="button" className="loan-rate-period-add" onClick={onAdd}>
                ＋ 金利期間を追加
              </button>
            ) : null}
            {canRemove ? (
              <button
                type="button"
                className="loan-rate-period-remove"
                onClick={onRemove}
                aria-label={`金利期間${index + 1}を削除`}
              >
                削除
              </button>
            ) : null}
          </div>
        ) : canRemove ? (
          <div className="loan-rate-period-actions">
            <button
              type="button"
              className="loan-rate-period-remove"
              onClick={onRemove}
              aria-label={`金利期間${index + 1}を削除`}
            >
              削除
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LoanInterestRatePeriodsEditor({
  periods,
  fieldIdPrefix,
  referenceYear,
  referenceMonth,
  loanYears,
  loanStartYear,
  loanStartMonth,
  linkedHousingProperty,
  linkedVehicle,
  memberAgeAtReference,
  memberBirthMonth,
  allowAddPeriod = true,
  onChange,
}: LoanInterestRatePeriodsEditorProps) {
  const schedule = resolveLoanRepaymentSchedule(
    createOwnedPropertyLoanSettings({
      interestRatePeriods: periods,
      years: loanYears,
      startYear: loanStartYear,
      startMonth: loanStartMonth,
    }),
    {
      property: linkedHousingProperty,
      vehicle: linkedVehicle,
      memberAgeAtReference,
      referenceYear,
      referenceMonth,
      birthMonth: memberBirthMonth,
    },
  );

  const updatePeriod = (index: number, period: LoanInterestRatePeriod) => {
    const updated = periods.map((entry, entryIndex) =>
      entryIndex === index ? period : entry,
    );
    onChange(normalizeInterestRatePeriodChain(updated, schedule));
  };

  const removePeriod = (index: number) => {
    let next = periods.filter((_, entryIndex) => entryIndex !== index);
    if (next.length > 0 && index === periods.length - 1) {
      next = next.map((entry, entryIndex) =>
        entryIndex === next.length - 1
          ? { ...entry, endYear: 0, endMonth: 0 }
          : entry,
      );
    }
    onChange(normalizeInterestRatePeriodChain(next, schedule));
  };

  const addPeriod = () => {
    const last = periods[periods.length - 1];
    const updatedPeriods = [...periods];

    if (last && isLoanEndBoundary(last)) {
      const lastBounds = resolveInterestRatePeriodBounds(last, schedule);
      const splitEnd = addCalendarMonths(
        lastBounds.start,
        Math.min(59, Math.max(0, schedule.totalMonths - 1)),
      );
      updatedPeriods[updatedPeriods.length - 1] = {
        ...last,
        endYear: splitEnd.year,
        endMonth: splitEnd.month,
      };
      const nextStart = addCalendarMonths(splitEnd, 1);
      onChange(
        normalizeInterestRatePeriodChain(
          [
            ...updatedPeriods,
            createLoanInterestRatePeriod({
              rateType: 'variable',
              startYear: nextStart.year,
              startMonth: nextStart.month,
              endYear: 0,
              endMonth: 0,
            }),
          ],
          schedule,
        ),
      );
      return;
    }

    const lastBounds = last
      ? resolveInterestRatePeriodBounds(last, schedule)
      : {
          start: schedule.repaymentStart,
          end: schedule.repaymentEnd,
        };
    const nextStart = addCalendarMonths(lastBounds.end, 1);
    onChange(
      normalizeInterestRatePeriodChain(
        [
          ...periods,
          createLoanInterestRatePeriod({
            rateType: 'variable',
            startYear: nextStart.year,
            startMonth: nextStart.month,
            endYear: 0,
            endMonth: 0,
          }),
        ],
        schedule,
      ),
    );
  };

  return (
    <div className="loan-rate-period-list">
      {periods.map((period, index) => (
        <LoanInterestRatePeriodRow
          key={period.id}
          period={period}
          index={index}
          fieldIdPrefix={fieldIdPrefix}
          referenceYear={referenceYear}
          loanYears={loanYears}
          schedule={schedule}
          isSinglePeriod={periods.length === 1}
          isLast={index === periods.length - 1}
          canRemove={periods.length > 1}
          allowAddPeriod={allowAddPeriod}
          periodsAfter={periods.length - index - 1}
          onChange={(updated) => updatePeriod(index, updated)}
          onRemove={() => removePeriod(index)}
          onAdd={addPeriod}
        />
      ))}
    </div>
  );
}
