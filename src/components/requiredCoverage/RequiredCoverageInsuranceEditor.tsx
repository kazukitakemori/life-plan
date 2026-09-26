import type { FamilyMember } from '../../types/family';
import type { InsuranceCategory, InsuranceEntry, InsuranceState } from '../../types/insurance';

interface RequiredCoverageInsuranceEditorProps {
  insuranceState?: InsuranceState;
  familyMembers: FamilyMember[];
  riskKind: 'death' | 'medical';
  subjectMemberId: string;
  onEntryChange?: (entry: InsuranceEntry) => void;
  onEntryAdd?: (category: InsuranceCategory, insuredMemberId: string) => void;
  onEntryRemove?: (entryId: string) => void;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

export function RequiredCoverageInsuranceEditor({
  insuranceState,
  familyMembers,
  riskKind,
  subjectMemberId,
  onEntryChange,
  onEntryAdd,
  onEntryRemove,
}: RequiredCoverageInsuranceEditorProps) {
  if (!insuranceState) return null;

  const subjectMember = familyMembers.find((member) => member.id === subjectMemberId);
  const rows = Object.entries(insuranceState.byMember ?? {})
    .flatMap(([contractorMemberId, entries]) =>
      entries.map((entry) => ({ contractorMemberId, entry })),
    )
    .filter(({ contractorMemberId, entry }) => {
      const targetMemberId = entry.insuredMemberId ?? contractorMemberId;
      if (targetMemberId !== subjectMemberId) return false;
      return riskKind === 'death'
        ? entry.category === 'life'
        : entry.category === 'medical' || entry.category === 'cancer';
    });

  return (
    <section
      className="required-coverage-card required-coverage-insurance-editor"
      aria-labelledby="required-coverage-current-insurance-heading"
    >
      <h3
        id="required-coverage-current-insurance-heading"
        className="required-coverage-card-title"
      >
        現在の保障
      </h3>
      {rows.length > 0 ? (
        <div className="required-coverage-insurance-list">
          {rows.map(({ entry }) => {
          return (
            <div key={entry.id} className="required-coverage-insurance-row">
              <div className="required-coverage-insurance-name">
                <strong>{entry.name || '保険'}</strong>
              </div>

              {riskKind === 'death' && entry.category === 'life' ? (
                <>
                  <label className="required-coverage-insurance-field">
                    <span>死亡保障額</span>
                    <div className="life-event-amount-field">
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={10}
                        value={entry.deathBenefitMan ?? 0}
                        disabled={!onEntryChange}
                        onChange={(event) =>
                          onEntryChange?.({
                            ...entry,
                            deathBenefitMan: roundMan(
                              Math.max(0, Number(event.target.value) || 0),
                            ),
                          })
                        }
                      />
                      <span className="amount-unit">万円</span>
                    </div>
                  </label>
                  <label className="required-coverage-insurance-field">
                    <span>保障期間</span>
                    <select
                      className="select-input"
                      value={entry.deathCoverageEndMode ?? ''}
                      disabled={!onEntryChange}
                      onChange={(event) => {
                        const value = event.target.value;
                        onEntryChange?.({
                          ...entry,
                          deathCoverageEndMode:
                            value === 'lifetime' || value === 'until'
                              ? value
                              : undefined,
                          deathCoverageEndAge:
                            value === 'until'
                              ? (entry.deathCoverageEndAge ??
                                subjectMember?.expectedLifespan ??
                                80)
                              : entry.deathCoverageEndAge,
                        });
                      }}
                    >
                      <option value="">未設定</option>
                      <option value="lifetime">終身</option>
                      <option value="until">年齢まで</option>
                    </select>
                  </label>
                  <p className="required-coverage-card-note">
                    ここでは税引前の死亡保障額を既契約保障として反映します。
                  </p>
                  {entry.deathCoverageEndMode === 'until' ? (
                    <label className="required-coverage-insurance-field">
                      <span>保障終了</span>
                      <div className="life-event-amount-field">
                        <input
                          type="number"
                          className="amount-input amount-input--compact"
                          min={0}
                          max={120}
                          step={1}
                          value={
                            entry.deathCoverageEndAge ??
                            subjectMember?.expectedLifespan ??
                            80
                          }
                          disabled={!onEntryChange}
                          onChange={(event) =>
                            onEntryChange?.({
                              ...entry,
                              deathCoverageEndAge: Math.max(
                                0,
                                Math.min(
                                  120,
                                  Math.round(Number(event.target.value) || 0),
                                ),
                              ),
                            })
                          }
                        />
                        <span className="amount-unit">歳</span>
                      </div>
                    </label>
                  ) : null}
                </>
              ) : null}

              {riskKind === 'medical' && entry.category === 'medical' ? (
                <label className="required-coverage-insurance-field">
                  <span>入院給付金</span>
                  <div className="life-event-amount-field">
                    <input
                      type="number"
                      className="amount-input"
                      min={0}
                      step={1000}
                      value={entry.medicalHospitalDailyYen ?? 0}
                      disabled={!onEntryChange}
                      onChange={(event) =>
                        onEntryChange?.({
                          ...entry,
                          medicalHospitalDailyYen: Math.max(
                            0,
                            Math.round(Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span className="amount-unit">円/日</span>
                  </div>
                </label>
              ) : null}

              {riskKind === 'medical' && entry.category === 'cancer' ? (
                <label className="required-coverage-insurance-field">
                  <span>診断一時金</span>
                  <div className="life-event-amount-field">
                    <input
                      type="number"
                      className="amount-input"
                      min={0}
                      step={10}
                      value={entry.cancerDiagnosisBenefitMan ?? 0}
                      disabled={!onEntryChange}
                      onChange={(event) =>
                        onEntryChange?.({
                          ...entry,
                          cancerDiagnosisBenefitMan: roundMan(
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span className="amount-unit">万円</span>
                  </div>
                </label>
              ) : null}

              {onEntryRemove ? (
                <button
                  type="button"
                  className="required-coverage-insurance-remove"
                  onClick={() => {
                    const label = entry.name || 'この保障';
                    if (window.confirm(`${label}を削除しますか？`)) {
                      onEntryRemove(entry.id);
                    }
                  }}
                >
                  この保障を削除
                </button>
              ) : null}
            </div>
          );
          })}
        </div>
      ) : null}
      {onEntryAdd ? (
        <div className="required-coverage-insurance-add">
          {riskKind === 'death' ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => onEntryAdd('life', subjectMemberId)}
            >
              ＋ 死亡保障を追加
            </button>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onEntryAdd('medical', subjectMemberId)}
              >
                ＋ 医療保障を追加
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onEntryAdd('cancer', subjectMemberId)}
              >
                ＋ がん保障を追加
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
