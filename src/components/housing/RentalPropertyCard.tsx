import { calcBirthYear, formatEndYearLabel, formatYearAtAgeLabel } from '../../lib/birthDate';
import {
  formatRentalRenewalIntervalLabel,
  RENTAL_OCCUPANCY_SELECT_LABELS,
  RENTAL_RENEWAL_INTERVAL_OPTIONS,
} from '../../lib/housingLabels';
import { getLivingAgeOptions } from '../../lib/livingDefaults';
import {
  clampFutureStartFields,
  filterAgesAtOrAfter,
  filterMonthsAtOrAfter,
  pinStartToAgeMonth,
  resolveReferenceNowAgeMonth,
  resolveSimulationStartAgeMonth,
} from '../../lib/periodTimingBounds';
import type { FamilyMember } from '../../types/family';
import type {
  RentalOccupancy,
  RentalPayerMode,
  RentalProperty,
} from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { useEffect, useMemo } from 'react';
import { resolveRentalPayerMode } from '../../lib/housingRentalPayer';
import { HousingManInput } from './HousingManInput';
import { HousingInsuranceLinks } from './HousingInsuranceLinks';
import { HousingRenewalDateFields } from './HousingRenewalDateFields';
import { housingPropertyElementId } from './HousingSecondLifeApplySummary';
import { useHousingApplyFlash } from './useHousingApplyFlash';

