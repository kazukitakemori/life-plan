import type { SecondLifeState } from '../../types/secondLife';
import {
  estimateSecondLifeHousingTotalMan,
  formatSecondLifeMan,
} from '../../lib/secondLifeEstimates';
import { getSecondLifeHousingTemplateKind } from '../../lib/secondLifeLabels';
import {
  estimateSecondLifeHousingLoanMonthlyMan,
  getDefaultSecondLifeHousingBaseCostMan,
  getSecondLifeHousingBaseCostLabel,
  getSecondLifeHousingLoanPrincipalMan,
  isSecondLifeHousingLoanConfigured,
  SECOND_LIFE_MOVING_COST_MAN,
  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
} from '../../lib/secondLifeHousingFinance';
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
  const isRent = housingKind === 'rent';
  const needsBaseCost = housingKind === 'renovate' || housingKind === 'purchase';
  const loanConfigured = isSecondLifeHousingLoanConfigured(state);
  const loanPrincipalMan = getSecondLifeHousingLoanPrincipalMan(state);
  const loanMonthlyMan = estimateSecondLifeHousingLoanMonthlyMan(state);

  const withSelectionDefaults = (patch: Partial<SecondLifeState>) => {
    const next = { ...state, ...patch };
    onChange({
      ...patch,
      housingBaseCostMan: getDefaultSecondLifeHousingBaseCostMan(next),
    });
  };

  const startHousingReview = () => {
    const patch: Partial<SecondLifeState> = { housingSkip: false };
    if (state.housingScenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') {
        patch.stayOption = 'renovate';
      }
    }
    const next = { ...state, ...patch };
    onChange({
      ...patch,
      housingBaseCostMan:
        state.housingBaseCostMan > 0
          ? state.housingBaseCostMan
          : getDefaultSecondLifeHousingBaseCostMan(next),
    });
  };

  const selectHousingScenario = (scenario: SecondLifeState['housingScenario']) => {
    const patch: Partial<SecondLifeState> = { housingScenario: scenario };
    if (scenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') patch.stayOption = 'renovate';
    }
    withSelectionDefaults(patch);
  };

  const setBaseCost = (value: number) => {
    const housingBaseCostMan = Math.max(0, value || 0);
    onChange({
      housingBaseCostMan,
      housingLoanDownPaymentMan: Math.min(
        housingBaseCostMan,
        Math.max(0, state.housingLoanDownPaymentMan),
      ),
    });
  };

  const estimatedLoanEndAge =
    state.housingLoanYears != null
      ? state.housingActionAge + state.housingLoanYears
      : null;

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
                            withSelectionDefaults({
                              housingScenario: 'stay',
                              stayOption: 'renovate',
                              includeMovingCost: false,
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
                            withSelectionDefaults({
                              housingScenario: 'stay',
                              stayOption: 'purchase_rebuild',
                              includeMovingCost: false,
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
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
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
                            withSelectionDefaults({
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
                            withSelectionDefaults({
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
                        引越し費を見込む（仮に{SECOND_LIFE_MOVING_COST_MAN}万円）
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
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
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
                            withSelectionDefaults({
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
                            withSelectionDefaults({
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
                        引越し費を見込む（仮に{SECOND_LIFE_MOVING_COST_MAN}万円）
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
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
                        </label>
                      ) : null}
                    </>
                  ) : null}
                </SecondLifeChoiceCard>
              );
            })}
          </div>

          {isRent ? (
            <div className="second-life-section-toolbar">
              <label className="second-life-timing">
                <span>想定する月額家賃</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={0}
                  step={0.1}
                  value={state.housingRentMonthlyMan}
                  onChange={(event) =>
                    onChange({
                      housingRentMonthlyMan: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                />
                <span>万円</span>
              </label>
              <p className="second-life-apply-note">
                敷金1か月・礼金1か月・仲介手数料0.5か月を試算用の仮設定にしています。実際の契約条件とは異なる場合があります。
              </p>
              <p className="second-life-apply-note">
                初期費用の仮試算：{formatSecondLifeMan(
                  state.housingRentMonthlyMan * 2.5 +
                    (state.includeMovingCost ? SECOND_LIFE_MOVING_COST_MAN : 0),
                )}万円
              </p>
            </div>
          ) : null}

          {needsBaseCost ? (
            <div className="second-life-section-toolbar">
              <label className="second-life-timing">
                <span>{getSecondLifeHousingBaseCostLabel(state)}</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={0}
                  step={10}
                  value={state.housingBaseCostMan}
                  onChange={(event) => setBaseCost(Number(event.target.value))}
                />
                <span>万円</span>
              </label>
              <p className="second-life-apply-note">
                最初に入っている金額は比較用の仮設定です。見積額や希望額が分かる場合は、ここを変更してください。
              </p>

              <div role="radiogroup" aria-label="住まい費用の支払い方法">
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'cash'}
                    onChange={() => onChange({ housingPaymentMethod: 'cash' })}
                  />
                  現金で支払う
                </label>
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'loan'}
                    onChange={() => onChange({ housingPaymentMethod: 'loan' })}
                  />
                  ローンを利用する
                </label>
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'undecided'}
                    onChange={() =>
                      onChange({ housingPaymentMethod: 'undecided' })
                    }
                  />
                  まだ決めていない
                </label>
              </div>

              {state.housingPaymentMethod === 'loan' ? (
                <>
                  <label className="second-life-timing">
                    <span>頭金</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={0}
                      max={state.housingBaseCostMan}
                      step={10}
                      value={state.housingLoanDownPaymentMan}
                      onChange={(event) =>
                        onChange({
                          housingLoanDownPaymentMan: Math.min(
                            state.housingBaseCostMan,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span>万円</span>
                  </label>
                  <label className="second-life-timing">
                    <span>金利（固定で仮試算）</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={0}
                      max={20}
                      step={0.1}
                      value={state.housingLoanInterestRatePct ?? ''}
                      placeholder="例 2.0"
                      onChange={(event) =>
                        onChange({
                          housingLoanInterestRatePct:
                            event.target.value === ''
                              ? null
                              : Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                    <span>%</span>
                  </label>
                  <label className="second-life-timing">
                    <span>返済期間</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={1}
                      max={50}
                      value={state.housingLoanYears ?? ''}
                      placeholder="例 10"
                      onChange={(event) =>
                        onChange({
                          housingLoanYears:
                            event.target.value === ''
                              ? null
                              : Math.min(
                                  50,
                                  Math.max(1, Math.round(Number(event.target.value))),
                                ),
                        })
                      }
                    />
                    <span>年</span>
                  </label>
                  <p className="second-life-apply-note">
                    借入予定額：{formatSecondLifeMan(loanPrincipalMan)}万円
                    {loanMonthlyMan != null
                      ? ` ／ 月々の返済目安：約${formatSecondLifeMan(loanMonthlyMan)}万円`
                      : ''}
                  </p>
                  {!loanConfigured ? (
                    <p className="second-life-apply-note">
                      金利と返済期間がそろうまでは、ローンを勝手に作らず、住まい本体の目安額を一括支出として仮計算します。
                    </p>
                  ) : null}
                  {estimatedLoanEndAge != null && estimatedLoanEndAge > 80 ? (
                    <p className="second-life-apply-note">
                      返済終了は世帯主{estimatedLoanEndAge}歳ごろの設定です。実際に借りられる期間・金利・審査条件は金融機関や商品で異なるため、実際の条件を確認してください。
                    </p>
                  ) : null}
                  <p className="second-life-apply-note">
                    ローン返済は固定金利・元利均等・ボーナス返済なしの簡易試算です。実際の借入条件を保証するものではありません。
                  </p>
                </>
              ) : state.housingPaymentMethod === 'undecided' ? (
                <p className="second-life-apply-note">
                  支払い方法が未定の間は、借入を自動設定せず、住まい本体の目安額をその年の一括支出として保守的に試算します。
                </p>
              ) : (
                <p className="second-life-apply-note">
                  住まい本体の目安額を、住まいを変える年の一括支出として試算します。
                </p>
              )}

              <p className="second-life-apply-note">
                試算する住まい関連費の合計：{formatSecondLifeMan(total)}万円
                {state.includeMovingCost || state.includePostPurchaseRenovation
                  ? '（住まい本体＋選択した追加費用）'
                  : ''}
              </p>
              {state.includeMovingCost || state.includePostPurchaseRenovation ? (
                <p className="second-life-apply-note">
                  引越し費・購入後リフォーム費は、現時点ではローンに含めず一括支出として試算します。
                </p>
              ) : null}
            </div>
          ) : null}

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
