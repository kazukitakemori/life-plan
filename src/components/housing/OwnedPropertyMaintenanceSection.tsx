import { Fragment, type CSSProperties } from 'react';
import {
  createOwnedAnnualTaxEntry,
  createOwnedImprovementEntry,
  createOwnedMonthlyFeeEntry,
} from '../../lib/housingDefaults';
import {
  formatOwnedPeriodOffsetLabel,
  formatOwnedRepairIntervalLabel,
  OWNED_REPAIR_INTERVAL_OPTIONS,
} from '../../lib/housingLabels';
import type { FamilyMember } from '../../types/family';
import type {
  OwnedAnnualTaxEntry,
  OwnedImprovementEntry,
  OwnedMonthlyFeeEntry,
  OwnedProperty,
  OwnedPropertyMaintenance,
} from '../../types/housing';
import { OWNED_PERIOD_LIFETIME } from '../../types/housing';
import { HousingManInput } from './HousingManInput';
import { HousingRenewalDateFields } from './HousingRenewalDateFields';

interface OwnedPropertyMaintenanceSectionProps {
  property: OwnedProperty;
  member: FamilyMember;
  referenceDate: Date;
  onChange: (property: OwnedProperty) => void;
}

function getPeriodOffsetOptions(
  property: OwnedProperty,
  member: FamilyMember,
  forEnd: boolean,
): number[] {
  const spanYears =
    property.endMode === 'lifetime'
      ? Math.max(1, (member.expectedLifespan ?? 90) - property.startAge)
      : Math.max(1, property.endAge - property.startAge);
  const capped = Math.min(spanYears, 50);
  const options: number[] = [];
  for (let years = 0; years <= capped; years += 1) {
    options.push(years);
  }
  if (forEnd) {
    options.push(OWNED_PERIOD_LIFETIME);
  }
  return options;
}

interface MonthlyFeeTableProps {
  label: string;
  entries: OwnedMonthlyFeeEntry[];
  property: OwnedProperty;
  member: FamilyMember;
  onChange: (entries: OwnedMonthlyFeeEntry[]) => void;
}

