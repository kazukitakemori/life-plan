import { useState } from 'react';

import {
  HOUSING_LOAN_STRUCTURE_COMPARISON,
  LOAN_STRUCTURE_TYPE_DESCRIPTIONS,
  LOAN_STRUCTURE_TYPE_LABELS,
  LOAN_STRUCTURE_TYPES,
} from '../../lib/loanLabels';
import type { LoanStructureType } from '../../types/loan';

interface HousingLoanStructurePickerProps {
  hasSpouse: boolean;
  confirmLabel?: string;
  onConfirm: (structureType: LoanStructureType) => void;
  onCancel: () => void;
}

function isCoupleStructure(type: LoanStructureType): boolean {
  return type !== 'sole';
}

function ComparisonCellContent({ value }: { value: string | readonly string[] }) {
  if (Array.isArray(value)) {
    return (
      <ul className="loan-structure-comparison-list">
        {value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return <>{value}</>;
}

export function HousingLoanStructurePicker({
  hasSpouse,
  confirmLabel = 'この形態で住宅ローンを追加',
  onConfirm,
  onCancel,
}: HousingLoanStructurePickerProps) {
  const [selected, setSelected] = useState<LoanStructureType>('sole');

  const canConfirm = !isCoupleStructure(selected) || hasSpouse;

  return (
    <section
      className="loan-structure-picker"
      aria-label="住宅ローンの借入形態を選択"
    >
      <div className="loan-structure-picker-header">
        <h4 className="loan-structure-picker-title">借入形態を選択</h4>
        <div className="loan-structure-picker-actions">
          <button
            type="button"
            className="loan-structure-picker-confirm"
            disabled={!canConfirm}
            onClick={() => onConfirm(selected)}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="loan-structure-picker-cancel"
            onClick={onCancel}
          >
            キャンセル
          </button>
        </div>
      </div>

      <fieldset className="loan-structure-options">
        <legend className="loan-structure-options-legend">借入形態</legend>
        {LOAN_STRUCTURE_TYPES.map((type) => {
          const disabled = isCoupleStructure(type) && !hasSpouse;
          return (
            <label
              key={type}
              className={`radio-option loan-structure-option${disabled ? ' loan-structure-option--disabled' : ''}`}
            >
              <input
                type="radio"
                name="loan-structure-type"
                value={type}
                checked={selected === type}
                disabled={disabled}
                onChange={() => setSelected(type)}
              />
              <span>
                {LOAN_STRUCTURE_TYPE_LABELS[type]}
                <span className="loan-structure-option-desc">
                  （{LOAN_STRUCTURE_TYPE_DESCRIPTIONS[type]}）
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {!hasSpouse ? (
        <p className="loan-structure-picker-note">
          ペアローン・連帯債務・収入合算は、Q1で配偶者を登録すると選択できます。
        </p>
      ) : null}

      <div className="loan-structure-comparison-wrap">
        <h5 className="loan-structure-comparison-title">ローン比較表</h5>
        <div className="loan-structure-comparison-scroll">
          <table className="loan-structure-comparison-table">
            <thead>
              <tr>
                <th scope="col" className="loan-structure-comparison-row-label">
                  項目
                </th>
                {HOUSING_LOAN_STRUCTURE_COMPARISON.columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOUSING_LOAN_STRUCTURE_COMPARISON.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="loan-structure-comparison-row-label">
                    {row.label}
                  </th>
                  {HOUSING_LOAN_STRUCTURE_COMPARISON.columns.map((column) => (
                    <td key={column.key}>
                      <ComparisonCellContent value={row[column.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
