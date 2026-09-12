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
        title={`${state.startAge}歳以降の生活費はどうしますか？`}
        useCurrent={useCurrentPlan}
        currentLabel="今の生活費計画をそのまま使う"
        reviewLabel={`${state.startAge}歳以降の生活費を設定する`}
        currentDescription={
          currentMonthly > 0
            ? `「生活費」で入力している現在の目安（月${formatSecondLifeMan(currentMonthly)}万円）を、そのまま使います。`
            : '「生活費」で入力している計画を、そのまま使います。'
        }
        reviewDescription="現在の生活費を基準に、100%・80%・70%で比較できます。年金額が入力済みなら、年金収入を目安にした試算も選べます。"
        name="second-life-living-mode"
        onUseCurrent={() => onChange({ livingSkip: true })}
        onReview={() => onChange({ livingSkip: false })}
      />

      {useCurrentPlan ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            「生活費」で入力した内容のまま計算します。元の入力は変更しません。
          </p>
        </div>
      ) : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              基準となる現在の生活費：月{formatSecondLifeMan(currentMonthly)}万円。{state.startAge}歳以降の生活費を下から選んでください。
            </p>
          </div>

          <div
            className="second-life-choice-grid second-life-choice-grid--living"
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
              80%・70%は比較用の目安です。生活費が自動的にその割合まで下がるという意味ではありません。元の「生活費」の入力は残したまま、{state.startAge}歳以降だけ選んだ金額で試算します。
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
