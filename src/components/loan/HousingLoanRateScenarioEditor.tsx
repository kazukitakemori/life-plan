import { useEffect, useState, type FormEvent } from 'react';

import { createOwnedPropertyLoanSettings } from '../../lib/housingDefaults';
import {
  createLoanInterestRatePeriod,
  resolveInterestRatePeriodBounds,
  resolveLoanRepaymentSchedule,
} from '../../lib/loanInterestRatePeriod';
import { addCalendarMonths, calendarMonthIndex } from '../../lib/housingLoanAmortization';
import type {
  LoanInterestRatePeriod,
  LoanInterestRateType,
  OwnedProperty,
} from '../../types/housing';
import type { VehicleEntry } from '../../types/vehicle';
import { HousingManInput } from '../housing/HousingManInput';
import { LoanInterestRatePeriodsEditor } from './LoanInterestRatePeriodsEditor';

type HousingRateScenario =
  | 'variable'
  | 'fixed'
  | 'initial_fixed'
  | 'detailed';

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

function inferHousingRateScenario(
  periods: LoanInterestRatePeriod[],
): HousingRateScenario {
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

  return 'detailed';
}

function resolveInitialFixedYears(
  periods: LoanInterestRatePeriod[],
  schedule: ReturnType<typeof resolveLoanRepaymentSchedule>,
): number | null {
  if (inferHousingRateScenario(periods) !== 'initial_fixed') return null;
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
  const [scenario, setScenario] = useState<HousingRateScenario>(() =>
    inferHousingRateScenario(periods),
  );

  useEffect(() => {
    setScenario(inferHousingRateScenario(periods));
  }, [fieldIdPrefix]);

  const firstPeriod = periods[0];
  const existingInitialFixedYears = resolveInitialFixedYears(periods, schedule);
  const hasExistingInitialFixed =
    inferHousingRateScenario(periods) === 'initial_fixed';
  const maxInitialFixedYears = Math.max(
    0,
    Math.floor((schedule.totalMonths - 1) / 12),
  );

  const applySinglePeriodScenario = (rateType: LoanInterestRateType) => {
    if (!firstPeriod) return;
    onChange([
      {
        ...firstPeriod,
        rateType,
        startYear: 0,
        startMonth: 0,
        endYear: 0,
        endMonth: 0,
      },
    ]);
  };

  const handleScenarioChange = (next: HousingRateScenario) => {
    setScenario(next);
    if (next === 'variable') {
      applySinglePeriodScenario('variable');
    } else if (next === 'fixed') {
      applySinglePeriodScenario('fixed');
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
        <label htmlFor={`${fieldIdPrefix}-rate-scenario`}>
          金利の設定方法
        </label>
        <select
          id={`${fieldIdPrefix}-rate-scenario`}
          className="ui-select ui-select--compact loan-rate-scenario-select"
          value={scenario}
          onChange={(event) =>
            handleScenarioChange(event.target.value as HousingRateScenario)
          }
        >
          <option value="variable">変動金利（現在の金利を継続）</option>
          <option value="fixed">全期間固定</option>
          <option value="initial_fixed">当初固定 → その後変動</option>
          <option value="detailed">複数の金利期間を細かく設定</option>
        </select>
      </div>

      {scenario === 'variable' || scenario === 'fixed' ? (
        <div className="loan-rate-scenario-simple">
          <div className="loan-rate-scenario-rate-line">
            <span className="loan-rate-scenario-rate-label">
              {scenario === 'variable' ? '現在の変動金利' : '固定金利'}
            </span>
            {firstPeriod ? (
              <HousingManInput
                unified
                compact
                value={firstPeriod.interestRatePct}
                onChange={(interestRatePct) =>
                  onChange([
                    {
                      ...firstPeriod,
                      rateType: scenario === 'variable' ? 'variable' : 'fixed',
                      interestRatePct,
                      startYear: 0,
                      startMonth: 0,
                      endYear: 0,
                      endMonth: 0,
                    },
                  ])
                }
                unit="%"
                min={0}
                step={0.01}
              />
            ) : null}
            <span className="loan-rate-scenario-range">完済まで</span>
          </div>
          <p className="loan-rate-scenario-note">
            {scenario === 'variable'
              ? '入力した金利が完済まで続く前提で試算します。将来の金利変化も入れる場合は「複数の金利期間を細かく設定」を選びます。'
              : '入力した固定金利を完済まで適用して試算します。'}
          </p>
        </div>
      ) : null}

      {scenario === 'initial_fixed' ? (
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
              3項目を入力してから条件へ反映します。未入力の金利を自動補完して計算には使いません。
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
            返済期間が短いため、当初固定期間とその後の期間を分けて設定できません。
          </p>
        )
      ) : null}

      {scenario === 'detailed' ? (
        <>
          <p className="loan-rate-scenario-note">
            金利が変わる時期を複数設定する場合に使います。
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
