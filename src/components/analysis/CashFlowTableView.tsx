import { useMemo, useState } from 'react';

import { formatCashFlowValue } from '../../lib/cashFlow';
import type { CashFlowTableData, InvestBreakdown } from '../../types/cashFlow';
import {
  BONUS_DETAIL_ROWS,
  INCOME_BREAKDOWN_ROWS,
  SALARY_DETAIL_ROWS,
  sumBonusDetail,
  sumSalaryDetail,
} from '../../types/cashFlow';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { PensionByMember } from '../../types/pension';
import { TaxSocialBreakdownModal } from '../other/TaxSocialBreakdownModal';
import { ExpenseBreakdownRows } from './ExpenseBreakdownRows';
import { InsuranceBreakdownRows } from './InsuranceBreakdownRows';
import { InvestBreakdownRows } from './InvestBreakdownRows';
import { PensionBreakdownRows } from './PensionBreakdownRows';
import { SavingsBreakdownRows } from './SavingsBreakdownRows';
import { MemberCashFlowFolderRows } from './MemberCashFlowFolderRows';
import { TaxSocialBreakdownRows } from './TaxSocialBreakdownRows';

export interface TaxSocialBreakdownContext {
  members: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
}

interface CashFlowTableViewProps {
  data: CashFlowTableData;
  onBack?: () => void;
  showBackButton?: boolean;
  showTitle?: boolean;
  taxSocialBreakdown?: TaxSocialBreakdownContext;
}

type DisplayRange = 'all' | '10' | '20';

/** 固定ヘッダー行の高さ（px）。年行＋年齢行の sticky top 計算に使用 */
const CF_HEAD_ROW_HEIGHT_PX = 33;

interface SimpleRowDef {
  key: string;
  label: string;
  indent: number;
  getValue: (year: CashFlowTableData['years'][number]) => number;
  rowClass?: string;
  emptyAsDash?: boolean;
}

