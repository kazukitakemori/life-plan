import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  INVEST_DETAIL_ROWS,
  sumInvestPersonalContribution,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

function personalContributionForCategory(
  year: YearRow,
  key: (typeof INVEST_DETAIL_ROWS)[number]['key'],
): number {
  const detail = year.investBreakdown[key];
  if (typeof detail.personalContribution === 'number') {
    return detail.personalContribution;
  }
  // 旧スナップショット: DC 以外の当年積立を家計負担とみなす
  if (key === 'dc') return 0;
  return detail.contribution;
}

interface InvestContributionBreakdownRowsProps {
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

export function InvestContributionBreakdownRows({
  visibleYears,
  expanded,
  onToggle,
  renderLabelCell,
  renderValueCell,
}: InvestContributionBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('運用積立', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            y.investContribution ??
              sumInvestPersonalContribution(y.investBreakdown),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        INVEST_DETAIL_ROWS.map((row) => (
          <tr
            key={`invest-contribution-${row.key}`}
            className="cf-row-expense-detail"
          >
            {renderLabelCell(row.label, 3, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                personalContributionForCategory(y, row.key),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
