import { useEffect, useState } from 'react';
import { calcBirthYear, formatEndYearLabel } from '../../lib/birthDate';
import { resolveNewIncomeStartMonth } from '../../lib/incomeStartFlags';
import { getPeriodDependentAlerts } from '../../lib/dependentAlerts';
import {
  validateDependentMemberPeriod,
  validatePeriodDependentSettings,
} from '../../lib/dependentValidation';
import {
  calcMonthlyAmountManFromAnnual,
  calcPeriodAnnualAmountFromMonthly,
  isSingleMonthIncomePeriod,
  roundAmountMan,
} from '../../lib/incomeAmount';
import {
  calcAnnualIncreaseRateFromEnd,
  calcEndAnnualAmountMan,
  calcPeriodIncreaseYears,
} from '../../lib/incomeIncreaseRate';
import {
  DEPENDENT_INELIGIBLE_ALERT,
  DEPENDENT_STATUS_LABELS,
  DEPENDENT_STATUS_OPTIONS,
  formatPeriodSocialInsuranceDependentStatus,
  formatPeriodTaxDependentStatus,
  getIncomeEntryDisplayLabel,
  getIncomeStreamDisplayLabel,
  getSpouseTaxDependentGuide,
  periodSocialInsuranceDependentStatusClass,
  periodTaxDependentStatusClass,
  FILING_TYPE_LABELS,
  FILING_TYPE_OPTIONS,
  getStreamTypeOptions,
  incomeCategoryShowsBonus,
  incomeCategoryShowsDependentSettings,
  incomeCategoryShowsLumpSum,
  incomeCategoryShowsRetirementAllowance,
  isStreamTypeFixed,
} from '../../lib/incomeLabels';
import { getIncomeEntryGuidanceNote } from '../../lib/incomeGuidance';
import {
  isBusinessIncomeStream,
  isExpenseInputStream,
} from '../../lib/incomeBreakdown';
import { createFollowUpPeriod } from '../../lib/incomePeriod';
import {
  createRetirementAllowanceEntry,
  resolveRetirementEnrollmentYears,
} from '../../lib/retirementAllowance';
import type { RetirementAllowanceEntry } from '../../types/income';
import {
  canConfigureDependentInQ7,
  dependentFieldsForMemberSelection,
  usesQ1DependentDefaults,
} from '../../lib/memberDependentDefaults';
import {
  resolveAutoPeriodDependent,
  syncPeriodWithAutoDependent,
  type PeriodDependentResolutionContext,
} from '../../lib/periodDependentResolution';
import type { FamilyMember } from '../../types/family';
import type {
  FilingType,
  IncomeBonus,
  IncomeByMember,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
} from '../../types/income';
import { DisclosureSection, FormField, FormSelect } from '../ui';

interface IncomeEntryCardProps {
  entry: IncomeEntry;
  member: FamilyMember;
  memberEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  index: number;
  onChange: (entry: IncomeEntry) => void;
  onRemove: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);
const DEFAULT_PERIOD_END_AGE = 60;
const DEFAULT_PERIOD_END_MONTH = 3;

function createPeriodId(): string {
  return crypto.randomUUID();
}

function withPeriodAnnualAmount(
  period: IncomePeriod,
  overrides: Partial<IncomePeriod> = {},
): IncomePeriod {
  const next = { ...period, ...overrides };
  return {
    ...next,
    annualAmountMan: calcPeriodAnnualAmountFromMonthly(next),
  };
}

function withSyncedLumpSumEnd(
  period: IncomePeriod,
  overrides: Partial<IncomePeriod>,
): IncomePeriod {
  const next = { ...period, ...overrides };
  if (isSingleMonthIncomePeriod(period)) {
    next.endAge = next.startAge;
    next.endMonth = next.startMonth;
  }
  return withPeriodAnnualAmount(next);
}

interface PeriodDependentSettingsProps {
  period: IncomePeriod;
  entry: IncomeEntry;
  member: FamilyMember;
  memberEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  calendarYear: number;
  onChange: (updated: IncomePeriod) => void;
}

