import type { SecondLifeState } from '../../types/secondLife';
import {
  estimateSecondLifeHousingTotalMan,
  formatSecondLifeMan,
} from '../../lib/secondLifeEstimates';
import { getSecondLifeHousingTemplateKind } from '../../lib/secondLifeLabels';
import { SecondLifeChoiceCard } from './SecondLifeChoiceCard';
import { SecondLifeModeSelector } from './SecondLifeModeSelector';

interface SecondLifeHousingSectionProps {
  state: SecondLifeState;
  onChange: (patch: Partial<SecondLifeState>) => void;
  onApply?: () => void;
}

const HOUSING_SCENARIOS: {
  id: SecondLifeState['housingScenario'];
  label: string;
}[] = [
  { id: 'stay', label: '今の場所でリフォーム・建て替え' },
  { id: 'hometown', label: '地元に帰る' },
  { id: 'new_area', label: '新しい土地で暮らす' },
];

export function SecondLifeHousingSection({
  state,
  onChange,
}: SecondLifeHousingSectionProps) {
  const total = estimateSecondLifeHousingTotalMan(state);
  const useCurrentPlan = state.housingSkip;
  const housingKind = getSecondLifeHousingTemplateKind(state);
  const hasHousingAction = housingKind !== 'stay' && housingKind !== 'skip';

  const startHousingReview = () => {
    const patch: Partial<SecondLifeState> = { housingSkip: false };
    if (state.housingScenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') {
        patch.stayOption = 'renovate';
      }
    }
    onChange(patch);
  };

  const selectHousingScenario = (scenario: SecondLifeState['housingScenario']) => {
    const patch: Partial<SecondLifeState> = { housingScenario: scenario };
    if (scenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') {
        patch.stayOption = 'renovate';
      }
    }
    onChange(patch);
  };

  return (
    <section className="second-life-section">
      <SecondLifeModeSelector
        title="これからの住まいはどうしますか？"
        useCurrent={useCurrentPlan}
        currentLabel="今の住まい計画をそのまま使う"
        reviewLabel="これからの住まいを見直す"
        currentDescription="「住まい」で入力している期間・費用のまま計算します。"
        reviewDescription="リフォーム・建て替え・転居など、今の計画から変える内容を設定します。"
        name="second-life-housing-mode"
        onUseCurrent={() => onChange({ housingSkip: true })}
        onReview={startHousingReview}
      />

      {useCurrentPlan ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            「住まい」で入力した内容のまま計算します。元の入力は変更しません。
          </p>
        </div>
      ) : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              住まいを変える時期を設定してください（{state.startAge}歳以降）。
            </p>
            {hasHousingAction ? (
              <label className="second-life-timing">
                <span>住まいを変える年齢（世帯主）</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={state.startAge}
                  max={110}
                  value={state.housingActionAge}
                  onChange={(event) =>
                    onChange({
                      housingActionAge: Math.max(
                        state.startAge,
                        Number(event.target.value) || state.startAge,
                      ),
                    })
                  }
                />
                <span>歳</span>
              </label>
            ) : null}
          </div>

          <div
            className="second-life-choice-grid"
            role="radiogroup"
            aria-label="セカンドライフの住まい方"
          >
            {HOUSING_SCENARIOS.map((scenario) => {
              const active = state.housingScenario === scenario.id;
              return (
                <SecondLifeChoiceCard
                  key={scenario.id}
                  active={active}
                  label={scenario.label}
                  name="second-life-housing-scenario"
                  onSelect={() => selectHousingScenario(scenario.id)}
                >
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
                </SecondLifeChoiceCard>
              );
            })}
          </div>

          <div className="second-life-section-actions">
            <p className="second-life-apply-note">
              元の「住まい」の入力は残ります。計算では、{state.housingActionAge}歳から上で選んだ住まい方に切り替わります。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
