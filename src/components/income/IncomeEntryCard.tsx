import { calcBirthYear, formatEndYearLabel } from '../../lib/birthDate';
import { getPeriodDependentAlerts } from '../../lib/dependentAlerts';
import {
  validateDependentMemberPeriod,
  validatePeriodDependentSettings,
} from '../../lib/dependentValidation';
import {
  calcPeriodAnnualAmountMan,
  isSingleMonthIncomePeriod,
} from '../../lib/incomeAmount';
import {
  DEPENDENT_STATUS_LABELS,
  DEPENDENT_STATUS_OPTIONS,
  SOCIAL_INSURANCE_DEPENDENT_LABEL,
  SOCIAL_INSURANCE_DEPENDENT_LABEL_CHILD_OTHER,
  TAX_DEPENDENT_LABEL,
  TAX_DEPENDENT_LABEL_CHILD_OTHER,
  FILING_TYPE_LABELS,
  FILING_TYPE_OPTIONS,
  getStreamTypeOptions,
  INCOME_CATEGORY_LABELS,
  INCOME_STREAM_LABELS,
  incomeCategoryShowsBonus,
  incomeCategoryShowsDependentSettings,
  incomeCategoryShowsLumpSum,
  isStreamTypeFixed,
} from '../../lib/incomeLabels';
import {
  isBusinessIncomeStream,
  isExpenseInputStream,
} from '../../lib/incomeBreakdown';
import { createFollowUpPeriod } from '../../lib/incomePeriod';
import {
  allowsSocialInsuranceDependentDefault,
  allowsTaxDependentDefault,
  canConfigureDependentInQ2,
  dependentFieldsForMemberSelection,
  usesQ1DependentDefaults,
} from '../../lib/memberDependentDefaults';
import type { FamilyMember } from '../../types/family';
import type {
  FilingType,
  IncomeBonus,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
} from '../../types/income';

interface IncomeEntryCardProps {
  entry: IncomeEntry;
  member: FamilyMember;
  memberEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  referenceDate: Date;
  index: number;
  onChange: (entry: IncomeEntry) => void;
  onRemove: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);
const KENPO_YEARS = [0, 1, 2, 3];
const DEFAULT_PERIOD_END_AGE = 60;
const DEFAULT_PERIOD_END_MONTH = 3;

function createPeriodId(): string {
  return crypto.randomUUID();
}

function getExpenseFieldDescription(streamType: IncomeStreamType): string {
  if (streamType === 'temporary_income') {
    return '必要経費（収入から差し引く支出）';
  }
  if (streamType === 'miscellaneous_income') {
    return '必要経費（収入から差し引く支出）';
  }
  return '事業のために毎月かかる支出（仕入れ・家賃・通信費など）';
}

