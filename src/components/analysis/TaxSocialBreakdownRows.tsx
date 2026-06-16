import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  PUBLIC_INSURANCE_DETAIL_ROWS,
  SOCIAL_INSURANCE_DETAIL_ROWS,
  sumPublicInsuranceDetail,
  sumSocialInsuranceDetail,
  sumTaxAmount,
  TAX_DETAIL_ROWS,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface TaxSocialBreakdownRowsProps {
  visibleYears: YearRow[];
  expanded: boolean;
  taxExpanded: boolean;
  socialInsuranceExpanded: boolean;
  publicInsuranceExpanded: boolean;
  onToggle: () => void;
  onToggleTax: () => void;
  onToggleSocialInsurance: () => void;
  onTogglePublicInsurance: () => void;
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

export function TaxSocialBreakdownRows({
  visibleYears,
  expanded,
  taxExpanded,
  socialInsuranceExpanded,
  publicInsuranceExpanded,
  onToggle,
  onToggleTax,
  onToggleSocialInsurance,
  onTogglePublicInsurance,
  renderLabelCell,
  renderValueCell,
}: TaxSocialBreakdownRowsProps) {
  return (
    <>
      <tr className="cf-row-tax cf-row-tax-total">
        {renderLabelCell('税・社保', 1, {
          folder: true,
          expanded,
          onToggle,
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(y.taxSocial, y.calendarYear, { emptyAsDash: true }),
        )}
      </tr>

      {expanded && (
        <>
          <tr className="cf-row-tax cf-row-tax-subtotal">
            {renderLabelCell('税金', 2, {
              folder: true,
              expanded: taxExpanded,
              onToggle: onToggleTax,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumTaxAmount(y.taxSocialBreakdown),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {taxExpanded &&
            TAX_DETAIL_ROWS.map((row) => (
              <tr key={row.key} className="cf-row-tax-detail">
                {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    y.taxSocialBreakdown[row.key],
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>
            ))}

          <tr className="cf-row-tax cf-row-tax-subtotal">
            {renderLabelCell('社会保険料', 2, {
              folder: true,
              expanded: socialInsuranceExpanded,
              onToggle: onToggleSocialInsurance,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumSocialInsuranceDetail(y.taxSocialBreakdown.socialInsuranceDetail),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {socialInsuranceExpanded &&
            SOCIAL_INSURANCE_DETAIL_ROWS.map((row) => (
              <tr key={row.key} className="cf-row-tax-detail">
                {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    y.taxSocialBreakdown.socialInsuranceDetail[row.key],
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>
            ))}

          <tr className="cf-row-tax cf-row-tax-subtotal">
            {renderLabelCell('公的保険料', 2, {
              folder: true,
              expanded: publicInsuranceExpanded,
              onToggle: onTogglePublicInsurance,
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumPublicInsuranceDetail(y.taxSocialBreakdown.publicInsuranceDetail),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {publicInsuranceExpanded &&
            PUBLIC_INSURANCE_DETAIL_ROWS.map((row) => (
              <tr key={row.key} className="cf-row-tax-detail">
                {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    y.taxSocialBreakdown.publicInsuranceDetail[row.key],
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
