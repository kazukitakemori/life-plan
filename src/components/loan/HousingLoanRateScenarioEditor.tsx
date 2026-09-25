import { useEffect, useState, type FormEvent } from 'react';

import { createOwnedPropertyLoanSettings } from '../../lib/housingDefaults';
import {
  createLoanInterestRatePeriod,
  resolveInterestRatePeriodBounds,
  resolveLoanRepaymentSchedule,
  type LoanRepaymentSchedule,
} from '../../lib/loanInterestRatePeriod';
import {
  addCalendarMonths,
  calendarMonthIndex,
} from '../../lib/housingLoanAmortization';
import type { CalendarYearMonth } from '../../lib/housingLoanAmortization';
import type {
  LoanInterestRatePeriod,
  LoanInterestRateType,
  OwnedProperty,
} from '../../types/housing';
import type { VehicleEntry } from '../../types/vehicle';
import { HousingManInput } from '../housing/HousingManInput';
import { LoanInterestRatePeriodsEditor } from './LoanInterestRatePeriodsEditor';

type HousingRateType =
  | 'variable'
  | 'fixed'
  | 'initial_fixed'
  | 'detailed';

type VariableRateScenario =
  | 'current'
  | 'rise'
  | 'custom';

interface RiseConfig {
  startAfterYears: number;
  intervalYears: number;
  risePct: number;
  capPct: number | null;
}

interface HousingLoanRateScenarioEditorProps {
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
  onChange: (periods: LoanInterestRatePeriod[]) => void;
}

const DEFAULT_RISE_CONFIG: RiseConfig = {
  startAfterYears: 1,
  intervalYears: 1,
  risePct: 0.1,
  capPct: null,
};

function isLoanStartBoundary(period: LoanInterestRatePeriod): boolean {
  return period.startYear <= 0 || period.startMonth <= 0;
}

function isLoanEndBoundary(period: LoanInterestRatePeriod): boolean {
  return period.endYear <= 0 || period.endMonth <= 0;
}

function monthsBetween(
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): number {
  return (
    calendarMonthIndex(end.year, end.month) -
    calendarMonthIndex(start.year, start.month)
  );
}

function monthsBetweenInclusive(
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): number {
  return monthsBetween(start, end) + 1;
}

function inferHousingRateType(
  periods: LoanInterestRatePeriod[],
): HousingRateType {
  if (periods.length === 1) {
    const period = periods[0];
    if (isLoanStartBoundary(period) && isLoanEndBoundary(period)) {
      return period.rateType === 'variable' ? 'variable' : 'fixed';
    }
  }

  if (
    periods.length >= 2 &&
    periods[0].rateType === 'fixed' &&
    isLoanStartBoundary(periods[0]) &&
    !isLoanEndBoundary(periods[0]) &&
    periods.slice(1).every((period) => period.rateType === 'variable') &&
    isLoanEndBoundary(periods[periods.length - 1])
  ) {
    return 'initial_fixed';
  }

  if (
    periods.length > 1 &&
    periods.every((period) => period.rateType === 'variable')
  ) {
    return 'variable';
  }

  return 'detailed';
}

function resolveInitialFixedYears(
  periods: LoanInterestRatePeriod[],
  schedule: LoanRepaymentSchedule,
): number | null {
  if (inferHousingRateType(periods) !== 'initial_fixed') return null;
  const firstBounds = resolveInterestRatePeriodBounds(periods[0], schedule);
  const months = monthsBetweenInclusive(
    schedule.repaymentStart,
    firstBounds.end,
  );
  if (months <= 0 || months % 12 !== 0) return null;
  return months / 12;
}

