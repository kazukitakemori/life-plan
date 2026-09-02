import { calcBirthYear, formatEndYearLabel, formatYearAtAgeLabel } from '../../lib/birthDate';
import {
  formatRentalRenewalIntervalLabel,
  RENTAL_OCCUPANCY_SELECT_LABELS,
  RENTAL_RENEWAL_INTERVAL_OPTIONS,
} from '../../lib/housingLabels';
import { getLivingAgeOptions } from '../../lib/livingDefaults';
import type { FamilyMember } from '../../types/family';
import type { RentalOccupancy, RentalProperty } from '../../types/housing';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleState } from '../../types/vehicle';
import { HousingManInput } from './HousingManInput';
import { HousingInsuranceLinks } from './HousingInsuranceLinks';
import { HousingRenewalDateFields } from './HousingRenewalDateFields';

interface RentalPropertyCardProps {
  rental: RentalProperty;
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedInsurances?: InsuranceEntry[];
  insuranceState?: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  onChange: (rental: RentalProperty) => void;
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
  member,
  members,
  referenceDate,
  linkedInsurances = [],
  insuranceState,
  housingState,
  vehicleState,
  onChange,
  onRemove,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: RentalPropertyCardProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getLivingAgeOptions(member);
  const isUpcoming = rental.occupancy === 'upcoming';
  const showEndCostInputs = !isUpcoming && rental.endMode === 'until';

  const update = (patch: Partial<RentalProperty>) => {
    onChange({ ...rental, ...patch });
  };

  return (
    <div className="housing-rental-card">
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
            賃料/月
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
                    <select
                      className="select-input select-input--compact select-input--schedule"
                      value={rental.startAge}
                      onChange={(e) =>
                        update({ startAge: Number(e.target.value) })
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
                      value={rental.startMonth}
                      onChange={(e) =>
                        update({ startMonth: Number(e.target.value) })
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
                      rental.startAge,
                      rental.startMonth,
                      birthYear,
                      member.birthMonth,
                    )}
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
                        member.birthMonth,
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="housing-table-cell housing-col-amount">
              <HousingManInput
                compact
                value={rental.monthlyRentMan}
                onChange={(monthlyRentMan) => update({ monthlyRentMan })}
              />
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
