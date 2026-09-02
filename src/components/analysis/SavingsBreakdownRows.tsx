import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  SAVINGS_DETAIL_ROWS,
  sumSavingsBreakdown,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface SavingsBreakdownRowsProps {
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

export function SavingsBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: SavingsBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-savings">
        {renderLabelCell('貯蓄額', 1, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(sumSavingsBreakdown(y.savingsBreakdown), y.calendarYear),
        )}
      </tr>

      {expanded &&
        SAVINGS_DETAIL_ROWS.map((row) => (
          <tr key={row.key} className="cf-row-savings-detail">
            {renderLabelCell(row.label, 2, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(y.savingsBreakdown[row.key], y.calendarYear, {
                emptyAsDash: true,
              }),
            )}
          </tr>
        ))}
    </>
  );
}
