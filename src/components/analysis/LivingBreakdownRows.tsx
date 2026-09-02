import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import { sumLivingExpense } from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface LivingBreakdownRowsProps {
  visibleYears: YearRow[];
  livingItems: CashFlowTableData['expenseLivingItems'];
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

export function LivingBreakdownRows({
  visibleYears,
  livingItems,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: LivingBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('生活費', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(sumLivingExpense(y.expenseBreakdown), y.calendarYear, {
            emptyAsDash: true,
          }),
        )}
      </tr>

      {expanded &&
        livingItems.map((item) => (
          <tr key={`living-${item.key}`} className="cf-row-expense-detail">
            {renderLabelCell(item.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                y.expenseBreakdown.livingByLabel[item.key] ?? 0,
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
