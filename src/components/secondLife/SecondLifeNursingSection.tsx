import { getMemberTabLabel } from '../../lib/memberDisplay';
import {
  formatThirdLifeCareDuration,
  getThirdLifeCareScenarioInfo,
  getThirdLifeCareStartAge,
  THIRD_LIFE_CARE_SCENARIOS,
} from '../../lib/thirdLifeCare';
import type { FamilyMember } from '../../types/family';
import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
  SecondLifeNursingTarget,
  SecondLifeState,
} from '../../types/secondLife';

type NursingApplyStatus = 'missing' | 'partial' | 'done';

interface SecondLifeNursingSectionProps {
  members: FamilyMember[];
  state: SecondLifeState;
  applyStatus: NursingApplyStatus;
  onChange: (state: SecondLifeState) => void;
  onApply: () => void;
  onOpenLifeEvent?: () => void;
}

export function SecondLifeNursingSection({
  members,
  state,
  applyStatus,
  onChange,
  onApply,
  onOpenLifeEvent,
}: SecondLifeNursingSectionProps) {
  const targets = ([
    ['head', 'head'],
    ['spouse', 'spouse'],
  ] as const)
    .map(([key, role]) => ({
      key,
      member: members.find((member) => member.role === role),
    }))
    .filter(
      (
        item,
      ): item is {
        key: SecondLifeNursingTarget;
        member: FamilyMember;
      } => Boolean(item.member),
    );

  const updateTarget = (
    target: SecondLifeNursingTarget,
    patch: Partial<SecondLifeNursingDesign>,
  ) => {
    onChange({
      ...state,
      nursingByTarget: {
        ...state.nursingByTarget,
        [target]: {
          ...state.nursingByTarget[target],
          configured: true,
          ...patch,
        },
      },
    });
  };

  const allConfigured =
    targets.length > 0 &&
    targets.every(({ key }) => state.nursingByTarget[key].configured !== false);

  const hasUnpricedDesign = targets.some(({ key }) => {
    const design = state.nursingByTarget[key];
    return (
      design.configured !== false &&
      !design.skip &&
      design.initialCostMan <= 0 &&
      design.monthlyCostMan <= 0
    );
  });

  const applyMessage = !allConfigured
    ? '介護の想定が未設定です。本人・配偶者それぞれについて、介護費を見込むかどうかを選んでください。'
    : hasUnpricedDesign
      ? '介護費を見込む人は、開始時費用または月額追加費用を入力してください。金額が0のままでは反映しません。'
    : applyStatus === 'done'
      ? '現在のサードライフ設計はキャッシュフローへ反映済みです。'
      : applyStatus === 'partial'
        ? 'サードライフ設計と現在の連動データに差分があります。下のボタンで最新内容を反映してください。'
        : 'サードライフ設計をキャッシュフローへ反映してください。';

  return (
    <section className="second-life-section" aria-labelledby="second-life-nursing-title">
      <div className="second-life-section-toolbar">
        <div>
          <p className="second-life-consistency-kicker">介護・サードライフの設計</p>
          <h3 id="second-life-nursing-title">誰に・いつから・どの介護を見込むか</h3>
        </div>
      </div>

      <p className="second-life-apply-note">
        このソフトでは、介護が必要になった後の時期を「サードライフ」と呼び、元気に暮らすセカンドライフとは分けて整理します。
      </p>

      <details className="third-life-reference-details">
        <summary>介護・施設の選択肢の違いを見る</summary>
        <div className="third-life-reference-list">
          {THIRD_LIFE_CARE_SCENARIOS.map((scenario) => (
            <section key={scenario.id} className="third-life-reference-item">
              <h4>{scenario.label}</h4>
              <p>{scenario.description}</p>
              {scenario.note ? <p>{scenario.note}</p> : null}
              <a href={scenario.referenceUrl} target="_blank" rel="noreferrer">
                {scenario.referenceLabel}
              </a>
            </section>
          ))}
        </div>
      </details>

      <details className="third-life-reference-details">
        <summary>費用の入力方法を見る</summary>
        <div className="third-life-cost-note">
          <p>
            ここで入力する費用は、「生活費」「住まい」で既に計上している金額とは別に、介護によって追加で家計から出る金額です。
          </p>
          <p>
            施設の公表月額には食費・居住費などが含まれる場合があります。その総額をそのまま追加すると二重計上になることがあるため、自動では入力しません。実際の見積や現在の生活費との差額が分かる場合は、その追加分を入力してください。
          </p>
        </div>
      </details>

      <div className="second-life-guide-grid third-life-person-grid">
        {targets.map(({ key, member }) => {
          const design = state.nursingByTarget[key];
          const configured = design.configured !== false;
          const scenarioInfo = getThirdLifeCareScenarioInfo(design.scenario);
          const hasCost = design.initialCostMan > 0 || design.monthlyCostMan > 0;
          const effectiveStartAge = getThirdLifeCareStartAge(
            design,
            member.expectedLifespan,
          );
          const maxStartAge = Math.max(60, member.expectedLifespan);
          const maxDurationYears = Math.max(
            1,
            member.expectedLifespan - effectiveStartAge + 1,
          );
          return (
            <article
              key={key}
              className={
                !configured
                  ? 'second-life-guide-card second-life-guide-card--missing'
                  : design.skip
                    ? 'second-life-guide-card second-life-guide-card--done'
                    : hasCost
                    ? 'second-life-guide-card second-life-guide-card--done'
                    : 'second-life-guide-card second-life-guide-card--partial'
              }
            >
              <div className="second-life-guide-card-head">
                <div>
                  <p className="second-life-guide-card-step">
                    {getMemberTabLabel(member)}
                  </p>
                  <p className="second-life-guide-card-summary">
                    {!configured
                      ? '未設定'
                      : design.skip
                        ? '今回は介護費を見込まない'
                      : hasCost
                        ? `${effectiveStartAge}歳〜 ${scenarioInfo.label}・月${design.monthlyCostMan}万円＋開始時${design.initialCostMan}万円（${formatThirdLifeCareDuration(design)}）`
                        : `${effectiveStartAge}歳〜 ${scenarioInfo.label}（費用未入力）`}
                  </p>
                </div>
              </div>

              <label className="second-life-skip">
                <input
                  type="checkbox"
                  checked={configured && design.skip}
                  onChange={(event) =>
                    updateTarget(key, { skip: event.target.checked })
                  }
                />
                今回は介護費を見込まない
              </label>

              {!design.skip ? (
                <div className="third-life-fields">
                  <label className="second-life-inline-option third-life-field-row">
                    <span>介護の想定</span>
                    <select
                      className="select-input"
                      value={design.scenario}
                      onChange={(event) =>
                        updateTarget(key, {
                          scenario: event.target.value as SecondLifeNursingScenario,
                        })
                      }
                    >
                      {THIRD_LIFE_CARE_SCENARIOS.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <details className="third-life-selected-description">
                    <summary>この選択肢について</summary>
                    <p>{scenarioInfo.description}</p>
                    {scenarioInfo.note ? <p>{scenarioInfo.note}</p> : null}
                    <a
                      href={scenarioInfo.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {scenarioInfo.referenceLabel}
                    </a>
                  </details>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>開始年齢</span>
                    <span>
                      <input
                        type="number"
                        className="second-life-age-input"
                        min={60}
                        max={maxStartAge}
                        value={effectiveStartAge}
                        onChange={(event) => {
                          const startAge = Math.min(
                            maxStartAge,
                            Math.max(60, Number(event.target.value) || 60),
                          );
                          const remainingYears = Math.max(
                            1,
                            member.expectedLifespan - startAge + 1,
                          );
                          updateTarget(key, {
                            startAge,
                            durationYears:
                              design.durationMode === 'years'
                                ? Math.min(
                                    remainingYears,
                                    design.durationYears ?? 5,
                                  )
                                : null,
                          });
                        }}
                      />
                      歳〜
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>開始時に追加でかかる費用</span>
                    <span>
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={1}
                        value={design.initialCostMan}
                        onChange={(event) =>
                          updateTarget(key, {
                            initialCostMan: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      万円
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>毎月追加でかかる費用</span>
                    <span>
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={0.1}
                        value={design.monthlyCostMan}
                        onChange={(event) =>
                          updateTarget(key, {
                            monthlyCostMan: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      万円／月
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>想定期間</span>
                    <select
                      className="select-input"
                      value={design.durationMode}
                      onChange={(event) => {
                        const durationMode =
                          event.target.value === 'years' ? 'years' : 'lifetime';
                        updateTarget(key, {
                          durationMode,
                          durationYears:
                            durationMode === 'years'
                              ? Math.min(maxDurationYears, design.durationYears ?? 5)
                              : null,
                        });
                      }}
                    >
                      <option value="lifetime">一生涯</option>
                      <option value="years">年数を指定</option>
                    </select>
                  </label>

                  {design.durationMode === 'years' ? (
                    <label className="second-life-inline-option third-life-field-row">
                      <span>介護を見込む年数</span>
                      <span>
                        <input
                          type="number"
                          className="second-life-age-input"
                          min={1}
                          max={maxDurationYears}
                          value={Math.min(
                            maxDurationYears,
                            design.durationYears ?? Math.min(5, maxDurationYears),
                          )}
                          onChange={(event) =>
                            updateTarget(key, {
                              durationYears: Math.min(
                                maxDurationYears,
                                Math.max(1, Number(event.target.value) || 1),
                              ),
                            })
                          }
                        />
                        年間
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="second-life-section-actions">
        <p className="second-life-apply-note">{applyMessage}</p>
        <button
          type="button"
          className="second-life-apply-btn"
          onClick={onApply}
          disabled={!allConfigured || applyStatus === 'done' || hasUnpricedDesign}
        >
          {!allConfigured
            ? '介護の想定を設定してください'
            : applyStatus === 'done'
              ? 'サードライフ設計は反映済み'
              : 'このサードライフ設計を反映する'}
        </button>
        {onOpenLifeEvent ? (
          <button
            type="button"
            className="second-life-guide-nav-btn"
            onClick={onOpenLifeEvent}
          >
            反映先のライフイベントを確認する →
          </button>
        ) : null}
      </div>
    </section>
  );
}
