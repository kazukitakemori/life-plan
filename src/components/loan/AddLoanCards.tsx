import { useState } from 'react';

import {
  LOAN_ADD_CATEGORIES,
  LOAN_CATEGORY_DESCRIPTIONS,
  LOAN_CATEGORY_ICONS,
  LOAN_CATEGORY_LABELS,
} from '../../lib/loanLabels';
import type { LoanCategory, LoanStructureType } from '../../types/loan';
import { HousingLoanStructurePicker } from './HousingLoanStructurePicker';

interface AddLoanCardsProps {
  hasSpouse: boolean;
  onAdd: (category: LoanCategory, structureType?: LoanStructureType) => void;
}

export function AddLoanCards({ hasSpouse, onAdd }: AddLoanCardsProps) {
  const [showHousingPicker, setShowHousingPicker] = useState(false);

  const handleCategoryClick = (category: LoanCategory) => {
    if (category === 'housing') {
      setShowHousingPicker(true);
      return;
    }
    onAdd(category);
  };

  const handleHousingConfirm = (structureType: LoanStructureType) => {
    onAdd('housing', structureType);
    setShowHousingPicker(false);
  };

  return (
    <section className="loan-add-section" aria-label="ローンを追加">
      <h3 className="loan-add-title">ローンを追加</h3>
      <div className="loan-add-grid">
        {LOAN_ADD_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={`loan-add-card${category === 'housing' && showHousingPicker ? ' loan-add-card--active' : ''}`}
            onClick={() => handleCategoryClick(category)}
          >
            <span className="loan-add-icon" aria-hidden>
              {LOAN_CATEGORY_ICONS[category]}
            </span>
            <span className="loan-add-card-title">
              {LOAN_CATEGORY_LABELS[category]}
            </span>
            <span className="loan-add-card-desc">
              {LOAN_CATEGORY_DESCRIPTIONS[category]}
            </span>
          </button>
        ))}
      </div>

      {showHousingPicker ? (
        <HousingLoanStructurePicker
          hasSpouse={hasSpouse}
          onConfirm={handleHousingConfirm}
          onCancel={() => setShowHousingPicker(false)}
        />
      ) : null}
    </section>
  );
}
