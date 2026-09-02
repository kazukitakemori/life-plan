import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  HOUSING_LOAN_REPAYMENT_DETAIL_ROWS,
  HOUSING_OWNED_DIRECT_DETAIL_ROWS,
  HOUSING_OWNED_TAIL_DETAIL_ROWS,
  HOUSING_RENTAL_DETAIL_ROWS,
  HOUSING_TAX_DETAIL_ROWS,
  sumHousingExpenseDetail,
  sumHousingLoanRepaymentDetail,
  sumHousingOwnedExpenseDetail,
  sumHousingRentalExpenseDetail,
  sumHousingTaxDetail,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface HousingBreakdownRowsProps {
  visibleYears: YearRow[];
  expanded: boolean;
  rentalExpanded: boolean;
  ownedExpanded: boolean;
  taxExpanded: boolean;
  loanRepaymentExpanded: boolean;
  onToggle: () => void;
  onToggleRental: () => void;
  onToggleOwned: () => void;
  onToggleTax: () => void;
  onToggleLoanRepayment: () => void;
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

export function HousingBreakdownRows({
  visibleYears,
  expanded,
  rentalExpanded,
  ownedExpanded,
  taxExpanded,
  loanRepaymentExpanded,
  onToggle,
  onToggleRental,
  onToggleOwned,
  onToggleTax,
  onToggleLoanRepayment,
  renderLabelCell,
  renderValueCell,
}: HousingBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-expense cf-row-expense-subtotal">
        {renderLabelCell('家', 2, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumHousingExpenseDetail(y.expenseBreakdown.housingDetail),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded && (
        <>
          <tr className="cf-row-expense cf-row-expense-subtotal">
            {renderLabelCell('賃貸', 3, {
              folder: true,
              expanded: rentalExpanded,
              onToggle: onToggleRental,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumHousingRentalExpenseDetail(y.expenseBreakdown.housingDetail),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {rentalExpanded &&
            HOUSING_RENTAL_DETAIL_ROWS.map((row) => (
              <tr
                key={`rental.${row.key}`}
                className="cf-row-expense-detail"
              >
                {renderLabelCell(row.label, 4, { icon: 'leaf' })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    y.expenseBreakdown.housingDetail[row.key],
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>
            ))}

          <tr className="cf-row-expense cf-row-expense-subtotal">
            {renderLabelCell('所有物件', 3, {
              folder: true,
              expanded: ownedExpanded,
              onToggle: onToggleOwned,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumHousingOwnedExpenseDetail(y.expenseBreakdown.housingDetail),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {ownedExpanded && (
            <>
              {HOUSING_OWNED_DIRECT_DETAIL_ROWS.map((row) => (
                <tr key={row.key} className="cf-row-expense-detail">
                  {renderLabelCell(row.label, 4, { icon: 'leaf' })}
                  {visibleYears.map((y) =>
                    renderValueCell(
                      y.expenseBreakdown.housingDetail[row.key],
                      y.calendarYear,
                      { emptyAsDash: true },
                    ),
                  )}
                </tr>
              ))}

              <tr className="cf-row-expense cf-row-expense-subtotal">
                {renderLabelCell('税金', 4, {
                  folder: true,
                  expanded: taxExpanded,
                  onToggle: onToggleTax,
                  icon: 'folder',
                })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    sumHousingTaxDetail(
                      y.expenseBreakdown.housingDetail.taxDetail,
                    ),
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>

              {taxExpanded &&
                HOUSING_TAX_DETAIL_ROWS.map((row) => (
                  <tr key={row.key} className="cf-row-expense-detail">
                    {renderLabelCell(row.label, 5, { icon: 'leaf' })}
                    {visibleYears.map((y) =>
                      renderValueCell(
                        y.expenseBreakdown.housingDetail.taxDetail[row.key],
                        y.calendarYear,
                        { emptyAsDash: true },
                      ),
                    )}
                  </tr>
                ))}

              <tr className="cf-row-expense cf-row-expense-subtotal">
                {renderLabelCell('ローン返済', 4, {
                  folder: true,
                  expanded: loanRepaymentExpanded,
                  onToggle: onToggleLoanRepayment,
                  icon: 'folder',
                })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    sumHousingLoanRepaymentDetail(
                      y.expenseBreakdown.housingDetail.loanRepaymentDetail,
                    ),
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>

              {loanRepaymentExpanded &&
                HOUSING_LOAN_REPAYMENT_DETAIL_ROWS.map((row) => (
                  <tr key={row.key} className="cf-row-expense-detail">
                    {renderLabelCell(row.label, 5, { icon: 'leaf' })}
                    {visibleYears.map((y) =>
                      renderValueCell(
                        y.expenseBreakdown.housingDetail.loanRepaymentDetail[
                          row.key
                        ],
                        y.calendarYear,
                        { emptyAsDash: true },
                      ),
                    )}
                  </tr>
                ))}

              {HOUSING_OWNED_TAIL_DETAIL_ROWS.map((row) => (
                <tr
                  key={`owned.${row.key}`}
                  className="cf-row-expense-detail"
                >
                  {renderLabelCell(row.label, 4, { icon: 'leaf' })}
                  {visibleYears.map((y) =>
                    renderValueCell(
                      y.expenseBreakdown.housingDetail[row.key],
                      y.calendarYear,
                      { emptyAsDash: true },
                    ),
                  )}
                </tr>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