function inferRiseConfig(
  periods: LoanInterestRatePeriod[],
  schedule: LoanRepaymentSchedule,
  expectedStart: CalendarYearMonth,
): RiseConfig | null {
  if (periods.length < 2) return null;
  if (!periods.every((period) => period.rateType === 'variable')) return null;

  const starts = periods.map(
    (period) => resolveInterestRatePeriodBounds(period, schedule).start,
  );
  const firstOffsetMonths = monthsBetween(expectedStart, starts[1]);
  if (firstOffsetMonths <= 0 || firstOffsetMonths % 12 !== 0) return null;

  const startAfterYears = firstOffsetMonths / 12;
  let intervalYears = DEFAULT_RISE_CONFIG.intervalYears;

  if (starts.length >= 3) {
    const intervalMonths = monthsBetween(starts[1], starts[2]);
    if (intervalMonths <= 0 || intervalMonths % 12 !== 0) return null;
    intervalYears = intervalMonths / 12;

    for (let index = 2; index < starts.length; index++) {
      const diffMonths = monthsBetween(starts[index - 1], starts[index]);
      if (diffMonths !== intervalMonths) return null;
    }
  }

  const deltas: number[] = [];
  for (let index = 1; index < periods.length; index++) {
    const delta =
      periods[index].interestRatePct -
      periods[index - 1].interestRatePct;
    if (delta <= 0) return null;
    deltas.push(delta);
  }

  const risePct = Math.max(...deltas);
  const hasCappedLastStep =
    deltas.length >= 2 &&
    deltas[deltas.length - 1] < risePct - 0.0001;
  const capPct = hasCappedLastStep
    ? periods[periods.length - 1].interestRatePct
    : null;

  for (let index = 0; index < deltas.length; index++) {
    const isLast = index === deltas.length - 1;
    if (isLast && hasCappedLastStep) continue;
    if (Math.abs(deltas[index] - risePct) > 0.0001) return null;
  }

  return {
    startAfterYears,
    intervalYears,
    risePct: Number(risePct.toFixed(4)),
    capPct,
  };
}

function inferVariableScenario(
  periods: LoanInterestRatePeriod[],
  schedule: LoanRepaymentSchedule,
  expectedStart: CalendarYearMonth,
): VariableRateScenario {
  if (
    periods.length === 1 &&
    periods[0].rateType === 'variable' &&
    isLoanEndBoundary(periods[0])
  ) {
    const bounds = resolveInterestRatePeriodBounds(periods[0], schedule);
    if (
      bounds.start.year === expectedStart.year &&
      bounds.start.month === expectedStart.month
    ) {
      return 'current';
    }
  }

  if (inferRiseConfig(periods, schedule, expectedStart)) {
    return 'rise';
  }

  return 'custom';
}

function buildSinglePeriod(
  current: LoanInterestRatePeriod | undefined,
  rateType: LoanInterestRateType,
  interestRatePct: number,
): LoanInterestRatePeriod[] {
  return [
    current
      ? {
          ...current,
          rateType,
          interestRatePct,
          startYear: 0,
          startMonth: 0,
          endYear: 0,
          endMonth: 0,
        }
      : createLoanInterestRatePeriod({
          rateType,
          interestRatePct,
        }),
  ];
}

function buildVariableScenarioPeriods({
  current,
  schedule,
  start,
  baseRatePct,
  config,
  useLoanStartBoundary,
}: {
  current?: LoanInterestRatePeriod;
  schedule: LoanRepaymentSchedule;
  start: CalendarYearMonth;
  baseRatePct: number;
  config: RiseConfig;
  useLoanStartBoundary: boolean;
}): LoanInterestRatePeriod[] {
  const startAfterYears = Math.max(1, Math.floor(config.startAfterYears));
  const intervalYears = Math.max(1, Math.floor(config.intervalYears));
  const risePct = Math.max(0, config.risePct);
  const capPct =
    config.capPct != null && config.capPct > 0 ? config.capPct : null;

  if (risePct <= 0 || (capPct != null && capPct <= baseRatePct)) {
    return [
      {
        ...(current ??
          createLoanInterestRatePeriod({
            rateType: 'variable',
            interestRatePct: baseRatePct,
          })),
        rateType: 'variable',
        interestRatePct: baseRatePct,
        startYear: useLoanStartBoundary ? 0 : start.year,
        startMonth: useLoanStartBoundary ? 0 : start.month,
        endYear: 0,
        endMonth: 0,
      },
    ];
  }

  const changes: Array<{
    start: CalendarYearMonth;
    ratePct: number;
  }> = [];

  let changeStart = addCalendarMonths(start, startAfterYears * 12);
  let ratePct = baseRatePct;

  while (
    calendarMonthIndex(changeStart.year, changeStart.month) <=
    calendarMonthIndex(schedule.repaymentEnd.year, schedule.repaymentEnd.month)
  ) {
    const nextRate = Number(
      Math.min(
        capPct ?? Number.POSITIVE_INFINITY,
        ratePct + risePct,
      ).toFixed(4),
    );

    if (nextRate <= ratePct + 0.000001) break;

    changes.push({
      start: changeStart,
      ratePct: nextRate,
    });
    ratePct = nextRate;

    if (capPct != null && ratePct >= capPct - 0.000001) break;
    changeStart = addCalendarMonths(changeStart, intervalYears * 12);
  }

  const allStarts = [
    { start, ratePct: baseRatePct },
    ...changes,
  ];

  return allStarts.map((entry, index) => {
    const next = allStarts[index + 1];
    const isLast = index === allStarts.length - 1;
    const end = next ? addCalendarMonths(next.start, -1) : schedule.repaymentEnd;
    const base =
      index === 0 && current
        ? current
        : createLoanInterestRatePeriod();

    return {
      ...base,
      rateType: 'variable',
      interestRatePct: entry.ratePct,
      startYear:
        index === 0 && useLoanStartBoundary ? 0 : entry.start.year,
      startMonth:
        index === 0 && useLoanStartBoundary ? 0 : entry.start.month,
      endYear: isLast ? 0 : end.year,
      endMonth: isLast ? 0 : end.month,
    };
  });
}

