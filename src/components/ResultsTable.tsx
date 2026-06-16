import type { YearlyResult } from '../types';
import { formatYen } from '../lib/simulate';

interface ResultsTableProps {
  data: YearlyResult[];
}

export function ResultsTable({ data }: ResultsTableProps) {
  return (
    <section className="panel table-panel">
      <h2>年次サマリー</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>年</th>
              <th>年間収入</th>
              <th>年間支出</th>
              <th>年間収支</th>
              <th>年末残高</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.year}>
                <td>{row.year}年目</td>
                <td>{formatYen(row.totalIncome)}</td>
                <td>{formatYen(row.totalExpense)}</td>
                <td className={row.totalNetFlow < 0 ? 'negative' : 'positive'}>
                  {formatYen(row.totalNetFlow)}
                </td>
                <td className={row.endBalance < 0 ? 'negative' : ''}>
                  {formatYen(row.endBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
