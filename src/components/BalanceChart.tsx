import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyResult } from '../types';
import { formatManYen, formatYen } from '../lib/simulate';

interface BalanceChartProps {
  data: MonthlyResult[];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyResult }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">
        {row.year}年{row.monthInYear}月
      </p>
      <p>残高: {formatYen(row.balance)}</p>
      <p>収支: {formatYen(row.netFlow)}</p>
    </div>
  );
}

export function BalanceChart({ data }: BalanceChartProps) {
  const tickData = data.filter((_, i) => i % 12 === 11 || i === data.length - 1);

  return (
    <section className="panel chart-panel">
      <h2>資産残高の推移</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={tickData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="year"
              tickFormatter={(year) => `${year}年`}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(v) => formatManYen(v)}
              stroke="#64748b"
              fontSize={12}
              width={72}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#1e40af"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
