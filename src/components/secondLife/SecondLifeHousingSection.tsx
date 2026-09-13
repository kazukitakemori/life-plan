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
  const configured = state.housingConfigured !== false;
  const placeholder = configured && state.housingSkip;

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

      {!configured ? (
        <p className="second-life-apply-note">
          まだ設定されていません。老後の住まい方を選ぶと、住宅費の目安を表示します。
        </p>
      ) : null}

      <label
        className={
          placeholder ? 'second-life-skip is-checked' : 'second-life-skip'
        }
      >
        <input
          type="checkbox"
          checked={placeholder}
          onChange={(event) =>
            onChange({
              housingConfigured: true,
              housingSkip: event.target.checked,
            })
          }
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
          const active =
            configured && !placeholder && state.housingScenario === scenario.id;
          return (
            <SecondLifeChoiceCard
              key={scenario.id}
              active={active}
              label={scenario.label}
              name="second-life-housing-scenario"
              placeholder={placeholder}
              onSelect={() =>
                onChange({
                  housingConfigured: true,
                  housingScenario: scenario.id,
                })
              }
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
                          checked={active && state.stayOption === 'renovate'}
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
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
                          checked={
                            active && state.stayOption === 'purchase_rebuild'
                          }
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
                              housingScenario: 'stay',
                              stayOption: 'purchase_rebuild',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      {active && state.stayOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                housingConfigured: true,
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
                          checked={
                            active && state.hometownOption === 'renovate_parents'
                          }
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
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
                          checked={
                            active && state.hometownOption === 'purchase_rebuild'
                          }
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
                              housingScenario: 'hometown',
                              hometownOption: 'purchase_rebuild',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      {active ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includeMovingCost}
                            onChange={(event) =>
                              onChange({
                                housingConfigured: true,
                                includeMovingCost: event.target.checked,
                              })
                            }
                          />
                          引越し
                        </label>
                      ) : null}
                      {active && state.hometownOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                housingConfigured: true,
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
                          checked={active && state.newAreaOption === 'rent'}
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
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
                          checked={active && state.newAreaOption === 'purchase'}
                          onChange={() =>
                            onChange({
                              housingConfigured: true,
                              housingScenario: 'new_area',
                              newAreaOption: 'purchase',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      {active ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includeMovingCost}
                            onChange={(event) =>
                              onChange({
                                housingConfigured: true,
                                includeMovingCost: event.target.checked,
                              })
                            }
                          />
                          引越し
                        </label>
                      ) : null}
                      {active && state.newAreaOption === 'purchase' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                housingConfigured: true,
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
                    住宅費の目安{' '}
                    <strong>
                      {active && total != null ? formatSecondLifeMan(total) : '未設定'}
                    </strong>{' '}
                    {active && total != null ? '万円' : ''}
                  </p>
                </>
              )}
            </SecondLifeChoiceCard>
          );
        })}
      </div>

      {configured && !placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            現在の住まい設定との重なりを確認してから反映します。今の住まいを継続する計画なら終了時期は変更せず、転居する計画なら切替時期を確認できます。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
          >
            住まい計画を確認して反映する
          </button>
        </div>
      ) : null}
    </section>
  );
}
