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
  buildBalanceLinePoints,
  balanceValueForMode,
  formatLifetimeTotalMan,
  getLifetimeChartPlotAgeDomain,
  getLifetimeChartTickAges,
  getLifetimeChartYTicks,
  LIFETIME_CHART_BALANCE_LINE_LABELS,
  createAllHiddenLifetimeChartVisibleSeries,
  createDefaultLifetimeChartVisibleSeries,
  resolveActiveBalanceLineMode,
  resolveLifetimeChartAxisDomain,
  resolveLifetimeChartTooltipPoint,
  RETIREMENT_HEAD_AGE,
  sliceLifetimeChartPoints,
  toggleLifetimeChartVisibleSeries,
  type LifetimeBalanceChartData,
  type LifetimeBalanceChartPoint,
  type LifetimeChartBalanceLineMode,
  type LifetimeChartScaleMode,
  type LifetimeChartSeriesKey,
  type LifetimeChartSeriesVisibility,
} from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_CHART_MARGIN_LEFT,
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import type { CashFlowTableData } from '../../types/cashFlow';

/** 通常時：グラフ＋イベント表を1画面に収める高さ */
const CHART_HEIGHT_COMPACT = 360;
/** 資産が極端で軸を広げたとき：折れ線の変化が見えるよう高くする */
const CHART_HEIGHT_EXPANDED = 560;
const CHART_MARGIN_LEFT = SIMULATION_CHART_MARGIN_LEFT;
const CHART_MARGIN_RIGHT = SIMULATION_CHART_MARGIN_RIGHT;
const CHART_MARGIN_TOP = 16;
/** ズームイン時などに棒が極端に太くならない上限（px） */
const EXPENSE_BAR_MAX_SIZE = 36;
/** ゼロ跨ぎ補間点を含む折れ線専用の非表示 X 軸（棒の帯域幅計算から除外する） */
const LINE_X_AXIS_ID = 'line';
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

const CHART_COLORS = {
  lifeEvent: '#ee9cba',
  education: '#6db86d',
  housing: '#6a9fd8',
  vehicle: '#90c2e7',
  living: '#eda866',
  loan: '#c4b5fd',
  insurance: '#fb7185',
  assetContribution: '#22d3ee',
  taxSocial: '#c9b896',
  income: '#0000ff',
  financialAssets: '#1f9690',
  financialAssetsNegative: '#ff0000',
} as const;

export type LifetimeChartVisibleSeries = LifetimeChartSeriesVisibility;

const LEGEND_ITEMS = [
  { key: 'lifeEvent', label: 'ライフイベント', color: CHART_COLORS.lifeEvent, type: 'bar' as const },
  { key: 'education', label: '教育費', color: CHART_COLORS.education, type: 'bar' as const },
  { key: 'housing', label: '住まい', color: CHART_COLORS.housing, type: 'bar' as const },
  { key: 'vehicle', label: '乗り物', color: CHART_COLORS.vehicle, type: 'bar' as const },
  { key: 'living', label: '生活費', color: CHART_COLORS.living, type: 'bar' as const },
  { key: 'loan', label: 'ローン', color: CHART_COLORS.loan, type: 'bar' as const },
  { key: 'insurance', label: '保険', color: CHART_COLORS.insurance, type: 'bar' as const },
  {
    key: 'assetContribution',
    label: '運用積立',
    color: CHART_COLORS.assetContribution,
    type: 'bar' as const,
  },
  { key: 'taxSocial', label: '税金・社保', color: CHART_COLORS.taxSocial, type: 'bar' as const },
  { key: 'income', label: '収入', color: CHART_COLORS.income, type: 'line' as const },
  {
    key: 'financialAssets',
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets,
    color: CHART_COLORS.financialAssets,
    type: 'step' as const,
  },
  {
    key: 'depositBalance',
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.deposit,
    color: CHART_COLORS.financialAssets,
    type: 'step' as const,
  },
] as const satisfies ReadonlyArray<{
  key: LifetimeChartSeriesKey;
  label: string;
  color: string;
  type: 'bar' | 'line' | 'step';
}>;

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
  visibleSeries: LifetimeChartVisibleSeries;
  balanceLineMode: LifetimeChartBalanceLineMode | null;
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

