import { Fragment, type ReactNode } from 'react';

import type { CashFlowTableData, InvestBreakdown } from '../../types/cashFlow';
import {
  INVEST_CATEGORY_PART_ROWS,
  INVEST_DETAIL_ROWS,
  sumInvestBreakdown,
  sumInvestCategoryDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface InvestBreakdownRowsProps {
  visibleYears: YearRow[];
  expanded: boolean;
  expandedCategories: ReadonlySet<keyof InvestBreakdown>;
  onToggle: () => void;
  onToggleCategory: (key: keyof InvestBreakdown) => void;
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

export function InvestBreakdownRows({
  visibleYears,
  expanded,
  expandedCategories,
  onToggle,
  onToggleCategory,
  renderLabelCell,
  renderValueCell,
}: InvestBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-invest">
        {renderLabelCell('運用残高', 1, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(sumInvestBreakdown(y.investBreakdown), y.calendarYear, {
            emptyAsDash: true,
          }),
        )}
      </tr>

      {expanded &&
        INVEST_DETAIL_ROWS.map((row) => {
          const categoryExpanded = expandedCategories.has(row.key);
          return (
            <Fragment key={row.key}>
              <tr className="cf-row-invest-detail">
                {renderLabelCell(row.label, 2, {
                  folder: true,
                  expanded: categoryExpanded,
                  onToggle: () => onToggleCategory(row.key),
                  icon: 'folder',
                })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    sumInvestCategoryDetail(y.investBreakdown[row.key]),
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>

              {categoryExpanded &&
                INVEST_CATEGORY_PART_ROWS.filter((part) => {
                  if (part.key !== 'capitalGainsTax') return true;
                  // NISA は非課税のため売却益税行は出さない
                  return (
                    row.key !== 'nisaTsumitate' && row.key !== 'nisaGrowth'
                  );
                }).map((part) => (
                  <tr
                    key={`${row.key}.${part.key}`}
                    className="cf-row-invest-part"
                  >
                    {renderLabelCell(part.label, 3, { icon: 'leaf' })}
                    {visibleYears.map((y) =>
                      renderValueCell(
                        y.investBreakdown[row.key][part.key],
                        y.calendarYear,
                        { emptyAsDash: true },
                      ),
                    )}
                  </tr>
                ))}
            </Fragment>
          );
        })}
    </>
  );
}
