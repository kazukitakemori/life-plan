import {
  buildMonthlyLabelsFromWestern,
  EMPLOYEES_PENSION_CATEGORY_OPTIONS,
  getWesternYearOptions,
  MONTH_OPTIONS,
  NATIONAL_PENSION_PAYMENT_OPTIONS,
} from '../../lib/pensionTeikibinLabels';
import type {
  NenkinTeikibinMonthlyRow,
  NenkinTeikibinOver50Form,
  TeikibinRecentMonthlyInputRow,
} from '../../types/pension';

interface RecentMonthlyTableOver50Props {
  form: NenkinTeikibinOver50Form;
  onChange: (patch: Partial<NenkinTeikibinOver50Form>) => void;
}

export function RecentMonthlyTableOver50({
  form,
  onChange,
}: RecentMonthlyTableOver50Props) {
  const monthLabels = buildMonthlyLabelsFromWestern(
    form.recentMonthlyYear,
    form.recentMonthlyMonth,
  );
  const yearOptions = getWesternYearOptions();
  const inputRow = form.recentMonthlyInputRow;

  const updateRow = (
    index: number,
    patch: Partial<NenkinTeikibinMonthlyRow>,
  ) => {
    const monthlyRows = form.monthlyRows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    onChange({ monthlyRows });
  };

  const updateInputRow = (patch: Partial<TeikibinRecentMonthlyInputRow>) => {
    onChange({
      recentMonthlyInputRow: { ...inputRow, ...patch },
    });
  };

  return (
    <div className="teikibin-block teikibin-block--monthly">
      <h5 className="teikibin-block-title">最近の月別状況</h5>

      <div className="teikibin-monthly-table-wrap">
        <table className="teikibin-monthly-table teikibin-monthly-table--over50">
          <thead>
            <tr>
              <th rowSpan={2}>年月</th>
              <th rowSpan={2}>国民年金（第1号・第3号）納付状況</th>
              <th colSpan={3}>厚生年金保険</th>
              <th rowSpan={2} className="teikibin-monthly-premium-header">
                保険料納付額
              </th>
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
                  <td className="teikibin-monthly-readonly" />
                  <td className="teikibin-monthly-readonly" />
                  <td className="teikibin-monthly-input-cell">
                    <input
                      type="text"
                      className="pension-field-input pension-field-input--table"
                      value={row.standardRemuneration}
                      onChange={(e) =>
                        updateRow(index, {
                          standardRemuneration: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="teikibin-monthly-input-cell">
                    <input
                      type="text"
                      className="pension-field-input pension-field-input--table"
                      value={row.standardBonus}
                      onChange={(e) =>
                        updateRow(index, { standardBonus: e.target.value })
                      }
                    />
                  </td>
                  <td className="teikibin-monthly-premium" />
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
              <td className="teikibin-monthly-input-cell">
                <select
                  className="pension-field-select pension-field-select--table"
                  value={inputRow.nationalPensionStatus}
                  onChange={(e) =>
                    updateInputRow({ nationalPensionStatus: e.target.value })
                  }
                >
                  {NATIONAL_PENSION_PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value || 'empty'} value={opt.value}>
                      {opt.label || '　'}
                    </option>
                  ))}
                </select>
              </td>
              <td className="teikibin-monthly-input-cell">
                <select
                  className="pension-field-select pension-field-select--table"
                  value={inputRow.employeesPensionCategory}
                  onChange={(e) =>
                    updateInputRow({
                      employeesPensionCategory: e.target.value,
                    })
                  }
                >
                  {EMPLOYEES_PENSION_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value || 'empty'} value={opt.value}>
                      {opt.label || '　'}
                    </option>
                  ))}
                </select>
              </td>
              <td className="teikibin-monthly-input-cell">
                <input
                  type="text"
                  className="pension-field-input pension-field-input--table"
                  value={inputRow.standardRemuneration}
                  onChange={(e) =>
                    updateInputRow({ standardRemuneration: e.target.value })
                  }
                />
              </td>
              <td className="teikibin-monthly-input-cell">
                <input
                  type="text"
                  className="pension-field-input pension-field-input--table"
                  value={inputRow.standardBonus}
                  onChange={(e) =>
                    updateInputRow({ standardBonus: e.target.value })
                  }
                />
              </td>
              <td className="teikibin-monthly-premium" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
