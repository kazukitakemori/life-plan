import { useState } from 'react';
import type { ReactNode } from 'react';

import type {
  CashFlowTableData,
  IncomeBreakdown,
  MemberCashFlowYearSlice,
  TaxSocialBreakdown,
} from '../../types/cashFlow';
import {
  BONUS_DETAIL_ROWS,
  createEmptyIncomeBreakdown,
  INCOME_BREAKDOWN_ROWS,
  SALARY_DETAIL_ROWS,
  sumBonusDetail,
  sumSalaryDetail,
} from '../../types/cashFlow';
import { InsuranceBreakdownRows } from './InsuranceBreakdownRows';
import { PensionBreakdownRows } from './PensionBreakdownRows';
import { TaxSocialBreakdownRows } from './TaxSocialBreakdownRows';

type YearRow = CashFlowTableData['years'][number];

const EMPTY_TAX_SOCIAL_BREAKDOWN: TaxSocialBreakdown = {
  incomeTax: 0,
  residentTax: 0,
  giftTax: 0,
  socialInsuranceDetail: {
    healthInsurance: 0,
    employeesPension: 0,
    employmentInsurance: 0,
  },
  publicInsuranceDetail: {
    nationalPension: 0,
    nationalHealthInsurance: 0,
    longTermCare: 0,
    lateElderlyHealth: 0,
  },
};

function getMemberSlice(
  year: YearRow,
  memberId: string,
): MemberCashFlowYearSlice {
  return (
    year.memberYearByMemberId?.[memberId] ?? {
      income: 0,
      incomeBreakdown: createEmptyIncomeBreakdown(),
      taxSocial: 0,
      taxSocialBreakdown: EMPTY_TAX_SOCIAL_BREAKDOWN,
    }
  );
}

interface MemberCashFlowFolderRowsProps {
  memberId: string;
  label: string;
  visibleYears: YearRow[];
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
    options?: { emptyAsDash?: boolean; onClick?: () => void },
  ) => ReactNode;
  onTaxSocialYearClick?: (calendarYear: number, memberId: string) => void;
}

