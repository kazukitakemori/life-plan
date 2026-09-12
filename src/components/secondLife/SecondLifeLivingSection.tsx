import type { SecondLifeLivingOption } from '../../lib/secondLifeEstimates';
import { formatSecondLifeMan } from '../../lib/secondLifeEstimates';
import type { SecondLifeState } from '../../types/secondLife';
import { SecondLifeChoiceCard } from './SecondLifeChoiceCard';
import { SecondLifeModeSelector } from './SecondLifeModeSelector';

interface SecondLifeLivingSectionProps {
  state: SecondLifeState;
  options: SecondLifeLivingOption[];
  onChange: (patch: Partial<SecondLifeState>) => void;
  onApply?: () => void;
}

export function SecondLifeLivingSection({
  state,
  options,
  onChange,
}: SecondLifeLivingSectionProps) {
  const currentMonthly =
    options.find((option) => option.level === 'same')?.monthlyMan ?? 0;
  const useCurrentPlan = state.livingSkip;

  return (
    <section className="second-life-section">
      <SecondLifeModeSelector
        useCurrent={useCurrentPlan}
        currentLabel='Q4「生活費」の現在の計画をそのまま使う'
        reviewLabel="セカンドライフの生活費を見直す"
        currentDescription={
          currentMonthly > 0
            ? `Q4で入力している生活費（現在の目安 ${formatSecondLifeMan(currentMonthly)}万円／月）を、そのまま計算に使います。`
            : 'Q4で入力している生活費スケジュールを、そのままキャッシュフロー計算に使います。'
        }
        reviewDescription="セカンドライフ開始年齢以降の生活水準を、現在と同じ・8割・7割などから改めて設定します。"
        name="second-life-living-mode"
        onUseCurrent={() => onChange({ livingSkip: true })}
        onReview={() => onChange({ livingSkip: false })}
      />

      {useCurrentPlan ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            Q4「生活費」の入力を変更せず、その計画をそのまま計算に使用します。
          </p>
        </div>
      ) : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              下で選んだ生活水準は、ページ上部のセカンドライフ開始 {state.startAge}歳から計算上だけ優先します。
            </p>
          </div>

          <div
            className="second-life-choice-grid"
            role="radiogroup"
            aria-label="セカンドライフの生活水準"
          >
            {options.map((option) => {
              const active = state.livingLevel === option.level;
              return (
                <SecondLifeChoiceCard
                  key={option.level}
                  active={active}
                  label={option.label}
                  name="second-life-living-level"
                  onSelect={() => onChange({ livingLevel: option.level })}
                >
                  <p className="second-life-living-monthly">
                    月々 <strong>{formatSecondLifeMan(option.monthlyMan)}</strong>{' '}
                    万円
                  </p>
                  {option.pensionAnnualMan != null ? (
                    <p className="second-life-living-ref">
                      （年金収入合計{' '}
                      {formatSecondLifeMan(option.pensionAnnualMan)} 万円）
                    </p>
                  ) : null}
                  <div className="second-life-breakdown">
                    {option.breakdown.length > 0 ? (
                      <ul>
                        {option.breakdown.map((item) => (
                          <li key={item.label}>
                            <span>{item.label}</span>
                            <span>{formatSecondLifeMan(item.amountMan)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="second-life-breakdown-empty">内訳なし</p>
                    )}
                  </div>
                </SecondLifeChoiceCard>
              );
            })}
          </div>

          <div className="second-life-section-actions">
            <p className="second-life-apply-note">
              「現在と同じ水準」を選んだ場合も、Q4の入力を書き換えるのではなく、Q12で確認した生活水準として開始年齢以降の計算に使用します。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