function PeriodDependentSettings({
  period,
  entry,
  member,
  memberEntries,
  familyMembers,
  incomeByMember,
  referenceDate,
  calendarYear,
  onChange,
}: PeriodDependentSettingsProps) {
  const [dependentIneligibleAlert, setDependentIneligibleAlert] =
    useState(false);
  const dependentIssues =
    member.role === 'child' || member.role === 'other'
      ? validateDependentMemberPeriod(
          member,
          entry,
          period,
          memberEntries,
          calendarYear,
        )
      : validatePeriodDependentSettings(
          member,
          entry,
          period,
          familyMembers,
          memberEntries,
          calendarYear,
        );
  const dependentAlerts = getPeriodDependentAlerts(member, entry, period);
  const isQ1LinkedMember = usesQ1DependentDefaults(member);
  const canConfigureDependent = canConfigureDependentInQ7(member);
  const dependentContext: PeriodDependentResolutionContext = {
    familyMembers,
    incomeByMember,
    referenceDate,
  };
  const resolvedDependent = resolveAutoPeriodDependent(
    member,
    entry,
    period,
    memberEntries,
    calendarYear,
    dependentContext,
  );

  const emitPeriod = (updated: IncomePeriod) => {
    onChange(
      syncPeriodWithAutoDependent(
        member,
        entry,
        updated,
        memberEntries,
        calendarYear,
        dependentContext,
      ),
    );
  };

  useEffect(() => {
    if (resolvedDependent.canSelectDependent) {
      setDependentIneligibleAlert(false);
    }
  }, [resolvedDependent.canSelectDependent]);

  useEffect(() => {
    if (
      period.dependentStatus === 'dependent' &&
      !resolvedDependent.canSelectDependent
    ) {
      emitPeriod({
        ...period,
        dependentStatus: 'none',
        taxDependent: false,
        socialInsuranceDependent: false,
      });
    }
  }, [
    period.dependentStatus,
    resolvedDependent.canSelectDependent,
    period.id,
  ]);

  useEffect(() => {
    setDependentIneligibleAlert(false);
  }, [period.id, period.annualAmountMan, period.monthlyAmountMan]);

  return (
    <div
      className={`income-period-dependent-status ${dependentIssues.length > 0 ? 'income-period-dependent-status--error' : ''}`}
    >
      <span className="income-period-dependent-label">扶養設定</span>
      {isQ1LinkedMember && !canConfigureDependent ? (
        <p className="income-period-dependent-q1-note">
          ご家族で扶養設定がすべてオフのため、この期間では扶養に入れません。
        </p>
      ) : (
        <div className="income-period-dependent-options">
          {DEPENDENT_STATUS_OPTIONS.map((status) => (
            <label
              key={status}
              className="income-period-dependent-option"
              onClick={(e) => {
                if (
                  status !== 'dependent' ||
                  resolvedDependent.canSelectDependent
                ) {
                  return;
                }
                e.preventDefault();
                setDependentIneligibleAlert(true);
              }}
            >
              <input
                type="radio"
                name={`dependent-status-${period.id}`}
                value={status}
                checked={period.dependentStatus === status}
                onChange={() => {
                  if (
                    status === 'dependent' &&
                    !resolvedDependent.canSelectDependent
                  ) {
                    setDependentIneligibleAlert(true);
                    return;
                  }
                  setDependentIneligibleAlert(false);
                  emitPeriod({
                    ...period,
                    ...dependentFieldsForMemberSelection(
                      member,
                      status === 'dependent',
                    ),
                  });
                }}
              />
              <span>{DEPENDENT_STATUS_LABELS[status]}</span>
            </label>
          ))}
        </div>
      )}
      {dependentIneligibleAlert && (
        <p
          className="income-period-dependent-q1-note income-period-dependent-q1-note--warning"
          role="alert"
        >
          {DEPENDENT_INELIGIBLE_ALERT}
        </p>
      )}
      {period.dependentStatus === 'dependent' && canConfigureDependent && (
        <div className="income-period-dependent-groups">
          <div className="income-period-dependent-group">
            <span className="income-period-dependent-group-label">
              税制上の扶養
            </span>
            <span
              className={`income-period-dependent-auto-status ${periodTaxDependentStatusClass(resolvedDependent.taxStatus)}`}
            >
              {formatPeriodTaxDependentStatus(resolvedDependent.taxStatus)}
            </span>
            {member.role === 'spouse' && (
              <p className="income-period-dependent-q1-note">
                {getSpouseTaxDependentGuide(calendarYear)}
              </p>
            )}
            {resolvedDependent.headSpouseDeductionBlocked && (
              <p className="income-period-dependent-q1-note income-period-dependent-q1-note--warning">
                世帯主の合計所得が1,000万円を超えるため、配偶者控除・配偶者特別控除は適用されません。
              </p>
            )}
          </div>
          <div className="income-period-dependent-group">
            <span className="income-period-dependent-group-label">
              社会保険の扶養
            </span>
            <span
              className={`income-period-dependent-auto-status ${periodSocialInsuranceDependentStatusClass(resolvedDependent.socialInsuranceStatus)}`}
            >
              {formatPeriodSocialInsuranceDependentStatus(
                resolvedDependent.socialInsuranceStatus,
              )}
            </span>
          </div>
        </div>
      )}
      {isQ1LinkedMember && canConfigureDependent && (
        <p className="income-period-dependent-q1-note">
          ご家族の扶養設定に連動しています。税制上・社会保険の扶養は収入から自動判定されます。
        </p>
      )}
      {dependentAlerts.length > 0 && (
        <ul className="income-period-dependent-alerts">
          {dependentAlerts.map((alert) => (
            <li key={alert.id}>{alert.message}</li>
          ))}
        </ul>
      )}
      {dependentIssues.length > 0 && (
        <ul className="income-period-dependent-errors">
          {dependentIssues.map((issue) => (
            <li key={issue.id}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PeriodRowProps {
  period: IncomePeriod;
  periodIndex: number;
  entry: IncomeEntry;
  member: FamilyMember;
  memberEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
  birthYear: number;
  birthMonth: number;
  calendarYear: number;
  startAgeOptions: number[];
  streamFixed: boolean;
  streamOptions: IncomeStreamType[];
  showExpenseColumn: boolean;
  showFilingColumn: boolean;
  showBonus: boolean;
  showLumpSum: boolean;
  showDependentStatus: boolean;
  canRemove: boolean;
  onChange: (updated: IncomePeriod) => void;
  onRemove: () => void;
  onEntryChange: (entry: IncomeEntry) => void;
}

function PeriodRow({
  period,
  periodIndex,
  entry,
  member,
  memberEntries,
  familyMembers,
  incomeByMember,
  referenceDate,
  birthYear,
  birthMonth,
  calendarYear,
  startAgeOptions,
  streamFixed,
  streamOptions,
  showExpenseColumn,
  showFilingColumn,
  showBonus,
  showLumpSum,
  showDependentStatus,
  canRemove,
  onChange,
  onRemove,
  onEntryChange,
}: PeriodRowProps) {
  const isLumpSumPeriod = isSingleMonthIncomePeriod(period);
  const [annualInput, setAnnualInput] = useState<string | null>(null);
  const [endAnnualInput, setEndAnnualInput] = useState<string | null>(null);
  const dependentContext: PeriodDependentResolutionContext = {
    familyMembers,
    incomeByMember,
    referenceDate,
  };
  const newIncomeStartMonth =
    periodIndex === 0
      ? resolveNewIncomeStartMonth(
          {
            ...entry,
            periods: entry.periods.map((p) =>
              p.id === period.id ? period : p,
            ),
          },
          member,
          referenceDate,
        )
      : null;

  const increaseYears = calcPeriodIncreaseYears(period, birthYear);
  const endAnnualAmountMan = calcEndAnnualAmountMan(
    period.annualAmountMan,
    period.annualIncreaseRate,
    increaseYears,
  );
  const canEditEndAnnual =
    increaseYears > 0 && period.annualAmountMan > 0;

  const emitPeriod = (updated: IncomePeriod) => {
    onChange(
      syncPeriodWithAutoDependent(
        member,
        entry,
        updated,
        memberEntries,
        calendarYear,
        dependentContext,
      ),
    );
  };

  useEffect(() => {
    setAnnualInput(null);
  }, [period.id, period.annualAmountMan, period.monthlyAmountMan]);

  useEffect(() => {
    setEndAnnualInput(null);
  }, [
    period.id,
    period.annualAmountMan,
    period.annualIncreaseRate,
    period.startAge,
    period.startMonth,
    period.endAge,
    period.endMonth,
  ]);

  const setMonthly = (monthlyAmountMan: number) => {
    emitPeriod(
      withPeriodAnnualAmount(period, {
        monthlyAmountMan: roundAmountMan(monthlyAmountMan),
      }),
    );
  };

  const setAnnual = (annualMan: number) => {
    const annualAmountMan = roundAmountMan(annualMan);
    const monthlyAmountMan = calcMonthlyAmountManFromAnnual(
      annualAmountMan,
      period.bonuses,
      isLumpSumPeriod,
    );
    emitPeriod({
      ...period,
      monthlyAmountMan,
      annualAmountMan,
    });
  };

  const commitAnnualInput = () => {
    if (annualInput === null) return;
    const parsed = Number(annualInput);
    setAnnual(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
    setAnnualInput(null);
  };

  const commitEndAnnualInput = () => {
    if (endAnnualInput === null) return;
    if (!canEditEndAnnual) {
      setEndAnnualInput(null);
      return;
    }
    const parsed = Number(endAnnualInput);
    const endMan = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const nextRate = calcAnnualIncreaseRateFromEnd(
      period.annualAmountMan,
      endMan,
      increaseYears,
    );
    setEndAnnualInput(null);
    if (nextRate == null) return;
    emitPeriod({
      ...period,
      annualIncreaseRate: nextRate,
    });
  };

  const updateBonus = (
    bonusId: string,
    patch: Partial<Pick<IncomeBonus, 'amountMan' | 'paymentMonth'>>,
  ) => {
    const bonuses = period.bonuses.map((b) =>
      b.id === bonusId ? { ...b, ...patch } : b,
    );
    emitPeriod(withPeriodAnnualAmount(period, { bonuses }));
  };

  const addBonus = () => {
    const bonuses: IncomeBonus[] = [
      ...period.bonuses,
      { id: crypto.randomUUID(), amountMan: 0, paymentMonth: 6 },
    ];
    emitPeriod(withPeriodAnnualAmount(period, { bonuses }));
  };

  const removeBonus = (bonusId: string) => {
    const bonuses = period.bonuses.filter((b) => b.id !== bonusId);
    emitPeriod(withPeriodAnnualAmount(period, { bonuses }));
  };

  const toggleLumpSumPeriod = () => {
    if (isLumpSumPeriod) {
      emitPeriod(
        withPeriodAnnualAmount({
          ...period,
          endAge: period.lumpSumRestoreEndAge ?? DEFAULT_PERIOD_END_AGE,
          endMonth: period.lumpSumRestoreEndMonth ?? DEFAULT_PERIOD_END_MONTH,
          lumpSumRestoreEndAge: null,
          lumpSumRestoreEndMonth: null,
        }),
      );
      return;
    }

    emitPeriod(
      withPeriodAnnualAmount({
        ...period,
        lumpSumRestoreEndAge: period.endAge,
        lumpSumRestoreEndMonth: period.endMonth,
        endAge: period.startAge,
        endMonth: period.startMonth,
      }),
    );
  };

  const updatePeriodEnd = (
    patch: Partial<Pick<IncomePeriod, 'endAge' | 'endMonth'>>,
  ) => {
    const next = { ...period, ...patch };
    const stillLumpSum = isSingleMonthIncomePeriod(next);
    emitPeriod(
      withPeriodAnnualAmount({
        ...next,
        lumpSumRestoreEndAge: stillLumpSum ? next.lumpSumRestoreEndAge : null,
        lumpSumRestoreEndMonth: stillLumpSum ? next.lumpSumRestoreEndMonth : null,
      }),
    );
  };

  return (

    <article className="income-period-card">

      <div className="income-period-card-top">

        <div className="income-period-card-identity">

          <div className="income-field">

            <span className="income-field-label">収入形態</span>

            {streamFixed ? (

              <span className="stream-type-fixed">

                {getIncomeStreamDisplayLabel(entry, period.streamType)}

              </span>

            ) : (

              <FormSelect

                wide

                value={period.streamType}

                onValueChange={(raw) =>

                  emitPeriod({

                    ...period,

                    streamType: raw as IncomeStreamType,

                  })

                }

                options={streamOptions.map((type) => ({

                  value: type,

                  label: getIncomeStreamDisplayLabel(entry, type),

                }))}

              />

            )}

          </div>



          {canRemove ? (

            <button

              type="button"

              className="ui-btn ui-btn--ghost"

              onClick={onRemove}

            >

              期間を削除

            </button>

          ) : null}

        </div>



        <div className="income-field">

          <span className="income-field-label">期間</span>

          <div

            className={`income-period-range${showLumpSum ? ' income-period-range--lump' : ''}`}

          >

            <FormSelect

              compact

              value={period.startAge}

              aria-label="開始年齢"

              onValueChange={(raw) => {
                emitPeriod(
                  withSyncedLumpSumEnd(period, {
                    startAge: Number(raw),
                  }),
                );
              }}

              options={startAgeOptions.map((age) => ({

                value: age,

                label: `${age}才`,

              }))}

            />

            <FormSelect

              compact

              value={period.startMonth}

              aria-label="開始月"

              onValueChange={(raw) =>

                emitPeriod(

                  withSyncedLumpSumEnd(period, {

                    startMonth: Number(raw),

                  }),

                )

              }

              options={MONTHS.map((m) => ({

                value: m,

                label: `${m}月`,

              }))}

            />

            <span className="income-period-arrow" aria-hidden>

              →

            </span>

            <FormSelect

              compact

              value={period.endAge}

              aria-label="終了年齢"

              onValueChange={(raw) => updatePeriodEnd({ endAge: Number(raw) })}

              options={END_AGES.map((a) => ({

                value: a,

                label: `${a}才`,

              }))}

            />

            <FormSelect

              compact

              value={period.endMonth}

              aria-label="終了月"

              onValueChange={(raw) => updatePeriodEnd({ endMonth: Number(raw) })}

              options={MONTHS.map((m) => ({

                value: m,

                label: `${m}月`,

              }))}

            />

            {showLumpSum ? (

              <div className="income-period-lump-row">

                <p className="income-period-year-note">

                  {formatEndYearLabel(

                    period.endAge,

                    period.endMonth,

                    birthYear,

                    birthMonth,

                  )}

                </p>

                <button

                  type="button"

                  className={`ui-btn ui-btn--ghost${isLumpSumPeriod ? ' is-active' : ''}`}

                  onClick={toggleLumpSumPeriod}

                  aria-pressed={isLumpSumPeriod}

                  title="一時金の期間（単月）に切り替えます。もう一度押すと元の期間に戻ります"

                >

                  一時金

                </button>

              </div>

            ) : (

              <p className="income-period-year-note">

                {formatEndYearLabel(

                  period.startAge,

                  period.startMonth,

                  birthYear,

                  birthMonth,

                )}

                {' 〜 '}

                {formatEndYearLabel(

                  period.endAge,

                  period.endMonth,

                  birthYear,

                  birthMonth,

                )}

              </p>

            )}

          </div>

        </div>

      </div>



      <div className="income-period-amounts">

        <div className="income-field">

          <span className="income-field-label">月額</span>

          <div className="ui-amount">

            <input

              type="number"

              className="ui-input ui-input--amount"

              value={period.monthlyAmountMan}

              min={0}

              step={0.1}

              onChange={(e) => setMonthly(Number(e.target.value) || 0)}

            />

            <span className="ui-amount-unit">万円</span>

          </div>

        </div>



        {showBonus ? (

          <div className="income-field income-field--bonus">

            <span className="income-field-label">賞与</span>

            <div className="income-bonus-list">

              {period.bonuses.map((bonus) => (

                <div key={bonus.id} className="income-bonus-row">

                  <FormSelect

                    compact

                    value={bonus.paymentMonth}

                    aria-label="賞与支給月"

                    onValueChange={(raw) =>

                      updateBonus(bonus.id, {

                        paymentMonth: Number(raw),

                      })

                    }

                    options={MONTHS.map((m) => ({

                      value: m,

                      label: `${m}月`,

                    }))}

                  />

                  <div className="ui-amount">

                    <input

                      type="number"

                      className="ui-input ui-input--amount"

                      value={bonus.amountMan}

                      min={0}

                      step={0.1}

                      onChange={(e) =>

                        updateBonus(bonus.id, {

                          amountMan: roundAmountMan(Number(e.target.value) || 0),

                        })

                      }

                    />

                    <span className="ui-amount-unit">万円</span>

                  </div>

                  <button

                    type="button"

                    className="ui-btn ui-btn--ghost"

                    onClick={() => removeBonus(bonus.id)}

                    aria-label="賞与を削除"

                  >

                    削除

                  </button>

                </div>

              ))}

              <button

                type="button"

                className="ui-btn ui-btn--ghost"

                onClick={addBonus}

              >

                賞与を追加

              </button>

            </div>

          </div>

        ) : null}



        <div className="income-field">

          <span className="income-field-label">年額</span>

          <div className="ui-amount">

            <input

              type="number"

              className="ui-input ui-input--amount"

              value={annualInput ?? period.annualAmountMan}

              min={0}

              step={0.1}

              onFocus={() => setAnnualInput(String(period.annualAmountMan))}

              onChange={(e) => setAnnualInput(e.target.value)}

              onBlur={commitAnnualInput}

              onKeyDown={(e) => {

                if (e.key === 'Enter') {

                  e.currentTarget.blur();

                }

              }}

            />

            <span className="ui-amount-unit">万円</span>

          </div>

        </div>

      </div>



      <DisclosureSection

        className="income-period-details"

        title="詳細設定"

        summary={

          [

            periodIndex === 0 && newIncomeStartMonth != null
              ? '新しい収入'
              : null,

            '上昇率',

            showExpenseColumn && isExpenseInputStream(period.streamType)

              ? '経費'

              : null,

            showFilingColumn && isBusinessIncomeStream(period.streamType)

              ? '申告'

              : null,

            showDependentStatus ? '扶養' : null,

          ]

            .filter(Boolean)

            .join(' · ') || 'オプション'

        }

      >

        <div className="income-period-advanced">

          {periodIndex === 0 && newIncomeStartMonth != null ? (

            <FormField

              label="新しい収入"

              hint="就職、開業などの場合はチェックを入れてください。"

              className="income-new-income-field"

            >

              <label className="income-new-income-flag">

                <input

                  type="checkbox"

                  checked={entry.isNewIncomeFromStart}

                  onChange={(e) =>

                    onEntryChange({

                      ...entry,

                      isNewIncomeFromStart: e.target.checked,

                    })

                  }

                />

                <span>{newIncomeStartMonth}月から始まる新しい収入</span>

              </label>

            </FormField>

          ) : null}

          <div className="income-rate-row">

            <div className="income-field">

              <span className="income-field-label">上昇率</span>

              <div className="ui-amount">

                <input

                  type="number"

                  className="ui-input ui-input--amount"

                  value={period.annualIncreaseRate ?? 0}

                  step={0.1}

                  aria-label="年間上昇率"

                  onChange={(e) =>

                    emitPeriod({

                      ...period,

                      annualIncreaseRate: e.target.value

                        ? Number(e.target.value)

                        : 0,

                    })

                  }

                />

                <span className="ui-amount-unit">%/年</span>

              </div>

            </div>

            <div className="income-field">

              <span className="income-field-label">終了時年収</span>

              <div className="ui-amount">

                <input

                  type="number"

                  className="ui-input ui-input--amount"

                  value={endAnnualInput ?? endAnnualAmountMan}

                  min={0}

                  step={0.1}

                  disabled={!canEditEndAnnual}

                  aria-label="期間終了時の年収"

                  title={

                    canEditEndAnnual

                      ? '期間終了時の年収。変更すると上昇率を逆算します'

                      : '期間が12か月未満のため上昇は適用されません'

                  }

                  onFocus={() => {

                    if (!canEditEndAnnual) return;

                    setEndAnnualInput(String(endAnnualAmountMan));

                  }}

                  onChange={(e) => setEndAnnualInput(e.target.value)}

                  onBlur={commitEndAnnualInput}

                  onKeyDown={(e) => {

                    if (e.key === 'Enter') {

                      e.currentTarget.blur();

                    }

                  }}

                />

                <span className="ui-amount-unit">万円</span>

              </div>

            </div>

          </div>



          {showExpenseColumn && isExpenseInputStream(period.streamType) ? (

            <div className="income-field">

              <span className="income-field-label">経費</span>

              <div className="ui-amount">

                <input

                  type="number"

                  className="ui-input ui-input--amount"

                  value={entry.expenseManPerMonth ?? 0}

                  min={0}

                  onChange={(e) =>

                    onEntryChange({

                      ...entry,

                      expenseManPerMonth: Number(e.target.value) || 0,

                    })

                  }

                />

                <span className="ui-amount-unit">万円/月</span>

              </div>

            </div>

          ) : null}



          {showFilingColumn &&

          isBusinessIncomeStream(period.streamType) &&

          periodIndex ===

            entry.periods.findIndex((p) =>

              isBusinessIncomeStream(p.streamType),

            ) ? (

            <div className="income-field">

              <span className="income-field-label">申告タイプ</span>

              <FormSelect

                wide

                value={entry.filingType ?? 'blue_65'}

                onValueChange={(raw) =>

                  onEntryChange({

                    ...entry,

                    filingType: raw as FilingType,

                  })

                }

                options={FILING_TYPE_OPTIONS.map((type) => ({

                  value: type,

                  label: FILING_TYPE_LABELS[type],

                }))}

              />

            </div>

          ) : null}



          {showDependentStatus ? (

            <PeriodDependentSettings

              period={period}

              entry={entry}

              member={member}

              memberEntries={memberEntries}

              familyMembers={familyMembers}

              incomeByMember={incomeByMember}

              referenceDate={referenceDate}

              calendarYear={calendarYear}

              onChange={onChange}

            />

          ) : null}

        </div>

      </DisclosureSection>

    </article>

  );

}

export function IncomeEntryCard({
  entry,
  member,
  memberEntries,
  familyMembers,
  incomeByMember,
  referenceDate,
  index,
  onChange,
  onRemove,
}: IncomeEntryCardProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const calendarYear = referenceDate.getFullYear();
  const showFilingColumn = entry.periods.some((p) =>
    isBusinessIncomeStream(p.streamType),
  );
  const showExpenseColumn = entry.periods.some((p) =>
    isExpenseInputStream(p.streamType),
  );
  const showBonus = incomeCategoryShowsBonus(entry.category);
  const showLumpSum = incomeCategoryShowsLumpSum(entry.category);
  const showDependentStatus =
    incomeCategoryShowsDependentSettings(entry.category) &&
    (member.role === 'head' ||
      member.role === 'spouse' ||
      member.role === 'child' ||
      member.role === 'other');
  const showRetirementAllowance = incomeCategoryShowsRetirementAllowance(
    entry.category,
  );
  const retirementAllowances = showRetirementAllowance
    ? (entry.retirementAllowances ?? [])
    : [];
  const ageOptions = Array.from(
    { length: Math.max(member.expectedLifespan, member.age ?? 0) + 1 },
    (_, i) => i,
  );
  const streamFixed =
    isStreamTypeFixed(entry.category) ||
    entry.incomePurpose === 'side_business';
  const streamOptions = getStreamTypeOptions(entry.category);
  const maxPeriodAge = Math.max(
    member.age ?? 0,
    member.expectedLifespan,
    ...entry.periods.flatMap((p) => [p.startAge, p.endAge]),
  );
  const startAgeOptions = Array.from({ length: maxPeriodAge + 1 }, (_, i) => i);
  const guidanceNote = getIncomeEntryGuidanceNote(entry, memberEntries);
  const dependentContext: PeriodDependentResolutionContext = {
    familyMembers,
    incomeByMember,
    referenceDate,
  };

  useEffect(() => {
    if (!entry.isNewIncomeFromStart) return;
    if (resolveNewIncomeStartMonth(entry, member, referenceDate) != null) {
      return;
    }
    onChange({ ...entry, isNewIncomeFromStart: false });
  }, [entry, member, referenceDate, onChange]);

  const syncEntryChange = (updatedEntry: IncomeEntry) => {
    const syncedEntries = memberEntries.map((e) =>
      e.id === updatedEntry.id ? updatedEntry : e,
    );
    onChange({
      ...updatedEntry,
      periods: updatedEntry.periods.map((p) =>
        syncPeriodWithAutoDependent(
          member,
          updatedEntry,
          p,
          syncedEntries,
          calendarYear,
          dependentContext,
        ),
      ),
    });
  };

  const updatePeriod = (periodId: string, updated: IncomePeriod) => {
    onChange({
      ...entry,
      periods: entry.periods.map((p) => (p.id === periodId ? updated : p)),
    });
  };

  const removePeriod = (periodId: string) => {
    if (entry.periods.length <= 1) return;
    onChange({
      ...entry,
      periods: entry.periods.filter((p) => p.id !== periodId),
    });
  };

  const addPeriod = () => {
    const last = entry.periods[entry.periods.length - 1];
    onChange({
      ...entry,
      periods: [
        ...entry.periods,
        createFollowUpPeriod(
          last,
          createPeriodId(),
          member.expectedLifespan,
        ),
      ],
    });
  };

  const addRetirementAllowance = () => {
    onChange({
      ...entry,
      retirementAllowances: [
        ...retirementAllowances,
        createRetirementAllowanceEntry(member),
      ],
    });
  };

  const updateRetirementAllowance = (
    id: string,
    patch: Partial<RetirementAllowanceEntry>,
  ) => {
    onChange({
      ...entry,
      retirementAllowances: retirementAllowances.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  const removeRetirementAllowance = (id: string) => {
    onChange({
      ...entry,
      retirementAllowances: retirementAllowances.filter((item) => item.id !== id),
    });
  };

  return (
    <div className="income-entry">
      <div className="income-entry-header">
        <div className="income-entry-header-left">
          <span className="income-entry-index">{index + 1}</span>
          <span className="occupation-badge">
            {getIncomeEntryDisplayLabel(entry)}
          </span>
        </div>
        <div className="income-entry-header-right">
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={onRemove}
          >
            削除
          </button>
        </div>
      </div>

      {guidanceNote ? (
        <p className="income-entry-guidance">{guidanceNote}</p>
      ) : null}

      <div className="income-period-list">
        {entry.periods.map((period, periodIndex) => (
          <PeriodRow
            key={period.id}
            period={period}
            periodIndex={periodIndex}
            entry={entry}
            member={member}
            memberEntries={memberEntries}
            familyMembers={familyMembers}
            incomeByMember={incomeByMember}
            referenceDate={referenceDate}
            birthYear={birthYear}
            birthMonth={member.birthMonth ?? 1}
            calendarYear={calendarYear}
            startAgeOptions={startAgeOptions}
            streamFixed={streamFixed}
            streamOptions={streamOptions}
            showExpenseColumn={showExpenseColumn}
            showFilingColumn={showFilingColumn}
            showBonus={showBonus}
            showLumpSum={showLumpSum}
            showDependentStatus={showDependentStatus}
            canRemove={entry.periods.length > 1}
            onChange={(updated) => updatePeriod(period.id, updated)}
            onRemove={() => removePeriod(period.id)}
            onEntryChange={syncEntryChange}
          />
        ))}
      </div>

      {retirementAllowances.length > 0 ? (
        <DisclosureSection
          className="income-retirement-disclosure"
          title="退職金"
          summary={`${retirementAllowances.length}件`}
          defaultOpen
        >
        <div className="income-retirement-list">
          {retirementAllowances.map((allowance, allowanceIndex) => {
            return (
              <div
                key={allowance.id}
                className="income-retirement-card"
              >
                <div className="income-retirement-card-header">
                  <span className="income-retirement-card-title">
                    退職金 {allowanceIndex + 1}
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn--danger"
                    onClick={() => removeRetirementAllowance(allowance.id)}
                  >
                    削除
                  </button>
                </div>
                                <div className="income-retirement-fields">
                  <div className="income-field">
                    <span className="income-field-label">受取額</span>
                    <div className="ui-amount">
                      <input
                        type="number"
                        className="ui-input ui-input--amount"
                        min={0}
                        step={10}
                        value={allowance.amountMan}
                        onChange={(e) =>
                          updateRetirementAllowance(allowance.id, {
                            amountMan: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="ui-amount-unit">万円</span>
                    </div>
                  </div>
                  <div className="income-field">
                    <span className="income-field-label">勤続年数</span>
                    <div className="income-retirement-years">
                      <FormSelect
                        value={allowance.enrollmentMode}
                        aria-label="勤続年数の入力方法"
                        onValueChange={(raw) =>
                          updateRetirementAllowance(allowance.id, {
                            enrollmentMode: raw as 'years' | 'period',
                          })
                        }
                        options={[
                          { value: 'years', label: '年数を入力' },
                          { value: 'period', label: '期間を入力' },
                        ]}
                      />
                      {allowance.enrollmentMode === 'period' ? (
                        <div className="income-retirement-period-row">
                          <FormSelect
                            compact
                            value={allowance.enrollmentStartAge}
                            aria-label="勤続開始年齢"
                            onValueChange={(raw) =>
                              updateRetirementAllowance(allowance.id, {
                                enrollmentStartAge: Number(raw),
                              })
                            }
                            options={ageOptions.map((age) => ({
                              value: age,
                              label: `${age}歳`,
                            }))}
                          />
                          <FormSelect
                            compact
                            value={allowance.enrollmentStartMonth}
                            aria-label="勤続開始月"
                            onValueChange={(raw) =>
                              updateRetirementAllowance(allowance.id, {
                                enrollmentStartMonth: Number(raw),
                              })
                            }
                            options={MONTHS.map((m) => ({
                              value: m,
                              label: `${m}月`,
                            }))}
                          />
                          <span className="income-period-arrow" aria-hidden>
                            →
                          </span>
                          <FormSelect
                            compact
                            value={allowance.enrollmentEndAge}
                            aria-label="勤続終了年齢"
                            onValueChange={(raw) =>
                              updateRetirementAllowance(allowance.id, {
                                enrollmentEndAge: Number(raw),
                              })
                            }
                            options={ageOptions.map((age) => ({
                              value: age,
                              label: `${age}歳`,
                            }))}
                          />
                          <FormSelect
                            compact
                            value={allowance.enrollmentEndMonth}
                            aria-label="勤続終了月"
                            onValueChange={(raw) =>
                              updateRetirementAllowance(allowance.id, {
                                enrollmentEndMonth: Number(raw),
                              })
                            }
                            options={MONTHS.map((m) => ({
                              value: m,
                              label: `${m}月`,
                            }))}
                          />
                          <span className="income-retirement-period-years">
                            （{resolveRetirementEnrollmentYears(allowance)}年）
                          </span>
                        </div>
                      ) : (
                        <div className="ui-amount">
                          <input
                            type="number"
                            className="ui-input ui-input--amount"
                            min={1}
                            step={1}
                            value={allowance.enrollmentYears}
                            aria-label="勤続年数"
                            onChange={(e) =>
                              updateRetirementAllowance(allowance.id, {
                                enrollmentYears: Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                ),
                              })
                            }
                          />
                          <span className="ui-amount-unit">年</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="income-field">
                    <span className="income-field-label">受取時期</span>
                    <div className="income-retirement-when">
                      <FormSelect
                        compact
                        value={allowance.receiveAge}
                        aria-label="退職金の受取年齢"
                        onValueChange={(raw) =>
                          updateRetirementAllowance(allowance.id, {
                            receiveAge: Number(raw),
                          })
                        }
                        options={ageOptions.map((age) => ({
                          value: age,
                          label: `${age}歳`,
                        }))}
                      />
                      <FormSelect
                        compact
                        value={allowance.receiveMonth}
                        aria-label="退職金の受取月"
                        onValueChange={(raw) =>
                          updateRetirementAllowance(allowance.id, {
                            receiveMonth: Number(raw),
                          })
                        }
                        options={MONTHS.map((m) => ({
                          value: m,
                          label: `${m}月`,
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </DisclosureSection>
      ) : null}

      <div className="income-entry-footer">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={addPeriod}>
          期間を追加
        </button>
        {showRetirementAllowance ? (
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={addRetirementAllowance}
          >
            退職金を追加
          </button>
        ) : null}
      </div>
    </div>
  );
}
