import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  OTHER_INSURANCE_PREMIUM_DETAIL_ROWS,
  sumOtherInsurancePremiumDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface InsuranceExpenseBreakdownRowsProps {
  visibleYears: YearRow[];
  expanded: boolean;
  onToggle: () => void;
  renderLabelCell: (
    label: string,
    indent: number,
    options?: {
      folder?: boolean;
      expanded?: boolean;
      onToggle?: () => void;
      icon?: 'folder' | 'leaf';
    },
  ) => ReactNode;
  renderValueCell: (
    value: number,
    year: number,
    options?: { emptyAsDash?: boolean },
  ) => ReactNode;
}

export function InsuranceExpenseBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: InsuranceExpenseBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('保険', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumOtherInsurancePremiumDetail(
              y.expenseBreakdown.insuranceOtherDetail,
            ),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        OTHER_INSURANCE_PREMIUM_DETAIL_ROWS.map((row) => (
          <tr key={`insurance-${row.key}`} className="cf-row-expense-detail">
            {renderLabelCell(row.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                y.expenseBreakdown.insuranceOtherDetail[row.key],
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
