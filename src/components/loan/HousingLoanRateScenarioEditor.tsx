import { useEffect, useState, type FormEvent } from 'react';

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
import type {
  CalendarYearMonth,
} from '../../lib/housingLoanAmortization';
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

function isLoanStartBoundary(period: LoanInterestRatePeriod): boolean {
  return period.startYear <= 0 || period.startMonth <= 0;
}

function isLoanEndBoundary(period: LoanInterestRatePeriod): boolean {
  return period.endYear <= 0 || period.endMonth <= 0;
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
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
): number | null {
  if (inferHousingRateType(periods) !== 'initial_fixed') return null;
  const firstBounds = resolveInterestRatePeriodBounds(periods[0], schedule);
  const startIndex = calendarMonthIndex(
    schedule.repaymentStart.year,
    schedule.repaymentStart.month,
  );
  const endIndex = calendarMonthIndex(firstBounds.end.year, firstBounds.end.month);
  const months = endIndex - startIndex + 1;
  if (months <= 0 || months % 12 !== 0) return null;
  return months / 12;
}

function monthsBetweenInclusive(
  start: CalendarYearMonth,
  end: CalendarYearMonth,
): number {
  return (
    calendarMonthIndex(end.year, end.month) -
    calendarMonthIndex(start.year, start.month) +
    1
  );
}

function resolveYearlyRiseStep(
  periods: LoanInterestRatePeriod[],
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
  expectedStart: CalendarYearMonth,
): number | null {
  if (periods.length < 2) return null;
  if (!periods.every((period) => period.rateType === 'variable')) return null;

  let riseStep: number | null = null;

  for (let index = 0; index < periods.length; index++) {
    const bounds = resolveInterestRatePeriodBounds(periods[index], schedule);
    const start = addCalendarMonths(expectedStart, index * 12);

    if (bounds.start.year !== start.year || bounds.start.month !== start.month) {
      return null;
    }

    const isLast = index === periods.length - 1;
    if (!isLast) {
      const expectedEnd = addCalendarMonths(start, 11);
      if (
        bounds.end.year !== expectedEnd.year ||
        bounds.end.month !== expectedEnd.month
      ) {
        return null;
      }
    } else if (
      bounds.end.year !== schedule.repaymentEnd.year ||
      bounds.end.month !== schedule.repaymentEnd.month
    ) {
      return null;
    }

    if (index > 0) {
      const step =
        periods[index].interestRatePct -
        periods[index - 1].interestRatePct;
      if (step < 0) return null;
      if (riseStep == null) {
        riseStep = step;
      } else if (Math.abs(step - riseStep) > 0.0001) {
        return null;
      }
    }
  }

  return riseStep;
}

