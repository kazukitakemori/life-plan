import type { ReactNode } from 'react';

import type { CashFlowTableData, InsuranceIncomeBreakdown } from '../../types/cashFlow';
import {
  INSURANCE_INCOME_DETAIL_ROWS,
  sumInsuranceIncomeBreakdown,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface InsuranceBreakdownRowsProps {
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
  getInsuranceIncomeBreakdown?: (year: YearRow) => InsuranceIncomeBreakdown;
}

export function InsuranceBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
  getInsuranceIncomeBreakdown,
}: InsuranceBreakdownRowsProps) {
  const resolveInsurance =
    getInsuranceIncomeBreakdown ?? ((year) => year.incomeBreakdown.insurance);

  return (
    <>
      <tr className="cf-row-income cf-row-income-subtotal">
        {renderLabelCell('保険', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumInsuranceIncomeBreakdown(resolveInsurance(y)),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        INSURANCE_INCOME_DETAIL_ROWS.map((row) => (
          <tr key={row.key} className="cf-row-income-detail">
            {renderLabelCell(row.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                resolveInsurance(y)[row.key],
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
