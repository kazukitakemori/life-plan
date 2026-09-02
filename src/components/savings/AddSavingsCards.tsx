import {
  SAVINGS_CATEGORY_DESCRIPTIONS,
  SAVINGS_CATEGORY_ICONS,
  SAVINGS_CATEGORY_LABELS,
  SAVINGS_DEPOSIT_ADD_CATEGORIES,
  SAVINGS_INVEST_ADD_CATEGORIES,
  SAVINGS_SECTOR_DESCRIPTIONS,
  SAVINGS_SECTOR_LABELS,
} from '../../lib/savingsLabels';
import type { SavingsCategory } from '../../types/savings';

interface AddSavingsCardsProps {
  onAdd: (category: SavingsCategory) => void;
}

function CategoryGrid({
  categories,
  onAdd,
}: {
  categories: SavingsCategory[];
  onAdd: (category: SavingsCategory) => void;
}) {
  return (
    <div className="savings-add-grid">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className="savings-add-card"
          onClick={() => onAdd(category)}
        >
          <span className="savings-add-icon" aria-hidden>
            {SAVINGS_CATEGORY_ICONS[category]}
          </span>
          <span className="savings-add-card-title">
            {SAVINGS_CATEGORY_LABELS[category]}
          </span>
          <span className="savings-add-card-desc">
            {SAVINGS_CATEGORY_DESCRIPTIONS[category]}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AddSavingsCards({ onAdd }: AddSavingsCardsProps) {
  return (
    <section className="savings-add-section" aria-label="貯蓄・運用を追加">
      <h3 className="savings-add-title">貯蓄・運用を追加</h3>

      <div className="savings-add-group">
        <div className="savings-add-group-header">
          <h4 className="savings-add-group-title">
            {SAVINGS_SECTOR_LABELS.deposit}
          </h4>
          <p className="savings-add-group-desc">
            {SAVINGS_SECTOR_DESCRIPTIONS.deposit}
          </p>
        </div>
        <CategoryGrid
          categories={SAVINGS_DEPOSIT_ADD_CATEGORIES}
          onAdd={onAdd}
        />
      </div>

      <div className="savings-add-group">
        <div className="savings-add-group-header">
          <h4 className="savings-add-group-title">
            {SAVINGS_SECTOR_LABELS.invest}
          </h4>
          <p className="savings-add-group-desc">
            {SAVINGS_SECTOR_DESCRIPTIONS.invest}
          </p>
        </div>
        <CategoryGrid
          categories={SAVINGS_INVEST_ADD_CATEGORIES}
          onAdd={onAdd}
        />
      </div>
    </section>
  );
}