export function MemberCashFlowFolderRows({
  memberId,
  label,
  visibleYears,
  renderLabelCell,
  renderValueCell,
  onTaxSocialYearClick,
}: MemberCashFlowFolderRowsProps) {
  const [folderExpanded, setFolderExpanded] = useState(false);
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [salaryExpanded, setSalaryExpanded] = useState(false);
  const [bonusExpanded, setBonusExpanded] = useState(false);
  const [insuranceIncomeExpanded, setInsuranceIncomeExpanded] = useState(false);
  const [expandedPensionFolders, setExpandedPensionFolders] = useState<
    Set<string>
  >(() => new Set());
  const [taxSocialExpanded, setTaxSocialExpanded] = useState(false);
  const [taxExpanded, setTaxExpanded] = useState(false);
  const [socialInsuranceExpanded, setSocialInsuranceExpanded] =
    useState(false);
  const [publicInsuranceExpanded, setPublicInsuranceExpanded] =
    useState(false);

  const pensionFolderKey = (key: string) => `${memberId}:${key}`;

  const togglePensionFolder = (key: string) => {
    const scopedKey = pensionFolderKey(key);
    setExpandedPensionFolders((prev) => {
      const next = new Set(prev);
      if (next.has(scopedKey)) {
        next.delete(scopedKey);
      } else {
        next.add(scopedKey);
      }
      return next;
    });
  };

  const getIncomeBreakdown = (year: YearRow): IncomeBreakdown =>
    getMemberSlice(year, memberId).incomeBreakdown;

  return (
    <>
      <tr className="cf-row-folder">
        {renderLabelCell(label, 0, {
          folder: true,
          expanded: folderExpanded,
          onToggle: () => setFolderExpanded((value) => !value),
          icon: 'folder',
        })}
        {visibleYears.map((y) => (
          <td key={y.calendarYear} className="cf-value-col" />
        ))}
      </tr>

      {folderExpanded && (
        <>
          <tr className="cf-row-income cf-row-income-total">
            {renderLabelCell('収入', 1, {
              folder: true,
              expanded: incomeExpanded,
              onToggle: () => setIncomeExpanded((value) => !value),
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                getMemberSlice(y, memberId).income,
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {incomeExpanded && (
            <>
              <tr className="cf-row-income cf-row-income-subtotal">
                {renderLabelCell('給与', 2, {
                  folder: true,
                  expanded: salaryExpanded,
                  onToggle: () => setSalaryExpanded((value) => !value),
                  icon: 'folder',
                })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    sumSalaryDetail(getIncomeBreakdown(y).salary),
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>

              {salaryExpanded &&
                SALARY_DETAIL_ROWS.map((row) => (
                  <tr key={`${memberId}-salary-${row.key}`} className="cf-row-income-detail">
                    {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                    {visibleYears.map((y) =>
                      renderValueCell(
                        getIncomeBreakdown(y).salary[row.key],
                        y.calendarYear,
                        { emptyAsDash: true },
                      ),
                    )}
                  </tr>
                ))}

              <tr className="cf-row-income cf-row-income-subtotal">
                {renderLabelCell('賞与', 2, {
                  folder: true,
                  expanded: bonusExpanded,
                  onToggle: () => setBonusExpanded((value) => !value),
                  icon: 'folder',
                })}
                {visibleYears.map((y) =>
                  renderValueCell(
                    sumBonusDetail(getIncomeBreakdown(y).bonus),
                    y.calendarYear,
                    { emptyAsDash: true },
                  ),
                )}
              </tr>

              {bonusExpanded &&
                BONUS_DETAIL_ROWS.map((row) => (
                  <tr key={`${memberId}-bonus-${row.key}`} className="cf-row-income-detail">
                    {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                    {visibleYears.map((y) =>
                      renderValueCell(
                        getIncomeBreakdown(y).bonus[row.key],
                        y.calendarYear,
                        { emptyAsDash: true },
                      ),
                    )}
                  </tr>
                ))}

              <PensionBreakdownRows
                visibleYears={visibleYears}
                expandedFolders={
                  new Set(
                    [...expandedPensionFolders]
                      .filter((key) => key.startsWith(`${memberId}:`))
                      .map((key) => key.slice(memberId.length + 1)),
                  )
                }
                onToggleFolder={togglePensionFolder}
                renderLabelCell={renderLabelCell}
                renderValueCell={renderValueCell}
                getPensionBreakdown={(year) => getIncomeBreakdown(year).pension}
              />

              <InsuranceBreakdownRows
                visibleYears={visibleYears}
                expanded={insuranceIncomeExpanded}
                onToggle={() => setInsuranceIncomeExpanded((value) => !value)}
                renderLabelCell={renderLabelCell}
                renderValueCell={renderValueCell}
                getInsuranceIncomeBreakdown={(year) =>
                  getIncomeBreakdown(year).insurance
                }
              />

              {INCOME_BREAKDOWN_ROWS.map((row) => (
                <tr key={`${memberId}-${row.key}`} className="cf-row-income-detail">
                  {renderLabelCell(row.label, 2, { icon: 'leaf' })}
                  {visibleYears.map((y) => {
                    const amount = getIncomeBreakdown(y)[row.key];
                    return renderValueCell(
                      typeof amount === 'number' ? amount : 0,
                      y.calendarYear,
                      { emptyAsDash: true },
                    );
                  })}
                </tr>
              ))}
            </>
          )}

          <TaxSocialBreakdownRows
            visibleYears={visibleYears}
            expanded={taxSocialExpanded}
            taxExpanded={taxExpanded}
            socialInsuranceExpanded={socialInsuranceExpanded}
            publicInsuranceExpanded={publicInsuranceExpanded}
            onToggle={() => setTaxSocialExpanded((value) => !value)}
            onToggleTax={() => setTaxExpanded((value) => !value)}
            onToggleSocialInsurance={() =>
              setSocialInsuranceExpanded((value) => !value)
            }
            onTogglePublicInsurance={() =>
              setPublicInsuranceExpanded((value) => !value)
            }
            onTaxSocialYearClick={
              onTaxSocialYearClick
                ? (calendarYear) => onTaxSocialYearClick(calendarYear, memberId)
                : undefined
            }
            getTaxSocial={(year) => getMemberSlice(year, memberId).taxSocial}
            getTaxSocialBreakdown={(year) =>
              getMemberSlice(year, memberId).taxSocialBreakdown
            }
            renderLabelCell={renderLabelCell}
            renderValueCell={renderValueCell}
          />
        </>
      )}
    </>
  );
}
