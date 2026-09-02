import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  OTHER_LOAN_PRIMARY_DETAIL_ROWS,
  OTHER_LOAN_UNLINKED_DETAIL_ROWS,
  sumOtherLoanRepaymentDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface LoanExpenseBreakdownRowsProps {
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

export function LoanExpenseBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: LoanExpenseBreakdownRowsProps) {
  const unlinkedRows = OTHER_LOAN_UNLINKED_DETAIL_ROWS.filter((row) =>
    visibleYears.some(
      (y) => y.expenseBreakdown.loanRepaymentDetail[row.key] > 0,
    ),
  );

  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('ローン', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumOtherLoanRepaymentDetail(y.expenseBreakdown.loanRepaymentDetail),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded && (
        <>
          {OTHER_LOAN_PRIMARY_DETAIL_ROWS.map((row) => (
            <tr key={`loan-${row.key}`} className="cf-row-expense-detail">
              {renderLabelCell(row.label, 3, { icon: 'leaf' })}
              {visibleYears.map((y) =>
                renderValueCell(
                  y.expenseBreakdown.loanRepaymentDetail[row.key],
                  y.calendarYear,
                  { emptyAsDash: true },
                ),
              )}
            </tr>
          ))}
          {unlinkedRows.map((row) => (
            <tr key={`loan-${row.key}`} className="cf-row-expense-detail">
              {renderLabelCell(row.label, 3, { icon: 'leaf' })}
              {visibleYears.map((y) =>
                renderValueCell(
                  y.expenseBreakdown.loanRepaymentDetail[row.key],
                  y.calendarYear,
                  { emptyAsDash: true },
                ),
              )}
            </tr>
          ))}
        </>
      )}
    </>
  );
}
