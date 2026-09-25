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
  | 'rise_01'
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

  if (periods.length === 2) {
    const [first, second] = periods;
    if (
      first.rateType === 'fixed' &&
      second.rateType === 'variable' &&
      isLoanStartBoundary(first) &&
      !isLoanEndBoundary(first) &&
      isLoanEndBoundary(second)
    ) {
      return 'initial_fixed';
    }
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

function isYearlyRiseScenario(
  periods: LoanInterestRatePeriod[],
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
): boolean {
  if (periods.length < 2) return false;
  if (!periods.every((period) => period.rateType === 'variable')) return false;

  for (let index = 0; index < periods.length; index++) {
    const period = periods[index];
    const bounds = resolveInterestRatePeriodBounds(period, schedule);
    const expectedStart =
      index === 0
        ? schedule.repaymentStart
        : addCalendarMonths(schedule.repaymentStart, index * 12);

    if (
      bounds.start.year !== expectedStart.year ||
      bounds.start.month !== expectedStart.month
    ) {
      return false;
    }

    const isLast = index === periods.length - 1;
    if (!isLast) {
      const expectedEnd = addCalendarMonths(expectedStart, 11);
      if (
        bounds.end.year !== expectedEnd.year ||
        bounds.end.month !== expectedEnd.month
      ) {
        return false;
      }
    }

    if (index > 0) {
      const previous = periods[index - 1].interestRatePct;
      const current = period.interestRatePct;
      if (Math.abs(current - (previous + 0.1)) > 0.0001) {
        return false;
      }
    }
  }

  return true;
}

function inferVariableScenario(
  periods: LoanInterestRatePeriod[],
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
): VariableRateScenario {
  if (
    periods.length === 1 &&
    periods[0].rateType === 'variable' &&
    isLoanStartBoundary(periods[0]) &&
    isLoanEndBoundary(periods[0])
  ) {
    return 'current';
  }

  if (isYearlyRiseScenario(periods, schedule)) {
    return 'rise_01';
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

function buildYearlyRisePeriods(
  current: LoanInterestRatePeriod | undefined,
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
  currentRatePct: number,
): LoanInterestRatePeriod[] {
  const totalMonths = Math.max(1, schedule.totalMonths);
  const yearBlocks = Math.ceil(totalMonths / 12);
  const result: LoanInterestRatePeriod[] = [];

  for (let index = 0; index < yearBlocks; index++) {
    const start = addCalendarMonths(schedule.repaymentStart, index * 12);
    const isLast = index === yearBlocks - 1;
    const end = isLast ? schedule.repaymentEnd : addCalendarMonths(start, 11);
    const base =
      index === 0 && current
        ? current
        : createLoanInterestRatePeriod();

    result.push({
      ...base,
      rateType: 'variable',
      interestRatePct: Number((currentRatePct + index * 0.1).toFixed(4)),
      startYear: index === 0 ? 0 : start.year,
      startMonth: index === 0 ? 0 : start.month,
      endYear: isLast ? 0 : end.year,
      endMonth: isLast ? 0 : end.month,
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
  const [rateType, setRateType] = useState<HousingRateType>(
    () => inferredRateType,
  );
  const [variableScenario, setVariableScenario] =
    useState<VariableRateScenario>(() =>
      inferredRateType === 'variable'
        ? inferVariableScenario(periods, schedule)
        : 'current',
    );

  useEffect(() => {
    const nextRateType = inferHousingRateType(periods);
    setRateType(nextRateType);
    setVariableScenario(
      nextRateType === 'variable'
        ? inferVariableScenario(periods, schedule)
        : 'current',
    );
  }, [fieldIdPrefix]);

  const firstPeriod = periods[0];
  const currentRatePct = firstPeriod?.interestRatePct ?? 0;
  const existingInitialFixedYears = resolveInitialFixedYears(periods, schedule);
  const hasExistingInitialFixed =
    inferHousingRateType(periods) === 'initial_fixed';
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
    setVariableScenario(scenario);

    if (scenario === 'current') {
      onChange(buildSinglePeriod(firstPeriod, 'variable', interestRatePct));
      return;
    }

    if (scenario === 'rise_01') {
      onChange(
        buildYearlyRisePeriods(firstPeriod, schedule, interestRatePct),
      );
    }
  };

  const handleRateTypeChange = (next: HousingRateType) => {
    setRateType(next);

    if (next === 'variable') {
      setVariableScenario('current');
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
      if (variableScenario === 'rise_01') {
        onChange(
          buildYearlyRisePeriods(firstPeriod, schedule, interestRatePct),
        );
      } else if (variableScenario === 'current') {
        onChange(buildSinglePeriod(firstPeriod, 'variable', interestRatePct));
      } else {
        const next = periods.map((period, index) =>
          index === 0
            ? { ...period, interestRatePct }
            : period,
        );
        onChange(next);
      }
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
    const secondStart = addCalendarMonths(firstEnd, 1);
    const first =
      periods[0] ??
      createLoanInterestRatePeriod({
        rateType: 'fixed',
        interestRatePct: fixedRate,
      });
    const second =
      hasExistingInitialFixed && periods[1]
        ? periods[1]
        : createLoanInterestRatePeriod({
            rateType: 'variable',
            interestRatePct: followingRate,
          });

    onChange([
      {
        ...first,
        rateType: 'fixed',
        interestRatePct: fixedRate,
        startYear: 0,
        startMonth: 0,
        endYear: firstEnd.year,
        endMonth: firstEnd.month,
      },
      {
        ...second,
        rateType: 'variable',
        interestRatePct: followingRate,
        startYear: secondStart.year,
        startMonth: secondStart.month,
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
              <option value="rise_01">金利上昇：毎年＋0.10%</option>
              <option value="custom">自分で設定</option>
            </select>
          </div>

          {variableScenario === 'current' ? (
            <p className="loan-rate-scenario-note">
              現在入力した金利が完済まで続く前提で試算します。
            </p>
          ) : null}

          {variableScenario === 'rise_01' ? (
            <p className="loan-rate-scenario-note">
              返済開始時の金利を基準に、1年ごとに0.10ポイントずつ上昇するシナリオを完済まで自動設定します。生成された条件は「自分で設定」に切り替えて調整できます。
            </p>
          ) : null}

          {variableScenario === 'custom' ? (
            <>
              <p className="loan-rate-scenario-note">
                将来の金利が変わる時期と金利を個別に設定します。
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
            key={`${fieldIdPrefix}-initial-${hasExistingInitialFixed ? periods.map((period) => period.id).join('-') : 'new'}`}
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
                <span>固定期間終了後の変動金利</span>
                <span className="loan-rate-scenario-native-input-wrap">
                  <input
                    className="ui-input loan-rate-scenario-native-input"
                    type="number"
                    name="followingRate"
                    min="0"
                    step="0.01"
                    defaultValue={
                      hasExistingInitialFixed
                        ? periods[1]?.interestRatePct ?? ''
                        : ''
                    }
                    placeholder="入力"
                    required
                  />
                  <span>%</span>
                </span>
              </label>
            </div>
            <p className="loan-rate-scenario-note">
              固定期間終了後の金利は自動補完せず、入力した値を使います。
            </p>
            <button
              type="submit"
              className="ui-btn ui-btn--secondary ui-btn--compact"
            >
              この金利条件を設定
            </button>
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
