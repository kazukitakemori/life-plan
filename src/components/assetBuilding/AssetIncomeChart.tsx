import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  formatLifetimeTotalMan,
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
  ASSET_CHART_HEIGHT_FULLSCREEN,
  ASSET_CHART_MARGIN_LEFT,
  ASSET_CHART_MARGIN_TOP,
  ASSET_EXPENSE_BAR_MAX_SIZE,
  ASSET_EXPENSE_LINE_COLOR,
  ASSET_EXPENSE_LINE_LABEL,
  ASSET_INCOME_LEGEND_ITEMS,
  ASSET_INCOME_STACK_ORDER,
  ASSET_LINE_X_AXIS_ID,
  AssetChartSummaryPanel,
  AssetChartTooltipShell,
  AssetChartYAxisMaxPanel,
  AssetChartZoomToolbar,
  AssetTooltipRow,
  DualAgeAxisTick,
  createDefaultAssetIncomeVisibility,
  createHiddenAssetIncomeVisibility,
  formatAxisMan,
  niceAxisMax,
  sumAssetExpenseTotal,
  sumVisibleAssetIncome,
  toCumulativeAssetIncomePoints,
  useAssetChartWindow,
  useAssetChartYAxisMax,
  xAxisTotalHeight,
  type AssetChartAggregation,
  type AssetIncomeSeriesKey,
  type AssetIncomeSeriesVisibility,
} from './assetBuildingChartShared';
import { AssetBuildingSelectMenu } from './AssetBuildingSelectMenu';
import { useFullscreenPlotHeight } from '../layout/ShellFullscreenContext';

interface AssetIncomeChartProps {
  cashFlowData: CashFlowTableData;
  hasSpouse: boolean;
  aggregation: AssetChartAggregation;
}

type IncomeChartPoint = LifetimeBalanceChartPoint & {
  expenseTotal: number;
};

function IncomeTooltip({
  active,
  label,
  payload,
  points,
  visibility,
  showExpenseLine,
  isCumulative,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: IncomeChartPoint }>;
  points: IncomeChartPoint[];
  visibility: AssetIncomeSeriesVisibility;
  showExpenseLine: boolean;
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
  if (
    rows.length === 0 &&
    total === 0 &&
    !(showExpenseLine && point.expenseTotal !== 0)
  ) {
    return null;
  }
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
      {showExpenseLine ? (
        <AssetTooltipRow
          color={ASSET_EXPENSE_LINE_COLOR}
          label={isCumulative ? '支出累計' : ASSET_EXPENSE_LINE_LABEL}
          value={point.expenseTotal}
          emphasis
        />
      ) : null}
    </AssetChartTooltipShell>
  );
}

