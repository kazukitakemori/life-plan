import {
  INSURANCE_CATEGORY_LABELS,
  INSURANCE_LIFE_ADD_CATEGORIES,
  INSURANCE_NONLIFE_ADD_CATEGORIES,
  INSURANCE_SECTOR_LABELS,
} from '../../lib/insuranceLabels';
import type { InsuranceCategory } from '../../types/insurance';

interface AddInsuranceCardsProps {
  onAdd: (category: InsuranceCategory) => void;
}

const ADD_DESCRIPTIONS: Record<InsuranceCategory, string> = {
  fire: '建物・家財',
  auto: '自動車',
  nonlife_other: '傷害・旅行など',
  life: '死亡・収入保障',
  medical: '入院・手術',
  cancer: 'がん治療',
  education: '教育資金',
  personal_pension: '老後資金',
  life_other: 'その他の保障',
};

function CategoryGrid({
  categories,
  onAdd,
}: {
  categories: InsuranceCategory[];
  onAdd: (category: InsuranceCategory) => void;
}) {
  return (
    <div className="insurance-add-grid ui-add-card-grid">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className="insurance-add-card ui-add-card"
          onClick={() => onAdd(category)}
        >
          <span className="insurance-add-card-title ui-add-card__title">
            {INSURANCE_CATEGORY_LABELS[category]}
          </span>
          <span className="insurance-add-card-desc ui-add-card__description">
            {ADD_DESCRIPTIONS[category]}
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
          <p className="insurance-add-group-desc">火災・自動車など</p>
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
          <p className="insurance-add-group-desc">死亡・医療・老後など</p>
        </div>
        <CategoryGrid
          categories={INSURANCE_LIFE_ADD_CATEGORIES}
          onAdd={onAdd}
        />
      </div>
    </section>
  );
}