export function CashFlowTableView({
  data,
  onBack,
  showBackButton = true,
  showTitle = true,
  taxSocialBreakdown,
}: CashFlowTableViewProps) {
  const [displayRange, setDisplayRange] = useState<DisplayRange>('all');
  const [breakdownModal, setBreakdownModal] = useState<{
    calendarYear: number;
    memberId?: string;
  } | null>(null);
  const [householdExpanded, setHouseholdExpanded] = useState(true);
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
  const [expenditureExpanded, setExpenditureExpanded] = useState(false);
  const [livingExpenseExpanded, setLivingExpenseExpanded] = useState(false);
  const [housingExpenseExpanded, setHousingExpenseExpanded] = useState(false);
  const [housingRentalExpanded, setHousingRentalExpanded] = useState(false);
  const [housingOwnedExpanded, setHousingOwnedExpanded] = useState(false);
  const [housingTaxExpanded, setHousingTaxExpanded] = useState(false);
  const [housingLoanRepaymentExpanded, setHousingLoanRepaymentExpanded] =
    useState(false);
  const [vehicleExpenseExpanded, setVehicleExpenseExpanded] = useState(false);
  const [lifeEventExpenseExpanded, setLifeEventExpenseExpanded] =
    useState(false);
  const [educationExpenseExpanded, setEducationExpenseExpanded] =
    useState(false);
  const [loanExpenseExpanded, setLoanExpenseExpanded] = useState(false);
  const [insuranceExpenseExpanded, setInsuranceExpenseExpanded] =
    useState(false);
  const [investContributionExpanded, setInvestContributionExpanded] =
    useState(false);
  const [savingsExpanded, setSavingsExpanded] = useState(false);
  const [investExpanded, setInvestExpanded] = useState(false);
  const [expandedInvestCategories, setExpandedInvestCategories] = useState<
    Set<keyof InvestBreakdown>
  >(() => new Set());

  const visibleYears = useMemo(() => {
    if (displayRange === 'all') return data.years;
    const count = displayRange === '10' ? 10 : 20;
    return data.years.slice(0, count);
  }, [data.years, displayRange]);

  const head = data.memberAgeRows.find((r) => r.label.includes('世帯主'));
  const startHeadAge = head ? head.agesByYear[data.startYear] : null;

  const memberFolderRows = useMemo(() => {
    const firstYear = data.years[0];
    if (!firstYear?.memberYearByMemberId) return [];

    return data.memberAgeRows.filter(
      (row) => firstYear.memberYearByMemberId[row.memberId] != null,
    );
  }, [data.memberAgeRows, data.years]);

  const disposableIncomeRow: SimpleRowDef = {
    key: 'disposable',
    label: '可処分所得',
    indent: 1,
    getValue: (y) => y.disposableIncome,
    rowClass: 'cf-row-income',
  };

  const householdRows: SimpleRowDef[] = [
    {
      key: 'balance',
      label: '年間収支',
      indent: 1,
      getValue: (y) => y.annualBalance,
      rowClass: 'cf-row-balance',
    },
  ];

  const financialAssetsRow: SimpleRowDef = {
    key: 'financialAssets',
    label: '金融資産',
    indent: 1,
    getValue: (y) => y.financialAssets,
    rowClass: 'cf-row-assets',
  };

  const togglePensionFolder = (key: string) => {
    setExpandedPensionFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleInvestCategory = (key: keyof InvestBreakdown) => {
    setExpandedInvestCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderValueCell = (
    value: number,
    year: number,
    options?: { emptyAsDash?: boolean; onClick?: () => void },
  ) => {
    const amount =
      typeof value === 'number' && Number.isFinite(value) ? value : 0;
    const formatted = formatCashFlowValue(amount, {
      emptyAsDash: options?.emptyAsDash,
    });

    if (options?.onClick) {
      return (
        <td
          key={year}
          className={`cf-value-col cf-value-col--clickable ${amount < 0 ? 'cf-negative' : ''}`}
          onClick={options.onClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              options.onClick?.();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`${year}年の税・社保の計算内訳を表示`}
        >
          {formatted}
        </td>
      );
    }

    return (
      <td
        key={year}
        className={`cf-value-col ${amount < 0 ? 'cf-negative' : ''}`}
      >
        {formatted}
      </td>
    );
  };

  const renderLabelCell = (
    label: string,
    indent: number,
    options?: {
      folder?: boolean;
      expanded?: boolean;
      onToggle?: () => void;
      icon?: 'folder' | 'leaf';
    },
  ) => (
    <td
      className="cf-sticky-col cf-label-col"
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      {options?.folder && (
        <button
          type="button"
          className="cf-folder-toggle"
          onClick={options.onToggle}
          aria-expanded={options.expanded}
        >
          {options.expanded ? '−' : '+'}
        </button>
      )}
      {options?.icon === 'folder' && (
        <span className="cf-folder-icon" aria-hidden>
          📁
        </span>
      )}
      {options?.icon === 'leaf' && (
        <span className="cf-leaf-icon" aria-hidden>
          📄
        </span>
      )}
      {label}
    </td>
  );

  return (
    <div className="cashflow-page">
      <div
        className={`cashflow-header${!showBackButton && !showTitle ? ' cashflow-header--controls-only' : ''}`}
      >
        {(showBackButton || showTitle) && (
          <div className="cashflow-header-left">
            {showBackButton && onBack != null && (
              <button type="button" className="cashflow-back-btn" onClick={onBack}>
                ← 入力に戻る
              </button>
            )}
            {showTitle && (
              <h2 className="cashflow-title">
                キャッシュフロー表
                <span className="cashflow-help" title="収入・生活費の入力内容から算出">
                  ?
                </span>
              </h2>
            )}
          </div>
        )}
        <div className="cashflow-header-right">
          <label className="cashflow-select-label">
            <select className="cashflow-select" value={data.startYear} disabled>
              <option value={data.startYear}>
                {data.startYear}年
                {startHeadAge != null ? `（${startHeadAge}歳）` : ''}～
              </option>
            </select>
          </label>
          <label className="cashflow-select-label">
            <select
              className="cashflow-select"
              value={displayRange}
              onChange={(e) => setDisplayRange(e.target.value as DisplayRange)}
            >
              <option value="all">全期間表示</option>
              <option value="10">10年表示</option>
              <option value="20">20年表示</option>
            </select>
          </label>
        </div>
      </div>

      <div className="cashflow-table-wrap">
        <table className="cashflow-table">
          <thead>
            <tr className="cf-head-year-row">
              <th className="cf-sticky-col cf-label-col cf-year-header-corner">
                年
              </th>
              {visibleYears.map((y) => (
                <th key={y.calendarYear} className="cf-year-col">
                  {y.calendarYear}年
                </th>
              ))}
            </tr>
            {data.memberAgeRows.map((member, ageIndex) => {
              const stickyTop = CF_HEAD_ROW_HEIGHT_PX * (ageIndex + 1);
              return (
                <tr key={member.memberId} className="cf-row-age cf-head-age-row">
                  <th
                    className="cf-sticky-col cf-label-col"
                    style={{ top: stickyTop }}
                  >
                    {member.label}
                  </th>
                  {visibleYears.map((y) => (
                    <th
                      key={y.calendarYear}
                      className="cf-value-col cf-age-value-col"
                      style={{ top: stickyTop }}
                    >
                      {member.agesByYear[y.calendarYear] ?? '-'}
                    </th>
                  ))}
                </tr>
              );
            })}
          </thead>
          <tbody>
            <tr className="cf-row-folder">
              {renderLabelCell('家計', 0, {
                folder: true,
                expanded: householdExpanded,
                onToggle: () => setHouseholdExpanded((v) => !v),
                icon: 'folder',
              })}
              {visibleYears.map((y) => (
                <td key={y.calendarYear} className="cf-value-col" />
              ))}
            </tr>

            {householdExpanded && (
              <>
                <tr className="cf-row-income cf-row-income-total">
                  {renderLabelCell('収入', 1, {
                    folder: true,
                    expanded: incomeExpanded,
                    onToggle: () => setIncomeExpanded((v) => !v),
                    icon: 'folder',
                  })}
                  {visibleYears.map((y) =>
                    renderValueCell(y.income, y.calendarYear),
                  )}
                </tr>

                {incomeExpanded && (
                  <>
                    <tr className="cf-row-income cf-row-income-subtotal">
                      {renderLabelCell('給与', 2, {
                        folder: true,
                        expanded: salaryExpanded,
                        onToggle: () => setSalaryExpanded((v) => !v),
                        icon: 'folder',
                      })}
                      {visibleYears.map((y) =>
                        renderValueCell(
                          sumSalaryDetail(y.incomeBreakdown.salary),
                          y.calendarYear,
                        ),
                      )}
                    </tr>

                    {salaryExpanded &&
                      SALARY_DETAIL_ROWS.map((row) => (
                        <tr key={`salary-${row.key}`} className="cf-row-income-detail">
                          {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                          {visibleYears.map((y) =>
                            renderValueCell(
                              y.incomeBreakdown.salary[row.key],
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
                        onToggle: () => setBonusExpanded((v) => !v),
                        icon: 'folder',
                      })}
                      {visibleYears.map((y) =>
                        renderValueCell(
                          sumBonusDetail(y.incomeBreakdown.bonus),
                          y.calendarYear,
                          { emptyAsDash: true },
                        ),
                      )}
                    </tr>

                    {bonusExpanded &&
                      BONUS_DETAIL_ROWS.map((row) => (
                        <tr key={`bonus-${row.key}`} className="cf-row-income-detail">
                          {renderLabelCell(row.label, 3, { icon: 'leaf' })}
                          {visibleYears.map((y) =>
                            renderValueCell(
                              y.incomeBreakdown.bonus[row.key],
                              y.calendarYear,
                              { emptyAsDash: true },
                            ),
                          )}
                        </tr>
                      ))}

                    <PensionBreakdownRows
                      visibleYears={visibleYears}
                      expandedFolders={expandedPensionFolders}
                      onToggleFolder={togglePensionFolder}
                      renderLabelCell={renderLabelCell}
                      renderValueCell={renderValueCell}
                    />

                    <InsuranceBreakdownRows
                      visibleYears={visibleYears}
                      expanded={insuranceIncomeExpanded}
                      onToggle={() =>
                        setInsuranceIncomeExpanded((value) => !value)
                      }
                      renderLabelCell={renderLabelCell}
                      renderValueCell={renderValueCell}
                    />

                    {INCOME_BREAKDOWN_ROWS.map((row) => (
                      <tr key={row.key} className="cf-row-income-detail">
                        {renderLabelCell(row.label, 2, { icon: 'leaf' })}
                        {visibleYears.map((y) => {
                          const amount = y.incomeBreakdown[row.key];
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
                  onToggle={() => setTaxSocialExpanded((v) => !v)}
                  onToggleTax={() => setTaxExpanded((v) => !v)}
                  onToggleSocialInsurance={() =>
                    setSocialInsuranceExpanded((v) => !v)
                  }
                  onTogglePublicInsurance={() =>
                    setPublicInsuranceExpanded((v) => !v)
                  }
                  onTaxSocialYearClick={
                    taxSocialBreakdown
                      ? (calendarYear) =>
                          setBreakdownModal({ calendarYear })
                      : undefined
                  }
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />

                <tr
                  key={disposableIncomeRow.key}
                  className={disposableIncomeRow.rowClass ?? ''}
                >
                  {renderLabelCell(
                    disposableIncomeRow.label,
                    disposableIncomeRow.indent,
                  )}
                  {visibleYears.map((y) =>
                    renderValueCell(
                      disposableIncomeRow.getValue(y),
                      y.calendarYear,
                      { emptyAsDash: disposableIncomeRow.emptyAsDash },
                    ),
                  )}
                </tr>

                <ExpenseBreakdownRows
                  visibleYears={visibleYears}
                  educationMembers={data.expenseEducationMembers}
                  livingItems={data.expenseLivingItems}
                  expanded={expenditureExpanded}
                  livingExpanded={livingExpenseExpanded}
                  housingExpanded={housingExpenseExpanded}
                  housingRentalExpanded={housingRentalExpanded}
                  housingOwnedExpanded={housingOwnedExpanded}
                  housingTaxExpanded={housingTaxExpanded}
                  housingLoanRepaymentExpanded={housingLoanRepaymentExpanded}
                  vehicleExpanded={vehicleExpenseExpanded}
                  lifeEventExpanded={lifeEventExpenseExpanded}
                  educationExpanded={educationExpenseExpanded}
                  loanExpanded={loanExpenseExpanded}
                  insuranceExpanded={insuranceExpenseExpanded}
                  investContributionExpanded={investContributionExpanded}
                  onToggle={() => setExpenditureExpanded((v) => !v)}
                  onToggleLiving={() => setLivingExpenseExpanded((v) => !v)}
                  onToggleHousing={() => setHousingExpenseExpanded((v) => !v)}
                  onToggleHousingRental={() =>
                    setHousingRentalExpanded((v) => !v)
                  }
                  onToggleHousingOwned={() =>
                    setHousingOwnedExpanded((v) => !v)
                  }
                  onToggleHousingTax={() => setHousingTaxExpanded((v) => !v)}
                  onToggleHousingLoanRepayment={() =>
                    setHousingLoanRepaymentExpanded((v) => !v)
                  }
                  onToggleVehicle={() => setVehicleExpenseExpanded((v) => !v)}
                  onToggleLifeEvent={() =>
                    setLifeEventExpenseExpanded((v) => !v)
                  }
                  onToggleEducation={() =>
                    setEducationExpenseExpanded((v) => !v)
                  }
                  onToggleLoan={() => setLoanExpenseExpanded((v) => !v)}
                  onToggleInsurance={() =>
                    setInsuranceExpenseExpanded((v) => !v)
                  }
                  onToggleInvestContribution={() =>
                    setInvestContributionExpanded((v) => !v)
                  }
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />

                {householdRows.map((row) => (
                  <tr key={row.key} className={row.rowClass ?? ''}>
                    {renderLabelCell(row.label, row.indent)}
                    {visibleYears.map((y) =>
                      renderValueCell(row.getValue(y), y.calendarYear, {
                        emptyAsDash: row.emptyAsDash,
                      }),
                    )}
                  </tr>
                ))}

                <SavingsBreakdownRows
                  visibleYears={visibleYears}
                  expanded={savingsExpanded}
                  onToggle={() => setSavingsExpanded((v) => !v)}
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />

                <InvestBreakdownRows
                  visibleYears={visibleYears}
                  expanded={investExpanded}
                  expandedCategories={expandedInvestCategories}
                  onToggle={() => setInvestExpanded((v) => !v)}
                  onToggleCategory={toggleInvestCategory}
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />

                <tr
                  key={financialAssetsRow.key}
                  className={financialAssetsRow.rowClass ?? ''}
                >
                  {renderLabelCell(
                    financialAssetsRow.label,
                    financialAssetsRow.indent,
                  )}
                  {visibleYears.map((y) =>
                    renderValueCell(
                      financialAssetsRow.getValue(y),
                      y.calendarYear,
                      { emptyAsDash: financialAssetsRow.emptyAsDash },
                    ),
                  )}
                </tr>
              </>
            )}
          </tbody>
          {memberFolderRows.map((memberRow) => (
            <tbody key={memberRow.memberId}>
              <MemberCashFlowFolderRows
                memberId={memberRow.memberId}
                label={memberRow.label}
                visibleYears={visibleYears}
                renderLabelCell={renderLabelCell}
                renderValueCell={renderValueCell}
                onTaxSocialYearClick={
                  taxSocialBreakdown
                    ? (calendarYear, memberId) =>
                        setBreakdownModal({ calendarYear, memberId })
                    : undefined
                }
              />
            </tbody>
          ))}
        </table>
      </div>

      <p className="cashflow-note">
        ※ 給与・賞与は Q7 収入の「収入形態」に応じて厚生年金・公務員厚・国民年金へ振り分けています。選択型DC拠・年金・退職金など未入力の行は「-」です。支出の運用積立は家計負担分のみ（事業主掛金は含みません）。
        {taxSocialBreakdown ? (
          <>
            {' '}
            「税・社保」の金額をクリックすると、計算内訳を表示できます。
          </>
        ) : null}
      </p>

      {taxSocialBreakdown ? (
        <TaxSocialBreakdownModal
          open={breakdownModal != null}
          calendarYear={breakdownModal?.calendarYear ?? null}
          initialMemberId={breakdownModal?.memberId}
          onClose={() => setBreakdownModal(null)}
          members={taxSocialBreakdown.members}
          incomeByMember={taxSocialBreakdown.incomeByMember}
          priorYearIncomeByMember={taxSocialBreakdown.priorYearIncomeByMember}
          pensionByMember={taxSocialBreakdown.pensionByMember}
          referenceDate={taxSocialBreakdown.referenceDate}
          cashFlowData={data}
        />
      ) : null}
    </div>
  );
}
