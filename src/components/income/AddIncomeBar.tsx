import type { AddIncomeOption } from '../../lib/incomeLabels';
import {
  ADD_INCOME_OPTIONS,
  INCOME_CATEGORY_LABELS,
} from '../../lib/incomeLabels';

interface AddIncomeBarProps {
  canAddSideBusiness: boolean;
  onAdd: (option: AddIncomeOption) => void;
}

const SIDE_BUSINESS_DISABLED_DESC =
  '先に本業（給与）の収入を追加してください';

export function AddIncomeBar({
  canAddSideBusiness,
  onAdd,
}: AddIncomeBarProps) {
  return (
    <section className="add-income-bar">
      <h3 className="add-income-title">収入を追加</h3>
      <div className="add-income-grid">
        {ADD_INCOME_OPTIONS.map((option) => {
          const isSideBusiness = option.variant === 'side_business';
          const disabled = isSideBusiness && !canAddSideBusiness;
          const description =
            disabled && isSideBusiness
              ? SIDE_BUSINESS_DISABLED_DESC
              : option.description;

          return (
            <button
              key={`${option.category}-${option.variant ?? 'default'}`}
              type="button"
              className={`add-income-card${
                disabled ? ' add-income-card--disabled' : ''
              }`}
              disabled={disabled}
              onClick={() => onAdd(option)}
            >
              <span className="add-income-icon">{option.icon}</span>
              <span className="add-income-label">
                {option.label ?? INCOME_CATEGORY_LABELS[option.category]}
              </span>
              <span className="add-income-desc">{description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
