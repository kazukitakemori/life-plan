import { useMemo, useState } from 'react';
import {
  Area,
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

import {
  LIFETIME_CHART_BALANCE_LINE_LABELS,
  createDefaultLifetimeChartVisibleSeries,
  getLifetimeChartPlotAgeDomain,
  getLifetimeChartYTicks,
  resolveActiveBalanceLineMode,
  toggleLifetimeChartVisibleSeries,
  type LifetimeChartBalanceLineMode,
  type LifetimeChartSeriesKey,
} from '../../lib/lifetimeBalanceChartData';
import { type RequiredCoverageChartPoint } from '../../lib/requiredCoverage';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import {
  CHART_COLORS,
  CHART_HEIGHT,
  CHART_MARGIN_LEFT,
  CHART_MARGIN_TOP,
  CoverageChartZoomToolbar,
  CoverageFormulaPanel,
  DualAgeAxisTick,
  EXPENSE_BAR_MAX_SIZE,
  LINE_X_AXIS_ID,
  coveragePreparedResourceLabels,
  deathTimeBalanceForMode,
  formatAxisMan,
  formatTooltipMan,
  getTickAges,
  niceAxisMax,
  useCoverageChartWindow,
  withDeathTimingSweep,
  xAxisTotalHeight,
  type CoverageChartDisplayPoint,
} from './requiredCoverageChartShared';

type NeedLegendKey = 'expenseBase' | 'preparedFill' | 'incomeGap';
type NeedLegendVisibility = Record<NeedLegendKey, boolean>;

function needLegendItems(preparedLabel: string) {
  return [
    {
      key: 'expenseBase' as const,
      label: '支出累計',
      color: CHART_COLORS.expenseBase,
      type: 'bar' as const,
    },
    {
      key: 'preparedFill' as const,
      label: preparedLabel,
      color: CHART_COLORS.remainingIncome,
      type: 'area' as const,
    },
    {
      key: 'incomeGap' as const,
      label: '必要保障額（不足額）',
      color: CHART_COLORS.remainingTotal,
      type: 'area' as const,
    },
  ];
}

const DEFAULT_NEED_VISIBLE: NeedLegendVisibility = {
  expenseBase: true,
  preparedFill: true,
  incomeGap: true,
};

type NeedBalanceLegendKey = 'depositBalance' | 'financialAssets';
type NeedBalanceLegendVisibility = Record<NeedBalanceLegendKey, boolean>;

const DEFAULT_BALANCE_LEGEND: NeedBalanceLegendVisibility = {
  depositBalance: true,
  financialAssets: false,
};

const BALANCE_LEGEND_ITEMS = [
  {
    key: 'depositBalance' as const,
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.deposit,
    color: CHART_COLORS.savings,
    type: 'step' as const,
  },
  {
    key: 'financialAssets' as const,
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets,
    color: '#1f9690',
    type: 'step' as const,
  },
] as const;

function toggleNeedBalanceLegend(
  current: NeedBalanceLegendVisibility,
  key: NeedBalanceLegendKey,
): NeedBalanceLegendVisibility {
  const merged = {
    ...createDefaultLifetimeChartVisibleSeries(),
    depositBalance: current.depositBalance,
    financialAssets: current.financialAssets,
  };
  const next = toggleLifetimeChartVisibleSeries(
    merged,
    key as LifetimeChartSeriesKey,
  );
  const result = {
    depositBalance: next.depositBalance,
    financialAssets: next.financialAssets,
  };
  if (!result.depositBalance && !result.financialAssets) {
    return key === 'depositBalance'
      ? { depositBalance: false, financialAssets: true }
      : { depositBalance: true, financialAssets: false };
  }
  return result;
}

function NeedChartSidebar({
  nowSweep,
  preparedLabels,
  chartLegendItems,
  visible,
  onVisibleChange,
  balanceLegend,
  onBalanceLegendChange,
  showChartLegend = true,
}: {
  nowSweep: CoverageChartDisplayPoint | null;
  preparedLabels: ReturnType<typeof coveragePreparedResourceLabels>;
  chartLegendItems: ReturnType<typeof needLegendItems>;
  visible: NeedLegendVisibility;
  onVisibleChange: (next: NeedLegendVisibility) => void;
  balanceLegend: NeedBalanceLegendVisibility;
  onBalanceLegendChange: (next: NeedBalanceLegendVisibility) => void;
  showChartLegend?: boolean;
}) {
  return (
    <aside className="sim-align-sidebar lifetime-chart-sidebar">
      <div className="lifetime-chart-summary">
        <h3 className="lifetime-chart-summary-title">いま万一の場合</h3>
        <CoverageFormulaPanel
          expense={nowSweep?.expenseBase ?? 0}
          income={nowSweep?.preparedFill ?? 0}
          shortfall={nowSweep?.shortfall ?? 0}
          incomeLabel={preparedLabels.formula}
        />
      </div>
      <div className="lifetime-chart-legend-panel">
        <h3 className="lifetime-chart-legend-title">凡例</h3>
        {showChartLegend ? (
          <div className="lifetime-chart-legend-bulk">
            <button
              type="button"
              className="lifetime-chart-legend-bulk-btn"
              onClick={() => onVisibleChange(DEFAULT_NEED_VISIBLE)}
            >
              全表示
            </button>
            <button
              type="button"
              className="lifetime-chart-legend-bulk-btn"
              onClick={() =>
                onVisibleChange({
                  expenseBase: false,
                  preparedFill: false,
                  incomeGap: false,
                })
              }
            >
              全解除
            </button>
          </div>
        ) : null}
        <ul className="lifetime-chart-legend">
          {showChartLegend
            ? chartLegendItems.map((item) => {
                const checked = visible[item.key];
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
                        onChange={() =>
                          onVisibleChange({
                            ...visible,
                            [item.key]: !checked,
                          })
                        }
                      />
                      <span
                        className={`lifetime-chart-legend-icon lifetime-chart-legend-icon--${item.type}`}
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span className="lifetime-chart-legend-label">
                        {item.label}
                      </span>
                    </label>
                  </li>
                );
              })
            : null}
          {BALANCE_LEGEND_ITEMS.map((item) => {
            const checked = balanceLegend[item.key];
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
                    onChange={() =>
                      onBalanceLegendChange(
                        toggleNeedBalanceLegend(balanceLegend, item.key),
                      )
                    }
                  />
                  <span
                    className={`lifetime-chart-legend-icon lifetime-chart-legend-icon--${item.type}`}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  <span className="lifetime-chart-legend-label">
                    {item.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="required-coverage-chart-zero-note required-coverage-balance-legend-note">
          残高は死亡年始（前年年末）時点。初年は試算開始時点です。生涯収支と同じ口座区分です。
        </p>
      </div>
    </aside>
  );
}

interface RequiredCoverageNeedChartProps {
  points: RequiredCoverageChartPoint[];
  hasSpouse: boolean;
  compact?: boolean;
  variant?: 'sweep' | 'line';
}

function NeedSweepTooltip({
  active,
  label,
  payload,
  points,
  preparedLabel,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: CoverageChartDisplayPoint }>;
  points: CoverageChartDisplayPoint[];
  preparedLabel: string;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.headAge}歳で万一が起きた場合
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">
        <p className="lifetime-chart-tooltip-row">
          <span
            className="lifetime-chart-tooltip-swatch"
            style={{ backgroundColor: CHART_COLORS.expenseBase }}
          />
          <span>支出累計</span>
          <span>{formatTooltipMan(point.expenseBase)}</span>
        </p>
        <p className="lifetime-chart-tooltip-row">
          <span
            className="lifetime-chart-tooltip-swatch"
            style={{ backgroundColor: CHART_COLORS.remainingIncome }}
          />
          <span>{preparedLabel}</span>
          <span>{formatTooltipMan(point.preparedFill)}</span>
        </p>
        <p className="lifetime-chart-tooltip-row lifetime-chart-tooltip-row--emphasis">
          <span
            className="lifetime-chart-tooltip-swatch"
            style={{ backgroundColor: CHART_COLORS.remainingTotal }}
          />
          <span>必要保障額（不足額）</span>
          <span>{formatTooltipMan(point.incomeGap)}</span>
        </p>
      </div>
    </div>
  );
}

function NeedLineTooltip({
  active,
  label,
  payload,
  points,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: CoverageChartDisplayPoint }>;
  points: CoverageChartDisplayPoint[];
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.headAge}歳で万一が起きた場合
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">
        <p className="lifetime-chart-tooltip-row lifetime-chart-tooltip-row--emphasis">
          <span
            className="lifetime-chart-tooltip-swatch"
            style={{ backgroundColor: CHART_COLORS.remainingTotal }}
          />
          <span>必要保障額</span>
          <span>{formatTooltipMan(point.shortfall)}</span>
        </p>
      </div>
    </div>
  );
}

