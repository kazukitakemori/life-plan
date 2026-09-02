import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  LIFE_EVENT_DETAIL_ROWS,
  sumLifeEventExpenseDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface LifeEventBreakdownRowsProps {
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

export function LifeEventBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: LifeEventBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('ライフイベント', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumLifeEventExpenseDetail(y.expenseBreakdown.lifeEventDetail),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        LIFE_EVENT_DETAIL_ROWS.map((row) => (
          <tr key={`life-event-${row.key}`} className="cf-row-expense-detail">
            {renderLabelCell(row.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                y.expenseBreakdown.lifeEventDetail[row.key],
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
