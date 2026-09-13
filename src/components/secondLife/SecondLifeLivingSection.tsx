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
  const configured = state.livingConfigured !== false;
  const useCurrentPlan = configured && state.livingSkip;
  const hasLivingBase = currentMonthly > 0;
  const effectiveLivingLevel = options.some(
    (option) => option.level === state.livingLevel,
  )
    ? state.livingLevel
    : 'same';

  return (
    <section className="second-life-section">
      <SecondLifeModeSelector
        title={`${state.startAge}歳以降の生活費はどうしますか？`}
        configured={configured}
        useCurrent={useCurrentPlan}
        currentLabel="今の生活費計画を使う"
        reviewLabel={`${state.startAge}歳以降の生活費を設定する`}
        currentDescription={
          currentMonthly > 0
            ? `現在の目安：月${formatSecondLifeMan(currentMonthly)}万円`
            : '現在の生活費計画を使います。'
        }
        reviewDescription="100%・80%・70%・年金収入を目安に比較します。"
        name="second-life-living-mode"
        onUseCurrent={() =>
          onChange({ livingConfigured: true, livingSkip: true })
        }
        onReview={() =>
          onChange({ livingConfigured: true, livingSkip: false })
        }
      />

      {!configured || useCurrentPlan ? null : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              {hasLivingBase
                ? `基準となる現在の生活費：月${formatSecondLifeMan(currentMonthly)}万円。${state.startAge}歳以降の生活費を下から選んでください。`
                : '現在の生活費が未入力です。Q4「生活費」を入力すると、老後の生活費を試算できます。'}
            </p>
          </div>

          <div
            className="second-life-choice-grid second-life-choice-grid--living"
            role="radiogroup"
            aria-label="セカンドライフの生活水準"
          >
            {options.map((option) => {
              const active = effectiveLivingLevel === option.level;
              return (
                <SecondLifeChoiceCard
                  key={option.level}
                  active={active}
                  label={option.label}
                  name="second-life-living-level"
                  onSelect={() => onChange({ livingLevel: option.level })}
                >
                  <p className="second-life-living-monthly">
                    月々{' '}
                    {option.monthlyMan > 0 ? (
                      <>
                        <strong>{formatSecondLifeMan(option.monthlyMan)}</strong>{' '}
                        万円
                      </>
                    ) : (
                      <strong>未設定</strong>
                    )}
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
                      <p className="second-life-breakdown-empty">
                        {option.monthlyMan > 0
                          ? '内訳なし'
                          : '現在の生活費を入力すると計算されます'}
                      </p>
                    )}
                  </div>
                </SecondLifeChoiceCard>
              );
            })}
          </div>

          <div className="second-life-section-actions">
            <p className="second-life-apply-note">
              80%・70%は比較用の目安です。生活費が自動的にその割合まで下がるという意味ではありません。
            </p>
          </div>
          {!options.some((option) => option.level === 'pension_based') ? (
            <p className="second-life-apply-note">
              年金額がまだ入力されていないため、「年金収入を目安にする」は表示していません。
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