export function RequiredCoverageNeedChart({
  points,
  hasSpouse,
  compact = false,
  variant,
}: RequiredCoverageNeedChartProps) {
  const [visible, setVisible] = useState<NeedLegendVisibility>(
    DEFAULT_NEED_VISIBLE,
  );
  const [balanceLegend, setBalanceLegend] = useState<NeedBalanceLegendVisibility>(
    DEFAULT_BALANCE_LEGEND,
  );
  const [hoveredHeadAge, setHoveredHeadAge] = useState<number | null>(null);
  const preparedBalanceMode: LifetimeChartBalanceLineMode =
    resolveActiveBalanceLineMode({
      ...createDefaultLifetimeChartVisibleSeries(),
      ...balanceLegend,
    }) ?? 'deposit';
  const preparedLabels = coveragePreparedResourceLabels(preparedBalanceMode);
  const legendItems = needLegendItems(preparedLabels.legend);
  const displayPoints = useMemo(
    () =>
      points.map((point) =>
        withDeathTimingSweep(
          point,
          deathTimeBalanceForMode(point, preparedBalanceMode),
        ),
      ),
    [points, preparedBalanceMode],
  );
  const {
    visiblePoints,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useCoverageChartWindow(displayPoints);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const tickAges = useMemo(() => getTickAges(visiblePoints), [visiblePoints]);
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisDomain = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      if (visible.expenseBase) peak = Math.max(peak, point.expenseBase);
      if (visible.preparedFill) peak = Math.max(peak, point.preparedFill);
      if (visible.incomeGap) {
        peak = Math.max(peak, point.preparedFill + point.incomeGap);
      }
    }
    return { min: 0, max: niceAxisMax(peak) };
  }, [visiblePoints, visible]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const needAxisDomain = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, point.shortfall);
    }
    return { min: 0, max: niceAxisMax(peak) };
  }, [visiblePoints]);
  const needYTicks = useMemo(
    () => getLifetimeChartYTicks(needAxisDomain.min, needAxisDomain.max),
    [needAxisDomain.min, needAxisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const hoveredPoint =
    visiblePoints.find((point) => point.headAge === hoveredHeadAge) ?? null;
  const nowSweep = displayPoints[0] ?? null;

  if (points.length === 0) return null;

  const showLine = variant === 'line' || (compact && variant !== 'sweep');
  const lineHeight = CHART_HEIGHT;
  const showExpense = visible.expenseBase;
  const showIncome = visible.preparedFill;
  const showNeed = visible.incomeGap;

  const lineChart = (
    <div className="lifetime-simulation-panel required-coverage-chart-panel required-coverage-need-line-panel">
      <div className="lifetime-simulation-align">
        <div className="sim-align-label sim-chart-label-spacer" aria-hidden="true" />
        <div className="sim-align-plot lifetime-chart-plot">
          <p className="lifetime-chart-y-unit" aria-hidden>
            （万円）
          </p>
          <ResponsiveContainer width="100%" height={lineHeight + xAxisHeight}>
            <ComposedChart
              data={visiblePoints}
              margin={{
                top: CHART_MARGIN_TOP,
                right: SIMULATION_CHART_MARGIN_RIGHT,
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
                ticks={needYTicks}
                stroke="#64748b"
                fontSize={11}
                width={CHART_MARGIN_LEFT}
                domain={[needAxisDomain.min, needAxisDomain.max]}
              />
              <ReferenceLine yAxisId="main" y={0} stroke="#cbd5e1" strokeWidth={1} />
              <Tooltip
                content={(props) => (
                  <NeedLineTooltip
                    active={props.active}
                    label={props.label as number | undefined}
                    payload={
                      props.payload as ReadonlyArray<{
                        payload?: CoverageChartDisplayPoint;
                      }>
                    }
                    points={visiblePoints}
                  />
                )}
              />
              <Line
                xAxisId={LINE_X_AXIS_ID}
                yAxisId="main"
                type="monotone"
                dataKey="shortfall"
                name="必要保障額"
                stroke={CHART_COLORS.remainingTotal}
                strokeWidth={2.75}
                dot={{
                  r: 3,
                  strokeWidth: 1,
                  stroke: '#fff',
                  fill: CHART_COLORS.remainingTotal,
                }}
                activeDot={{ r: 5, strokeWidth: 1, stroke: '#fff' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="sim-align-gap" aria-hidden="true" />
        <aside className="sim-align-sidebar lifetime-chart-sidebar">
          {showLine ? (
            <NeedChartSidebar
              nowSweep={nowSweep}
              preparedLabels={preparedLabels}
              chartLegendItems={legendItems}
              visible={visible}
              onVisibleChange={setVisible}
              balanceLegend={balanceLegend}
              onBalanceLegendChange={setBalanceLegend}
              showChartLegend={false}
            />
          ) : (
            <div aria-hidden="true" />
          )}
        </aside>
      </div>
    </div>
  );

  return (
    <section
      className="required-coverage-chart-card"
      aria-labelledby="required-coverage-need-chart-heading"
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3
            id="required-coverage-need-chart-heading"
            className="lifetime-chart-title"
          >
            {showLine ? '必要保障額だけを見る' : '必要保障額の推移'}
          </h3>
          <p className="required-coverage-chart-zero-note">
            {showLine
              ? '各年齢で万一が起きた場合の不足額です。右の凡例で残高の口座区分（現預金／金融資産）を切り替えられます。'
              : '支出累計（税・社保込）− 万一後の収入と死亡時点の残高 ＝ 必要保障額（不足額）。残高の区分は右の凡例で切り替えます。'}
          </p>
        </div>
        <CoverageChartZoomToolbar
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={reset}
        />
      </div>

      {showLine ? (
        lineChart
      ) : (
          <div className="lifetime-simulation-panel required-coverage-chart-panel">
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
                  height={CHART_HEIGHT + xAxisHeight}
                >
                  <ComposedChart
                    data={visiblePoints}
                    barCategoryGap={getSimulationBarCategoryGapPx(
                      visiblePoints.length,
                    )}
                    barGap={0}
                    maxBarSize={EXPENSE_BAR_MAX_SIZE}
                    onMouseMove={(state: {
                      activeTooltipIndex?: number;
                      isTooltipActive?: boolean;
                    }) => {
                      if (!state.isTooltipActive) {
                        setHoveredHeadAge(null);
                        return;
                      }
                      const index = state.activeTooltipIndex;
                      setHoveredHeadAge(
                        index != null
                          ? (visiblePoints[index]?.headAge ?? null)
                          : null,
                      );
                    }}
                    onMouseLeave={() => setHoveredHeadAge(null)}
                    margin={{
                      top: CHART_MARGIN_TOP,
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
                    <ReferenceLine
                      yAxisId="main"
                      y={0}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                    />
                    <Tooltip
                      content={(props) => (
                        <NeedSweepTooltip
                          active={props.active}
                          label={props.label as number | undefined}
                          payload={
                            props.payload as ReadonlyArray<{
                              payload?: CoverageChartDisplayPoint;
                            }>
                          }
                          points={visiblePoints}
                          preparedLabel={preparedLabels.legend}
                        />
                      )}
                    />
                    <Bar
                      yAxisId="main"
                      dataKey="expenseBase"
                      name="支出累計"
                      fill={CHART_COLORS.expenseBase}
                      fillOpacity={0.38}
                      hide={!showExpense}
                      isAnimationActive={false}
                    />
                    <Area
                      xAxisId={LINE_X_AXIS_ID}
                      yAxisId="main"
                      type="monotone"
                      dataKey="preparedFill"
                      stackId="needGap"
                      name={preparedLabels.legend}
                      stroke="none"
                      fill={showIncome ? CHART_COLORS.remainingIncome : 'transparent'}
                      fillOpacity={0.35}
                      legendType="none"
                      tooltipType="none"
                      hide={!showIncome && !showNeed}
                      isAnimationActive={false}
                    />
                    <Area
                      xAxisId={LINE_X_AXIS_ID}
                      yAxisId="main"
                      type="monotone"
                      dataKey="incomeGap"
                      stackId="needGap"
                      name="必要保障額（不足額）"
                      stroke="none"
                      fill={CHART_COLORS.remainingTotal}
                      fillOpacity={0.42}
                      legendType="none"
                      tooltipType="none"
                      hide={!showNeed}
                      isAnimationActive={false}
                    />
                    <Line
                      xAxisId={LINE_X_AXIS_ID}
                      yAxisId="main"
                      type="monotone"
                      dataKey="expenseBase"
                      name="支出累計"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      dot={{
                        r: 2.5,
                        strokeWidth: 1,
                        stroke: '#fff',
                        fill: '#94a3b8',
                      }}
                      activeDot={{ r: 4, strokeWidth: 1, stroke: '#fff' }}
                      hide={!showExpense}
                      isAnimationActive={false}
                    />
                    <Line
                      xAxisId={LINE_X_AXIS_ID}
                      yAxisId="main"
                      type="monotone"
                      dataKey="preparedFill"
                      name={preparedLabels.legend}
                      stroke={CHART_COLORS.remainingIncome}
                      strokeWidth={2.75}
                      dot={{ r: 3, strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 1, stroke: '#fff' }}
                      hide={!showIncome}
                      isAnimationActive={false}
                    />
                    {hoveredPoint &&
                      showExpense &&
                      hoveredPoint.expenseBase <= axisDomain.max && (
                        <ReferenceDot
                          xAxisId={LINE_X_AXIS_ID}
                          yAxisId="main"
                          x={hoveredPoint.headAge}
                          y={hoveredPoint.expenseBase}
                          r={5}
                          fill="#94a3b8"
                          stroke="#fff"
                          strokeWidth={2}
                          ifOverflow="hidden"
                        />
                      )}
                    {hoveredPoint &&
                      showNeed &&
                      hoveredPoint.preparedFill + hoveredPoint.incomeGap <=
                        axisDomain.max && (
                        <ReferenceDot
                          xAxisId={LINE_X_AXIS_ID}
                          yAxisId="main"
                          x={hoveredPoint.headAge}
                          y={hoveredPoint.preparedFill + hoveredPoint.incomeGap}
                          r={5}
                          fill={CHART_COLORS.remainingTotal}
                          stroke="#fff"
                          strokeWidth={2}
                          ifOverflow="hidden"
                        />
                      )}
                    {hoveredPoint &&
                      showIncome &&
                      hoveredPoint.preparedFill >= axisDomain.min &&
                      hoveredPoint.preparedFill <= axisDomain.max && (
                        <ReferenceDot
                          xAxisId={LINE_X_AXIS_ID}
                          yAxisId="main"
                          x={hoveredPoint.headAge}
                          y={hoveredPoint.preparedFill}
                          r={4}
                          fill={CHART_COLORS.remainingIncome}
                          stroke="#fff"
                          strokeWidth={2}
                          ifOverflow="hidden"
                        />
                      )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="sim-align-gap" aria-hidden="true" />
              <aside className="sim-align-sidebar lifetime-chart-sidebar">
                <NeedChartSidebar
                  nowSweep={nowSweep}
                  preparedLabels={preparedLabels}
                  chartLegendItems={legendItems}
                  visible={visible}
                  onVisibleChange={setVisible}
                  balanceLegend={balanceLegend}
                  onBalanceLegendChange={setBalanceLegend}
                />
              </aside>
            </div>
          </div>
      )}
    </section>
  );
}
