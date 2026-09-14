import type { AddIncomeOption } from '../../lib/incomeLabels';
import {
  ADD_INCOME_OPTIONS,
  INCOME_CATEGORY_LABELS,
} from '../../lib/incomeLabels';

interface AddIncomeBarProps {
  canAddSideBusiness: boolean;
  onAdd: (option: AddIncomeOption) => void;
}

function getAddIncomeDescription(option: AddIncomeOption, disabled: boolean): string {
  if (option.variant === 'side_business') {
    return disabled ? '本業の追加後に設定' : '副業・事業所得';
  }

  switch (option.category) {
    case 'employee':
    case 'civil_servant':
      return '給与・賞与';
    case 'part_time':
      return 'パート・アルバイト収入';
    case 'self_employed':
      return '事業所得';
    case 'benefit':
      return '給付金・手当';
    case 'other':
      return 'その他の収入';
  }
}

export function AddIncomeBar({
  canAddSideBusiness,
  onAdd,
}: AddIncomeBarProps) {
  return (
    <section className="add-income-bar">
      <h3 className="add-income-title">収入を追加</h3>
      <div className="add-income-grid ui-add-card-grid">
        {ADD_INCOME_OPTIONS.map((option) => {
          const isSideBusiness = option.variant === 'side_business';
          const disabled = isSideBusiness && !canAddSideBusiness;
          const description = getAddIncomeDescription(option, disabled);

          return (
            <button
              key={`${option.category}-${option.variant ?? 'default'}`}
              type="button"
              className={`add-income-card ui-add-card${
                disabled ? ' add-income-card--disabled' : ''
              }`}
              disabled={disabled}
              onClick={() => onAdd(option)}
            >
              <span className="add-income-label ui-add-card__title">
                {option.label ?? INCOME_CATEGORY_LABELS[option.category]}
              </span>
              <span className="add-income-desc ui-add-card__description">
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