export function AssetIncomeChart({
  cashFlowData,
  hasSpouse,
  aggregation,
}: AssetIncomeChartProps) {
  const scopeOptions = useMemo(
    () => resolveAssetIncomeChartScopes(cashFlowData),
    [cashFlowData],
  );
  const [scope, setScope] = useState<AssetIncomeChartScope>('household');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement>(null);
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
  const [showExpenseLine, setShowExpenseLine] = useState(true);
  const chartPoints = useMemo((): IncomeChartPoint[] => {
    const base =
      aggregation === 'cumulative'
        ? toCumulativeAssetIncomePoints(points)
        : points;
    return base.map((point) => ({
      ...point,
      expenseTotal: sumAssetExpenseTotal(point),
    }));
  }, [aggregation, points]);
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
  const autoYAxisMax = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, sumVisibleAssetIncome(point, visibility), 0);
      if (showExpenseLine) {
        peak = Math.max(peak, point.expenseTotal, 0);
      }
    }
    return niceAxisMax(peak);
  }, [visiblePoints, visibility, showExpenseLine]);
  const {
    yAxisMaxMode,
    manualYAxisMax,
    axisMax,
    setYAxisMaxMode,
    setManualYAxisMax,
  } = useAssetChartYAxisMax(autoYAxisMax);
  const axisDomain = useMemo(
    () => ({ min: 0, max: axisMax }),
    [axisMax],
  );
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const plotHeight = useFullscreenPlotHeight(
    ASSET_CHART_HEIGHT,
    ASSET_CHART_HEIGHT_FULLSCREEN,
  );
  const isCumulative = aggregation === 'cumulative';
  const summaryRows = useMemo(() => {
    if (visiblePoints.length === 0) return [];
    const total = isCumulative
      ? sumVisibleAssetIncome(
          visiblePoints[visiblePoints.length - 1],
          visibility,
        )
      : visiblePoints.reduce(
          (sum, point) => sum + sumVisibleAssetIncome(point, visibility),
          0,
        );
    return [
      {
        label: isCumulative ? '収入累計' : '収入合計',
        value: formatLifetimeTotalMan(total),
      },
    ];
  }, [visiblePoints, visibility, isCumulative]);

  useEffect(() => {
    if (!scopeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (scopeMenuRef.current?.contains(target)) return;
      setScopeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setScopeMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [scopeMenuOpen]);

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
          <div className="asset-building-chart-title-row" ref={scopeMenuRef}>
            <h3 id="asset-income-chart-heading" className="lifetime-chart-title">
              収入
            </h3>
            {scopeOptions.length > 1 ? (
              <AssetBuildingSelectMenu
                value={activeScope}
                options={scopeOptions.map((option) => ({
                  id: option.value,
                  label: option.label,
                }))}
                open={scopeMenuOpen}
                onOpenChange={setScopeMenuOpen}
                onChange={setScope}
                ariaLabel="収入の表示単位"
                secondary
                fallbackLabel="家計"
              />
            ) : null}
          </div>
          <p className="asset-building-chart-note">
            {isCumulative
              ? activeScope === 'household'
                ? '計画開始からの累計収入内訳の積み上げです。折れ線は累計支出です。'
                : `計画開始からの${scopeLabel}の累計収入内訳です。折れ線は家計の累計支出です。`
              : activeScope === 'household'
                ? 'キャッシュフロー表と同じ収入内訳の積み上げです。折れ線は支出合計です。'
                : `キャッシュフロー表の${scopeLabel}フォルダと同じ収入内訳です。折れ線は家計の支出合計です。`}
          </p>
        </div>
        <div className="lifetime-chart-header-tools">
          <AssetChartZoomToolbar
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
          />
        </div>
      </div>

      <div className="lifetime-simulation-panel asset-building-chart-panel">
        <div className="lifetime-simulation-align">
          <div
            className="sim-align-label sim-chart-label-spacer"
            aria-hidden="true"
          />
          <div className="sim-align-plot">
            <div className="lifetime-chart-plot">
              <p className="lifetime-chart-y-unit" aria-hidden>
                （万円）
              </p>
              <ResponsiveContainer
                width="100%"
                height={plotHeight + xAxisHeight}
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
                  <XAxis
                    xAxisId={ASSET_LINE_X_AXIS_ID}
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
                    width={ASSET_CHART_MARGIN_LEFT}
                    domain={[axisDomain.min, axisDomain.max]}
                    allowDataOverflow
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
                            payload?: IncomeChartPoint;
                          }>
                        }
                        points={visiblePoints}
                        visibility={visibility}
                        showExpenseLine={showExpenseLine}
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
                  <Line
                    xAxisId={ASSET_LINE_X_AXIS_ID}
                    yAxisId="main"
                    type="monotone"
                    dataKey="expenseTotal"
                    name={ASSET_EXPENSE_LINE_LABEL}
                    stroke={ASSET_EXPENSE_LINE_COLOR}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    hide={!showExpenseLine}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="asset-building-chart-legend-below">
              <div className="lifetime-chart-legend-panel lifetime-chart-legend-panel--below">
                <div className="lifetime-chart-legend-below-header">
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
                </div>
                <ul className="lifetime-chart-legend">
                  <li
                    className={
                      showExpenseLine
                        ? 'lifetime-chart-legend-item'
                        : 'lifetime-chart-legend-item is-hidden'
                    }
                  >
                    <label className="lifetime-chart-legend-toggle">
                      <input
                        type="checkbox"
                        className="lifetime-chart-legend-check"
                        checked={showExpenseLine}
                        onChange={() => setShowExpenseLine((value) => !value)}
                      />
                      <span
                        className="lifetime-chart-legend-icon lifetime-chart-legend-icon--line"
                        style={{ backgroundColor: ASSET_EXPENSE_LINE_COLOR }}
                        aria-hidden
                      />
                      <span className="lifetime-chart-legend-label">
                        {ASSET_EXPENSE_LINE_LABEL}
                      </span>
                    </label>
                  </li>
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
            </div>
          </div>
          <div className="sim-align-gap" aria-hidden="true" />
          <aside className="sim-align-sidebar lifetime-chart-sidebar">
            <AssetChartSummaryPanel title="表示期間" rows={summaryRows} />
            <AssetChartYAxisMaxPanel
              yAxisMaxMode={yAxisMaxMode}
              manualYAxisMax={manualYAxisMax}
              autoYAxisMax={autoYAxisMax}
              onYAxisMaxModeChange={setYAxisMaxMode}
              onManualYAxisMaxChange={setManualYAxisMax}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