function buildCustomChangePointChain({
  periods,
  schedule,
  start,
  useLoanStartBoundary,
}: {
  periods: LoanInterestRatePeriod[];
  schedule: LoanRepaymentSchedule;
  start: CalendarYearMonth;
  useLoanStartBoundary: boolean;
}): LoanInterestRatePeriod[] {
  if (periods.length === 0) return periods;

  const ordered = [...periods].sort((a, b) => {
    if (a === periods[0]) return -1;
    if (b === periods[0]) return 1;
    const aStart = resolveInterestRatePeriodBounds(a, schedule).start;
    const bStart = resolveInterestRatePeriodBounds(b, schedule).start;
    return (
      calendarMonthIndex(aStart.year, aStart.month) -
      calendarMonthIndex(bStart.year, bStart.month)
    );
  });

  return ordered.map((period, index) => {
    const periodStart =
      index === 0
        ? start
        : resolveInterestRatePeriodBounds(period, schedule).start;
    const next =
      index < ordered.length - 1
        ? resolveInterestRatePeriodBounds(ordered[index + 1], schedule).start
        : null;
    const end = next ? addCalendarMonths(next, -1) : schedule.repaymentEnd;

    return {
      ...period,
      rateType: 'variable',
      startYear:
        index === 0 && useLoanStartBoundary ? 0 : periodStart.year,
      startMonth:
        index === 0 && useLoanStartBoundary ? 0 : periodStart.month,
      endYear: index === ordered.length - 1 ? 0 : end.year,
      endMonth: index === ordered.length - 1 ? 0 : end.month,
    };
  });
}

function RiseScenarioFields({
  config,
  baseRatePct,
  onChange,
  fieldIdPrefix,
}: {
  config: RiseConfig;
  baseRatePct: number;
  onChange: (config: RiseConfig) => void;
  fieldIdPrefix: string;
}) {
  const update = (patch: Partial<RiseConfig>) =>
    onChange({ ...config, ...patch });

  return (
    <div className="loan-rate-rise-panel">
      <div className="loan-rate-rise-grid">
        <label className="loan-rate-rise-field">
          <span>上昇開始</span>
          <span className="loan-rate-scenario-native-input-wrap">
            <input
              id={`${fieldIdPrefix}-rise-start`}
              className="ui-input loan-rate-scenario-native-input"
              type="number"
              min="1"
              step="1"
              value={config.startAfterYears}
              onChange={(event) =>
                update({
                  startAfterYears: Math.max(
                    1,
                    Math.floor(Number(event.target.value) || 1),
                  ),
                })
              }
            />
            <span>年後から</span>
          </span>
        </label>

        <label className="loan-rate-rise-field">
          <span>上昇間隔</span>
          <span className="loan-rate-scenario-native-input-wrap">
            <input
              id={`${fieldIdPrefix}-rise-interval`}
              className="ui-input loan-rate-scenario-native-input"
              type="number"
              min="1"
              step="1"
              value={config.intervalYears}
              onChange={(event) =>
                update({
                  intervalYears: Math.max(
                    1,
                    Math.floor(Number(event.target.value) || 1),
                  ),
                })
              }
            />
            <span>年ごと</span>
          </span>
        </label>

        <label className="loan-rate-rise-field">
          <span>1回の上昇幅</span>
          <HousingManInput
            unified
            compact
            value={config.risePct}
            onChange={(risePct) => update({ risePct: Math.max(0, risePct) })}
            unit="%"
            min={0}
            step={0.01}
          />
        </label>

        <label className="loan-rate-rise-field">
          <span>上限金利（任意）</span>
          <span className="loan-rate-scenario-native-input-wrap">
            <input
              id={`${fieldIdPrefix}-rise-cap`}
              className="ui-input loan-rate-scenario-native-input"
              type="number"
              min="0"
              step="0.01"
              value={config.capPct ?? ''}
              placeholder="上限なし"
              onChange={(event) => {
                const raw = event.target.value;
                update({
                  capPct:
                    raw === ''
                      ? null
                      : Math.max(0, Number(raw) || 0),
                });
              }}
            />
            <span>%</span>
          </span>
        </label>
      </div>

      {config.capPct != null && config.capPct <= baseRatePct ? (
        <p className="loan-rate-scenario-note">
          上限金利が現在の金利以下のため、この条件では金利は上昇しません。
        </p>
      ) : null}
    </div>
  );
}