function buildTooltipRows(
  point: LifetimeBalanceChartPoint,
  visibleSeries: LifetimeChartVisibleSeries,
  balanceLineMode: LifetimeChartBalanceLineMode | null,
) {
  const rows: Array<{
    dataKey: LifetimeChartSeriesKey;
    name: string;
    value: number;
    color: string;
  }> = [];

  if (visibleSeries.lifeEvent) {
    rows.push({
      dataKey: 'lifeEvent',
      name: 'ライフイベント',
      value: point.lifeEvent,
      color: CHART_COLORS.lifeEvent,
    });
  }
  if (visibleSeries.education) {
    rows.push({
      dataKey: 'education',
      name: '教育費',
      value: point.education,
      color: CHART_COLORS.education,
    });
  }
  if (visibleSeries.housing) {
    rows.push({
      dataKey: 'housing',
      name: '住まい',
      value: point.housing,
      color: CHART_COLORS.housing,
    });
  }
  if (visibleSeries.vehicle) {
    rows.push({
      dataKey: 'vehicle',
      name: '乗り物',
      value: point.vehicle,
      color: CHART_COLORS.vehicle,
    });
  }
  if (visibleSeries.living) {
    rows.push({
      dataKey: 'living',
      name: '生活費',
      value: point.living,
      color: CHART_COLORS.living,
    });
  }
  if (visibleSeries.loan) {
    rows.push({
      dataKey: 'loan',
      name: 'ローン',
      value: point.loan,
      color: CHART_COLORS.loan,
    });
  }
  if (visibleSeries.insurance) {
    rows.push({
      dataKey: 'insurance',
      name: '保険',
      value: point.insurance,
      color: CHART_COLORS.insurance,
    });
  }
  if (visibleSeries.assetContribution) {
    rows.push({
      dataKey: 'assetContribution',
      name: '運用積立',
      value: point.assetContribution,
      color: CHART_COLORS.assetContribution,
    });
  }
  if (visibleSeries.taxSocial) {
    rows.push({
      dataKey: 'taxSocial',
      name: '税金・社保',
      value: point.taxSocial,
      color: CHART_COLORS.taxSocial,
    });
  }
  if (visibleSeries.income) {
    rows.push({
      dataKey: 'income',
      name: '収入',
      value: point.income,
      color: CHART_COLORS.income,
    });
  }
  if (balanceLineMode != null) {
    const balanceValue = balanceValueForMode(point, balanceLineMode);
    rows.push({
      dataKey:
        balanceLineMode === 'deposit' ? 'depositBalance' : 'financialAssets',
      name: LIFETIME_CHART_BALANCE_LINE_LABELS[balanceLineMode],
      value: balanceValue,
      color:
        balanceValue < 0
          ? CHART_COLORS.financialAssetsNegative
          : CHART_COLORS.financialAssets,
    });
  }

  return rows.filter((row) => {
    if (
      row.dataKey === 'income' ||
      row.dataKey === 'financialAssets' ||
      row.dataKey === 'depositBalance'
    ) {
      return true;
    }
    return row.value !== 0;
  });
}

