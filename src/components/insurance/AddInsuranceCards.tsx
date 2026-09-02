import {
  INSURANCE_CATEGORY_DESCRIPTIONS,
  INSURANCE_CATEGORY_ICONS,
  INSURANCE_CATEGORY_LABELS,
  INSURANCE_LIFE_ADD_CATEGORIES,
  INSURANCE_NONLIFE_ADD_CATEGORIES,
  INSURANCE_SECTOR_DESCRIPTIONS,
  INSURANCE_SECTOR_LABELS,
} from '../../lib/insuranceLabels';
import type { InsuranceCategory } from '../../types/insurance';

interface AddInsuranceCardsProps {
  onAdd: (category: InsuranceCategory) => void;
}

function CategoryGrid({
  categories,
  onAdd,
}: {
  categories: InsuranceCategory[];
  onAdd: (category: InsuranceCategory) => void;
}) {
  return (
    <div className="insurance-add-grid">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className="insurance-add-card"
          onClick={() => onAdd(category)}
        >
          <span className="insurance-add-icon" aria-hidden>
            {INSURANCE_CATEGORY_ICONS[category]}
          </span>
          <span className="insurance-add-card-title">
            {INSURANCE_CATEGORY_LABELS[category]}
          </span>
          <span className="insurance-add-card-desc">
            {INSURANCE_CATEGORY_DESCRIPTIONS[category]}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AddInsuranceCards({ onAdd }: AddInsuranceCardsProps) {
  return (
    <section className="insurance-add-section" aria-label="保険を追加">
      <h3 className="insurance-add-title">保険を追加</h3>

      <div className="insurance-add-group">
        <div className="insurance-add-group-header">
          <h4 className="insurance-add-group-title">
            {INSURANCE_SECTOR_LABELS.nonlife}
          </h4>
          <p className="insurance-add-group-desc">
            {INSURANCE_SECTOR_DESCRIPTIONS.nonlife}
          </p>
        </div>
        <CategoryGrid
          categories={INSURANCE_NONLIFE_ADD_CATEGORIES}
          onAdd={onAdd}
        />
      </div>

      <div className="insurance-add-group">
        <div className="insurance-add-group-header">
          <h4 className="insurance-add-group-title">
            {INSURANCE_SECTOR_LABELS.life}
          </h4>
          <p className="insurance-add-group-desc">
            {INSURANCE_SECTOR_DESCRIPTIONS.life}
          </p>
        </div>
        <CategoryGrid
          categories={INSURANCE_LIFE_ADD_CATEGORIES}
          onAdd={onAdd}
        />
      </div>
    </section>
  );
}
