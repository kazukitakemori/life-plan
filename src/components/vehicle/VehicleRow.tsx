import { useEffect, useState } from 'react';
import {
  calcBirthYear,
  calcYearAtAge,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import { resolveMemberBirthMonth } from '../../lib/familyDefaults';
import { toJapaneseEra } from '../../lib/era';
import { getVehicleAgeOptions } from '../../lib/vehicleDefaults';
import {
  type DuplicateVehicleOptions,
} from '../../lib/vehicleDuplicate';
import {
  buildInspectionYearOptions,
  getInspectionPeriodHint,
  resolveNextInspection,
  vehicleRequiresInspection,
  withAutoNextInspection,
} from '../../lib/vehicleInspection';
import {
  ANNUAL_COST_CYCLE_OPTIONS,
  CAR_VEHICLE_KIND_LABELS,
  CAR_VEHICLE_KIND_OPTIONS,
  formatAnnualCostCycleLabel,
  formatVehicleUsagePeriodHint,
  getVehicleGasolineCostMan,
  getVehicleParkingCostMan,
  VEHICLE_REPLACEMENT_CONDITION_LABELS,
  VEHICLE_REPLACEMENT_CONDITION_OPTIONS,
  MOTORCYCLE_VEHICLE_KIND_LABELS,
  MOTORCYCLE_VEHICLE_KIND_OPTIONS,
  parseVehicleCondition,
  resolveAnnualCostCycleYears,
  resolveVehicleCondition,
  resolveVehicleKind,
  VEHICLE_CONDITION_LABELS,
  VEHICLE_CONDITION_OPTIONS,
  VEHICLE_PAYMENT_MODE_LABELS,
  VEHICLE_PAYMENT_MODE_OPTIONS,
  vehicleTypeHasKind,
} from '../../lib/vehicleLabels';
import type { FamilyMember } from '../../types/family';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleEntry, VehiclePaymentMode, VehicleReplacementCondition, VehicleState } from '../../types/vehicle';
import { VehicleInsuranceLinks } from './VehicleInsuranceLinks';
import { VehicleLoanLinks } from './VehicleLoanLinks';

