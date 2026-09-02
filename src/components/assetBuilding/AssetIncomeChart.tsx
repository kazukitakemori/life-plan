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
  resolveAssetIncomeChartScopes,
  buildAssetIncomeChartPoints,
  type AssetIncomeChartScope,
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import type { CashFlowTableData } from '../../types/cashFlow';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import {
  ASSET_CHART_HEIGHT,
  ASSET_CHART_MARGIN_LEFT,
  ASSET_CHART_MARGIN_TOP,
  ASSET_EXPENSE_BAR_MAX_SIZE,
  ASSET_INCOME_LEGEND_ITEMS,
  ASSET_INCOME_STACK_ORDER,
  AssetChartTooltipShell,
  AssetChartZoomToolbar,
  AssetTooltipRow,
  DualAgeAxisTick,
  createDefaultAssetIncomeVisibility,
  createHiddenAssetIncomeVisibility,
  formatAxisMan,
  niceAxisMax,
  sumVisibleAssetIncome,
  toCumulativeAssetIncomePoints,
  useAssetChartWindow,
  xAxisTotalHeight,
  type AssetChartAggregation,
  type AssetIncomeSeriesKey,
  type AssetIncomeSeriesVisibility,
} from './assetBuildingChartShared';

interface AssetIncomeChartProps {
  cashFlowData: CashFlowTableData;
  hasSpouse: boolean;
}

function IncomeTooltip({
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
  visibility: AssetIncomeSeriesVisibility;
  isCumulative: boolean;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  const rows = ASSET_INCOME_LEGEND_ITEMS.filter(
    (item) => visibility[item.key] && point[item.key] !== 0,
  );
  const total = sumVisibleAssetIncome(point, visibility);
  if (rows.length === 0 && total === 0) return null;
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
        label={isCumulative ? '収入累計' : '収入合計'}
        value={total}
        emphasis
      />
    </AssetChartTooltipShell>
  );
}

export function AssetIncomeChart({
  cashFlowData,
  hasSpouse,
}: AssetIncomeChartProps) {
  const scopeOptions = useMemo(
    () => resolveAssetIncomeChartScopes(cashFlowData),
    [cashFlowData],
  );
  const [scope, setScope] = useState<AssetIncomeChartScope>('household');
  const activeScope = scopeOptions.some((option) => option.value === scope)
    ? scope
    : 'household';
  const points = useMemo(
    () => buildAssetIncomeChartPoints(cashFlowData, activeScope),
    [cashFlowData, activeScope],
  );
  const scopeLabel =
    scopeOptions.find((option) => option.value === activeScope)?.label ??
    '家計';
  const [visibility, setVisibility] = useState(
    createDefaultAssetIncomeVisibility,
  );
  const [aggregation, setAggregation] =
    useState<AssetChartAggregation>('year');
  const chartPoints = useMemo(
    () =>
      aggregation === 'cumulative'
        ? toCumulativeAssetIncomePoints(points)
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
      peak = Math.max(peak, sumVisibleAssetIncome(point, visibility), 0);
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

  const toggleSeries = (key: AssetIncomeSeriesKey) => {
    setVisibility((current) => ({ ...current, [key]: !current[key] }));
  };

  if (points.length === 0) return null;

  return (
    <section
      className="asset-building-chart-card"
      aria-labelledby="asset-income-chart-heading"
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 id="asset-income-chart-heading" className="lifetime-chart-title">
            {isCumulative ? '収入（累計）' : '収入（単年）'}
          </h3>
          <p className="asset-building-chart-note">
            {isCumulative
              ? activeScope === 'household'
                ? '計画開始からの累計収入内訳の積み上げです。凡例で表示を切り替えられます。'
                : `計画開始からの${scopeLabel}の累計収入内訳です。キャッシュフロー表の個人フォルダと同じ内訳です。`
              : activeScope === 'household'
                ? 'キャッシュフロー表と同じ収入内訳の積み上げです。凡例で表示を切り替えられます。'
                : `キャッシュフロー表の${scopeLabel}フォルダと同じ収入内訳です。`}
          </p>
        </div>
        <div className="lifetime-chart-header-tools">
          {scopeOptions.length > 1 ? (
            <div
              className="lifetime-chart-scale-toggle"
              role="group"
              aria-label="収入の表示単位"
            >
              {scopeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    activeScope === option.value
                      ? 'lifetime-chart-scale-btn is-active'
                      : 'lifetime-chart-scale-btn'
                  }
                  aria-pressed={activeScope === option.value}
                  onClick={() => setScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
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
                    <IncomeTooltip
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
                {ASSET_INCOME_STACK_ORDER.map((key) => {
                  const item = ASSET_INCOME_LEGEND_ITEMS.find(
                    (row) => row.key === key,
                  );
                  if (!item) return null;
                  return (
                    <Bar
                      key={key}
                      yAxisId="main"
                      dataKey={key}
                      name={item.label}
                      stackId="income"
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
                    setVisibility(createDefaultAssetIncomeVisibility())
                  }
                >
                  全表示
                </button>
                <button
                  type="button"
                  className="lifetime-chart-legend-bulk-btn"
                  onClick={() =>
                    setVisibility(createHiddenAssetIncomeVisibility())
                  }
                >
                  全解除
                </button>
              </div>
              <ul className="lifetime-chart-legend">
                {ASSET_INCOME_LEGEND_ITEMS.map((item) => (
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
