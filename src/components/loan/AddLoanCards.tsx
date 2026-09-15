import { useState } from 'react';

import {
  LOAN_ADD_CATEGORIES,
  LOAN_CATEGORY_LABELS,
} from '../../lib/loanLabels';
import type { LoanCategory, LoanStructureType } from '../../types/loan';
import { AddDisclosure } from '../ui';
import { HousingLoanStructurePicker } from './HousingLoanStructurePicker';

interface AddLoanCardsProps {
  hasSpouse: boolean;
  onAdd: (category: LoanCategory, structureType?: LoanStructureType) => void;
}

const ADD_DESCRIPTIONS: Record<LoanCategory, string> = {
  housing: '住宅資金',
  vehicle: '車・バイク',
  education: '学費・留学',
  free: 'その他の借入',
};

export function AddLoanCards({ hasSpouse, onAdd }: AddLoanCardsProps) {
  const [showHousingPicker, setShowHousingPicker] = useState(false);

  return (
    <AddDisclosure label="ローンを追加" className="loan-add-section">
      {(close) => {
        const handleCategoryClick = (category: LoanCategory) => {
          if (category === 'housing') {
            setShowHousingPicker(true);
            return;
          }
          onAdd(category);
          close();
        };

        const handleHousingConfirm = (structureType: LoanStructureType) => {
          onAdd('housing', structureType);
          setShowHousingPicker(false);
          close();
        };

        return (
          <>
            <div className="loan-add-grid ui-add-card-grid">
              {LOAN_ADD_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`loan-add-card ui-add-card${category === 'housing' && showHousingPicker ? ' loan-add-card--active ui-add-card--active' : ''}`}
                  onClick={() => handleCategoryClick(category)}
                >
                  <span className="loan-add-card-title ui-add-card__title">
                    {LOAN_CATEGORY_LABELS[category]}
                  </span>
                  <span className="loan-add-card-desc ui-add-card__description">
                    {ADD_DESCRIPTIONS[category]}
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
          </>
        );
      }}
    </AddDisclosure>
  );
}
