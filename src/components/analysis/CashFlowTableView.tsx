import { useMemo, useState } from 'react';

import { formatCashFlowValue } from '../../lib/cashFlow';
import type { CashFlowTableData } from '../../types/cashFlow';
import {
  BONUS_DETAIL_ROWS,
  INCOME_BREAKDOWN_ROWS,
  SALARY_DETAIL_ROWS,
  sumBonusDetail,
  sumSalaryDetail,
} from '../../types/cashFlow';
import { ExpenseBreakdownRows } from './ExpenseBreakdownRows';
import { PensionBreakdownRows } from './PensionBreakdownRows';
import { TaxSocialBreakdownRows } from './TaxSocialBreakdownRows';

interface CashFlowTableViewProps {
  data: CashFlowTableData;
  onBack: () => void;
  showBackButton?: boolean;
  showTitle?: boolean;
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
}: CashFlowTableViewProps) {
  const [displayRange, setDisplayRange] = useState<DisplayRange>('all');
  const [householdExpanded, setHouseholdExpanded] = useState(true);
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [salaryExpanded, setSalaryExpanded] = useState(false);
  const [bonusExpanded, setBonusExpanded] = useState(false);
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
  const [educationExpenseExpanded, setEducationExpenseExpanded] =
    useState(false);

  const visibleYears = useMemo(() => {
    if (displayRange === 'all') return data.years;
    const count = displayRange === '10' ? 10 : 20;
    return data.years.slice(0, count);
  }, [data.years, displayRange]);

  const head = data.memberAgeRows.find((r) => r.label.includes('世帯主'));
  const startHeadAge = head ? head.agesByYear[data.startYear] : null;

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
      rowClass: 'cf-row-income',
    },
    {
      key: 'savings',
      label: '貯蓄額',
      indent: 1,
      getValue: (y) => y.savings,
      rowClass: 'cf-row-savings',
    },
    {
      key: 'financial',
      label: '資産(金融)',
      indent: 1,
      getValue: (y) => y.financialAssets,
      rowClass: 'cf-row-assets',
    },
  ];

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

  const renderValueCell = (
    value: number,
    year: number,
    options?: { emptyAsDash?: boolean },
  ) => (
    <td
      key={year}
      className={`cf-value-col ${value < 0 ? 'cf-negative' : ''}`}
    >
      {formatCashFlowValue(value, { emptyAsDash: options?.emptyAsDash })}
    </td>
  );

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
            {showBackButton && (
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

                    {INCOME_BREAKDOWN_ROWS.map((row) => (
                      <tr key={row.key} className="cf-row-income-detail">
                        {renderLabelCell(row.label, 2, { icon: 'leaf' })}
                        {visibleYears.map((y) =>
                          renderValueCell(
                            y.incomeBreakdown[row.key],
                            y.calendarYear,
                            { emptyAsDash: true },
                          ),
                        )}
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
                  expanded={expenditureExpanded}
                  educationExpanded={educationExpenseExpanded}
                  onToggle={() => setExpenditureExpanded((v) => !v)}
                  onToggleEducation={() =>
                    setEducationExpenseExpanded((v) => !v)
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
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="cashflow-note">
        ※ 給与・賞与は Q7 収入の「収入形態」に応じて厚生年金・公務員厚・国民年金へ振り分けています。選択型DC拠・年金・退職金など未入力の行は「-」です。
      </p>
    </div>
  );
}