function MonthlyFeeTable({
  label,
  entries,
  property,
  member,
  onChange,
}: MonthlyFeeTableProps) {
  const startOptions = getPeriodOffsetOptions(property, member, false);
  const endOptions = getPeriodOffsetOptions(property, member, true);
  const canRemove = entries.length > 1;

  const updateEntry = (id: string, patch: Partial<OwnedMonthlyFeeEntry>) => {
    onChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeEntry = (id: string) => {
    if (!canRemove) return;
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    const last = entries[entries.length - 1];
    const nextStart =
      last.endOffsetYears === OWNED_PERIOD_LIFETIME
        ? last.startOffsetYears
        : last.endOffsetYears;
    onChange([
      ...entries,
      createOwnedMonthlyFeeEntry({
        startOffsetYears: nextStart,
        endOffsetYears: OWNED_PERIOD_LIFETIME,
      }),
    ]);
  };

  return (
    <div
      className="housing-rental-table-group"
      style={{ '--fee-rows': entries.length } as CSSProperties}
    >
      <div
        className="housing-table-cell housing-col-name housing-table-cell--item-label housing-table-cell--rowspan-label"
        style={{ gridRow: `1 / ${entries.length + 1}` }}
      >
        {label}
      </div>
      {entries.map((entry, index) => {
        const row = index + 1;
        return (
          <Fragment key={entry.id}>
            <div
              className="housing-table-cell housing-col-period"
              style={{ gridRow: row, gridColumn: 2 }}
            >
              <select
                className="select-input select-input--compact housing-maint-offset-select"
                value={entry.startOffsetYears}
                onChange={(e) =>
                  updateEntry(entry.id, {
                    startOffsetYears: Number(e.target.value),
                  })
                }
                aria-label={`${label} 開始`}
              >
                {startOptions.map((offset) => (
                  <option key={offset} value={offset}>
                    {formatOwnedPeriodOffsetLabel(offset)}
                  </option>
                ))}
              </select>
              <span className="housing-maint-period-sep" aria-hidden>
                〜
              </span>
              <select
                className="select-input select-input--compact housing-maint-offset-select"
                value={entry.endOffsetYears}
                onChange={(e) =>
                  updateEntry(entry.id, {
                    endOffsetYears: Number(e.target.value),
                  })
                }
                aria-label={`${label} 終了`}
              >
                {endOptions.map((offset) => (
                  <option key={offset} value={offset}>
                    {formatOwnedPeriodOffsetLabel(offset)}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="housing-table-cell housing-col-amount"
              style={{ gridRow: row, gridColumn: 3 }}
            >
              <HousingManInput
                compact
                unit="万円/月"
                value={entry.amountManPerMonth}
                onChange={(amountManPerMonth) =>
                  updateEntry(entry.id, { amountManPerMonth })
                }
              />
            </div>
            <div
              className="housing-table-cell housing-col-add"
              style={{ gridRow: row, gridColumn: 4 }}
            >
              {index === entries.length - 1 && (
                <button
                  type="button"
                  className="housing-maint-add-btn"
                  onClick={addEntry}
                >
                  ＋ 追加
                </button>
              )}
            </div>
            <div
              className="housing-table-cell housing-col-action"
              style={{ gridRow: row, gridColumn: 5 }}
            >
              {canRemove && (
                <button
                  type="button"
                  className="housing-row-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${label}を削除`}
                >
                  −
                </button>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

interface TaxSectionProps {
  title: string;
  entries: OwnedAnnualTaxEntry[];
  referenceYear: number;
  onChange: (entries: OwnedAnnualTaxEntry[]) => void;
}

function TaxSection({
  title,
  entries,
  referenceYear,
  onChange,
}: TaxSectionProps) {
  const updateEntry = (id: string, patch: Partial<OwnedAnnualTaxEntry>) => {
    onChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeEntry = (id: string) => {
    onChange(entries.filter((entry) => entry.id !== id));
  };

  const addEntry = () => {
    const lastYear =
      entries
        .map((entry) => entry.startYear)
        .filter((year): year is number => year != null)
        .sort((a, b) => b - a)[0] ?? referenceYear;
    onChange([
      ...entries,
      createOwnedAnnualTaxEntry({ startYear: lastYear + 1 }),
    ]);
  };

  return (
    <div
      className="housing-rental-table-group"
      style={{ '--fee-rows': entries.length } as CSSProperties}
    >
      <div
        className="housing-table-cell housing-col-name housing-table-cell--item-label housing-table-cell--rowspan-label"
        style={{ gridRow: `1 / ${entries.length + 1}`, gridColumn: 1 }}
      >
        {title}
      </div>
      {entries.map((entry, index) => {
        const row = index + 1;
        return (
          <Fragment key={entry.id}>
            <div
              className="housing-table-cell housing-col-period"
              style={{ gridRow: row, gridColumn: 2 }}
            >
              {entry.startYear == null ? (
                <span className="housing-maint-tax-initial">当初</span>
              ) : (
                <>
                  <input
                    type="number"
                    className="housing-year-input"
                    value={entry.startYear}
                    min={referenceYear}
                    onChange={(e) =>
                      updateEntry(entry.id, {
                        startYear: Number(e.target.value) || referenceYear,
                      })
                    }
                    aria-label={`${title} 開始年`}
                  />
                  <span className="housing-maint-tax-year-suffix">年〜</span>
                </>
              )}
            </div>
            <div
              className="housing-table-cell housing-col-amount"
              style={{ gridRow: row, gridColumn: 3 }}
            >
              <HousingManInput
                compact
                unit="万円/年"
                value={entry.fixedAssetTaxMan}
                onChange={(fixedAssetTaxMan) =>
                  updateEntry(entry.id, { fixedAssetTaxMan })
                }
              />
            </div>
            <div
              className="housing-table-cell housing-col-amount"
              style={{ gridRow: row, gridColumn: 4 }}
            >
              <HousingManInput
                compact
                unit="万円/年"
                value={entry.cityPlanningTaxMan}
                onChange={(cityPlanningTaxMan) =>
                  updateEntry(entry.id, { cityPlanningTaxMan })
                }
              />
            </div>
            <div
              className="housing-table-cell housing-col-add"
              style={{ gridRow: row, gridColumn: 5 }}
            >
              {index === entries.length - 1 && (
                <button
                  type="button"
                  className="housing-maint-add-btn"
                  onClick={addEntry}
                >
                  ＋ 追加
                </button>
              )}
            </div>
            <div
              className="housing-table-cell housing-col-action"
              style={{ gridRow: row, gridColumn: 6 }}
            >
              {entry.startYear != null && (
                <button
                  type="button"
                  className="housing-row-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${title}の税額行を削除`}
                >
                  −
                </button>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function OwnedPropertyMaintenanceSection({
  property,
  member,
  referenceDate,
  onChange,
}: OwnedPropertyMaintenanceSectionProps) {
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const showBuildingTaxes = property.type !== 'land';
  const maintenance = property.maintenance;

  const updateMaintenance = (patch: Partial<OwnedPropertyMaintenance>) => {
    onChange({
      ...property,
      maintenance: { ...maintenance, ...patch },
    });
  };

  const updateImprovements = (improvements: OwnedImprovementEntry[]) => {
    updateMaintenance({ improvements });
  };

  const addImprovement = () => {
    updateImprovements([
      ...maintenance.improvements,
      createOwnedImprovementEntry(referenceYear, referenceMonth),
    ]);
  };

  const updateImprovement = (
    id: string,
    patch: Partial<OwnedImprovementEntry>,
  ) => {
    updateImprovements(
      maintenance.improvements.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeImprovement = (id: string) => {
    if (maintenance.improvements.length <= 1) return;
    updateImprovements(
      maintenance.improvements.filter((entry) => entry.id !== id),
    );
  };

  const canRemoveImprovement = maintenance.improvements.length > 1;

  return (
    <div className="housing-maint-layout">
      <div className="housing-rental-card">
        <div className="housing-rental-table housing-rental-table--maint-fees">
          <div className="housing-rental-table-header">
            <div className="housing-table-header-cell housing-col-name">項目</div>
            <div className="housing-table-header-cell housing-col-period">期間</div>
            <div className="housing-table-header-cell housing-col-amount">金額</div>
            <div className="housing-table-header-cell housing-col-add" />
            <div className="housing-table-header-cell housing-col-action" />
          </div>

          <div className="housing-rental-table-body">
            <MonthlyFeeTable
              label="管理費"
              entries={maintenance.managementFees}
              property={property}
              member={member}
              onChange={(managementFees) =>
                updateMaintenance({ managementFees })
              }
            />

            <MonthlyFeeTable
              label="修繕積立金"
              entries={maintenance.repairReserveFees}
              property={property}
              member={member}
              onChange={(repairReserveFees) =>
                updateMaintenance({ repairReserveFees })
              }
            />

            <div className="housing-rental-table-row housing-rental-table-row--self-repair">
              <div className="housing-table-cell housing-col-name housing-table-cell--item-label">
                自主修繕費
              </div>
              <div className="housing-table-cell housing-col-period housing-col-period--wide">
                <div className="housing-maint-self-repair-fields">
                  <div className="housing-maint-self-repair-line">
                    <span className="housing-maint-self-repair-label">費用：</span>
                    <HousingManInput
                      compact
                      value={maintenance.selfRepair.costMan}
                      onChange={(costMan) =>
                        updateMaintenance({
                          selfRepair: { ...maintenance.selfRepair, costMan },
                        })
                      }
                    />
                  </div>
                  <div className="housing-maint-self-repair-line">
                    <span className="housing-maint-self-repair-label">次回：</span>
                    <HousingRenewalDateFields
                      year={maintenance.selfRepair.nextYear}
                      month={maintenance.selfRepair.nextMonth}
                      referenceYear={referenceYear}
                      onChange={(nextYear, nextMonth) =>
                        updateMaintenance({
                          selfRepair: {
                            ...maintenance.selfRepair,
                            nextYear,
                            nextMonth,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="housing-maint-self-repair-line">
                    <span className="housing-maint-self-repair-label">以降：</span>
                    <select
                      className="select-input select-input--compact"
                      value={maintenance.selfRepair.intervalYears}
                      onChange={(e) =>
                        updateMaintenance({
                          selfRepair: {
                            ...maintenance.selfRepair,
                            intervalYears: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {OWNED_REPAIR_INTERVAL_OPTIONS.map((years) => (
                        <option key={years} value={years}>
                          {formatOwnedRepairIntervalLabel(years)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="housing-table-cell housing-col-action" />
            </div>

            <div
              className="housing-rental-table-group"
              style={
                {
                  '--fee-rows': maintenance.improvements.length,
                } as CSSProperties
              }
            >
              <div
                className="housing-table-cell housing-col-name housing-table-cell--item-label housing-table-cell--rowspan-label"
                style={{
                  gridRow: `1 / ${maintenance.improvements.length + 1}`,
                }}
              >
                改良費
              </div>
              {maintenance.improvements.map((entry, index) => {
                const row = index + 1;
                return (
                  <Fragment key={entry.id}>
                    <div
                      className="housing-table-cell housing-col-period"
                      style={{ gridRow: row, gridColumn: 2 }}
                    >
                      <HousingRenewalDateFields
                        year={entry.year}
                        month={entry.month}
                        referenceYear={referenceYear}
                        onChange={(year, month) =>
                          updateImprovement(entry.id, { year, month })
                        }
                      />
                    </div>
                    <div
                      className="housing-table-cell housing-col-amount"
                      style={{ gridRow: row, gridColumn: 3 }}
                    >
                      <HousingManInput
                        compact
                        value={entry.amountMan}
                        onChange={(amountMan) =>
                          updateImprovement(entry.id, { amountMan })
                        }
                      />
                    </div>
                    <div
                      className="housing-table-cell housing-col-add"
                      style={{ gridRow: row, gridColumn: 4 }}
                    >
                      {index === maintenance.improvements.length - 1 && (
                        <button
                          type="button"
                          className="housing-maint-add-btn"
                          onClick={addImprovement}
                        >
                          ＋ 追加
                        </button>
                      )}
                    </div>
                    <div
                      className="housing-table-cell housing-col-action"
                      style={{ gridRow: row, gridColumn: 5 }}
                    >
                      {canRemoveImprovement && (
                        <button
                          type="button"
                          className="housing-row-remove"
                          onClick={() => removeImprovement(entry.id)}
                          aria-label="改良費を削除"
                        >
                          −
                        </button>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="housing-rental-card">
        <div className="housing-rental-table housing-rental-table--maint-tax">
          <div className="housing-rental-table-header">
            <div className="housing-table-header-cell housing-col-name">税金</div>
            <div className="housing-table-header-cell housing-col-period">
              <a
                className="housing-maint-road-price-link"
                href="https://www.rosenka.nta.go.jp/"
                target="_blank"
                rel="noopener noreferrer"
              >
                路線価図 ↗
              </a>
            </div>
            <div className="housing-table-header-cell housing-col-amount">
              固定資産税
              <span
                className="housing-help-icon"
                title="固定資産税は毎年4月・5月・6月に納付する地方税です"
              >
                ?
              </span>
            </div>
            <div className="housing-table-header-cell housing-col-amount">
              都市計画税
              <span
                className="housing-help-icon"
                title="都市計画税は固定資産税とあわせて納付する地方税です"
              >
                ?
              </span>
            </div>
            <div className="housing-table-header-cell housing-col-add" />
            <div className="housing-table-header-cell housing-col-action" />
          </div>

          <div className="housing-rental-table-body">
            <TaxSection
              title="土地"
              entries={maintenance.landTaxes}
              referenceYear={referenceYear}
              onChange={(landTaxes) => updateMaintenance({ landTaxes })}
            />

            {showBuildingTaxes && (
              <TaxSection
                title="建物"
                entries={maintenance.buildingTaxes}
                referenceYear={referenceYear}
                onChange={(buildingTaxes) =>
                  updateMaintenance({ buildingTaxes })
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
