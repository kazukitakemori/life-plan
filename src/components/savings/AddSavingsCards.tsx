import {
  SAVINGS_CATEGORY_LABELS,
  SAVINGS_DEPOSIT_ADD_CATEGORIES,
  SAVINGS_INVEST_ADD_CATEGORIES,
  SAVINGS_SECTOR_LABELS,
} from '../../lib/savingsLabels';
import type { SavingsCategory } from '../../types/savings';
import { AddDisclosure } from '../ui';

interface AddSavingsCardsProps {
  onAdd: (category: SavingsCategory) => void;
}

const ADD_DESCRIPTIONS: Record<SavingsCategory, string> = {
  deposit: '日常の預貯金',
  time_deposit: '定期性の預金',
  savings_other: '財形など',
  nisa_tsumitate: 'つみたて投資枠',
  nisa_growth: '成長投資枠',
  taxable: '課税口座',
  ideco: '個人型確定拠出年金',
  dc: '企業型確定拠出年金',
  db: '確定給付企業年金',
  invest_other: '株式・債券など',
};

function CategoryGrid({
  categories,
  onAdd,
}: {
  categories: SavingsCategory[];
  onAdd: (category: SavingsCategory) => void;
}) {
  return (
    <div className="savings-add-grid ui-add-card-grid">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className="savings-add-card ui-add-card"
          onClick={() => onAdd(category)}
        >
          <span className="savings-add-card-title ui-add-card__title">
            {SAVINGS_CATEGORY_LABELS[category]}
          </span>
          <span className="savings-add-card-desc ui-add-card__description">
            {ADD_DESCRIPTIONS[category]}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AddSavingsCards({ onAdd }: AddSavingsCardsProps) {
  return (
    <AddDisclosure label="貯蓄・運用を追加" className="savings-add-section">
      {(close) => {
        const handleAdd = (category: SavingsCategory) => {
          onAdd(category);
          close();
        };

        return (
          <>
            <div className="savings-add-group">
              <div className="savings-add-group-header">
                <h4 className="savings-add-group-title">
                  {SAVINGS_SECTOR_LABELS.deposit}
                </h4>
                <p className="savings-add-group-desc">預貯金など</p>
              </div>
              <CategoryGrid
                categories={SAVINGS_DEPOSIT_ADD_CATEGORIES}
                onAdd={handleAdd}
              />
            </div>

            <div className="savings-add-group">
              <div className="savings-add-group-header">
                <h4 className="savings-add-group-title">
                  {SAVINGS_SECTOR_LABELS.invest}
                </h4>
                <p className="savings-add-group-desc">投資・年金資産</p>
              </div>
              <CategoryGrid
                categories={SAVINGS_INVEST_ADD_CATEGORIES}
                onAdd={handleAdd}
              />
            </div>
          </>
        );
      }}
    </AddDisclosure>
  );
}
