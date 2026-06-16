import type { IncomeCategory } from '../../types/income';
import { ADD_INCOME_OPTIONS, INCOME_CATEGORY_LABELS } from '../../lib/incomeLabels';

interface AddIncomeBarProps {
  onAdd: (category: IncomeCategory) => void;
}

export function AddIncomeBar({ onAdd }: AddIncomeBarProps) {
  return (
    <section className="add-income-bar">
      <h3 className="add-income-title">収入を追加</h3>
      <div className="add-income-grid">
        {ADD_INCOME_OPTIONS.map((option) => (
          <button
            key={option.category}
            type="button"
            className="add-income-card"
            onClick={() => onAdd(option.category)}
          >
            <span className="add-income-icon">{option.icon}</span>
            <span className="add-income-label">
              {INCOME_CATEGORY_LABELS[option.category]}
            </span>
            <span className="add-income-desc">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
