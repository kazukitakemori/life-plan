import { formatCashFlowValue } from '../../lib/cashFlow';

export interface LifetimeSummaryYear {
  calendarYear: number;
  disposableIncome: number;
  expenditure: number;
  annualBalance: number;
}

interface LifetimeSummaryTableProps {
  years: LifetimeSummaryYear[];
}

const ROWS = [
  {
    key: 'disposable',
    label: '可処分所得',
    rowClass: 'cf-row-income',
    getValue: (y: LifetimeSummaryYear) => y.disposableIncome,
  },
  {
    key: 'expenditure',
    label: '支出',
    rowClass: 'cf-row-expense-total',
    getValue: (y: LifetimeSummaryYear) => y.expenditure,
  },
  {
    key: 'balance',
    label: '年間収支',
    rowClass: 'cf-row-balance',
    getValue: (y: LifetimeSummaryYear) => y.annualBalance,
  },
] as const;

export function LifetimeSummaryTable({ years }: LifetimeSummaryTableProps) {
  return (
    <section
      className="lifetime-summary-table"
      aria-label="可処分所得・支出・年間収支"
    >
      <div className="lifetime-summary-table-wrap">
        {years.length === 0 ? null : (
          <table className="cashflow-table lifetime-summary-table-grid">
            <thead>
              <tr className="cf-head-year-row">
                <th className="cf-sticky-col cf-label-col cf-year-header-corner">
                  年
                </th>
                {years.map((y) => (
                  <th key={y.calendarYear} className="cf-year-col">
                    {y.calendarYear}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className={row.rowClass}>
                  <td className="cf-sticky-col cf-label-col">{row.label}</td>
                  {years.map((y) => {
                    const amount = row.getValue(y);
                    return (
                      <td
                        key={y.calendarYear}
                        className={`cf-value-col${amount < 0 ? ' cf-negative' : ''}`}
                      >
                        {formatCashFlowValue(amount)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
