import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCashFlowValue } from '../../lib/cashFlow';
import {
  buildLifetimeBalanceChartData,
  buildFinancialAssetsLinePoints,
  formatLifetimeTotalMan,
  getLifetimeChartTickAges,
  getLifetimeChartYTicks,
  resolveLifetimeChartTooltipPoint,
  RETIREMENT_HEAD_AGE,
  sliceLifetimeChartPoints,
  type LifetimeBalanceChartData,
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_CHART_MARGIN_LEFT,
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
  getSimulationPlotMinWidth,
} from '../../lib/simulationLayout';
import type { CashFlowTableData } from '../../types/cashFlow';

const CHART_HEIGHT = 760;
const CHART_MARGIN_LEFT = SIMULATION_CHART_MARGIN_LEFT;
const CHART_MARGIN_RIGHT = SIMULATION_CHART_MARGIN_RIGHT;
const CHART_MARGIN_TOP = 24;
/** ズームイン時などに棒が極端に太くならない上限（px） */
const EXPENSE_BAR_MAX_SIZE = 36;
/** ゼロ跨ぎ補間点を含む折れ線専用の非表示 X 軸（棒の帯域幅計算から除外する） */
const LINE_X_AXIS_ID = 'line';
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

const CHART_COLORS = {
  lifeEvent: '#f0a8c0',
  childRelated: '#f0d060',
  housing: '#6a9fd8',
  living: '#eda866',
  taxSocial: '#c9b896',
  income: '#0000ff',
  financialAssets: '#1f9690',
  financialAssetsNegative: '#ff0000',
} as const;

const LEGEND_ITEMS = [
  { key: 'lifeEvent', label: '将来プラン', color: CHART_COLORS.lifeEvent, type: 'bar' as const },
  {
    key: 'childRelated',
    label: 'お子さま関連',
    color: CHART_COLORS.childRelated,
    type: 'bar' as const,
  },
  { key: 'housing', label: '住宅関連', color: CHART_COLORS.housing, type: 'bar' as const },
  { key: 'living', label: '生活費', color: CHART_COLORS.living, type: 'bar' as const },
  { key: 'taxSocial', label: '税金・社保', color: CHART_COLORS.taxSocial, type: 'bar' as const },
  { key: 'income', label: '収入', color: CHART_COLORS.income, type: 'line' as const },
  {
    key: 'financialAssets',
    label: '金融資産残高',
    color: CHART_COLORS.financialAssets,
    type: 'step' as const,
  },
] as const;

const LEGEND_ITEM_ORDER = new Map(
  LEGEND_ITEMS.map((item, index) => [item.key, index]),
);

interface LifetimeBalanceSimulationChartProps {
  data: CashFlowTableData;
  showHeader?: boolean;
  visiblePoints?: LifetimeBalanceChartPoint[];
  minHeadAge?: number;
  maxHeadAge?: number;
  tickAges?: number[];
  windowStart?: number;
  windowEnd?: number | null;
  totalPoints?: number;
  onWindowStartChange?: (value: number) => void;
  onWindowEndChange?: (value: number | null) => void;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    payload?: LifetimeBalanceChartPoint;
  }>;
  points: LifetimeBalanceChartPoint[];
}

interface ChartMouseState {
  activeTooltipIndex?: number;
  activeLabel?: number | string;
  isTooltipActive?: boolean;
}

function headAgeFromChartMouseState(
  state: ChartMouseState,
  points: LifetimeBalanceChartPoint[],
): number | null {
  if (!state.isTooltipActive) return null;

  const byIndex =
    state.activeTooltipIndex != null && state.activeTooltipIndex >= 0
      ? points[state.activeTooltipIndex]?.headAge
      : undefined;
  if (byIndex != null) return byIndex;

  const label = state.activeLabel;
  if (typeof label === 'number' && Number.isInteger(label)) return label;

  return null;
}

function buildTooltipRows(point: LifetimeBalanceChartPoint) {
  return [
    { dataKey: 'lifeEvent', name: '将来プラン', value: point.lifeEvent, color: CHART_COLORS.lifeEvent },
    {
      dataKey: 'childRelated',
      name: 'お子さま関連',
      value: point.childRelated,
      color: CHART_COLORS.childRelated,
    },
    { dataKey: 'housing', name: '住宅関連', value: point.housing, color: CHART_COLORS.housing },
    { dataKey: 'living', name: '生活費', value: point.living, color: CHART_COLORS.living },
    { dataKey: 'taxSocial', name: '税金・社保', value: point.taxSocial, color: CHART_COLORS.taxSocial },
    { dataKey: 'income', name: '収入', value: point.income, color: CHART_COLORS.income },
    {
      dataKey: 'financialAssets',
      name: '金融資産残高',
      value: point.financialAssets,
      color:
        point.financialAssets < 0
          ? CHART_COLORS.financialAssetsNegative
          : CHART_COLORS.financialAssets,
    },
  ];
}

