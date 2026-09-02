import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  getLifetimeChartPlotAgeDomain,
  getLifetimeChartYTicks,
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import {
  ASSET_CHART_HEIGHT,
  ASSET_CHART_MARGIN_LEFT,
  ASSET_CHART_MARGIN_TOP,
  ASSET_EXPENSE_BAR_MAX_SIZE,
  ASSET_EXPENSE_LEGEND_ITEMS,
  ASSET_EXPENSE_STACK_ORDER,
  AssetChartTooltipShell,
  AssetChartZoomToolbar,
  AssetTooltipRow,
  DualAgeAxisTick,
  createDefaultAssetExpenseVisibility,
  formatAxisMan,
  niceAxisMax,
  sumVisibleAssetExpense,
  toCumulativeAssetExpensePoints,
  useAssetChartWindow,
  xAxisTotalHeight,
  type AssetChartAggregation,
  type AssetExpenseSeriesKey,
  type AssetExpenseSeriesVisibility,
} from './assetBuildingChartShared';

interface AssetExpenseChartProps {
  points: LifetimeBalanceChartPoint[];
  hasSpouse: boolean;
}

function ExpenseTooltip({
  active,
  label,
  payload,
  points,
  visibility,
  isCumulative,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: LifetimeBalanceChartPoint }>;
  points: LifetimeBalanceChartPoint[];
  visibility: AssetExpenseSeriesVisibility;
  isCumulative: boolean;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  const rows = ASSET_EXPENSE_LEGEND_ITEMS.filter(
    (item) => visibility[item.key] && point[item.key] !== 0,
  );
  const total = sumVisibleAssetExpense(point, visibility);
  return (
    <AssetChartTooltipShell
      calendarYear={point.calendarYear}
      headAge={point.headAge}
      spouseAge={point.spouseAge}
    >
      {rows.map((item) => (
        <AssetTooltipRow
          key={item.key}
          color={item.color}
          label={item.label}
          value={point[item.key]}
        />
      ))}
      <AssetTooltipRow
        color="#64748b"
        label={isCumulative ? '支出累計' : '支出合計'}
        value={total}
        emphasis
      />
    </AssetChartTooltipShell>
  );
}

export function AssetExpenseChart({
  points,
  hasSpouse,
}: AssetExpenseChartProps) {
  const [visibility, setVisibility] = useState(
    createDefaultAssetExpenseVisibility,
  );
  const [aggregation, setAggregation] =
    useState<AssetChartAggregation>('year');
  const chartPoints = useMemo(
    () =>
      aggregation === 'cumulative'
        ? toCumulativeAssetExpensePoints(points)
        : points,
    [aggregation, points],
  );
  const {
    visiblePoints,
    tickAges,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useAssetChartWindow(chartPoints);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisDomain = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, sumVisibleAssetExpense(point, visibility), 0);
    }
    return { min: 0, max: niceAxisMax(peak) };
  }, [visiblePoints, visibility]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const isCumulative = aggregation === 'cumulative';

  const toggleSeries = (key: AssetExpenseSeriesKey) => {
    setVisibility((current) => ({ ...current, [key]: !current[key] }));
  };

  if (points.length === 0) return null;

  return (
    <section
      className="asset-building-chart-card"
      aria-labelledby="asset-expense-chart-heading"
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 id="asset-expense-chart-heading" className="lifetime-chart-title">
            {isCumulative ? '支出（累計）' : '支出（単年）'}
          </h3>
          {isCumulative ? (
            <p className="asset-building-chart-note">
              計画開始からの累計支出内訳の積み上げです。凡例で表示を切り替えられます。
            </p>
          ) : null}
        </div>
        <AssetChartZoomToolbar
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={reset}
          aggregation={aggregation}
          onAggregationChange={setAggregation}
        />
      </div>

      <div className="lifetime-simulation-panel asset-building-chart-panel">
        <div className="lifetime-simulation-align">
          <div
            className="sim-align-label sim-chart-label-spacer"
            aria-hidden="true"
          />
          <div className="sim-align-plot lifetime-chart-plot">
            <p className="lifetime-chart-y-unit" aria-hidden>
              （万円）
            </p>
            <ResponsiveContainer
              width="100%"
              height={ASSET_CHART_HEIGHT + xAxisHeight}
            >
              <ComposedChart
                data={visiblePoints}
                barCategoryGap={getSimulationBarCategoryGapPx(
                  visiblePoints.length,
                )}
                barGap={0}
                maxBarSize={ASSET_EXPENSE_BAR_MAX_SIZE}
                margin={{
                  top: ASSET_CHART_MARGIN_TOP,
                  right: SIMULATION_CHART_MARGIN_RIGHT,
                  left: 0,
                  bottom: xAxisHeight,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  vertical={false}
                />
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
                <YAxis
                  yAxisId="main"
                  tickFormatter={formatAxisMan}
                  ticks={yTicks}
                  stroke="#64748b"
                  fontSize={11}
                  width={ASSET_CHART_MARGIN_LEFT}
                  domain={[axisDomain.min, axisDomain.max]}
                />
                <ReferenceLine
                  yAxisId="main"
                  y={0}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <Tooltip
                  content={(props) => (
                    <ExpenseTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: LifetimeBalanceChartPoint;
                        }>
                      }
                      points={visiblePoints}
                      visibility={visibility}
                      isCumulative={isCumulative}
                    />
                  )}
                />
                {ASSET_EXPENSE_STACK_ORDER.map((key) => {
                  const item = ASSET_EXPENSE_LEGEND_ITEMS.find(
                    (row) => row.key === key,
                  );
                  if (!item) return null;
                  return (
                    <Bar
                      key={key}
                      yAxisId="main"
                      dataKey={key}
                      name={item.label}
                      stackId="expense"
                      fill={item.color}
                      hide={!visibility[key]}
                      isAnimationActive={false}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="sim-align-gap" aria-hidden="true" />
          <aside className="sim-align-sidebar lifetime-chart-sidebar">
            <div className="lifetime-chart-legend-panel">
              <h3 className="lifetime-chart-legend-title">凡例</h3>
              <div className="lifetime-chart-legend-bulk">
                <button
                  type="button"
                  className="lifetime-chart-legend-bulk-btn"
                  onClick={() =>
                    setVisibility(createDefaultAssetExpenseVisibility())
                  }
                >
                  全表示
                </button>
                <button
                  type="button"
                  className="lifetime-chart-legend-bulk-btn"
                  onClick={() =>
                    setVisibility({
                      lifeEvent: false,
                      education: false,
                      housing: false,
                      vehicle: false,
                      living: false,
                      loan: false,
                      insurance: false,
                      assetContribution: false,
                      taxSocial: false,
                    })
                  }
                >
                  全解除
                </button>
              </div>
              <ul className="lifetime-chart-legend">
                {ASSET_EXPENSE_LEGEND_ITEMS.map((item) => (
                  <li
                    key={item.key}
                    className={
                      visibility[item.key]
                        ? 'lifetime-chart-legend-item'
                        : 'lifetime-chart-legend-item is-hidden'
                    }
                  >
                    <label className="lifetime-chart-legend-toggle">
                      <input
                        type="checkbox"
                        className="lifetime-chart-legend-check"
                        checked={visibility[item.key]}
                        onChange={() => toggleSeries(item.key)}
                      />
                      <span
                        className="lifetime-chart-legend-icon lifetime-chart-legend-icon--bar"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span className="lifetime-chart-legend-label">
                        {item.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