function withPeriodAnnualAmount(
  period: IncomePeriod,
  overrides: Partial<IncomePeriod> = {},
): IncomePeriod {
  const next = { ...period, ...overrides };
  return {
    ...next,
    annualAmountMan: calcPeriodAnnualAmountMan(next),
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

interface PeriodRowProps {
  period: IncomePeriod;
  periodIndex: number;
  entry: IncomeEntry;
  member: FamilyMember;
  memberEntries: IncomeEntry[];
  familyMembers: FamilyMember[];
  birthYear: number;
  birthMonth: number;
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
  birthYear,
  birthMonth,
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
  const annualAmountMan = calcPeriodAnnualAmountMan(period);
  const isLumpSumPeriod = isSingleMonthIncomePeriod(period);
  const dependentIssues = showDependentStatus
    ? member.role === 'child' || member.role === 'other'
      ? validateDependentMemberPeriod(member, entry, period, memberEntries)
      : validatePeriodDependentSettings(
          member,
          entry,
          period,
          familyMembers,
          memberEntries,
        )
    : [];
  const dependentAlerts = showDependentStatus
    ? getPeriodDependentAlerts(member, entry, period)
    : [];
  const isQ1LinkedMember = usesQ1DependentDefaults(member);
  const allowTaxDependent = allowsTaxDependentDefault(member);
  const allowSocialInsuranceDependent = allowsSocialInsuranceDependentDefault(member);
  const canConfigureDependent = canConfigureDependentInQ2(member);

  const setMonthly = (monthlyAmountMan: number) => {
    onChange(withPeriodAnnualAmount(period, { monthlyAmountMan }));
  };

  const setLumpSumAnnual = (annualMan: number) => {
    const bonusTotal = period.bonuses.reduce((sum, b) => sum + b.amountMan, 0);
    onChange(
      withPeriodAnnualAmount(period, {
        monthlyAmountMan: Math.max(0, annualMan - bonusTotal),
      }),
    );
  };

  const updateBonus = (
    bonusId: string,
    patch: Partial<Pick<IncomeBonus, 'amountMan' | 'paymentMonth'>>,
  ) => {
    const bonuses = period.bonuses.map((b) =>
      b.id === bonusId ? { ...b, ...patch } : b,
    );
    onChange(withPeriodAnnualAmount(period, { bonuses }));
  };

  const addBonus = () => {
    const bonuses: IncomeBonus[] = [
      ...period.bonuses,
      { id: crypto.randomUUID(), amountMan: 0, paymentMonth: 6 },
    ];
    onChange(withPeriodAnnualAmount(period, { bonuses }));
  };

  const removeBonus = (bonusId: string) => {
    const bonuses = period.bonuses.filter((b) => b.id !== bonusId);
    onChange(withPeriodAnnualAmount(period, { bonuses }));
  };

  const toggleLumpSumPeriod = () => {
    if (isLumpSumPeriod) {
      onChange(
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

    onChange(
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
    onChange(
      withPeriodAnnualAmount({
        ...next,
        lumpSumRestoreEndAge: stillLumpSum ? next.lumpSumRestoreEndAge : null,
        lumpSumRestoreEndMonth: stillLumpSum ? next.lumpSumRestoreEndMonth : null,
      }),
    );
  };

  return (
    <div className="income-table-row">
      <div className="income-table-cell income-col-type">
        {streamFixed ? (
          <span className="stream-type-fixed">
            {INCOME_STREAM_LABELS[period.streamType]}
          </span>
        ) : (
          <select
            className="select-input select-input--wide"
            value={period.streamType}
            onChange={(e) =>
              onChange({
                ...period,
                streamType: e.target.value as IncomeStreamType,
              })
            }
          >
            {streamOptions.map((type) => (
              <option key={type} value={type}>
                {INCOME_STREAM_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="income-table-cell income-col-period">
        <div
          className={`period-inputs period-inputs--grid ${showLumpSum ? 'period-inputs--lump-sum' : ''}`}
        >
          <select
            className="select-input select-input--period"
            value={period.startAge}
            onChange={(e) =>
              onChange(
                withSyncedLumpSumEnd(period, {
                  startAge: Number(e.target.value),
                }),
              )
            }
          >
            {startAgeOptions.map((age) => (
              <option key={age} value={age}>
                {age}才
              </option>
            ))}
          </select>
          <select
            className="select-input select-input--period"
            value={period.startMonth}
            onChange={(e) =>
              onChange(
                withSyncedLumpSumEnd(period, {
                  startMonth: Number(e.target.value),
                }),
              )
            }
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          <span className="period-separator period-separator--arrow">→</span>
          <select
            className="select-input select-input--period"
            value={period.endAge}
            onChange={(e) =>
              updatePeriodEnd({ endAge: Number(e.target.value) })
            }
          >
            {END_AGES.map((a) => (
              <option key={a} value={a}>
                {a}才
              </option>
            ))}
          </select>
          <select
            className="select-input select-input--period"
            value={period.endMonth}
            onChange={(e) =>
              updatePeriodEnd({ endMonth: Number(e.target.value) })
            }
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          {showLumpSum ? (
            <div className="period-end-row">
              <p className="period-end-label">
                {formatEndYearLabel(
                  period.endAge,
                  period.endMonth,
                  birthYear,
                  birthMonth,
                )}
              </p>
              <button
                type="button"
                className={`period-lump-sum-btn ${isLumpSumPeriod ? 'period-lump-sum-btn--active' : ''}`}
                onClick={toggleLumpSumPeriod}
                aria-pressed={isLumpSumPeriod}
                title="一時金の期間（単月）に切り替えます。もう一度押すと元の期間に戻ります"
              >
                一時金
              </button>
            </div>
          ) : (
            <p className="period-end-label">
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

      <div className="income-table-cell income-col-amount-group">
        <div
          className={`income-amount-group-top ${showBonus ? '' : 'income-amount-group-top--no-bonus'}`}
        >
          <div className="income-amount-monthly">
            <div className="amount-inline">
              <input
                type="number"
                className="amount-input"
                value={period.monthlyAmountMan}
                min={0}
                step={1}
                onChange={(e) => setMonthly(Number(e.target.value) || 0)}
              />
              <span className="amount-unit">万円</span>
            </div>
          </div>

          {showBonus && (
            <div className="income-amount-bonus">
              <div className="bonus-column">
                {period.bonuses.map((bonus) => (
                  <div key={bonus.id} className="bonus-row">
                    <select
                      className="select-input select-input--compact"
                      value={bonus.paymentMonth}
                      onChange={(e) =>
                        updateBonus(bonus.id, {
                          paymentMonth: Number(e.target.value),
                        })
                      }
                      aria-label="賞与支給月"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}月
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="amount-input amount-input--small"
                      value={bonus.amountMan}
                      min={0}
                      onChange={(e) =>
                        updateBonus(bonus.id, {
                          amountMan: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <span className="amount-unit">万円</span>
                    <button
                      type="button"
                      className="bonus-remove-btn"
                      onClick={() => removeBonus(bonus.id)}
                      aria-label="賞与を削除"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button type="button" className="inline-add-btn" onClick={addBonus}>
                  ＋ 追加
                </button>
              </div>
            </div>
          )}

          <div className="income-amount-annual">
            <div className="amount-inline">
              <input
                type="number"
                className={
                  isLumpSumPeriod
                    ? 'amount-input'
                    : 'amount-input amount-input--readonly'
                }
                value={annualAmountMan}
                min={0}
                step={1}
                readOnly={!isLumpSumPeriod}
                tabIndex={isLumpSumPeriod ? 0 : -1}
                onChange={
                  isLumpSumPeriod
                    ? (e) => setLumpSumAnnual(Number(e.target.value) || 0)
                    : undefined
                }
              />
              <span className="amount-unit">万円</span>
            </div>
          </div>
        </div>

        {showDependentStatus && (
          <div
            className={`income-period-dependent-status ${dependentIssues.length > 0 ? 'income-period-dependent-status--error' : ''}`}
          >
            <span className="income-period-dependent-label">扶養設定</span>
            {isQ1LinkedMember && !canConfigureDependent ? (
              <p className="income-period-dependent-q1-note">
                ご家族（Q1）で扶養設定がすべてオフのため、この期間では扶養に入れません。
              </p>
            ) : (
              <div className="income-period-dependent-options">
                {DEPENDENT_STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="income-period-dependent-option"
                  >
                    <input
                      type="radio"
                      name={`dependent-status-${period.id}`}
                      value={status}
                      checked={period.dependentStatus === status}
                      disabled={
                        isQ1LinkedMember &&
                        status === 'dependent' &&
                        !canConfigureDependent
                      }
                      onChange={() =>
                        onChange({
                          ...period,
                          ...dependentFieldsForMemberSelection(
                            member,
                            status === 'dependent',
                          ),
                        })
                      }
                    />
                    <span>{DEPENDENT_STATUS_LABELS[status]}</span>
                  </label>
                ))}
              </div>
            )}
            {period.dependentStatus === 'dependent' && canConfigureDependent && (
              <div className="income-period-dependent-checks">
                <label
                  className={`income-period-dependent-check ${!allowTaxDependent ? 'income-period-dependent-check--disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={period.taxDependent}
                    disabled={!allowTaxDependent}
                    onChange={(e) =>
                      onChange({ ...period, taxDependent: e.target.checked })
                    }
                  />
                  <span>
                    {isQ1LinkedMember
                      ? TAX_DEPENDENT_LABEL_CHILD_OTHER
                      : TAX_DEPENDENT_LABEL}
                    {isQ1LinkedMember && !allowTaxDependent && (
                      <span className="income-period-dependent-q1-hint">
                        （Q1でオフ）
                      </span>
                    )}
                  </span>
                </label>
                <label
                  className={`income-period-dependent-check ${!allowSocialInsuranceDependent ? 'income-period-dependent-check--disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={period.socialInsuranceDependent}
                    disabled={!allowSocialInsuranceDependent}
                    onChange={(e) =>
                      onChange({
                        ...period,
                        socialInsuranceDependent: e.target.checked,
                      })
                    }
                  />
                  <span>
                    {isQ1LinkedMember
                      ? SOCIAL_INSURANCE_DEPENDENT_LABEL_CHILD_OTHER
                      : SOCIAL_INSURANCE_DEPENDENT_LABEL}
                    {isQ1LinkedMember && !allowSocialInsuranceDependent && (
                      <span className="income-period-dependent-q1-hint">
                        （Q1でオフ）
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}
            {isQ1LinkedMember && canConfigureDependent && (
              <p className="income-period-dependent-q1-note">
                Q1の扶養設定に連動しています。税法上・社会保険の扶養はQ1でオンにした項目のみ選べます。
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
        )}
      </div>

      <div className="income-table-cell income-col-contingency">
        <div className="rate-input-wrap">
          <input
            type="number"
            className="rate-input"
            value={period.spouseContingencyRate ?? ''}
            min={0}
            max={100}
            step={0.1}
            onChange={(e) =>
              onChange({
                ...period,
                spouseContingencyRate: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
          <span className="rate-unit">%</span>
        </div>
      </div>

      <div className="income-table-cell income-col-rate">
        <div className="rate-input-wrap">
          <button
            type="button"
            className="rate-calc-btn"
            disabled
            aria-label="年間上昇率を計算"
            title="計算（準備中）"
          >
            🧮
          </button>
          <input
            type="number"
            className="rate-input"
            value={period.annualIncreaseRate ?? ''}
            min={0}
            max={100}
            step={0.1}
            onChange={(e) =>
              onChange({
                ...period,
                annualIncreaseRate: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
          <span className="rate-unit">%</span>
        </div>
      </div>

      {showExpenseColumn && (
        <div className="income-table-cell income-col-expense">
          {isExpenseInputStream(period.streamType) ? (
            <div className="self-employed-field">
              <div className="expense-field">
                <input
                  type="number"
                  className="amount-input"
                  value={entry.expenseManPerMonth ?? 0}
                  min={0}
                  onChange={(e) =>
                    onEntryChange({
                      ...entry,
                      expenseManPerMonth: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円/月</span>
              </div>
              <p className="field-description">
                {getExpenseFieldDescription(period.streamType)}
              </p>
            </div>
          ) : null}
        </div>
      )}
      {showFilingColumn && (
        <div className="income-table-cell income-col-filing">
          {isBusinessIncomeStream(period.streamType) &&
          periodIndex ===
            entry.periods.findIndex((p) =>
              isBusinessIncomeStream(p.streamType),
            ) ? (
            <div className="self-employed-field">
              <select
                className="select-input select-input--wide"
                value={entry.filingType ?? 'blue_65'}
                onChange={(e) =>
                  onEntryChange({
                    ...entry,
                    filingType: e.target.value as FilingType,
                  })
                }
              >
                {FILING_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {FILING_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <p className="field-description">
                確定申告の種類です。青色申告は経費の特別控除（10万〜65万円）が受けられます。
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="income-table-cell income-col-actions">
        {canRemove && (
          <button
            type="button"
            className="remove-period-btn"
            onClick={onRemove}
            aria-label="期間を削除"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}

export function IncomeEntryCard({
  entry,
  member,
  memberEntries,
  familyMembers,
  referenceDate,
  index,
  onChange,
  onRemove,
}: IncomeEntryCardProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const isSelfEmployedEntry = entry.category === 'self_employed';
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
  const showKenpo = entry.category === 'employee';
  const showFooterActions = showKenpo || isSelfEmployedEntry;
  const streamFixed = isStreamTypeFixed(entry.category);
  const streamOptions = getStreamTypeOptions(entry.category);
  const maxPeriodAge = Math.max(
    member.age,
    member.expectedLifespan,
    ...entry.periods.flatMap((p) => [p.startAge, p.endAge]),
  );
  const startAgeOptions = Array.from({ length: maxPeriodAge + 1 }, (_, i) => i);

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

  const tableClass = [
    'income-table',
    showFilingColumn ? 'income-table--self-employed' : '',
    showExpenseColumn && !showFilingColumn
      ? 'income-table--with-expense'
      : '',
    !showBonus ? 'income-table--no-bonus' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="income-entry">
      <div className="income-entry-header">
        <div className="income-entry-header-left">
          <span className="income-entry-index">{index + 1}. 収入</span>
          <span className="occupation-badge">
            {INCOME_CATEGORY_LABELS[entry.category]}
          </span>
          <button type="button" className="detail-settings-btn" disabled>
            詳細設定（死亡退職金など）
          </button>
        </div>
        <div className="income-entry-header-right">
          <label className="contingency-check">
            <input
              type="checkbox"
              checked={entry.spouseContingencyOnly}
              onChange={(e) =>
                onChange({ ...entry, spouseContingencyOnly: e.target.checked })
              }
            />
            <span>配偶者さんに万が一があった時のみ反映</span>
          </label>
          <button
            type="button"
            className="remove-member-btn"
            onClick={onRemove}
            aria-label="収入を削除"
          >
            −
          </button>
        </div>
      </div>

      <div className="income-table-scroll">
        <div className={tableClass}>
        <div className="income-table-header">
          <div className="income-header-cell income-header-type" />
          <div className="income-header-cell income-header-period">期間</div>
          <div className="income-header-cell income-header-amount-group">
            金額（額面）
          </div>
          <div className="income-header-cell income-header-contingency">
            配偶者さんに万が一
          </div>
          <div className="income-header-cell income-header-rate">年間上昇率</div>
          {showExpenseColumn && (
            <div className="income-header-cell income-header-expense">経費</div>
          )}
          {showFilingColumn && (
            <div className="income-header-cell income-header-filing">
              申告タイプ
            </div>
          )}
          <div className="income-header-cell income-header-actions" />
          <div className="income-header-cell income-header-sub-monthly">月額</div>
          {showBonus && (
            <div className="income-header-cell income-header-sub-bonus">賞与</div>
          )}
          <div className="income-header-cell income-header-sub-annual">年額</div>
        </div>

        {entry.periods.map((period, periodIndex) => (
          <PeriodRow
            key={period.id}
            period={period}
            periodIndex={periodIndex}
            entry={entry}
            member={member}
            memberEntries={memberEntries}
            familyMembers={familyMembers}
            birthYear={birthYear}
            birthMonth={member.birthMonth}
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
            onEntryChange={onChange}
          />
        ))}
        </div>
      </div>

      {showFooterActions && (
        <div className="income-entry-footer">
          <button type="button" className="footer-action-btn" onClick={addPeriod}>
            ＋ 期間を追加
          </button>
          <button type="button" className="footer-action-btn" disabled>
            ＋ 退職金追加
          </button>
          {showKenpo && (
            <div className="kenpo-setting">
              <span className="kenpo-label">退職後の協会けんぽ任意継続</span>
              <select
                className="select-input"
                value={entry.kenpoContinuationYears ?? 0}
                onChange={(e) =>
                  onChange({
                    ...entry,
                    kenpoContinuationYears: Number(e.target.value),
                  })
                }
              >
                {KENPO_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}年間
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {!showFooterActions && (
        <div className="income-entry-footer income-entry-footer--minimal">
          <button type="button" className="footer-action-btn" onClick={addPeriod}>
            ＋ 期間を追加
          </button>
        </div>
      )}
    </div>
  );
}