export interface LifetimeChartHeaderProps {
  showTitle?: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showReset: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export interface LifetimeChartGridRowProps {
  chartData: LifetimeBalanceChartData;
  visiblePoints: LifetimeBalanceChartPoint[];
  minHeadAge: number;
  maxHeadAge: number;
  tickAges: number[];
}

function xAxisRowStep(): number {
  return X_AXIS_ROW_HEIGHT + X_AXIS_ROW_GAP;
}

function xAxisRowY(rowIndex: number): number {
  return X_AXIS_ROW_START + rowIndex * xAxisRowStep() + X_AXIS_ROW_HEIGHT / 2;
}

function xAxisTotalHeight(rowCount: number): number {
  return X_AXIS_ROW_START + rowCount * xAxisRowStep() + 4;
}

function formatAxisMan(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
}

function DualAgeAxisTick({
  x = 0,
  y = 0,
  payload,
  points,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  points: LifetimeBalanceChartPoint[];
}) {
  if (!payload) return null;

  const point = points.find((row) => row.headAge === payload.value);
  if (!point) return null;

  const rows = point.spouseAge != null
    ? [
        { value: String(point.headAge), rowIndex: 0 },
        { value: String(point.spouseAge), rowIndex: 1 },
      ]
    : [{ value: String(point.headAge), rowIndex: 0 }];

  return (
    <g transform={`translate(${x},${y})`}>
      {rows.map((row) => (
        <text
          key={row.rowIndex}
          x={0}
          y={xAxisRowY(row.rowIndex)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={row.rowIndex === 0 ? '#555' : '#666'}
          fontSize={11}
        >
          {row.value}
        </text>
      ))}
    </g>
  );
}

function ChartTooltip({ active, label, payload, points }: ChartTooltipProps) {
  if (!active) return null;

  const point = resolveLifetimeChartTooltipPoint(points, label, payload);
  if (!point) return null;

  const tooltipRows = buildTooltipRows(point).sort(
    (left, right) =>
      (LEGEND_ITEM_ORDER.get(left.dataKey as (typeof LEGEND_ITEMS)[number]['key']) ??
        Number.MAX_SAFE_INTEGER) -
      (LEGEND_ITEM_ORDER.get(right.dataKey as (typeof LEGEND_ITEMS)[number]['key']) ??
        Number.MAX_SAFE_INTEGER),
  );

  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.calendarYear}年（{point.headAge}歳）
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">
        {tooltipRows.map((item) => (
          <p key={item.dataKey} className="lifetime-chart-tooltip-row">
            <span
              className="lifetime-chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>{item.name}</span>
            <span>{formatCashFlowValue(item.value)}万円</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function ChartSidebar({ summary }: { summary: LifetimeBalanceChartData['summary'] }) {
  return (
    <aside className="sim-align-sidebar lifetime-chart-sidebar">
      <div className="lifetime-chart-summary">
        <h3 className="lifetime-chart-summary-title">合計金額</h3>
        <dl className="lifetime-chart-summary-list">
          <div className="lifetime-chart-summary-row">
            <dt>収入計</dt>
            <dd>{formatLifetimeTotalMan(summary.totalIncome)}</dd>
          </div>
          <div className="lifetime-chart-summary-row">
            <dt>支出計</dt>
            <dd>{formatLifetimeTotalMan(summary.totalExpenditure)}</dd>
          </div>
        </dl>
      </div>

      <div className="lifetime-chart-legend-panel">
        <h3 className="lifetime-chart-legend-title">凡例</h3>
        <ul className="lifetime-chart-legend">
          {LEGEND_ITEMS.map((item) => (
            <li key={item.key} className="lifetime-chart-legend-item">
              <span
                className={`lifetime-chart-legend-icon lifetime-chart-legend-icon--${item.type}`}
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="lifetime-chart-legend-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function LifetimeChartHeader({
  showTitle = true,
  canZoomIn,
  canZoomOut,
  showReset,
  onZoomIn,
  onZoomOut,
  onReset,
}: LifetimeChartHeaderProps) {
  return (
    <div className="lifetime-chart-header">
      <div className="lifetime-chart-header-left">
        {showTitle && (
          <h2 className="lifetime-chart-title">生涯収支シミュレーショングラフ</h2>
        )}
      </div>
      <div className="lifetime-chart-toolbar">
        <button
          type="button"
          className="lifetime-chart-zoom-btn"
          aria-label="ズームイン"
          disabled={!canZoomIn}
          onClick={onZoomIn}
        >
          +
        </button>
        <button
          type="button"
          className="lifetime-chart-zoom-btn"
          aria-label="ズームアウト"
          disabled={!canZoomOut}
          onClick={onZoomOut}
        >
          −
        </button>
        {showReset && (
          <button type="button" className="lifetime-chart-reset-btn" onClick={onReset}>
            全期間
          </button>
        )}
      </div>
    </div>
  );
}

export function LifetimeChartGridRow({
  chartData,
  visiblePoints,
  minHeadAge,
  maxHeadAge,
  tickAges,
}: LifetimeChartGridRowProps) {
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(chartData.yAxisMin, chartData.yAxisMax),
    [chartData.yAxisMin, chartData.yAxisMax],
  );

  const xAxisRowCount = chartData.spouseAxisLabel ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);

  const showRetirementLine = visiblePoints.some(
    (point) => point.headAge === RETIREMENT_HEAD_AGE,
  );

  const chartLinePoints = useMemo(
    () => buildFinancialAssetsLinePoints(visiblePoints),
    [visiblePoints],
  );

  const [hoveredHeadAge, setHoveredHeadAge] = useState<number | null>(null);

  const hoveredPoint = useMemo(
    () => visiblePoints.find((point) => point.headAge === hoveredHeadAge) ?? null,
    [visiblePoints, hoveredHeadAge],
  );

  const handleChartMouseMove = (state: ChartMouseState) => {
    setHoveredHeadAge(headAgeFromChartMouseState(state, visiblePoints));
  };

  return (
    <>
      <div className="sim-align-label sim-chart-label-spacer" aria-hidden="true" />
      <div className="sim-align-yaxis" aria-hidden="true" />
      <div className="sim-align-plot lifetime-chart-plot">
        <p className="lifetime-chart-y-unit" aria-hidden>
          （万円）
        </p>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT + xAxisHeight}>
          <ComposedChart
            data={visiblePoints}
            barCategoryGap={getSimulationBarCategoryGapPx()}
            barGap={0}
            maxBarSize={EXPENSE_BAR_MAX_SIZE}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredHeadAge(null)}
            margin={{
              top: CHART_MARGIN_TOP,
              right: CHART_MARGIN_RIGHT,
              left: 0,
              bottom: xAxisHeight,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="headAge"
              type="number"
              scale="linear"
              domain={[minHeadAge, maxHeadAge]}
              allowDataOverflow
              padding={{ left: 0, right: 0 }}
              ticks={tickAges}
              interval={0}
              stroke="#64748b"
              fontSize={11}
              height={xAxisHeight}
              tick={(props) => (
                <DualAgeAxisTick {...props} points={visiblePoints} />
              )}
            />
            <XAxis
              xAxisId={LINE_X_AXIS_ID}
              dataKey="headAge"
              type="number"
              scale="linear"
              domain={[minHeadAge, maxHeadAge]}
              allowDataOverflow
              padding={{ left: 0, right: 0 }}
              hide
            />
            <YAxis
              yAxisId="main"
              tickFormatter={formatAxisMan}
              ticks={yTicks}
              stroke="#64748b"
              fontSize={11}
              width={CHART_MARGIN_LEFT}
              domain={[Math.min(chartData.yAxisMin, 0), chartData.yAxisMax]}
            />
            <ReferenceLine yAxisId="main" y={0} stroke="#cbd5e1" strokeWidth={1} />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={props.label as number | undefined}
                  payload={
                    props.payload as ChartTooltipProps['payload']
                  }
                  points={visiblePoints}
                />
              )}
            />

            {showRetirementLine && (
              <ReferenceLine
                yAxisId="main"
                x={RETIREMENT_HEAD_AGE}
                stroke="#9aa3ad"
                strokeDasharray="4 4"
              />
            )}

            <Bar
              yAxisId="main"
              dataKey="taxSocial"
              name="税金・社保"
              stackId="expense"
              fill={CHART_COLORS.taxSocial}
            />
            <Bar
              yAxisId="main"
              dataKey="living"
              name="生活費"
              stackId="expense"
              fill={CHART_COLORS.living}
            />
            <Bar
              yAxisId="main"
              dataKey="housing"
              name="住宅関連"
              stackId="expense"
              fill={CHART_COLORS.housing}
            />
            <Bar
              yAxisId="main"
              dataKey="childRelated"
              name="お子さま関連"
              stackId="expense"
              fill={CHART_COLORS.childRelated}
            />
            <Bar
              yAxisId="main"
              dataKey="lifeEvent"
              name="将来プラン"
              stackId="expense"
              fill={CHART_COLORS.lifeEvent}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={visiblePoints}
              type="monotone"
              dataKey="income"
              name="収入"
              stroke={CHART_COLORS.income}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="financialAssetsPositive"
              name="金融資産残高"
              stroke={CHART_COLORS.financialAssets}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="financialAssetsNegative"
              name="金融資産残高"
              stroke={CHART_COLORS.financialAssetsNegative}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
            />
            {hoveredPoint && (
              <ReferenceDot
                xAxisId={LINE_X_AXIS_ID}
                yAxisId="main"
                x={hoveredPoint.headAge}
                y={hoveredPoint.financialAssets}
                r={5}
                fill={
                  hoveredPoint.financialAssets < 0
                    ? CHART_COLORS.financialAssetsNegative
                    : CHART_COLORS.financialAssets
                }
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="visible"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="sim-align-gap" aria-hidden="true" />
      <ChartSidebar summary={chartData.summary} />
    </>
  );
}

export function LifetimeBalanceSimulationChart({
  data,
  showHeader = true,
  visiblePoints: visiblePointsProp,
  minHeadAge: minHeadAgeProp,
  maxHeadAge: maxHeadAgeProp,
  tickAges: tickAgesProp,
  windowStart: windowStartProp,
  windowEnd: windowEndProp,
  totalPoints: totalPointsProp,
  onWindowStartChange,
  onWindowEndChange,
}: LifetimeBalanceSimulationChartProps) {
  const chartData = useMemo(() => buildLifetimeBalanceChartData(data), [data]);
  const [localWindowStart, setLocalWindowStart] = useState(0);
  const [localWindowEnd, setLocalWindowEnd] = useState<number | null>(null);

  const windowStart = windowStartProp ?? localWindowStart;
  const windowEnd = windowEndProp ?? localWindowEnd;
  const setWindowStart = onWindowStartChange ?? setLocalWindowStart;
  const setWindowEnd = onWindowEndChange ?? setLocalWindowEnd;
  const totalPoints = totalPointsProp ?? chartData.points.length;

  const endIndex = windowEnd ?? totalPoints;
  const visiblePoints = useMemo(
    () =>
      visiblePointsProp ??
      sliceLifetimeChartPoints(chartData.points, windowStart, endIndex),
    [visiblePointsProp, chartData.points, windowStart, endIndex],
  );

  const tickAges = useMemo(
    () => tickAgesProp ?? getLifetimeChartTickAges(visiblePoints),
    [tickAgesProp, visiblePoints],
  );

  const minHeadAge = minHeadAgeProp ?? visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge =
    maxHeadAgeProp ??
    visiblePoints[visiblePoints.length - 1]?.headAge ??
    minHeadAge;

  const canZoomIn = visiblePoints.length > 12;
  const canZoomOut = windowStart > 0 || endIndex < totalPoints;

  const zoomIn = () => {
    if (!canZoomIn) return;
    const currentLength = endIndex - windowStart;
    const nextLength = Math.max(12, Math.floor(currentLength * 0.75));
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(totalPoints, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
  };

  const zoomOut = () => {
    if (!canZoomOut) return;
    const currentLength = endIndex - windowStart;
    const nextLength = Math.min(totalPoints, Math.ceil(currentLength * 1.35));
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(totalPoints, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd === totalPoints ? null : nextEnd);
  };

  const resetZoom = () => {
    setWindowStart(0);
    setWindowEnd(null);
  };

  return (
    <section className="lifetime-chart-card" aria-label="生涯収支シミュレーション">
      <LifetimeChartHeader
        showTitle={showHeader}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        showReset={canZoomOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetZoom}
      />
      <div
        className="lifetime-simulation-scroll"
      >
        <div
          className="lifetime-simulation-align"
          style={
            {
              '--sim-plot-min': `${getSimulationPlotMinWidth(visiblePoints.length)}px`,
            } as React.CSSProperties
          }
        >
        <LifetimeChartGridRow
          chartData={chartData}
          visiblePoints={visiblePoints}
          minHeadAge={minHeadAge}
          maxHeadAge={maxHeadAge}
          tickAges={tickAges}
        />
        </div>
      </div>
    </section>
  );
}