export interface LifetimeChartHeaderProps {
  showTitle?: boolean;
  scaleMode: LifetimeChartScaleMode;
  onScaleModeChange: (mode: LifetimeChartScaleMode) => void;
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
  scaleMode: LifetimeChartScaleMode;
  visibleSeries: LifetimeChartVisibleSeries;
  onVisibleSeriesChange: (next: LifetimeChartVisibleSeries) => void;
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
  index = 0,
  payload,
  points,
}: {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: number };
  points: LifetimeBalanceChartPoint[];
}) {
  if (!payload) return null;

  const point = points.find((row) => row.headAge === payload.value);
  if (!point) return null;

  const rows = point.spouseAge != null
    ? [
        { value: String(point.headAge), label: '世帯主', rowIndex: 0 },
        { value: String(point.spouseAge), label: '配偶者', rowIndex: 1 },
      ]
    : [{ value: String(point.headAge), label: '世帯主', rowIndex: 0 }];
  const labelXInGroup = CHART_MARGIN_LEFT - 8 - x;

  return (
    <g transform={`translate(${x},${y})`}>
      {rows.map((row) => (
        <g key={row.rowIndex}>
          {index === 0 ? (
            <text
              x={labelXInGroup}
              y={xAxisRowY(row.rowIndex)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#64748b"
              fontSize={10}
            >
              {row.label}
            </text>
          ) : null}
          <text
            x={0}
            y={xAxisRowY(row.rowIndex)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={row.rowIndex === 0 ? '#555' : '#666'}
            fontSize={11}
          >
            {row.value}
          </text>
        </g>
      ))}
    </g>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
  points,
  visibleSeries,
  balanceLineMode,
}: ChartTooltipProps) {
  if (!active) return null;

  const point = resolveLifetimeChartTooltipPoint(points, label, payload);
  if (!point) return null;

  const tooltipRows = buildTooltipRows(
    point,
    visibleSeries,
    balanceLineMode,
  ).sort(
    (left, right) =>
      (LEGEND_ITEM_ORDER.get(left.dataKey) ?? Number.MAX_SAFE_INTEGER) -
      (LEGEND_ITEM_ORDER.get(right.dataKey) ?? Number.MAX_SAFE_INTEGER),
  );

  if (tooltipRows.length === 0) return null;

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

function ChartSidebar({
  summary,
  visibleSeries,
  onVisibleSeriesChange,
}: {
  summary: LifetimeBalanceChartData['summary'];
  visibleSeries: LifetimeChartVisibleSeries;
  onVisibleSeriesChange: (next: LifetimeChartVisibleSeries) => void;
}) {
  const handleToggle = (key: LifetimeChartSeriesKey) => {
    onVisibleSeriesChange(toggleLifetimeChartVisibleSeries(visibleSeries, key));
  };

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
        <div className="lifetime-chart-legend-bulk">
          <button
            type="button"
            className="lifetime-chart-legend-bulk-btn"
            onClick={() =>
              onVisibleSeriesChange(createDefaultLifetimeChartVisibleSeries())
            }
          >
            全表示
          </button>
          <button
            type="button"
            className="lifetime-chart-legend-bulk-btn"
            onClick={() =>
              onVisibleSeriesChange(createAllHiddenLifetimeChartVisibleSeries())
            }
          >
            全解除
          </button>
        </div>
        <ul className="lifetime-chart-legend">
          {LEGEND_ITEMS.map((item) => {
            const checked = visibleSeries[item.key];
            return (
              <li
                key={item.key}
                className={
                  checked
                    ? 'lifetime-chart-legend-item'
                    : 'lifetime-chart-legend-item is-hidden'
                }
              >
                <label className="lifetime-chart-legend-toggle">
                  <input
                    type="checkbox"
                    className="lifetime-chart-legend-check"
                    checked={checked}
                    onChange={() => handleToggle(item.key)}
                  />
                  <span
                    className={`lifetime-chart-legend-icon lifetime-chart-legend-icon--${item.type}`}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  <span className="lifetime-chart-legend-label">{item.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export function LifetimeChartHeader({
  showTitle = true,
  scaleMode,
  onScaleModeChange,
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
        <div
          className="lifetime-chart-scale-toggle"
          role="group"
          aria-label="Y軸の表示スケール"
        >
          <button
            type="button"
            className={
              scaleMode === 'cashFlow'
                ? 'lifetime-chart-scale-btn is-active'
                : 'lifetime-chart-scale-btn'
            }
            aria-pressed={scaleMode === 'cashFlow'}
            onClick={() => onScaleModeChange('cashFlow')}
          >
            収支重視
          </button>
          <button
            type="button"
            className={
              scaleMode === 'assets'
                ? 'lifetime-chart-scale-btn is-active'
                : 'lifetime-chart-scale-btn'
            }
            aria-pressed={scaleMode === 'assets'}
            onClick={() => onScaleModeChange('assets')}
          >
            資産重視
          </button>
        </div>
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
  scaleMode,
  visibleSeries,
  onVisibleSeriesChange,
}: LifetimeChartGridRowProps) {
  const balanceLineMode = resolveActiveBalanceLineMode(visibleSeries);

  const axisDomain = useMemo(
    () =>
      resolveLifetimeChartAxisDomain(
        visiblePoints,
        scaleMode,
        balanceLineMode,
        visibleSeries,
      ),
    [visiblePoints, scaleMode, balanceLineMode, visibleSeries],
  );

  const chartHeight =
    scaleMode === 'assets' ? CHART_HEIGHT_EXPANDED : CHART_HEIGHT_COMPACT;

  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );

  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );

  const xAxisRowCount = chartData.spouseAxisLabel ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);

  const showRetirementLine = visiblePoints.some(
    (point) => point.headAge === RETIREMENT_HEAD_AGE,
  );

  const chartLinePoints = useMemo(
    () =>
      balanceLineMode == null
        ? []
        : buildBalanceLinePoints(visiblePoints, balanceLineMode),
    [visiblePoints, balanceLineMode],
  );

  const showBalanceLine = balanceLineMode != null;

  const balanceLineLabel =
    balanceLineMode == null
      ? ''
      : LIFETIME_CHART_BALANCE_LINE_LABELS[balanceLineMode];

  const [hoveredHeadAge, setHoveredHeadAge] = useState<number | null>(null);

  const hoveredPoint = useMemo(
    () => visiblePoints.find((point) => point.headAge === hoveredHeadAge) ?? null,
    [visiblePoints, hoveredHeadAge],
  );

  const hoveredBalance =
    hoveredPoint && balanceLineMode != null
      ? balanceValueForMode(hoveredPoint, balanceLineMode)
      : null;

  const handleChartMouseMove = (state: ChartMouseState) => {
    setHoveredHeadAge(headAgeFromChartMouseState(state, visiblePoints));
  };

  return (
    <>
      <div className="sim-align-label sim-chart-label-spacer" aria-hidden="true" />
      <div className="sim-align-plot lifetime-chart-plot">
        <p className="lifetime-chart-y-unit" aria-hidden>
          （万円）
        </p>
        <ResponsiveContainer width="100%" height={chartHeight + xAxisHeight}>
          <ComposedChart
            data={visiblePoints}
            barCategoryGap={getSimulationBarCategoryGapPx(visiblePoints.length)}
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
              domain={[plotMinHeadAge, plotMaxHeadAge]}
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
              domain={[plotMinHeadAge, plotMaxHeadAge]}
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
              domain={[axisDomain.min, axisDomain.max]}
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
                  visibleSeries={visibleSeries}
                  balanceLineMode={balanceLineMode}
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
              hide={!visibleSeries.taxSocial}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="assetContribution"
              name="運用積立"
              stackId="expense"
              fill={CHART_COLORS.assetContribution}
              hide={!visibleSeries.assetContribution}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="insurance"
              name="保険"
              stackId="expense"
              fill={CHART_COLORS.insurance}
              hide={!visibleSeries.insurance}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="loan"
              name="ローン"
              stackId="expense"
              fill={CHART_COLORS.loan}
              hide={!visibleSeries.loan}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="living"
              name="生活費"
              stackId="expense"
              fill={CHART_COLORS.living}
              hide={!visibleSeries.living}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="vehicle"
              name="乗り物"
              stackId="expense"
              fill={CHART_COLORS.vehicle}
              hide={!visibleSeries.vehicle}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="housing"
              name="住まい"
              stackId="expense"
              fill={CHART_COLORS.housing}
              hide={!visibleSeries.housing}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="education"
              name="教育費"
              stackId="expense"
              fill={CHART_COLORS.education}
              hide={!visibleSeries.education}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="lifeEvent"
              name="ライフイベント"
              stackId="expense"
              fill={CHART_COLORS.lifeEvent}
              hide={!visibleSeries.lifeEvent}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              type="monotone"
              dataKey="income"
              name="収入"
              stroke={CHART_COLORS.income}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              hide={!visibleSeries.income}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="balancePositive"
              name={balanceLineLabel}
              stroke={CHART_COLORS.financialAssets}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
              hide={!showBalanceLine}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="balanceNegative"
              name={balanceLineLabel}
              stroke={CHART_COLORS.financialAssetsNegative}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
              hide={!showBalanceLine}
              isAnimationActive={false}
            />
            {hoveredPoint &&
              hoveredBalance != null &&
              balanceLineMode != null &&
              hoveredBalance >= axisDomain.min &&
              hoveredBalance <= axisDomain.max && (
              <ReferenceDot
                xAxisId={LINE_X_AXIS_ID}
                yAxisId="main"
                x={hoveredPoint.headAge}
                y={hoveredBalance}
                r={5}
                fill={
                  hoveredBalance < 0
                    ? CHART_COLORS.financialAssetsNegative
                    : CHART_COLORS.financialAssets
                }
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="hidden"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="sim-align-gap" aria-hidden="true" />
      <ChartSidebar
        summary={chartData.summary}
        visibleSeries={visibleSeries}
        onVisibleSeriesChange={onVisibleSeriesChange}
      />
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
  const [scaleMode, setScaleMode] = useState<LifetimeChartScaleMode>('cashFlow');
  const [visibleSeries, setVisibleSeries] = useState(() =>
    createDefaultLifetimeChartVisibleSeries(),
  );
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
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
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
        <div className="lifetime-simulation-align">
        <LifetimeChartGridRow
          chartData={chartData}
          visiblePoints={visiblePoints}
          minHeadAge={minHeadAge}
          maxHeadAge={maxHeadAge}
          tickAges={tickAges}
          scaleMode={scaleMode}
          visibleSeries={visibleSeries}
          onVisibleSeriesChange={setVisibleSeries}
        />
        </div>
      </div>
    </section>
  );
}