interface VehicleRowProps {
  entry: VehicleEntry;
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedLoans: VehicleLinkedLoanView[];
  linkedInsurances?: InsuranceEntry[];
  insuranceState?: InsuranceState;
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  canRemove: boolean;
  isDragging: boolean;
  onChange: (entry: VehicleEntry) => void;
  onDuplicate?: (options: DuplicateVehicleOptions) => void;
  onRemove: () => void;
  onAddLoan: () => void;
  onRemoveLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onAddInsurance?: () => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: (fromId: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);

export function VehicleRow({
  entry,
  member,
  members,
  referenceDate,
  linkedLoans,
  linkedInsurances = [],
  insuranceState,
  loanState,
  housingState,
  vehicleState,
  canRemove,
  isDragging,
  onChange,
  onDuplicate,
  onRemove,
  onAddLoan,
  onRemoveLoan,
  onUpdateLoan,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
  onDragStart,
  onDragEnd,
  onDropOn,
}: VehicleRowProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const memberBirthMonth = resolveMemberBirthMonth(member);
  const ageOptions = getVehicleAgeOptions(member);
  const resolvedKind = resolveVehicleKind(entry.type, entry.kind);
  const resolvedCondition = resolveVehicleCondition(entry);
  const requiresInspection = vehicleRequiresInspection(entry);
  const nextInspection = resolveNextInspection(
    entry,
    birthYear,
    memberBirthMonth,
  );
  const inspectionHint = getInspectionPeriodHint(entry);
  const startCalendarYear = calcYearAtAge(
    birthYear,
    memberBirthMonth,
    entry.startAge,
    entry.startMonth,
  );
  const inspectionYearOptions = (() => {
    const options = buildInspectionYearOptions(startCalendarYear);
    if (
      nextInspection &&
      !options.includes(nextInspection.year)
    ) {
      return [...options, nextInspection.year].sort((a, b) => a - b);
    }
    return options;
  })();

  const applyAutoInspection = (next: VehicleEntry) =>
    withAutoNextInspection(next, birthYear, memberBirthMonth);
  const annualCostCycleYears = resolveAnnualCostCycleYears(entry);
  const isMonthlyRepayment = entry.paymentMode === 'monthlyRepayment';
  const isAlreadyOwned = entry.paymentMode === 'alreadyOwned';
  const isPurchaseAmount = entry.paymentMode === 'purchaseAmount';

  const repaymentEndYear = entry.repaymentEndYear || startCalendarYear + 5;
  const repaymentEndMonth = entry.repaymentEndMonth || entry.startMonth;
  /** 自動車・バイク: なし/新車/中古。自転車・その他: なし/あり */
  type DuplicateReplacementOption =
    | 'none'
    | 'yes'
    | VehicleReplacementCondition;
  const [duplicateReplacement, setDuplicateReplacement] =
    useState<DuplicateReplacementOption>('none');
  const needsReplacementCondition = vehicleTypeHasKind(entry.type);
  const canDuplicate = (() => {
    if (!onDuplicate) return false;
    if (entry.endMode === 'lifetime') return false;
    // 利用期間の終わり（endMonthまで）に続く翌月が、期待余命を超える場合は複製しない。
    const duplicateStartAge =
      entry.endMonth === 12 ? entry.endAge + 1 : entry.endAge;
    return duplicateStartAge <= member.expectedLifespan;
  })();
  const REPAYMENT_END_YEAR_OPTIONS = Array.from(
    { length: 36 },
    (_, i) => startCalendarYear + i,
  );

  useEffect(() => {
    if ((isMonthlyRepayment || isAlreadyOwned) && linkedLoans.length > 0) {
      linkedLoans.forEach((loan) => onRemoveLoan(loan.entry.id));
    }
  }, [isMonthlyRepayment, isAlreadyOwned, linkedLoans, onRemoveLoan]);

  const handlePaymentModeChange = (mode: VehiclePaymentMode) => {
    onChange({ ...entry, paymentMode: mode });
  };

  return (
    <div
      className={`vehicle-entry-block${isDragging ? ' vehicle-entry-block--dragging' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        if (fromId) onDropOn(fromId);
      }}
    >
    <div
      className={`life-event-table-row${isDragging ? ' life-event-table-row--dragging' : ''}`}
    >
      <div className="life-event-table-cell life-event-col-drag">
        <button
          type="button"
          className="life-event-drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', entry.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label="並べ替え"
        >
          ⠿
        </button>
      </div>

      <div className="life-event-table-cell vehicle-col-summary">
        <input
          type="text"
          className="life-event-text-input"
          value={entry.label}
          placeholder="名称"
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
        />
      </div>

      <div className="life-event-table-cell vehicle-col-type">
        <div className="vehicle-type-cell">
        {entry.type === 'car' && resolvedKind ? (
          <select
            className="select-input life-event-select"
            value={resolvedKind}
            onChange={(e) => {
              const condition = parseVehicleCondition(e.target.value);
              onChange(
                applyAutoInspection({
                  ...entry,
                  kind: condition,
                  condition,
                }),
              );
            }}
          >
            {CAR_VEHICLE_KIND_OPTIONS.map((kind) => (
              <option key={kind} value={kind}>
                {CAR_VEHICLE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        ) : entry.type === 'motorcycle' && resolvedKind ? (
          <div className="vehicle-type-stack">
            <select
              className="select-input life-event-select"
              value={resolvedCondition}
              onChange={(e) =>
                onChange(
                  applyAutoInspection({
                    ...entry,
                    condition: parseVehicleCondition(e.target.value),
                  }),
                )
              }
              aria-label="新車・中古・既に保有"
            >
              {VEHICLE_CONDITION_OPTIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {VEHICLE_CONDITION_LABELS[condition]}
                </option>
              ))}
            </select>
            <select
              className="select-input life-event-select"
              value={resolvedKind}
              onChange={(e) =>
                onChange(
                  applyAutoInspection({
                    ...entry,
                    kind: resolveVehicleKind(
                      entry.type,
                      e.target.value as VehicleEntry['kind'],
                    ),
                  }),
                )
              }
              aria-label="排気量区分"
            >
              {MOTORCYCLE_VEHICLE_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {MOTORCYCLE_VEHICLE_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <select
            className="select-input life-event-select"
            value={resolvedCondition === 'owned' ? 'owned' : 'new'}
            onChange={(e) =>
              onChange(
                applyAutoInspection({
                  ...entry,
                  condition: parseVehicleCondition(e.target.value),
                }),
              )
            }
            aria-label="購入区分"
          >
            <option value="new">
              {entry.type === 'bicycle' ? '自転車' : 'その他'}
            </option>
            <option value="owned">既に保有</option>
          </select>
        )}
        </div>
      </div>

      <div className="life-event-table-cell vehicle-col-period">
        <div className="life-event-period-block">
          <div className="life-event-period-side">
            <div className="life-event-period-fields">
              <select
                className="select-input select-input--compact select-input--schedule"
                value={entry.startAge}
                onChange={(e) =>
                  onChange(
                    applyAutoInspection({
                      ...entry,
                      startAge: Number(e.target.value),
                    }),
                  )
                }
              >
                {ageOptions.map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact select-input--schedule"
                value={entry.startMonth}
                onChange={(e) =>
                  onChange(
                    applyAutoInspection({
                      ...entry,
                      startMonth: Number(e.target.value),
                    }),
                  )
                }
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <p className="period-start-label">
              {formatYearAtAgeLabel(
                entry.startAge,
                entry.startMonth,
                birthYear,
                member.birthMonth,
              )}
            </p>
          </div>

          <span className="life-event-period-arrow" aria-hidden>
            →
          </span>

          <div className="life-event-period-side">
            <div className="life-event-period-fields">
              <select
                className="select-input select-input--compact select-input--schedule"
                value={entry.endMode === 'lifetime' ? 'lifetime' : String(entry.endAge)}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'lifetime') {
                    onChange({ ...entry, endMode: 'lifetime' });
                    return;
                  }

                  const selectedEndAge = Number(value);
                  const resolvedEndAge =
                    entry.endMode === 'lifetime'
                      ? Math.max(entry.startAge + 1, selectedEndAge)
                      : selectedEndAge;
                  onChange({
                    ...entry,
                    endMode: 'until',
                    endAge: resolvedEndAge,
                  });
                }}
              >
                <option value="lifetime">生涯</option>
                {END_AGES.filter((age) => age >= entry.startAge).map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>

              {entry.endMode === 'until' && (
                <>
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={entry.endMonth}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        endMonth: Number(e.target.value),
                      })
                    }
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                  <span className="period-until-suffix">まで</span>
                </>
              )}
            </div>
            {entry.endMode === 'until' ? (
              <p className="period-end-label">
                {formatEndYearLabel(
                  entry.endAge,
                  entry.endMonth,
                  birthYear,
                  member.birthMonth,
                )}
              </p>
            ) : (
              <p className="period-end-label">
                {formatVehicleUsagePeriodHint(entry)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="life-event-table-cell vehicle-col-purchase">
        <div className="vehicle-owned-payment-cell">
          <div
            className="vehicle-owned-payment-toggle"
            role="radiogroup"
            aria-label="支払い方法の入力方法"
          >
            {VEHICLE_PAYMENT_MODE_OPTIONS.map((mode) => (
              <label
                key={mode}
                className={[
                  'vehicle-owned-payment-toggle-option',
                  entry.paymentMode === mode
                    ? 'vehicle-owned-payment-toggle-option--active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <input
                  type="radio"
                  name={`vehicle-payment-mode-${entry.id}`}
                  checked={entry.paymentMode === mode}
                  onChange={() => handlePaymentModeChange(mode)}
                />
                <span>{VEHICLE_PAYMENT_MODE_LABELS[mode]}</span>
              </label>
            ))}
          </div>
          {isMonthlyRepayment ? (
            <div className="vehicle-repayment-inputs">
              <div className="life-event-amount-field">
                <input
                  type="number"
                  className="amount-input"
                  value={entry.monthlyRepaymentMan}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    onChange({
                      ...entry,
                      monthlyRepaymentMan: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円/月</span>
              </div>
              <div className="vehicle-repayment-term-reveal">
                <span className="vehicle-monthly-label">返済期間</span>
                <div className="life-event-period-fields">
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={repaymentEndYear}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        repaymentEndYear: Number(e.target.value),
                        repaymentEndMonth: repaymentEndMonth,
                      })
                    }
                    aria-label="返済終了年"
                  >
                    {REPAYMENT_END_YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={repaymentEndMonth}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        repaymentEndYear: repaymentEndYear,
                        repaymentEndMonth: Number(e.target.value),
                      })
                    }
                    aria-label="返済終了月"
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                  <span className="amount-unit">まで</span>
                </div>
              </div>
            </div>
          ) : isAlreadyOwned ? (
            <p className="vehicle-already-owned-note">
              購入費・ローン返済は計上しません
            </p>
          ) : isPurchaseAmount ? (
            <div className="life-event-amount-field">
              <input
                type="number"
                className="amount-input"
                value={entry.purchaseAmountMan}
                min={0}
                step={1}
                onChange={(e) =>
                  onChange({
                    ...entry,
                    purchaseAmountMan: Number(e.target.value) || 0,
                  })
                }
              />
              <span className="amount-unit">万円</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="life-event-table-cell vehicle-col-replace">
        <div className="vehicle-replace-cell">
          <div className="vehicle-duplicate-controls">
            <select
              className="select-input life-event-select"
              value={
                needsReplacementCondition
                  ? duplicateReplacement === 'yes'
                    ? 'none'
                    : duplicateReplacement
                  : duplicateReplacement === 'new' ||
                      duplicateReplacement === 'used'
                    ? 'yes'
                    : duplicateReplacement
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'none') {
                  setDuplicateReplacement('none');
                  return;
                }
                if (!needsReplacementCondition) {
                  setDuplicateReplacement('yes');
                  return;
                }
                setDuplicateReplacement(
                  value === 'used' ? 'used' : 'new',
                );
              }}
              aria-label="買い替え"
              disabled={!onDuplicate}
            >
              <option value="none">なし</option>
              {needsReplacementCondition ? (
                VEHICLE_REPLACEMENT_CONDITION_OPTIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {VEHICLE_REPLACEMENT_CONDITION_LABELS[condition]}
                  </option>
                ))
              ) : (
                <option value="yes">あり</option>
              )}
            </select>
            {duplicateReplacement !== 'none' && (
              <button
                type="button"
                className="life-event-copy-btn vehicle-duplicate-btn"
                onClick={() => {
                  if (!onDuplicate) return;
                  if (needsReplacementCondition) {
                    if (
                      duplicateReplacement !== 'new' &&
                      duplicateReplacement !== 'used'
                    ) {
                      return;
                    }
                    onDuplicate({ condition: duplicateReplacement });
                    return;
                  }
                  onDuplicate({});
                }}
                disabled={!canDuplicate}
              >
                複製
              </button>
            )}
          </div>
          {duplicateReplacement !== 'none' && (
            <p className="vehicle-replace-hint">
              利用期間の終わりの翌月から、同条件で次の台を追加します
            </p>
          )}
        </div>
      </div>

      <div className="life-event-table-cell vehicle-col-monthly">
        {vehicleTypeHasKind(entry.type) ? (
          <div className="vehicle-monthly-stack">
            <div className="vehicle-monthly-item">
              <span className="vehicle-monthly-label">ガソリン代</span>
              <div className="life-event-amount-field">
                <input
                  type="number"
                  className="amount-input"
                  value={getVehicleGasolineCostMan(entry)}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    onChange({
                      ...entry,
                      gasolineCostMan: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円</span>
              </div>
            </div>
            <div className="vehicle-monthly-item">
              <span className="vehicle-monthly-label">駐車場代</span>
              <div className="life-event-amount-field">
                <input
                  type="number"
                  className="amount-input"
                  value={getVehicleParkingCostMan(entry)}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    onChange({
                      ...entry,
                      parkingCostMan: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="life-event-amount-field">
            <input
              type="number"
              className="amount-input"
              value={entry.monthlyCostMan}
              min={0}
              step={0.1}
              onChange={(e) =>
                onChange({
                  ...entry,
                  monthlyCostMan: Number(e.target.value) || 0,
                })
              }
            />
            <span className="amount-unit">万円</span>
          </div>
        )}
      </div>

      <div className="life-event-table-cell vehicle-col-annual">
        <div className="vehicle-annual-stack">
          <div className="vehicle-monthly-item">
            {vehicleTypeHasKind(entry.type) && (
              <span className="vehicle-monthly-label">税金・メンテ</span>
            )}
            <div className="vehicle-annual-cost-row">
              <div className="life-event-amount-field">
                <input
                  type="number"
                  className="amount-input"
                  value={entry.annualCostMan}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    onChange({
                      ...entry,
                      annualCostMan: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円</span>
              </div>
              <select
                className="select-input select-input--compact select-input--schedule vehicle-annual-cycle-select"
                value={annualCostCycleYears}
                onChange={(e) =>
                  onChange({
                    ...entry,
                    annualCostCycleYears: Number(e.target.value),
                  })
                }
                aria-label="税金・メンテナンス費の周期"
              >
                {ANNUAL_COST_CYCLE_OPTIONS.map((years) => (
                  <option key={years} value={years}>
                    {formatAnnualCostCycleLabel(years)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {requiresInspection && nextInspection ? (
            <>
              <div className="vehicle-monthly-item">
                <span className="vehicle-monthly-label">車検費用</span>
                <div className="life-event-amount-field">
                  <input
                    type="number"
                    className="amount-input"
                    value={entry.inspectionCostMan ?? 0}
                    min={0}
                    step={0.1}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        inspectionCostMan: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="amount-unit">万円</span>
                </div>
              </div>
              <div className="vehicle-monthly-item">
                <span className="vehicle-monthly-label">次の車検（いまの車）</span>
                <div className="life-event-period-fields">
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={nextInspection.year}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        nextInspectionYear: Number(e.target.value),
                      })
                    }
                  >
                    {inspectionYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={nextInspection.month}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        nextInspectionMonth: Number(e.target.value),
                      })
                    }
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                </div>
                <p className="period-start-label">
                  {toJapaneseEra(nextInspection.year, nextInspection.month)}
                </p>
                {inspectionHint && (
                  <p className="vehicle-inspection-hint">{inspectionHint}</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="life-event-table-cell life-event-col-action">
        <button
          type="button"
          className="life-event-row-remove"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="削除"
        >
          −
        </button>
      </div>
    </div>

      <div className="vehicle-table-group vehicle-table-insurance">
        <div className="life-event-header-cell vehicle-table-group-label">
          保険
        </div>
        <div className="life-event-table-cell vehicle-table-group-body">
          {onAddInsurance &&
          onUpdateInsurance &&
          onRemoveInsurance &&
          insuranceState ? (
            <VehicleInsuranceLinks
              vehicleName={entry.label}
              insurances={linkedInsurances}
              members={members}
              insuranceState={insuranceState}
              housingState={housingState}
              vehicleState={vehicleState}
              referenceDate={referenceDate}
              onAddInsurance={onAddInsurance}
              onUpdateInsurance={onUpdateInsurance}
              onRemoveInsurance={onRemoveInsurance}
            />
          ) : (
            <button
              type="button"
              className="housing-owned-loan-add-btn"
              disabled
              title="保険の追加は準備中です"
            >
              ＋ 保険の追加
            </button>
          )}
        </div>
      </div>

      {isPurchaseAmount ? (
        <div className="vehicle-table-group vehicle-table-loan">
          <div className="life-event-header-cell vehicle-table-group-label">
            ローン
          </div>
          <div className="life-event-table-cell vehicle-table-group-body">
            {onUpdateLoan ? (
              <VehicleLoanLinks
                vehicleName={entry.label}
                loans={linkedLoans}
                members={members}
                loanState={loanState}
                housingState={housingState}
                vehicleState={vehicleState}
                referenceDate={referenceDate}
                addLoanEnabled={entry.purchaseAmountMan > 0}
                onAddLoan={onAddLoan}
                onUpdateLoan={onUpdateLoan}
                onRemoveLoan={onRemoveLoan}
              />
            ) : (
              <button
                type="button"
                className="housing-owned-loan-add-btn"
                disabled
                title="ローンの追加は準備中です"
              >
                ＋ ローンを追加
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
