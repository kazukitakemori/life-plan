import {
  buildMonthlyLabelsFromWestern,
  getWesternYearOptions,
  MONTH_OPTIONS,
} from '../../lib/pensionTeikibinLabels';
import {
  EMPLOYEES_PENSION_CATEGORY_OPTIONS,
  NATIONAL_PENSION_PAYMENT_OPTIONS,
} from '../../lib/pensionTeikibinLabels';
import type { NenkinTeikibinMonthlyFields } from '../../types/pension';

interface RecentMonthlyTableProps {
  form: NenkinTeikibinMonthlyFields;
  onChange: (patch: Partial<NenkinTeikibinMonthlyFields>) => void;
}

export function RecentMonthlyTable({ form, onChange }: RecentMonthlyTableProps) {
  const monthLabels = buildMonthlyLabelsFromWestern(
    form.recentMonthlyYear,
    form.recentMonthlyMonth,
  );
  const yearOptions = getWesternYearOptions();

  return (
    <div className="teikibin-block teikibin-block--monthly">
      <h5 className="teikibin-block-title">最近の月別状況</h5>

      <div className="teikibin-monthly-table-wrap">
        <table className="teikibin-monthly-table">
          <thead>
            <tr>
              <th rowSpan={2}>年月</th>
              <th rowSpan={2}>国民年金（第1号・第3号）納付状況</th>
              <th colSpan={3}>厚生年金保険</th>
              <th rowSpan={2}>保険料納付額</th>
            </tr>
            <tr>
              <th>加入区分</th>
              <th>標準報酬月額（千円）</th>
              <th>標準賞与額（千円）</th>
            </tr>
          </thead>
          <tbody>
            {monthLabels.map((label, index) => {
              const row = form.monthlyRows[index];
              if (!row) return null;
              return (
                <tr key={label}>
                  <td className="teikibin-monthly-label">{label}</td>
                  <td className="teikibin-monthly-readonly">{row.nationalPensionStatus || '—'}</td>
                  <td className="teikibin-monthly-readonly">{row.employeesPensionCategory || '—'}</td>
                  <td className="teikibin-monthly-input-cell">
                    <input type="text" inputMode="numeric" className="pension-field-input pension-field-input--table"
                      value={row.standardRemuneration}
                      onChange={(e) => updateRow(index, { standardRemuneration: e.target.value })}
                      aria-label={`${label} 標準報酬月額`} />
                  </td>
                  <td className="teikibin-monthly-input-cell">
                    <input type="text" inputMode="numeric" className="pension-field-input pension-field-input--table"
                      value={row.standardBonus}
                      onChange={(e) => updateRow(index, { standardBonus: e.target.value })}
                      aria-label={`${label} 標準賞与額`} />
                  </td>
                  <td className="teikibin-monthly-input-cell">
                    <input type="text" inputMode="numeric" className="pension-field-input pension-field-input--table"
                      value={row.premiumPayment}
                      onChange={(e) => updateRow(index, { premiumPayment: e.target.value })}
                      aria-label={`${label} 保険料納付額`} />
                  </td>
                </tr>
              );
            })}

            <tr className="teikibin-monthly-input-row">
              <td className="teikibin-monthly-date">
                <select
                  className="pension-field-select pension-field-select--date"
                  value={form.recentMonthlyYear}
                  onChange={(e) =>
                    onChange({ recentMonthlyYear: Number(e.target.value) })
                  }
                  aria-label="表示開始年（西暦）"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <span className="teikibin-monthly-date-unit">年</span>
                <select
                  className="pension-field-select pension-field-select--date"
                  value={form.recentMonthlyMonth}
                  onChange={(e) =>
                    onChange({ recentMonthlyMonth: Number(e.target.value) })
                  }
                  aria-label="表示開始月"
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
                <span className="teikibin-monthly-date-unit">月</span>
              </td>
              <td colSpan={5} className="teikibin-monthly-readonly">
                最近の月別状況は詳細入力です。未入力でも年金概算は利用できます
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
