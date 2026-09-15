import { useEffect, useMemo } from 'react';
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
import { resolveRentalPayerMode } from '../../lib/housingRentalPayer';
import type { FamilyMember } from '../../types/family';
import type {
  RentalOccupancy,
  RentalPayerMode,
  RentalProperty,
} from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { HousingInsuranceLinks } from './HousingInsuranceLinks';
import { HousingManInput } from './HousingManInput';
import { HousingRenewalDateFields } from './HousingRenewalDateFields';

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
  onChange,
  onPayerModeChange,
  onRemove,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: RentalPropertyCardProps) {
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

  const rentLabel =
    payerMode === 'both'
      ? amountRole === 'spouseShare'
        ? '配偶者の負担額 / 月'
        : '家賃 / 月（分担）'
      : '家賃 / 月';

  return (
    <article className="housing-rental-card">
      <div className="housing-rental-card-header">
        <div className="housing-rental-header-fields">
          <label className="housing-rental-field housing-rental-name-field">
            <span className="housing-rental-field-label">物件名</span>
            <input
              type="text"
              className="housing-text-input ui-control-width--long"
              value={rental.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>

          <label className="housing-rental-field housing-rental-occupancy-field">
            <span className="housing-rental-field-label">入居状況</span>
            <select
              className="select-input select-input--compact housing-occupancy-select ui-control-width--medium"
              value={rental.occupancy}
              onChange={(e) =>
                update({ occupancy: e.target.value as RentalOccupancy })
              }
            >
              {OCCUPANCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {RENTAL_OCCUPANCY_SELECT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasSpouse ? (
          <label className="housing-rental-field housing-rental-payer-field">
            <span className="housing-rental-field-label">家賃の負担者</span>
            <select
              className="select-input select-input--compact housing-rental-payer-select ui-control-width--medium"
              value={payerMode}
              onChange={(e) =>
                onPayerModeChange(e.target.value as RentalPayerMode)
              }
            >
              <option value="head">世帯主が払う</option>
              <option value="spouse">配偶者が払う</option>
              <option value="both">両方で払う</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="housing-rental-card-body">
        <section className="housing-rental-block housing-rental-block--basic">
          <h4 className="housing-rental-block-title">基本情報</h4>
          <div className="housing-rental-basic-grid">
            <div className="housing-rental-field housing-rental-period-field">
              <span className="housing-rental-field-label">契約期間</span>
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
                          <option value={rental.startAge}>{rental.startAge}才</option>
                        </select>
                        <select
                          className="select-input select-input--compact select-input--schedule"
                          value={rental.startMonth}
                          disabled
                          aria-label="契約開始月（基準月）"
                        >
                          <option value={rental.startMonth}>{rental.startMonth}月</option>
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
                          aria-label="契約開始年齢"
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
                          aria-label="契約開始月"
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
                        aria-label="契約終了年齢"
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
                          aria-label="契約終了年齢"
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
                          aria-label="契約終了月"
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
                  {rental.endMode === 'until' ? (
                    <p className="period-end-label housing-period-end-label">
                      {formatEndYearLabel(
                        rental.endAge,
                        rental.endMonth,
                        birthYear,
                        timingMember.birthMonth,
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="housing-rental-field housing-rental-rent-field">
              <span className="housing-rental-field-label">{rentLabel}</span>
              {payerMode === 'both' && amountRole === 'primary' ? (
                <div className="housing-rental-split-rent">
                  <label className="housing-rental-split-rent-label">
                    <span>世帯主</span>
                    <HousingManInput
                      compact
                      value={rental.monthlyRentMan}
                      onChange={(monthlyRentMan) => update({ monthlyRentMan })}
                    />
                  </label>
                  <label className="housing-rental-split-rent-label">
                    <span>配偶者</span>
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
          </div>
        </section>

        {isUpcoming ? (
          <section className="housing-rental-block">
            <h4 className="housing-rental-block-title">入居時にかかる費用</h4>
            <div className="housing-rental-cost-grid housing-rental-cost-grid--four">
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">敷金</span>
                <HousingManInput
                  compact
                  value={rental.securityDepositMan}
                  onChange={(securityDepositMan) => update({ securityDepositMan })}
                />
              </label>
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">礼金／一時金</span>
                <HousingManInput
                  compact
                  value={rental.keyMoneyMan}
                  onChange={(keyMoneyMan) => update({ keyMoneyMan })}
                />
              </label>
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">仲介手数料</span>
                <HousingManInput
                  compact
                  value={rental.brokerageFeeMan}
                  onChange={(brokerageFeeMan) => update({ brokerageFeeMan })}
                />
              </label>
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">引越し費用</span>
                <HousingManInput
                  compact
                  value={rental.movingCostMan}
                  onChange={(movingCostMan) => update({ movingCostMan })}
                />
              </label>
            </div>
          </section>
        ) : null}

        {showEndCostInputs ? (
          <section className="housing-rental-block">
            <h4 className="housing-rental-block-title">退去時の費用・返金</h4>
            <div className="housing-rental-cost-grid housing-rental-cost-grid--two">
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">退去・引越し費用</span>
                <HousingManInput
                  compact
                  value={rental.moveOutCostMan}
                  onChange={(moveOutCostMan) => update({ moveOutCostMan })}
                />
              </label>
              <label className="housing-rental-field">
                <span className="housing-rental-field-label">敷金（返金）</span>
                <HousingManInput
                  compact
                  value={rental.securityDepositRefundMan}
                  onChange={(securityDepositRefundMan) =>
                    update({ securityDepositRefundMan })
                  }
                />
              </label>
            </div>
          </section>
        ) : null}

        <section className="housing-rental-block">
          <h4 className="housing-rental-block-title">更新</h4>
          <div className="housing-rental-renewal-grid">
            <label className="housing-rental-field">
              <span className="housing-rental-field-label">更新費用</span>
              <HousingManInput
                compact
                value={rental.renewalFeeMan}
                onChange={(renewalFeeMan) => update({ renewalFeeMan })}
              />
            </label>
            <div className="housing-rental-field">
              <span className="housing-rental-field-label">次回更新</span>
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
            <label className="housing-rental-field">
              <span className="housing-rental-field-label">以降の更新間隔</span>
              <select
                className="select-input select-input--compact ui-control-width--short"
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
            </label>
          </div>
        </section>

        <section className="housing-rental-block housing-rental-block--insurance">
          <h4 className="housing-rental-block-title">保険</h4>
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
        </section>
      </div>

      <div className="housing-rental-card-footer">
        <button
          type="button"
          className="housing-row-remove housing-rental-remove-btn"
          onClick={onRemove}
          aria-label="賃貸物件を削除"
        >
          賃貸物件を削除
        </button>
      </div>
    </article>
  );
}
