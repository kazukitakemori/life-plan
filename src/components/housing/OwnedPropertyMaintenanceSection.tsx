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

interface MonthlyFeeGroupProps {
  label: string;
  entries: OwnedMonthlyFeeEntry[];
  property: OwnedProperty;
  member: FamilyMember;
  onChange: (entries: OwnedMonthlyFeeEntry[]) => void;
}

function MonthlyFeeGroup({
  label,
  entries,
  property,
  member,
  onChange,
}: MonthlyFeeGroupProps) {
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
    <section className="housing-maint-subsection">
      <div className="housing-maint-subsection-header">
        <div>
          <h6 className="housing-maint-subsection-title">{label}</h6>
          <p className="housing-maint-subsection-note">
            金額が変わる場合は、期間を追加して分けて入力できます。
          </p>
        </div>
      </div>

      <div className="housing-maint-entry-list">
        {entries.map((entry, index) => (
          <div className="housing-maint-entry-card" key={entry.id}>
            <div className="housing-maint-entry-header">
              <strong className="housing-maint-entry-title">
                {entries.length > 1 ? `${label} ${index + 1}` : label}
              </strong>
              {canRemove ? (
                <button
                  type="button"
                  className="ui-entry-delete-button housing-maint-entry-delete"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${label}${index + 1}を削除`}
                >
                  削除
                </button>
              ) : null}
            </div>

            <div className="housing-maint-entry-grid housing-maint-entry-grid--monthly">
              <label className="housing-maint-field">
                <span className="housing-maint-field-label">適用期間</span>
                <div className="housing-maint-period-fields">
                  <select
                    className="select-input select-input--compact ui-control-width--medium"
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
                    className="select-input select-input--compact ui-control-width--medium"
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
              </label>

              <label className="housing-maint-field">
                <span className="housing-maint-field-label">月額</span>
                <HousingManInput
                  compact
                  unit="万円/月"
                  value={entry.amountManPerMonth}
                  onChange={(amountManPerMonth) =>
                    updateEntry(entry.id, { amountManPerMonth })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="housing-maint-add-row">
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={addEntry}
        >
          ＋ 期間を追加
        </button>
      </div>
    </section>
  );
}

interface TaxGroupProps {
  title: string;
  entries: OwnedAnnualTaxEntry[];
  referenceYear: number;
  onChange: (entries: OwnedAnnualTaxEntry[]) => void;
}

function TaxGroup({
  title,
  entries,
  referenceYear,
  onChange,
}: TaxGroupProps) {
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
    <section className="housing-maint-subsection">
      <div className="housing-maint-subsection-header">
        <div>
          <h6 className="housing-maint-subsection-title">{title}</h6>
          <p className="housing-maint-subsection-note">
            税額が変わる場合は、変更年を追加して分けて入力できます。
          </p>
        </div>
      </div>

      <div className="housing-maint-entry-list">
        {entries.map((entry, index) => (
          <div className="housing-maint-entry-card" key={entry.id}>
            <div className="housing-maint-entry-header">
              <strong className="housing-maint-entry-title">
                {entry.startYear == null
                  ? `${title}・当初`
                  : `${title}・${entry.startYear}年から`}
              </strong>
              {entry.startYear != null ? (
                <button
                  type="button"
                  className="ui-entry-delete-button housing-maint-entry-delete"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`${title}${index + 1}の税額設定を削除`}
                >
                  削除
                </button>
              ) : null}
            </div>

            <div className="housing-maint-entry-grid housing-maint-entry-grid--tax">
              <label className="housing-maint-field">
                <span className="housing-maint-field-label">適用開始</span>
                {entry.startYear == null ? (
                  <span className="housing-maint-static-value">当初から</span>
                ) : (
                  <div className="housing-maint-year-field">
                    <input
                      type="number"
                      className="housing-year-input ui-control-width--short"
                      value={entry.startYear}
                      min={referenceYear}
                      onChange={(e) =>
                        updateEntry(entry.id, {
                          startYear: Number(e.target.value) || referenceYear,
                        })
                      }
                      aria-label={`${title} 開始年`}
                    />
                    <span>年〜</span>
                  </div>
                )}
              </label>

              <label className="housing-maint-field">
                <span className="housing-maint-field-label">固定資産税</span>
                <HousingManInput
                  compact
                  unit="万円/年"
                  value={entry.fixedAssetTaxMan}
                  onChange={(fixedAssetTaxMan) =>
                    updateEntry(entry.id, { fixedAssetTaxMan })
                  }
                />
              </label>

              <label className="housing-maint-field">
                <span className="housing-maint-field-label">都市計画税</span>
                <HousingManInput
                  compact
                  unit="万円/年"
                  value={entry.cityPlanningTaxMan}
                  onChange={(cityPlanningTaxMan) =>
                    updateEntry(entry.id, { cityPlanningTaxMan })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="housing-maint-add-row">
        <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={addEntry}
        >
          ＋ 税額の変更年を追加
        </button>
      </div>
    </section>
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
    <div className="housing-maint-layout housing-maint-layout--cards">
      <section className="housing-maint-panel">
        <div className="housing-maint-panel-header">
          <div>
            <h5 className="housing-maint-panel-title">毎月の維持費</h5>
            <p className="housing-maint-panel-note">
              管理費と修繕積立金を、金額が変わる期間ごとに入力します。
            </p>
          </div>
        </div>
        <div className="housing-maint-panel-body">
          <MonthlyFeeGroup
            label="管理費"
            entries={maintenance.managementFees}
            property={property}
            member={member}
            onChange={(managementFees) =>
              updateMaintenance({ managementFees })
            }
          />
          <MonthlyFeeGroup
            label="修繕積立金"
            entries={maintenance.repairReserveFees}
            property={property}
            member={member}
            onChange={(repairReserveFees) =>
              updateMaintenance({ repairReserveFees })
            }
          />
        </div>
      </section>

      <section className="housing-maint-panel">
        <div className="housing-maint-panel-header">
          <div>
            <h5 className="housing-maint-panel-title">修繕・改良</h5>
            <p className="housing-maint-panel-note">
              定期的な自主修繕と、個別に予定している改良費を入力します。
            </p>
          </div>
        </div>
        <div className="housing-maint-panel-body">
          <section className="housing-maint-subsection">
            <div className="housing-maint-subsection-header">
              <div>
                <h6 className="housing-maint-subsection-title">自主修繕費</h6>
                <p className="housing-maint-subsection-note">
                  次回予定年と、その後の繰り返し周期を設定します。
                </p>
              </div>
            </div>

            <div className="housing-maint-entry-card">
              <div className="housing-maint-entry-grid housing-maint-entry-grid--repair">
                <label className="housing-maint-field">
                  <span className="housing-maint-field-label">費用</span>
                  <HousingManInput
                    compact
                    value={maintenance.selfRepair.costMan}
                    onChange={(costMan) =>
                      updateMaintenance({
                        selfRepair: { ...maintenance.selfRepair, costMan },
                      })
                    }
                  />
                </label>

                <div className="housing-maint-field">
                  <span className="housing-maint-field-label">次回予定年</span>
                  <HousingRenewalDateFields
                    year={maintenance.selfRepair.nextYear}
                    month={maintenance.selfRepair.nextMonth}
                    referenceYear={referenceYear}
                    yearOnly
                    onChange={(nextYear) =>
                      updateMaintenance({
                        selfRepair: {
                          ...maintenance.selfRepair,
                          nextYear,
                        },
                      })
                    }
                  />
                </div>

                <label className="housing-maint-field">
                  <span className="housing-maint-field-label">以降の周期</span>
                  <select
                    className="select-input select-input--compact ui-control-width--medium"
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
                </label>
              </div>
            </div>
          </section>

          <section className="housing-maint-subsection">
            <div className="housing-maint-subsection-header">
              <div>
                <h6 className="housing-maint-subsection-title">改良費</h6>
                <p className="housing-maint-subsection-note">
                  リフォームなど、予定年が決まっている支出を個別に登録します。
                </p>
              </div>
            </div>

            <div className="housing-maint-entry-list">
              {maintenance.improvements.map((entry, index) => (
                <div className="housing-maint-entry-card" key={entry.id}>
                  <div className="housing-maint-entry-header">
                    <strong className="housing-maint-entry-title">
                      改良費 {index + 1}
                    </strong>
                    {canRemoveImprovement ? (
                      <button
                        type="button"
                        className="ui-entry-delete-button housing-maint-entry-delete"
                        onClick={() => removeImprovement(entry.id)}
                        aria-label={`改良費${index + 1}を削除`}
                      >
                        削除
                      </button>
                    ) : null}
                  </div>

                  <div className="housing-maint-entry-grid housing-maint-entry-grid--improvement">
                    <div className="housing-maint-field">
                      <span className="housing-maint-field-label">予定年</span>
                      <HousingRenewalDateFields
                        year={entry.year}
                        month={entry.month}
                        referenceYear={referenceYear}
                        yearOnly
                        onChange={(year) =>
                          updateImprovement(entry.id, { year })
                        }
                      />
                    </div>
                    <label className="housing-maint-field">
                      <span className="housing-maint-field-label">金額</span>
                      <HousingManInput
                        compact
                        value={entry.amountMan}
                        onChange={(amountMan) =>
                          updateImprovement(entry.id, { amountMan })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="housing-maint-add-row">
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={addImprovement}
              >
                ＋ 改良費を追加
              </button>
            </div>
          </section>
        </div>
      </section>

      <section className="housing-maint-panel">
        <div className="housing-maint-panel-header housing-maint-panel-header--action">
          <div>
            <h5 className="housing-maint-panel-title">
              固定資産税・都市計画税
            </h5>
            <p className="housing-maint-panel-note">
              土地と建物を分けて、年額を入力します。
            </p>
          </div>
          <a
            className="ui-btn ui-btn--ghost housing-maint-road-price-link"
            href="https://www.rosenka.nta.go.jp/"
            target="_blank"
            rel="noopener noreferrer"
          >
            路線価図を開く ↗
          </a>
        </div>

        <div className="housing-maint-panel-body">
          <TaxGroup
            title="土地"
            entries={maintenance.landTaxes}
            referenceYear={referenceYear}
            onChange={(landTaxes) => updateMaintenance({ landTaxes })}
          />

          {showBuildingTaxes ? (
            <TaxGroup
              title="建物"
              entries={maintenance.buildingTaxes}
              referenceYear={referenceYear}
              onChange={(buildingTaxes) =>
                updateMaintenance({ buildingTaxes })
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
