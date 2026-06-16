import type { SimulationSummary } from '../types';
import { formatYen, formatYearMonth } from '../lib/simulate';

interface SummaryCardsProps {
  summary: SimulationSummary;
  monthlyNet: number;
}

export function SummaryCards({ summary, monthlyNet }: SummaryCardsProps) {
  const isDeficit = monthlyNet < 0;

  return (
    <section className="summary-grid">
      <div className="summary-card">
        <span className="summary-label">最終残高</span>
        <span
          className={`summary-value ${summary.finalBalance < 0 ? 'negative' : ''}`}
        >
          {formatYen(summary.finalBalance)}
        </span>
        <span className="summary-sub">シミュレーション終了時</span>
      </div>

      <div className="summary-card">
        <span className="summary-label">最低残高</span>
        <span
          className={`summary-value ${summary.minimumBalance < 0 ? 'negative' : ''}`}
        >
          {formatYen(summary.minimumBalance)}
        </span>
        <span className="summary-sub">
          {formatYearMonth(summary.minimumBalanceMonth)}
        </span>
      </div>

      <div className="summary-card">
        <span className="summary-label">月間収支</span>
        <span className={`summary-value ${isDeficit ? 'negative' : 'positive'}`}>
          {formatYen(monthlyNet)}
        </span>
        <span className="summary-sub">収入 − 支出</span>
      </div>

      <div className="summary-card">
        <span className="summary-label">累計収支</span>
        <span
          className={`summary-value ${summary.totalNetFlow < 0 ? 'negative' : 'positive'}`}
        >
          {formatYen(summary.totalNetFlow)}
        </span>
        <span className="summary-sub">期間全体</span>
      </div>
    </section>
  );
}
