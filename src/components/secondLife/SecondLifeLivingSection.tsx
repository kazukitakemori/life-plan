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
  const placeholder = state.livingSkip;

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

      <label
        className={
          placeholder ? 'second-life-skip is-checked' : 'second-life-skip'
        }
      >
        <input
          type="checkbox"
          checked={state.livingSkip}
          onChange={(event) => onChange({ livingSkip: event.target.checked })}
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
          const active = !placeholder && state.livingLevel === option.level;
          return (
            <SecondLifeChoiceCard
              key={option.level}
              active={active}
              label={option.label}
              name="second-life-living-level"
              placeholder={placeholder}
              onSelect={() => onChange({ livingLevel: option.level })}
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
                </>
              )}
            </SecondLifeChoiceCard>
          );
        })}
      </div>

      {!placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            選択した生活水準で、世帯の生活費スケジュールを開始年齢以降に組み直します（既存の開始前スケジュールは残ります）。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
          >
            この内容を生活費に反映する
          </button>
        </div>
      ) : null}
    </section>
  );
}
