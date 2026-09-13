import type { SecondLifeState } from '../../types/secondLife';
import {
  estimateSecondLifeHousingTotalMan,
  formatSecondLifeMan,
} from '../../lib/secondLifeEstimates';
import {
  getSecondLifeHousingTemplateKind,
  SECOND_LIFE_RENOVATION_SCOPE_LABELS,
} from '../../lib/secondLifeLabels';
import {
  estimateSecondLifeHousingLoanMonthlyMan,
  getDefaultSecondLifeHousingBaseCostMan,
  getSecondLifeHousingBaseCostLabel,
  getSecondLifeRenovationReferenceCostMan,
  getSecondLifeHousingLoanPrincipalMan,
  isSecondLifeHousingLoanConfigured,
  SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN,
  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,
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
  const isRenovation = housingKind === 'renovate';
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

  const selectRenovationScope = (scope: SecondLifeState['renovationScope']) => {
    const currentReference = getSecondLifeRenovationReferenceCostMan(
      state.renovationScope,
    );
    const nextReference = getSecondLifeRenovationReferenceCostMan(scope);
    const shouldUpdateReference =
      state.housingBaseCostMan === 0 ||
      state.housingBaseCostMan === currentReference ||
      state.housingBaseCostMan === SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;
    if (shouldUpdateReference) {
      onChange({
        renovationScope: scope,
        housingBaseCostMan: nextReference,
        housingLoanDownPaymentMan: Math.min(
          nextReference,
          Math.max(0, state.housingLoanDownPaymentMan),
        ),
      });
      return;
    }
    onChange({ renovationScope: scope });
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
        currentLabel="今の住まい計画を使う"
        reviewLabel="老後の住まいを見直す"
        currentDescription="現在の住まい計画をそのまま使います。"
        reviewDescription="リフォーム・建て替え・転居などを設定します。"
        name="second-life-housing-mode"
        onUseCurrent={() => onChange({ housingSkip: true })}
        onReview={startHousingReview}
      />

      {useCurrentPlan ? null : (
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
                          購入・建て替え後のリフォームを見込む
                        </label>
                      ) : null}
                      {state.stayOption === 'purchase_rebuild' &&
                      state.includePostPurchaseRenovation ? (
                        <label className="second-life-inline-cost">
                          <span>追加リフォーム費</span>
                          <input type="number" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />
                          <span>万円</span>
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
                        引越し費を見込む
                      </label>
                      {state.includeMovingCost ? (
                        <label className="second-life-inline-cost">
                          <span>引越し費</span>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={state.movingCostMan}
                            onChange={(event) =>
                              onChange({
                                movingCostMan: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              })
                            }
                          />
                          <span>万円</span>
                        </label>
                      ) : null}
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
                          購入・建て替え後のリフォームを見込む
                        </label>
                      ) : null}
                      {state.hometownOption === 'purchase_rebuild' &&
                      state.includePostPurchaseRenovation ? (
                        <label className="second-life-inline-cost">
                          <span>追加リフォーム費</span>
                          <input type="number" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />
                          <span>万円</span>
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
                        引越し費を見込む
                      </label>
                      {state.includeMovingCost ? (
                        <label className="second-life-inline-cost">
                          <span>引越し費</span>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={state.movingCostMan}
                            onChange={(event) =>
                              onChange({
                                movingCostMan: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              })
                            }
                          />
                          <span>万円</span>
                        </label>
                      ) : null}
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
                          購入・建て替え後のリフォームを見込む
                        </label>
                      ) : null}
                      {state.newAreaOption === 'purchase' &&
                      state.includePostPurchaseRenovation ? (
                        <label className="second-life-inline-cost">
                          <span>追加リフォーム費</span>
                          <input type="number" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />
                          <span>万円</span>
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
                    (state.includeMovingCost ? state.movingCostMan : 0),
                )}万円
              </p>
            </div>
          ) : null}

          {isRenovation ? (
            <div className="second-life-renovation-scope">
              <p className="second-life-renovation-scope-title">
                どのようなリフォームを考えますか？
              </p>
              <div
                className="second-life-renovation-scope-grid"
                role="radiogroup"
                aria-label="リフォーム内容"
              >
                {Object.entries(SECOND_LIFE_RENOVATION_SCOPE_LABELS).map(
                  ([scope, label]) => (
                    <label key={scope} className="second-life-renovation-scope-option">
                      <input
                        type="radio"
                        name="second-life-renovation-scope"
                        checked={state.renovationScope === scope}
                        onChange={() =>
                          selectRenovationScope(
                            scope as SecondLifeState['renovationScope'],
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ),
                )}
              </div>
              <p className="second-life-apply-note">
                工事内容を変えると参考初期値も切り替わります。見積額などを手入力済みの場合は、その金額を保持します。
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
                {isRenovation
                  ? `この工事内容の参考初期値は${getSecondLifeRenovationReferenceCostMan(state.renovationScope)}万円です。見積額や希望額が分かる場合は、その金額を優先してください。`
                  : '住宅購入・建て替えは地域や物件条件による差が大きいため、全国一律の金額は自動入力していません。見積額や希望額を入力してください。'}
              </p>
              {isRenovation &&
              state.housingBaseCostMan !==
                getSecondLifeRenovationReferenceCostMan(state.renovationScope) ? (
                <button
                  type="button"
                  className="second-life-reference-apply-btn"
                  onClick={() =>
                    setBaseCost(
                      getSecondLifeRenovationReferenceCostMan(
                        state.renovationScope,
                      ),
                    )
                  }
                >
                  参考額
                  {getSecondLifeRenovationReferenceCostMan(state.renovationScope)}万円を反映
                </button>
              ) : null}
              {isRenovation ? (
                <details className="second-life-reference-details">
                  <summary>参考値の根拠を見る</summary>
                  <div className="second-life-reference-body">
                    <p>
                      住宅リフォーム推進協議会の2025年度調査では、50代以上のリフォーム実施費用は中央値
                      {SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN}万円、平均
                      {SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN}万円でした。
                    </p>
                    <p>
                      これは工事内容別の全国相場ではありません。工事規模に合わせた参考初期値を置いていますが、実際の住宅条件・地域・仕様で大きく変わるため、見積額がある場合はそちらを優先してください。
                    </p>
                    <a
                      href="https://j-reform.com/publish/pdf/jitsurei-R7-c.pdf"
                      target="_blank"
                      rel="noreferrer"
                    >
                      調査資料を確認する
                    </a>
                  </div>
                </details>
              ) : null}

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
                  <p className="second-life-apply-note second-life-summary-note">
                    借入予定額：{formatSecondLifeMan(loanPrincipalMan)}万円
                    {loanMonthlyMan != null
                      ? ` ／ 月々の返済目安：約${formatSecondLifeMan(loanMonthlyMan)}万円`
                      : ''}
                  </p>
                  {!loanConfigured ? (
                    <p className="second-life-apply-note">
                      金利・返済期間を入力すると月々の返済額を試算します。未入力の間は一括支出として仮計算します。
                    </p>
                  ) : null}
                  {estimatedLoanEndAge != null && estimatedLoanEndAge > 80 ? (
                    <p className="second-life-apply-note second-life-apply-note--warning">
                      返済終了は世帯主{estimatedLoanEndAge}歳ごろです。借入可能な期間は金融機関・商品によって異なります。
                    </p>
                  ) : null}
                  <details className="second-life-reference-details">
                    <summary>ローン試算の前提を見る</summary>
                    <div className="second-life-reference-body">
                      <p>
                        固定金利・元利均等・ボーナス返済なしの簡易試算です。実際の借入条件を保証するものではありません。
                      </p>
                      {state.includeMovingCost || state.includePostPurchaseRenovation ? (
                        <p>
                          引越し費・購入後リフォーム費はローンに含めず、一括支出として試算します。
                        </p>
                      ) : null}
                    </div>
                  </details>
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

              <p className="second-life-apply-note second-life-summary-note">
                試算する住まい関連費の合計：{formatSecondLifeMan(total)}万円
                {state.includeMovingCost || state.includePostPurchaseRenovation
                  ? '（住まい本体＋選択した追加費用）'
                  : ''}
              </p>
            </div>
          ) : null}

        </>
      )}
    </section>
  );
}