function CustomRateChangeEditor({
  periods,
  schedule,
  start,
  useLoanStartBoundary,
  onChange,
}: {
  periods: LoanInterestRatePeriod[];
  schedule: LoanRepaymentSchedule;
  start: CalendarYearMonth;
  useLoanStartBoundary: boolean;
  onChange: (periods: LoanInterestRatePeriod[]) => void;
}) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftYears, setDraftYears] = useState<number | null>(null);
  const [draftRate, setDraftRate] = useState<number | null>(null);

  const maxYears = Math.max(
    0,
    Math.floor(monthsBetween(start, schedule.repaymentEnd) / 12),
  );

  const changes = periods.slice(1).map((period, index) => {
    const bounds = resolveInterestRatePeriodBounds(period, schedule);
    const offsetMonths = monthsBetween(start, bounds.start);
    return {
      period,
      index: index + 1,
      afterYears:
        offsetMonths > 0 && offsetMonths % 12 === 0
          ? offsetMonths / 12
          : null,
      start: bounds.start,
    };
  });

  const usedYears = new Set(
    changes
      .map((change) => change.afterYears)
      .filter((year): year is number => year != null),
  );

  const rebuild = (nextPeriods: LoanInterestRatePeriod[]) => {
    onChange(
      buildCustomChangePointChain({
        periods: nextPeriods,
        schedule,
        start,
        useLoanStartBoundary,
      }),
    );
  };

  const updateChangeYear = (periodIndex: number, afterYears: number) => {
    const nextStart = addCalendarMonths(start, afterYears * 12);
    rebuild(
      periods.map((period, index) =>
        index === periodIndex
          ? {
              ...period,
              startYear: nextStart.year,
              startMonth: nextStart.month,
            }
          : period,
      ),
    );
  };

  const updateChangeRate = (periodIndex: number, interestRatePct: number) => {
    rebuild(
      periods.map((period, index) =>
        index === periodIndex
          ? { ...period, interestRatePct }
          : period,
      ),
    );
  };

  const removeChange = (periodIndex: number) => {
    rebuild(periods.filter((_, index) => index !== periodIndex));
  };

  const addChange = () => {
    if (
      draftYears == null ||
      draftRate == null ||
      draftYears < 1 ||
      draftYears > maxYears ||
      usedYears.has(draftYears)
    ) {
      return;
    }

    const nextStart = addCalendarMonths(start, draftYears * 12);
    rebuild([
      ...periods,
      createLoanInterestRatePeriod({
        rateType: 'variable',
        interestRatePct: draftRate,
        startYear: nextStart.year,
        startMonth: nextStart.month,
        endYear: 0,
        endMonth: 0,
      }),
    ]);
    setDraftOpen(false);
    setDraftYears(null);
    setDraftRate(null);
  };

  return (
    <div className="loan-rate-custom-editor">
      {changes.length > 0 ? (
        <div className="loan-rate-custom-list">
          {changes.map((change) => (
            <div
              className="loan-rate-custom-row"
              key={change.period.id}
            >
              <span className="loan-rate-custom-prefix">借入開始から</span>
              {change.afterYears != null ? (
                <select
                  className="ui-select ui-select--compact loan-rate-custom-year"
                  value={change.afterYears}
                  onChange={(event) =>
                    updateChangeYear(
                      change.index,
                      Number(event.target.value),
                    )
                  }
                >
                  {Array.from({ length: maxYears }, (_, index) => index + 1)
                    .filter(
                      (year) =>
                        year === change.afterYears || !usedYears.has(year),
                    )
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}年後
                      </option>
                    ))}
                </select>
              ) : (
                <span className="loan-rate-custom-date">
                  {change.start.year}年{change.start.month}月から
                </span>
              )}
              <span className="loan-rate-custom-arrow">→</span>
              <HousingManInput
                unified
                compact
                value={change.period.interestRatePct}
                onChange={(interestRatePct) =>
                  updateChangeRate(change.index, interestRatePct)
                }
                unit="%"
                min={0}
                step={0.01}
              />
              <button
                type="button"
                className="ui-delete-button"
                onClick={() => removeChange(change.index)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      {maxYears <= 0 ? (
        <p className="loan-rate-scenario-note">
          完済まで1年未満のため、追加の金利変更は設定できません。
        </p>
      ) : draftOpen ? (
        <div className="loan-rate-custom-draft">
          <label className="loan-rate-rise-field">
            <span>変更時期</span>
            <select
              className="ui-select ui-select--compact loan-rate-custom-year"
              value={draftYears ?? ''}
              onChange={(event) =>
                setDraftYears(
                  event.target.value === ''
                    ? null
                    : Number(event.target.value),
                )
              }
            >
              <option value="">選択してください</option>
              {Array.from({ length: maxYears }, (_, index) => index + 1)
                .filter((year) => !usedYears.has(year))
                .map((year) => (
                  <option key={year} value={year}>
                    {year}年後
                  </option>
                ))}
            </select>
          </label>

          <label className="loan-rate-rise-field">
            <span>変更後の金利</span>
            <span className="loan-rate-scenario-native-input-wrap">
              <input
                className="ui-input loan-rate-scenario-native-input"
                type="number"
                min="0"
                step="0.01"
                value={draftRate ?? ''}
                placeholder="入力"
                onChange={(event) =>
                  setDraftRate(
                    event.target.value === ''
                      ? null
                      : Math.max(0, Number(event.target.value) || 0),
                  )
                }
              />
              <span>%</span>
            </span>
          </label>

          <div className="loan-rate-custom-draft-actions">
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--compact"
              onClick={addChange}
              disabled={draftYears == null || draftRate == null}
            >
              追加
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--compact"
              onClick={() => {
                setDraftOpen(false);
                setDraftYears(null);
                setDraftRate(null);
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--compact"
          onClick={() => setDraftOpen(true)}
        >
          ＋ 金利変更を追加
        </button>
      )}
    </div>
  );
}

export function HousingLoanRateScenarioEditor({
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
  onChange,
}: HousingLoanRateScenarioEditorProps) {
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

  const inferredRateType = inferHousingRateType(periods);
  const variablePeriods =
    inferredRateType === 'initial_fixed' ? periods.slice(1) : periods;
  const variableStart =
    inferredRateType === 'initial_fixed' && variablePeriods[0]
      ? resolveInterestRatePeriodBounds(variablePeriods[0], schedule).start
      : schedule.repaymentStart;
  const inferredVariableScenario =
    inferredRateType === 'variable' || inferredRateType === 'initial_fixed'
      ? inferVariableScenario(variablePeriods, schedule, variableStart)
      : 'current';
  const inferredRiseConfig =
    inferRiseConfig(variablePeriods, schedule, variableStart) ??
    DEFAULT_RISE_CONFIG;

  const [rateType, setRateType] = useState<HousingRateType>(
    () => inferredRateType,
  );
  const [variableScenario, setVariableScenario] =
    useState<VariableRateScenario>(() =>
      inferredRateType === 'variable' ? inferredVariableScenario : 'current',
    );
  const [variableRiseConfig, setVariableRiseConfig] =
    useState<RiseConfig>(() =>
      inferredRateType === 'variable'
        ? inferredRiseConfig
        : DEFAULT_RISE_CONFIG,
    );
  const [postFixedScenario, setPostFixedScenario] =
    useState<VariableRateScenario>(() =>
      inferredRateType === 'initial_fixed'
        ? inferredVariableScenario
        : 'current',
    );
  const [postFixedRiseConfig, setPostFixedRiseConfig] =
    useState<RiseConfig>(() =>
      inferredRateType === 'initial_fixed'
        ? inferredRiseConfig
        : DEFAULT_RISE_CONFIG,
    );

  useEffect(() => {
    const nextRateType = inferHousingRateType(periods);
    const nextVariablePeriods =
      nextRateType === 'initial_fixed' ? periods.slice(1) : periods;
    const nextVariableStart =
      nextRateType === 'initial_fixed' && nextVariablePeriods[0]
        ? resolveInterestRatePeriodBounds(nextVariablePeriods[0], schedule).start
        : schedule.repaymentStart;
    const nextScenario =
      nextRateType === 'variable' || nextRateType === 'initial_fixed'
        ? inferVariableScenario(
            nextVariablePeriods,
            schedule,
            nextVariableStart,
          )
        : 'current';
    const nextRiseConfig =
      inferRiseConfig(
        nextVariablePeriods,
        schedule,
        nextVariableStart,
      ) ?? DEFAULT_RISE_CONFIG;

    setRateType(nextRateType);
    if (nextRateType === 'variable') {
      setVariableScenario(nextScenario);
      setVariableRiseConfig(nextRiseConfig);
    }
    if (nextRateType === 'initial_fixed') {
      setPostFixedScenario(nextScenario);
      setPostFixedRiseConfig(nextRiseConfig);
    }
  }, [fieldIdPrefix]);

  const firstPeriod = periods[0];
  const currentRatePct = firstPeriod?.interestRatePct ?? 0;
  const existingInitialFixedYears = resolveInitialFixedYears(periods, schedule);
  const hasExistingInitialFixed =
    inferHousingRateType(periods) === 'initial_fixed';
  const existingPostFixedRate =
    hasExistingInitialFixed ? periods[1]?.interestRatePct : undefined;
  const maxInitialFixedYears = Math.max(
    0,
    Math.floor((schedule.totalMonths - 1) / 12),
  );

  const applySinglePeriodRate = (
    nextRateType: LoanInterestRateType,
    interestRatePct = currentRatePct,
  ) => {
    onChange(buildSinglePeriod(firstPeriod, nextRateType, interestRatePct));
  };

  const applyVariableScenario = (
    scenario: VariableRateScenario,
    interestRatePct = currentRatePct,
  ) => {
    const previousScenario = variableScenario;
    setVariableScenario(scenario);

    if (scenario === 'current') {
      onChange(buildSinglePeriod(firstPeriod, 'variable', interestRatePct));
      return;
    }

    if (scenario === 'rise') {
      onChange(
        buildVariableScenarioPeriods({
          current: firstPeriod,
          schedule,
          start: schedule.repaymentStart,
          baseRatePct: interestRatePct,
          config: variableRiseConfig,
          useLoanStartBoundary: true,
        }),
      );
      return;
    }

    if (scenario === 'custom' && previousScenario !== 'custom') {
      onChange(buildSinglePeriod(firstPeriod, 'variable', interestRatePct));
    }
  };

  const handleRateTypeChange = (next: HousingRateType) => {
    setRateType(next);

    if (next === 'variable') {
      setVariableScenario('current');
      setVariableRiseConfig(DEFAULT_RISE_CONFIG);
      applySinglePeriodRate('variable');
      return;
    }

    if (next === 'fixed') {
      applySinglePeriodRate('fixed');
    }
  };

  const handleCurrentRateChange = (interestRatePct: number) => {
    if (rateType === 'fixed') {
      applySinglePeriodRate('fixed', interestRatePct);
      return;
    }

    if (rateType === 'variable') {
      if (variableScenario === 'rise') {
        onChange(
          buildVariableScenarioPeriods({
            current: firstPeriod,
            schedule,
            start: schedule.repaymentStart,
            baseRatePct: interestRatePct,
            config: variableRiseConfig,
            useLoanStartBoundary: true,
          }),
        );
      } else if (variableScenario === 'current') {
        onChange(buildSinglePeriod(firstPeriod, 'variable', interestRatePct));
      } else {
        onChange(
          periods.map((period, index) =>
            index === 0 ? { ...period, interestRatePct } : period,
          ),
        );
      }
    }
  };

  const handleVariableRiseConfigChange = (config: RiseConfig) => {
    setVariableRiseConfig(config);
    if (variableScenario === 'rise') {
      onChange(
        buildVariableScenarioPeriods({
          current: firstPeriod,
          schedule,
          start: schedule.repaymentStart,
          baseRatePct: currentRatePct,
          config,
          useLoanStartBoundary: true,
        }),
      );
    }
  };

  const handleInitialFixedSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fixedYears = Number(formData.get('fixedYears'));
    const fixedRate = Number(formData.get('fixedRate'));
    const followingRate = Number(formData.get('followingRate'));

    if (
      !Number.isFinite(fixedYears) ||
      !Number.isFinite(fixedRate) ||
      !Number.isFinite(followingRate) ||
      fixedYears < 1 ||
      fixedYears > maxInitialFixedYears ||
      fixedRate < 0 ||
      followingRate < 0
    ) {
      return;
    }

    const firstEnd = addCalendarMonths(
      schedule.repaymentStart,
      fixedYears * 12 - 1,
    );
    const nextVariableStart = addCalendarMonths(firstEnd, 1);
    const first =
      periods[0] ??
      createLoanInterestRatePeriod({
        rateType: 'fixed',
        interestRatePct: fixedRate,
      });
    const fixedPeriod: LoanInterestRatePeriod = {
      ...first,
      rateType: 'fixed',
      interestRatePct: fixedRate,
      startYear: 0,
      startMonth: 0,
      endYear: firstEnd.year,
      endMonth: firstEnd.month,
    };
    const currentVariable =
      hasExistingInitialFixed ? periods[1] : undefined;

    if (postFixedScenario === 'rise') {
      onChange([
        fixedPeriod,
        ...buildVariableScenarioPeriods({
          current: currentVariable,
          schedule,
          start: nextVariableStart,
          baseRatePct: followingRate,
          config: postFixedRiseConfig,
          useLoanStartBoundary: false,
        }),
      ]);
      return;
    }

    onChange([
      fixedPeriod,
      {
        ...(currentVariable ??
          createLoanInterestRatePeriod({ rateType: 'variable' })),
        rateType: 'variable',
        interestRatePct: followingRate,
        startYear: nextVariableStart.year,
        startMonth: nextVariableStart.month,
        endYear: 0,
        endMonth: 0,
      },
    ]);
  };

  const postFixedVariableStart =
    hasExistingInitialFixed && periods[1]
      ? resolveInterestRatePeriodBounds(periods[1], schedule).start
      : null;

  return (
    <div className="loan-rate-scenario-editor">
      <div className="loan-rate-scenario-method">
        <label htmlFor={`${fieldIdPrefix}-rate-type`}>金利タイプ</label>
        <select
          id={`${fieldIdPrefix}-rate-type`}
          className="ui-select ui-select--compact loan-rate-scenario-select"
          value={rateType}
          onChange={(event) =>
            handleRateTypeChange(event.target.value as HousingRateType)
          }
        >
          <option value="variable">変動金利</option>
          <option value="fixed">全期間固定</option>
          <option value="initial_fixed">固定期間選択型</option>
          <option value="detailed">その他・細かく設定</option>
        </select>
      </div>

      {rateType === 'variable' ? (
        <div className="loan-rate-scenario-simple">
          <div className="loan-rate-scenario-rate-line">
            <span className="loan-rate-scenario-rate-label">現在の金利</span>
            <HousingManInput
              unified
              compact
              value={currentRatePct}
              onChange={handleCurrentRateChange}
              unit="%"
              min={0}
              step={0.01}
            />
          </div>

          <div className="loan-rate-scenario-method">
            <label htmlFor={`${fieldIdPrefix}-variable-scenario`}>
              将来の金利シナリオ
            </label>
            <select
              id={`${fieldIdPrefix}-variable-scenario`}
              className="ui-select ui-select--compact loan-rate-scenario-select"
              value={variableScenario}
              onChange={(event) =>
                applyVariableScenario(
                  event.target.value as VariableRateScenario,
                )
              }
            >
              <option value="current">現状維持</option>
              <option value="rise">段階的に上昇</option>
              <option value="custom">自分で設定</option>
            </select>
          </div>

          {variableScenario === 'rise' ? (
            <RiseScenarioFields
              config={variableRiseConfig}
              baseRatePct={currentRatePct}
              fieldIdPrefix={`${fieldIdPrefix}-variable`}
              onChange={handleVariableRiseConfigChange}
            />
          ) : null}

          {variableScenario === 'custom' ? (
              <CustomRateChangeEditor
                periods={periods}
                schedule={schedule}
                start={schedule.repaymentStart}
                useLoanStartBoundary
                onChange={onChange}
              />
          ) : null}
        </div>
      ) : null}

      {rateType === 'fixed' ? (
        <div className="loan-rate-scenario-simple">
          <div className="loan-rate-scenario-rate-line">
            <span className="loan-rate-scenario-rate-label">固定金利</span>
            <HousingManInput
              unified
              compact
              value={currentRatePct}
              onChange={handleCurrentRateChange}
              unit="%"
              min={0}
              step={0.01}
            />
            <span className="loan-rate-scenario-range">完済まで</span>
          </div>
        </div>
      ) : null}

      {rateType === 'initial_fixed' ? (
        maxInitialFixedYears > 0 ? (
          <form
            className="loan-rate-initial-fixed-form"
            onSubmit={handleInitialFixedSubmit}
            key={`${fieldIdPrefix}-initial-${hasExistingInitialFixed ? periods[0]?.id ?? 'existing' : 'new'}`}
          >
            <div className="loan-rate-initial-fixed-fields">
              <label className="loan-rate-initial-fixed-field">
                <span>当初固定期間</span>
                <select
                  name="fixedYears"
                  className="ui-select ui-select--compact"
                  defaultValue={
                    existingInitialFixedYears != null
                      ? String(existingInitialFixedYears)
                      : ''
                  }
                  required
                >
                  <option value="">選択してください</option>
                  {Array.from(
                    { length: maxInitialFixedYears },
                    (_, index) => index + 1,
                  ).map((years) => (
                    <option key={years} value={years}>
                      {years}年間
                    </option>
                  ))}
                </select>
              </label>

              <label className="loan-rate-initial-fixed-field">
                <span>当初の固定金利</span>
                <span className="loan-rate-scenario-native-input-wrap">
                  <input
                    className="ui-input loan-rate-scenario-native-input"
                    type="number"
                    name="fixedRate"
                    min="0"
                    step="0.01"
                    defaultValue={firstPeriod?.interestRatePct ?? ''}
                    required
                  />
                  <span>%</span>
                </span>
              </label>

              <label className="loan-rate-initial-fixed-field">
                <span>固定終了後の変動金利</span>
                <span className="loan-rate-scenario-native-input-wrap">
                  <input
                    className="ui-input loan-rate-scenario-native-input"
                    type="number"
                    name="followingRate"
                    min="0"
                    step="0.01"
                    defaultValue={existingPostFixedRate ?? ''}
                    placeholder="入力"
                    required
                  />
                  <span>%</span>
                </span>
              </label>
            </div>

            <div className="loan-rate-scenario-method">
              <label htmlFor={`${fieldIdPrefix}-post-fixed-scenario`}>
                固定終了後の金利シナリオ
              </label>
              <select
                id={`${fieldIdPrefix}-post-fixed-scenario`}
                className="ui-select ui-select--compact loan-rate-scenario-select"
                value={postFixedScenario}
                onChange={(event) => {
                  const nextScenario =
                    event.target.value as VariableRateScenario;
                  setPostFixedScenario(nextScenario);

                  if (
                    nextScenario === 'custom' &&
                    hasExistingInitialFixed &&
                    periods[1]
                  ) {
                    const variableBounds =
                      resolveInterestRatePeriodBounds(
                        periods[1],
                        schedule,
                      );
                    onChange([
                      periods[0],
                      {
                        ...periods[1],
                        rateType: 'variable',
                        startYear: variableBounds.start.year,
                        startMonth: variableBounds.start.month,
                        endYear: 0,
                        endMonth: 0,
                      },
                    ]);
                  }
                }}
              >
                <option value="current">現状維持</option>
                <option value="rise">段階的に上昇</option>
                <option value="custom">自分で設定</option>
              </select>
            </div>

            {postFixedScenario === 'rise' ? (
              <RiseScenarioFields
                config={postFixedRiseConfig}
                baseRatePct={existingPostFixedRate ?? 0}
                fieldIdPrefix={`${fieldIdPrefix}-post-fixed`}
                onChange={setPostFixedRiseConfig}
              />
            ) : null}

            <button
              type="submit"
              className="ui-btn ui-btn--secondary ui-btn--compact"
            >
              この金利条件を設定
            </button>

            {postFixedScenario === 'custom' &&
            hasExistingInitialFixed &&
            periods.length >= 2 &&
            postFixedVariableStart ? (
              <div className="loan-rate-post-fixed-custom">
                <CustomRateChangeEditor
                  periods={periods.slice(1)}
                  schedule={schedule}
                  start={postFixedVariableStart}
                  useLoanStartBoundary={false}
                  onChange={(nextVariablePeriods) =>
                    onChange([periods[0], ...nextVariablePeriods])
                  }
                />
              </div>
            ) : null}
          </form>
        ) : (
          <p className="loan-rate-scenario-note">
            返済期間が短いため、固定期間とその後の期間を分けて設定できません。
          </p>
        )
      ) : null}

      {rateType === 'detailed' ? (
        <LoanInterestRatePeriodsEditor
            periods={periods}
            fieldIdPrefix={fieldIdPrefix}
            referenceYear={referenceYear}
            referenceMonth={referenceMonth}
            loanYears={loanYears}
            loanStartYear={loanStartYear}
            loanStartMonth={loanStartMonth}
            linkedHousingProperty={linkedHousingProperty}
            linkedVehicle={linkedVehicle}
            memberAgeAtReference={memberAgeAtReference}
            memberBirthMonth={memberBirthMonth}
            allowAddPeriod
            onChange={onChange}
          />
      ) : null}
    </div>
  );
}
