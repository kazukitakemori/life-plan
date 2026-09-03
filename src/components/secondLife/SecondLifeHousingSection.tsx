import type { SecondLifeState } from '../../types/secondLife';
import {
  estimateSecondLifeHousingTotalMan,
  formatSecondLifeMan,
} from '../../lib/secondLifeEstimates';
import { SECOND_LIFE_SKIP_LABEL } from '../../lib/secondLifeLabels';
import {
  SecondLifeChoiceCard,
  SecondLifePlaceholderBody,
} from './SecondLifeChoiceCard';
import { SecondLifeStartAgeField } from './SecondLifeStartAgeField';

interface SecondLifeHousingSectionProps {
  state: SecondLifeState;
  onChange: (patch: Partial<SecondLifeState>) => void;
  onApply?: () => void;
}

const HOUSING_SCENARIOS: {
  id: SecondLifeState['housingScenario'];
  label: string;
}[] = [
  { id: 'stay', label: '今の場所に住み続けたい' },
  { id: 'hometown', label: '地元に帰りたい' },
  { id: 'new_area', label: '新しい土地で暮らしたい' },
];

export function SecondLifeHousingSection({
  state,
  onChange,
  onApply,
}: SecondLifeHousingSectionProps) {
  const total = estimateSecondLifeHousingTotalMan(state);
  const placeholder = state.housingSkip;

  return (
    <section
      className={
        placeholder
          ? 'second-life-section second-life-section--skipped'
          : 'second-life-section'
      }
    >
      <div className="second-life-section-toolbar">
        <SecondLifeStartAgeField
          value={state.startAge}
          onChange={(startAge) => onChange({ startAge })}
        />
      </div>

      <label
        className={
          placeholder ? 'second-life-skip is-checked' : 'second-life-skip'
        }
      >
        <input
          type="checkbox"
          checked={state.housingSkip}
          onChange={(event) => onChange({ housingSkip: event.target.checked })}
        />
        {SECOND_LIFE_SKIP_LABEL}
      </label>

      <div
        className={
          placeholder
            ? 'second-life-choice-grid is-placeholder'
            : 'second-life-choice-grid'
        }
        role={placeholder ? undefined : 'radiogroup'}
        aria-label="将来のお住まいの選択"
        aria-disabled={placeholder || undefined}
      >
        {HOUSING_SCENARIOS.map((scenario) => {
          const active = !placeholder && state.housingScenario === scenario.id;
          return (
            <SecondLifeChoiceCard
              key={scenario.id}
              active={active}
              label={scenario.label}
              name="second-life-housing-scenario"
              placeholder={placeholder}
              onSelect={() => onChange({ housingScenario: scenario.id })}
            >
              {placeholder ? (
                <SecondLifePlaceholderBody totalLabel="総額" lines={3} />
              ) : (
                <>
                  {scenario.id === 'stay' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-stay"
                          checked={state.stayOption === 'renovate'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'stay',
                              stayOption: 'renovate',
                            })
                          }
                        />
                        現在の住宅をリフォームしながら住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-stay"
                          checked={state.stayOption === 'purchase_rebuild'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'stay',
                              stayOption: 'purchase_rebuild',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      {state.stayOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {scenario.id === 'hometown' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-hometown"
                          checked={state.hometownOption === 'renovate_parents'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'hometown',
                              hometownOption: 'renovate_parents',
                            })
                          }
                        />
                        実家をリフォームしながら住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-hometown"
                          checked={state.hometownOption === 'purchase_rebuild'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'hometown',
                              hometownOption: 'purchase_rebuild',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="checkbox"
                          checked={state.includeMovingCost}
                          onChange={(event) =>
                            onChange({ includeMovingCost: event.target.checked })
                          }
                        />
                        引越し
                      </label>
                      {state.hometownOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {scenario.id === 'new_area' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-new-area"
                          checked={state.newAreaOption === 'rent'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'new_area',
                              newAreaOption: 'rent',
                            })
                          }
                        />
                        賃貸住宅に住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-new-area"
                          checked={state.newAreaOption === 'purchase'}
                          onChange={() =>
                            onChange({
                              housingScenario: 'new_area',
                              newAreaOption: 'purchase',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="checkbox"
                          checked={state.includeMovingCost}
                          onChange={(event) =>
                            onChange({ includeMovingCost: event.target.checked })
                          }
                        />
                        引越し
                      </label>
                      {state.newAreaOption === 'purchase' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  <p className="second-life-choice-total">
                    総額{' '}
                    <strong>{active ? formatSecondLifeMan(total) : '—'}</strong>{' '}
                    万円
                  </p>
                </>
              )}
            </SecondLifeChoiceCard>
          );
        })}
      </div>

      {!placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            選択内容に応じて、この画面の住まい入力へ反映します（賃貸・購入は物件を追加、転居時は既存住まいを終了、リフォーム費用はQ3へ）。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
          >
            この内容を住まいに反映する
          </button>
        </div>
      ) : null}
    </section>
  );
}
