import { getMemberTabLabel } from '../../lib/memberDisplay';
import { getDefaultNursingAnnualCostMan } from '../../lib/secondLifeEstimates';
import type { FamilyMember } from '../../types/family';
import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
  SecondLifeNursingTarget,
  SecondLifeState,
} from '../../types/secondLife';

const NURSING_SCENARIOS: {
  id: SecondLifeNursingScenario;
  label: string;
}[] = [
  { id: 'home', label: '在宅介護' },
  { id: 'day_service', label: '在宅＋デイサービス' },
  { id: 'facility', label: '施設介護' },
];

interface SecondLifeNursingSectionProps {
  members: FamilyMember[];
  state: SecondLifeState;
  onChange: (state: SecondLifeState) => void;
  onOpenLifeEvent?: () => void;
}

export function SecondLifeNursingSection({
  members,
  state,
  onChange,
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
          ...patch,
        },
      },
    });
  };

  return (
    <section className="second-life-section" aria-labelledby="second-life-nursing-title">
      <div className="second-life-section-toolbar">
        <div>
          <p className="second-life-consistency-kicker">介護の設計</p>
          <h3 id="second-life-nursing-title">誰に・いつから・いくら見込むか</h3>
        </div>
      </div>

      <p className="second-life-apply-note">
        介護の設計はこのセカンドライフ画面を本体にします。ライフイベントには計算用の連動データとして反映します。
      </p>

      <div className="second-life-guide-grid">
        {targets.map(({ key, member }) => {
          const design = state.nursingByTarget[key];
          return (
            <article
              key={key}
              className={
                design.skip
                  ? 'second-life-guide-card second-life-guide-card--missing'
                  : 'second-life-guide-card second-life-guide-card--done'
              }
            >
              <div className="second-life-guide-card-head">
                <div>
                  <p className="second-life-guide-card-step">
                    {getMemberTabLabel(member)}
                  </p>
                  <p className="second-life-guide-card-summary">
                    {design.skip
                      ? '介護費を見込まない'
                      : `${design.startAge}歳〜 年${design.annualCostMan}万円`}
                  </p>
                </div>
              </div>

              <label className="second-life-skip">
                <input
                  type="checkbox"
                  checked={design.skip}
                  onChange={(event) =>
                    updateTarget(key, { skip: event.target.checked })
                  }
                />
                今回は介護費を見込まない
              </label>

              {!design.skip ? (
                <div className="second-life-breakdown">
                  <label className="second-life-inline-option">
                    <span>介護の想定</span>
                    <select
                      className="select-input"
                      value={design.scenario}
                      onChange={(event) => {
                        const scenario = event.target.value as SecondLifeNursingScenario;
                        const previousDefault = getDefaultNursingAnnualCostMan(
                          design.scenario,
                        );
                        updateTarget(key, {
                          scenario,
                          annualCostMan:
                            design.annualCostMan === previousDefault
                              ? getDefaultNursingAnnualCostMan(scenario)
                              : design.annualCostMan,
                        });
                      }}
                    >
                      {NURSING_SCENARIOS.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="second-life-inline-option">
                    <span>開始年齢</span>
                    <span>
                      <input
                        type="number"
                        className="second-life-age-input"
                        min={60}
                        max={110}
                        value={design.startAge}
                        onChange={(event) =>
                          updateTarget(key, {
                            startAge: Math.max(60, Number(event.target.value) || 60),
                          })
                        }
                      />
                      歳〜
                    </span>
                  </label>

                  <label className="second-life-inline-option">
                    <span>年間介護費</span>
                    <span>
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={1}
                        value={design.annualCostMan}
                        onChange={(event) =>
                          updateTarget(key, {
                            annualCostMan: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      万円／年
                    </span>
                  </label>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {onOpenLifeEvent ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            設計後、ライフイベントへ反映するとキャッシュフロー計算に使われます。反映後の行は「セカンドライフ連動」として保護されます。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onOpenLifeEvent}
          >
            ライフイベントで反映を確認する
          </button>
        </div>
      ) : null}
    </section>
  );
}