interface RentalPropertyCardProps {
  rental: RentalProperty;
  storageTargetId: string;
  amountRole: 'primary' | 'spouseShare';
  member: FamilyMember;
  /** 居住期間の年齢基準。未指定時は member */
  periodMember?: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedInsurances?: InsuranceEntry[];
  insuranceState?: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  hasSpouse: boolean;
  /** セカンドライフ反映で追加されたときのフラッシュ用トークン */
  highlightToken?: number;
  /** セカンドライフ反映で終了された */
  endedBySecondLife?: boolean;
  onChange: (rental: RentalProperty) => void;
  onPayerModeChange: (payerMode: RentalPayerMode) => void;
  onRemove: () => void;
  onAddInsurance?: () => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const END_AGES = Array.from({ length: 101 }, (_, index) => index);
const OCCUPANCY_OPTIONS: RentalOccupancy[] = ['current', 'upcoming'];

export function RentalPropertyCard({
  rental,
  storageTargetId,
  amountRole,
  member,
  periodMember,
  members,
  referenceDate,
  linkedInsurances = [],
  insuranceState,
  housingState,
  vehicleState,
  hasSpouse,
  highlightToken,
  endedBySecondLife = false,
  onChange,
  onPayerModeChange,
  onRemove,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: RentalPropertyCardProps) {
  const flashing = useHousingApplyFlash(highlightToken);
  const headId = members.find((item) => item.role === 'head')?.id;
  const spouseId = members.find((item) => item.role === 'spouse')?.id;
  const payerMode = resolveRentalPayerMode(
    rental,
    storageTargetId,
    headId,
    spouseId,
  );
  const timingMember = periodMember ?? member;
  const birthYear = calcBirthYear(
    timingMember.age,
    timingMember.birthMonth,
    referenceDate,
  );
  const ageOptions = getLivingAgeOptions(timingMember);
  const isUpcoming = rental.occupancy === 'upcoming';
  const isCurrent = rental.occupancy === 'current';
  const showEndCostInputs = !isUpcoming && rental.endMode === 'until';
  const simStart = useMemo(
    () => resolveSimulationStartAgeMonth(timingMember, referenceDate),
    [timingMember, referenceDate],
  );
  const refNow = useMemo(
    () => resolveReferenceNowAgeMonth(timingMember, referenceDate),
    [timingMember, referenceDate],
  );
  const startAgeOptions = isUpcoming
    ? filterAgesAtOrAfter(ageOptions, simStart)
    : ageOptions;
  const startMonthOptions = isUpcoming
    ? filterMonthsAtOrAfter(rental.startAge, simStart, MONTHS)
    : MONTHS;

  const update = (patch: Partial<RentalProperty>) => {
    let next = { ...rental, ...patch };
    if (isUpcoming) {
      next = clampFutureStartFields(next, simStart);
    } else if (isCurrent) {
      next = pinStartToAgeMonth(next, refNow);
    }
    onChange(next);
  };

  useEffect(() => {
    if (isUpcoming) {
      const clamped = clampFutureStartFields(rental, simStart);
      if (
        clamped.startAge !== rental.startAge ||
        clamped.startMonth !== rental.startMonth
      ) {
        onChange(clamped);
      }
      return;
    }
    if (isCurrent) {
      const pinned = pinStartToAgeMonth(rental, refNow);
      if (
        pinned.startAge !== rental.startAge ||
        pinned.startMonth !== rental.startMonth
      ) {
        onChange(pinned);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simStart.age, simStart.month, refNow.age, refNow.month, isUpcoming, isCurrent]);

  return (
    <div
      id={housingPropertyElementId('rental', rental.id)}
      className={[
        'housing-rental-card',
        flashing ? 'is-flash' : '',
        endedBySecondLife ? 'is-ended-by-second-life' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {endedBySecondLife ? (
        <div className="housing-second-life-ended-banner">
          セカンドライフ反映で終了
        </div>
      ) : null}
      {hasSpouse ? (
        <div className="housing-rental-payer-bar">
          <label className="housing-rental-payer-label">
            家賃の負担者
            <select
              className="select-input select-input--compact housing-rental-payer-select"
              value={payerMode}
              onChange={(e) =>
                onPayerModeChange(e.target.value as RentalPayerMode)
              }
              aria-label="家賃の負担者"
            >
              <option value="head">世帯主が払う</option>
              <option value="spouse">配偶者が払う</option>
              <option value="both">両方で払う</option>
            </select>
          </label>
        </div>
      ) : null}
      <div
        className={[
          'housing-rental-table',
          isUpcoming ? 'housing-rental-table--upcoming' : '',
          showEndCostInputs ? 'housing-rental-table--until' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="housing-rental-table-header">
          <div className="housing-table-header-cell housing-col-name">物件名</div>
          <div className="housing-table-header-cell housing-col-period">
            契約期間
          </div>
          <div className="housing-table-header-cell housing-col-amount">
            {payerMode === 'both' ? '賃料/月（分担）' : '賃料/月'}
          </div>
          {isUpcoming && (
            <>
              <div className="housing-table-header-cell housing-col-amount">
                敷金
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                礼金／一時金
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                仲介手数料
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                引越し費用
              </div>
            </>
          )}
          {showEndCostInputs && (
            <>
              <div className="housing-table-header-cell housing-col-amount">
                退去・引越し費用
              </div>
              <div className="housing-table-header-cell housing-col-amount">
                敷金（返金）
              </div>
            </>
          )}
          <div className="housing-table-header-cell housing-col-renewal">更新</div>
          <div className="housing-table-header-cell housing-col-action" />
        </div>

        <div className="housing-rental-table-body">
          <div className="housing-rental-table-row">
            <div className="housing-table-cell housing-col-name">
              <input
                type="text"
                className="housing-text-input"
                value={rental.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <select
                className="select-input select-input--compact housing-occupancy-select"
                value={rental.occupancy}
                onChange={(e) =>
                  update({ occupancy: e.target.value as RentalOccupancy })
                }
                aria-label="入居状況"
              >
                {OCCUPANCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {RENTAL_OCCUPANCY_SELECT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="housing-table-cell housing-col-period">
              <div className="living-schedule-inputs">
                <div className="living-schedule-side">
                  <div className="living-schedule-fields">
                    {isCurrent ? (
                      <>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.startAge}
                          disabled
                          aria-label="契約開始年齢（基準月）"
                        >
                          <option value={rental.startAge}>
                            {rental.startAge}才
                          </option>
                        </select>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.startMonth}
                          disabled
                          aria-label="契約開始月（基準月）"
                        >
                          <option value={rental.startMonth}>
                            {rental.startMonth}月
                          </option>
                        </select>
                      </>
                    ) : (
                      <>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.startAge}
                          onChange={(e) =>
                            update({ startAge: Number(e.target.value) })
                          }
                        >
                          {startAgeOptions.map((age) => (
                            <option key={age} value={age}>
                              {age}才
                            </option>
                          ))}
                        </select>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.startMonth}
                          onChange={(e) =>
                            update({ startMonth: Number(e.target.value) })
                          }
                        >
                          {startMonthOptions.map((month) => (
                            <option key={month} value={month}>
                              {month}月
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <p className="period-start-label">
                    {formatYearAtAgeLabel(
                      rental.startAge,
                      rental.startMonth,
                      birthYear,
                      timingMember.birthMonth,
                    )}
                    {isCurrent ? '（基準月）' : ''}
                  </p>
                </div>

                <span className="living-schedule-arrow" aria-hidden>
                  →
                </span>

                <div className="living-schedule-side">
                  <div className="living-schedule-fields">
                    {rental.endMode === 'lifetime' ? (
                      <select
                        className="select-input select-input--compact select-input--schedule"
                        value="lifetime"
                        onChange={(e) => {
                          if (e.target.value !== 'lifetime') {
                            update({
                              endMode: 'until',
                              endAge: Math.max(
                                rental.startAge + 1,
                                Number(e.target.value),
                              ),
                            });
                          }
                        }}
                      >
                        <option value="lifetime">生涯</option>
                        {END_AGES.filter((age) => age > rental.startAge).map(
                          (age) => (
                            <option key={age} value={age}>
                              {age}才
                            </option>
                          ),
                        )}
                      </select>
                    ) : (
                      <>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.endAge}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'lifetime') {
                              update({ endMode: 'lifetime' });
                            } else {
                              update({ endAge: Number(value) });
                            }
                          }}
                        >
                          <option value="lifetime">生涯</option>
                          {END_AGES.filter((age) => age > rental.startAge).map(
                            (age) => (
                              <option key={age} value={age}>
                                {age}才
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.endMonth}
                          onChange={(e) =>
                            update({ endMonth: Number(e.target.value) })
                          }
                        >
                          {MONTHS.map((month) => (
                            <option key={month} value={month}>
                              {month}月
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  {rental.endMode === 'until' && (
                    <p className="period-end-label housing-period-end-label">
                      {formatEndYearLabel(
                        rental.endAge,
                        rental.endMonth,
                        birthYear,
                        timingMember.birthMonth,
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="housing-table-cell housing-col-amount">
              {payerMode === 'both' && amountRole === 'primary' ? (
                <div className="housing-rental-split-rent">
                  <label className="housing-rental-split-rent-label">
                    世帯主
                    <HousingManInput
                      compact
                      value={rental.monthlyRentMan}
                      onChange={(monthlyRentMan) => update({ monthlyRentMan })}
                    />
                  </label>
                  <label className="housing-rental-split-rent-label">
                    配偶者
                    <HousingManInput
                      compact
                      value={rental.spouseMonthlyRentMan ?? 0}
                      onChange={(spouseMonthlyRentMan) =>
                        update({ spouseMonthlyRentMan })
                      }
                    />
                  </label>
                </div>
              ) : amountRole === 'spouseShare' ? (
                <HousingManInput
                  compact
                  value={rental.spouseMonthlyRentMan ?? 0}
                  onChange={(spouseMonthlyRentMan) =>
                    update({ spouseMonthlyRentMan })
                  }
                />
              ) : (
                <HousingManInput
                  compact
                  value={rental.monthlyRentMan}
                  onChange={(monthlyRentMan) => update({ monthlyRentMan })}
                />
              )}
            </div>

            {isUpcoming && (
              <>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.securityDepositMan}
                    onChange={(securityDepositMan) =>
                      update({ securityDepositMan })
                    }
                  />
                </div>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.keyMoneyMan}
                    onChange={(keyMoneyMan) => update({ keyMoneyMan })}
                  />
                </div>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.brokerageFeeMan}
                    onChange={(brokerageFeeMan) => update({ brokerageFeeMan })}
                  />
                </div>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.movingCostMan}
                    onChange={(movingCostMan) => update({ movingCostMan })}
                  />
                </div>
              </>
            )}

            {showEndCostInputs && (
              <>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.moveOutCostMan}
                    onChange={(moveOutCostMan) => update({ moveOutCostMan })}
                  />
                </div>
                <div className="housing-table-cell housing-col-amount">
                  <HousingManInput
                    compact
                    value={rental.securityDepositRefundMan}
                    onChange={(securityDepositRefundMan) =>
                      update({ securityDepositRefundMan })
                    }
                  />
                </div>
              </>
            )}

            <div className="housing-table-cell housing-col-renewal">
              <div className="housing-renewal-fields">
                <div className="housing-renewal-row">
                  <span className="housing-renewal-label">費用:</span>
                  <HousingManInput
                    compact
                    value={rental.renewalFeeMan}
                    onChange={(renewalFeeMan) => update({ renewalFeeMan })}
                  />
                </div>
                <div className="housing-renewal-row">
                  <span className="housing-renewal-label">次回</span>
                  <HousingRenewalDateFields
                    yearOnly
                    year={rental.renewalNextYear}
                    month={rental.renewalNextMonth}
                    referenceYear={referenceDate.getFullYear()}
                    onChange={(renewalNextYear, renewalNextMonth) =>
                      update({ renewalNextYear, renewalNextMonth })
                    }
                  />
                </div>
                <div className="housing-renewal-row">
                  <span className="housing-renewal-suffix">以降</span>
                  <select
                    className="select-input select-input--compact"
                    value={rental.renewalIntervalYears}
                    onChange={(e) =>
                      update({ renewalIntervalYears: Number(e.target.value) })
                    }
                  >
                    {RENTAL_RENEWAL_INTERVAL_OPTIONS.map((years) => (
                      <option key={years} value={years}>
                        {formatRentalRenewalIntervalLabel(years)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="housing-table-cell housing-col-action">
              <button
                type="button"
                className="housing-row-remove"
                onClick={onRemove}
                aria-label="賃貸物件を削除"
              >
                −
              </button>
            </div>
          </div>

          <div className="housing-rental-table-group housing-rental-table-insurance">
            <div className="housing-table-header-cell housing-col-name">保険</div>
            <div className="housing-table-cell housing-rental-table-insurance-body">
              {onAddInsurance &&
              onUpdateInsurance &&
              onRemoveInsurance &&
              insuranceState ? (
                <HousingInsuranceLinks
                  propertyName={rental.name}
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
        </div>
      </div>
    </div>
  );
}
