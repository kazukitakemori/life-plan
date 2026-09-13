import type { SecondLifeLivingOption } from '../../lib/secondLifeEstimates';
import { formatSecondLifeMan } from '../../lib/secondLifeEstimates';
import { SECOND_LIFE_SKIP_LABEL } from '../../lib/secondLifeLabels';
import type { SecondLifeState } from '../../types/secondLife';
import { SecondLifeChoiceCard } from './SecondLifeChoiceCard';
import { SecondLifeStartAgeField } from './SecondLifeStartAgeField';

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
  onApply,
}: SecondLifeLivingSectionProps) {
  const currentMonthly =
    options.find((option) => option.level === 'same')?.monthlyMan ?? 0;
  const skipLabelMonthly = currentMonthly > 0 ? currentMonthly : null;
  const configured = state.livingConfigured !== false;
  const placeholder = configured && state.livingSkip;
  const selectedOption = options.find(
    (option) => option.level === state.livingLevel,
  );
  const canApply =
    configured &&
    !placeholder &&
    selectedOption != null &&
    selectedOption.monthlyMan > 0;

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
          まだ設定されていません。生活水準を選ぶと、現在の入力内容から老後の生活費を計算します。
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
              livingConfigured: true,
              livingSkip: event.target.checked,
            })
          }
        />
        {SECOND_LIFE_SKIP_LABEL}
        {skipLabelMonthly != null ? (
          <span className="second-life-skip-hint">
            （現在の生活費 {formatSecondLifeMan(skipLabelMonthly)} 万円／月）
          </span>
        ) : null}
      </label>

      <div
        className={
          placeholder
            ? 'second-life-choice-grid is-placeholder'
            : 'second-life-choice-grid'
        }
        role={placeholder ? undefined : 'radiogroup'}
        aria-label="生活水準の選択"
        aria-disabled={placeholder || undefined}
      >
        {options.map((option) => {
          const active =
            configured && !placeholder && state.livingLevel === option.level;
          const hasEstimate = option.monthlyMan > 0;
          return (
            <SecondLifeChoiceCard
              key={option.level}
              active={active}
              label={option.label}
              name="second-life-living-level"
              placeholder={placeholder}
              onSelect={() =>
                onChange({
                  livingConfigured: true,
                  livingLevel: option.level,
                })
              }
            >
              {placeholder ? (
                <div className="second-life-placeholder-body">
                  <p className="second-life-living-monthly">
                    月々 <strong>—</strong> 万円
                  </p>
                  <div className="second-life-breakdown">
                    <p className="second-life-breakdown-empty">—</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="second-life-living-monthly">
                    月々{' '}
                    {hasEstimate ? (
                      <>
                        <strong>{formatSecondLifeMan(option.monthlyMan)}</strong>{' '}
                        万円
                      </>
                    ) : (
                      <strong>未設定</strong>
                    )}
                  </p>
                  {option.pensionAnnualMan != null && option.pensionAnnualMan > 0 ? (
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
                        {hasEstimate
                          ? '内訳なし'
                          : '現在の生活費などを入力すると計算されます'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </SecondLifeChoiceCard>
          );
        })}
      </div>

      {configured && !placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            {canApply
              ? '選択した生活水準で、負担者（世帯主）の生活費スケジュールを開始年齢以降に組み直します（既存の開始前スケジュールは残ります）。'
              : '生活費の元データがまだありません。現在の生活費などを入力すると、老後の生活費を計算して反映できます。'}
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
            disabled={!canApply}
          >
            {canApply
              ? 'この内容を生活費に反映する'
              : '元データを入力すると反映できます'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
