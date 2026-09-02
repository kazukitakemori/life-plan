import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  VEHICLE_DETAIL_ROWS,
  sumVehicleExpenseDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface VehicleBreakdownRowsProps {
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

export function VehicleBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: VehicleBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('乗り物', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumVehicleExpenseDetail(y.expenseBreakdown.vehicleDetail),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        VEHICLE_DETAIL_ROWS.map((row) => (
          <tr key={row.key} className="cf-row-expense-detail">
            {renderLabelCell(row.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                y.expenseBreakdown.vehicleDetail[row.key],
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
