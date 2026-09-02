import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import { sumEducationExpense, sumInvestPersonalContribution } from '../../types/cashFlow';
import { HousingBreakdownRows } from './HousingBreakdownRows';
import { InsuranceExpenseBreakdownRows } from './InsuranceExpenseBreakdownRows';
import { InvestContributionBreakdownRows } from './InvestContributionBreakdownRows';
import { LifeEventBreakdownRows } from './LifeEventBreakdownRows';
import { LivingBreakdownRows } from './LivingBreakdownRows';
import { LoanExpenseBreakdownRows } from './LoanExpenseBreakdownRows';
import { VehicleBreakdownRows } from './VehicleBreakdownRows';

type YearRow = CashFlowTableData['years'][number];

interface ExpenseBreakdownRowsProps {
  visibleYears: YearRow[];
  educationMembers: CashFlowTableData['expenseEducationMembers'];
  livingItems: CashFlowTableData['expenseLivingItems'];
  expanded: boolean;
  livingExpanded: boolean;
  housingExpanded: boolean;
  housingRentalExpanded: boolean;
  housingOwnedExpanded: boolean;
  housingTaxExpanded: boolean;
  housingLoanRepaymentExpanded: boolean;
  vehicleExpanded: boolean;
  lifeEventExpanded: boolean;
  educationExpanded: boolean;
  loanExpanded: boolean;
  insuranceExpanded: boolean;
  investContributionExpanded: boolean;
  onToggle: () => void;
  onToggleLiving: () => void;
  onToggleHousing: () => void;
  onToggleHousingRental: () => void;
  onToggleHousingOwned: () => void;
  onToggleHousingTax: () => void;
  onToggleHousingLoanRepayment: () => void;
  onToggleVehicle: () => void;
  onToggleLifeEvent: () => void;
  onToggleEducation: () => void;
  onToggleLoan: () => void;
  onToggleInsurance: () => void;
  onToggleInvestContribution: () => void;
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
  livingItems,
  expanded,
  livingExpanded,
  housingExpanded,
  housingRentalExpanded,
  housingOwnedExpanded,
  housingTaxExpanded,
  housingLoanRepaymentExpanded,
  vehicleExpanded,
  lifeEventExpanded,
  educationExpanded,
  loanExpanded,
  insuranceExpanded,
  investContributionExpanded,
  onToggle,
  onToggleLiving,
  onToggleHousing,
  onToggleHousingRental,
  onToggleHousingOwned,
  onToggleHousingTax,
  onToggleHousingLoanRepayment,
  onToggleVehicle,
  onToggleLifeEvent,
  onToggleEducation,
  onToggleLoan,
  onToggleInsurance,
  onToggleInvestContribution,
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
        {visibleYears.map((y) => {
          const invest =
            y.investContribution ??
            sumInvestPersonalContribution(y.investBreakdown);
          const total =
            y.investContribution == null ? y.expenditure + invest : y.expenditure;
          return renderValueCell(total, y.calendarYear, { emptyAsDash: true });
        })}
      </tr>

      {expanded && (
        <>
          <LivingBreakdownRows
            visibleYears={visibleYears}
            livingItems={livingItems}
            expanded={livingExpanded}
            onToggle={onToggleLiving}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

          <HousingBreakdownRows
            visibleYears={visibleYears}
            expanded={housingExpanded}
            rentalExpanded={housingRentalExpanded}
            ownedExpanded={housingOwnedExpanded}
            taxExpanded={housingTaxExpanded}
            loanRepaymentExpanded={housingLoanRepaymentExpanded}
            onToggle={onToggleHousing}
            onToggleRental={onToggleHousingRental}
            onToggleOwned={onToggleHousingOwned}
            onToggleTax={onToggleHousingTax}
            onToggleLoanRepayment={onToggleHousingLoanRepayment}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

          <VehicleBreakdownRows
            visibleYears={visibleYears}
            expanded={vehicleExpanded}
            onToggle={onToggleVehicle}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

          <LifeEventBreakdownRows
            visibleYears={visibleYears}
            expanded={lifeEventExpanded}
            onToggle={onToggleLifeEvent}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

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

          <LoanExpenseBreakdownRows
            visibleYears={visibleYears}
            expanded={loanExpanded}
            onToggle={onToggleLoan}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

          <InsuranceExpenseBreakdownRows
            visibleYears={visibleYears}
            expanded={insuranceExpanded}
            onToggle={onToggleInsurance}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />

          <InvestContributionBreakdownRows
            visibleYears={visibleYears}
            expanded={investContributionExpanded}
            onToggle={onToggleInvestContribution}
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />
        </>
      )}
    </>
  );
}
