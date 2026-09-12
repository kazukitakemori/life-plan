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
    if (state.housingScenario === 'stay' && state.stayOption === 'continue') {
      patch.stayOption = 'renovate';
    }
    onChange(patch);
  };

  const selectHousingScenario = (scenario: SecondLifeState['housingScenario']) => {
    const patch: Partial<SecondLifeState> = { housingScenario: scenario };
    if (scenario === 'stay' && state.stayOption === 'continue') {
      patch.stayOption = 'renovate';
    }
    onChange(patch);
  };

  return (
    <section className="second-life-section">
      <SecondLifeModeSelector
        useCurrent={useCurrentPlan}
        currentLabel='Q5「住まい」の現在の計画をそのまま使う'
        reviewLabel="セカンドライフの住まいを見直す"
        currentDescription="Q5で入力している住まいの期間・費用を、そのままキャッシュフロー計算に使います。"
        reviewDescription="リフォーム・建て替え・転居など、セカンドライフ用の住まい方をここで設定します。"
        name="second-life-housing-mode"
        onUseCurrent={() => onChange({ housingSkip: true })}
        onReview={startHousingReview}
      />

      {useCurrentPlan ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            Q5「住まい」の入力を変更せず、その計画をそのまま計算に使用します。
          </p>
        </div>
      ) : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              セカンドライフ開始：{state.startAge}歳（開始年齢はこのページ上部で変更）
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
              Q5「住まい」の入力自体は変更せず、住まいを変える年齢以降のキャッシュフロー計算だけこの設計を優先します。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