function inferVariableScenario(
  periods: LoanInterestRatePeriod[],
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
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

  if (resolveYearlyRiseStep(periods, schedule, expectedStart) != null) {
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
  annualRisePct,
  useLoanStartBoundary,
}: {
  current?: LoanInterestRatePeriod;
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>;
  start: CalendarYearMonth;
  baseRatePct: number;
  annualRisePct: number;
  useLoanStartBoundary: boolean;
}): LoanInterestRatePeriod[] {
  const totalMonths = Math.max(
    1,
    monthsBetweenInclusive(start, schedule.repaymentEnd),
  );
  const yearBlocks = Math.ceil(totalMonths / 12);
  const result: LoanInterestRatePeriod[] = [];

  for (let index = 0; index < yearBlocks; index++) {
    const periodStart = addCalendarMonths(start, index * 12);
    const isLast = index === yearBlocks - 1;
    const periodEnd = isLast
      ? schedule.repaymentEnd
      : addCalendarMonths(periodStart, 11);
    const base =
      index === 0 && current
        ? current
        : createLoanInterestRatePeriod();

    result.push({
      ...base,
      rateType: 'variable',
      interestRatePct: Number(
        (baseRatePct + index * annualRisePct).toFixed(4),
      ),
      startYear: index === 0 && useLoanStartBoundary ? 0 : periodStart.year,
      startMonth: index === 0 && useLoanStartBoundary ? 0 : periodStart.month,
      endYear: isLast ? 0 : periodEnd.year,
      endMonth: isLast ? 0 : periodEnd.month,
    });
  }

  return result;
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
  const inferredRiseStep =
    resolveYearlyRiseStep(variablePeriods, schedule, variableStart) ?? 0.1;

  const [rateType, setRateType] = useState<HousingRateType>(
    () => inferredRateType,
  );
  const [variableScenario, setVariableScenario] =
    useState<VariableRateScenario>(() =>
      inferredRateType === 'variable' ? inferredVariableScenario : 'current',
    );
  const [variableRiseStep, setVariableRiseStep] =
    useState<number>(() => inferredRateType === 'variable' ? inferredRiseStep : 0.1);
  const [postFixedScenario, setPostFixedScenario] =
    useState<VariableRateScenario>(() =>
      inferredRateType === 'initial_fixed' ? inferredVariableScenario : 'current',
    );
  const [postFixedRiseStep, setPostFixedRiseStep] =
    useState<number>(() =>
      inferredRateType === 'initial_fixed' ? inferredRiseStep : 0.1,
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
        ? inferVariableScenario(nextVariablePeriods, schedule, nextVariableStart)
        : 'current';
    const nextRiseStep =
      resolveYearlyRiseStep(
        nextVariablePeriods,
        schedule,
        nextVariableStart,
      ) ?? 0.1;

    setRateType(nextRateType);
    if (nextRateType === 'variable') {
      setVariableScenario(nextScenario);
      setVariableRiseStep(nextRiseStep);
    }
    if (nextRateType === 'initial_fixed') {
      setPostFixedScenario(nextScenario);
      setPostFixedRiseStep(nextRiseStep);
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
          annualRisePct: variableRiseStep,
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
      setVariableRiseStep(0.1);
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
            annualRisePct: variableRiseStep,
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

  const handleVariableRiseStepChange = (annualRisePct: number) => {
    const safeRise = Math.max(0, annualRisePct);
    setVariableRiseStep(safeRise);
    if (variableScenario === 'rise') {
      onChange(
        buildVariableScenarioPeriods({
          current: firstPeriod,
          schedule,
          start: schedule.repaymentStart,
          baseRatePct: currentRatePct,
          annualRisePct: safeRise,
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
    const riseStep = Math.max(
      0,
      Number(formData.get('postFixedRiseStep') ?? postFixedRiseStep),
    );

    if (
      !Number.isFinite(fixedYears) ||
      !Number.isFinite(fixedRate) ||
      !Number.isFinite(followingRate) ||
      fixedYears < 1 ||
      fixedYears > maxInitialFixedYears ||
      fixedRate < 0 ||
      followingRate < 0 ||
      !Number.isFinite(riseStep)
    ) {
      return;
    }

    const firstEnd = addCalendarMonths(
      schedule.repaymentStart,
      fixedYears * 12 - 1,
    );
    const variableStart = addCalendarMonths(firstEnd, 1);
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
          start: variableStart,
          baseRatePct: followingRate,
          annualRisePct: riseStep,
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
        startYear: variableStart.year,
        startMonth: variableStart.month,
        endYear: 0,
        endMonth: 0,
      },
    ]);
  };

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
              <option value="rise">金利上昇</option>
              <option value="custom">自分で設定</option>
            </select>
          </div>

          {variableScenario === 'current' ? (
            <p className="loan-rate-scenario-note">
              現在入力した金利が完済まで続く前提で試算します。
            </p>
          ) : null}

          {variableScenario === 'rise' ? (
            <div className="loan-rate-rise-setting">
              <span className="loan-rate-scenario-rate-label">
                1年ごとの上昇幅
              </span>
              <HousingManInput
                unified
                compact
                value={variableRiseStep}
                onChange={handleVariableRiseStepChange}
                unit="%"
                min={0}
                step={0.01}
              />
              <span className="loan-rate-scenario-note">
                初期値は0.10%。入力した幅で毎年上昇する前提を完済まで自動設定します。
              </span>
            </div>
          ) : null}

          {variableScenario === 'custom' ? (
            <>
              <p className="loan-rate-scenario-note">
                将来の金利が変わる時期だけ追加してください。自動生成した年次期間は引き継がないため、必要な期間だけ設定できます。
              </p>
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
            </>
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
          <p className="loan-rate-scenario-note">
            入力した固定金利を完済まで適用して試算します。
          </p>
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
                  const next = event.target.value as VariableRateScenario;
                  setPostFixedScenario(next);
                  if (next === 'rise' && postFixedRiseStep < 0) {
                    setPostFixedRiseStep(0.1);
                  }
                }}
              >
                <option value="current">現状維持</option>
                <option value="rise">金利上昇</option>
                <option value="custom">自分で設定</option>
              </select>
            </div>

            {postFixedScenario === 'rise' ? (
              <label className="loan-rate-initial-fixed-field">
                <span>1年ごとの上昇幅</span>
                <span className="loan-rate-scenario-native-input-wrap">
                  <input
                    className="ui-input loan-rate-scenario-native-input"
                    type="number"
                    name="postFixedRiseStep"
                    min="0"
                    step="0.01"
                    value={postFixedRiseStep}
                    onChange={(event) =>
                      setPostFixedRiseStep(
                        Math.max(0, Number(event.target.value) || 0),
                      )
                    }
                  />
                  <span>%</span>
                </span>
              </label>
            ) : null}

            <p className="loan-rate-scenario-note">
              固定期間終了後は変動金利として扱い、その後の金利変化もシナリオで設定します。
            </p>
            <button
              type="submit"
              className="ui-btn ui-btn--secondary ui-btn--compact"
            >
              この金利条件を設定
            </button>

            {postFixedScenario === 'custom' &&
            hasExistingInitialFixed &&
            periods.length <= 2 ? (
              <div className="loan-rate-post-fixed-custom">
                <p className="loan-rate-scenario-note">
                  「この金利条件を設定」を押すと、固定期間＋最初の変動期間だけに整理します。その後、必要な金利変更だけ追加できます。
                </p>
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
        <>
          <p className="loan-rate-scenario-note">
            複数の固定・変動期間を自由に組み合わせる場合に使います。
          </p>
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
        </>
      ) : null}
    </div>
  );
}
