import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  EXPENSE_CATEGORY_ROWS,
  EXPENSE_CATEGORY_ROWS_AFTER_EDUCATION,
  sumEducationExpense,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface ExpenseBreakdownRowsProps {
  visibleYears: YearRow[];
  educationMembers: CashFlowTableData['expenseEducationMembers'];
  expanded: boolean;
  educationExpanded: boolean;
  onToggle: () => void;
  onToggleEducation: () => void;
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

export function ExpenseBreakdownRows({
  visibleYears,
  educationMembers,
  expanded,
  educationExpanded,
  onToggle,
  onToggleEducation,
  renderLabelCell,
  renderValueCell,
}: ExpenseBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-total">
        {renderLabelCell('支出', 1, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(y.expenditure, y.calendarYear, { emptyAsDash: true }),
        )}
      </tr>

      {expanded && (
        <>
          {EXPENSE_CATEGORY_ROWS.map((row) => (
            <tr key={row.key} className="cf-row-expense-detail">
              {renderLabelCell(row.label, 2, { icon: 'leaf' })}
              {visibleYears.map((y) =>
                renderValueCell(
                  y.expenseBreakdown[row.key],
                  y.calendarYear,
                  { emptyAsDash: true },
                ),
              )}
            </tr>
          ))}

          <tr className="cf-row-expense cf-row-expense-subtotal">
            {renderLabelCell('教育費', 2, {
              folder: true,
              expanded: educationExpanded,
              onToggle: onToggleEducation,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumEducationExpense(y.expenseBreakdown),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {educationExpanded &&
            educationMembers.map((member) => (
              <tr
                key={`education-${member.memberId}`}
                className="cf-row-expense-detail"
              >
                {renderLabelCell(member.label, 3, { icon: 'leaf' })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    y.expenseBreakdown.educationByMember[member.memberId] ?? 0,
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>
            ))}

          {EXPENSE_CATEGORY_ROWS_AFTER_EDUCATION.map((row) => (
            <tr key={row.key} className="cf-row-expense-detail">
              {renderLabelCell(row.label, 2, { icon: 'leaf' })}
              {visibleYears.map((y) =>
                renderValueCell(
                  y.expenseBreakdown[row.key],
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
