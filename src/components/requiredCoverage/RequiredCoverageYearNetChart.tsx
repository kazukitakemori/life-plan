import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
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
} from '../../lib/lifetimeBalanceChartData';
import type { RequiredCoverageChartPoint } from '../../lib/requiredCoverage';
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
  DualAgeAxisTick,
  EXPENSE_BAR_MAX_SIZE,
  formatAxisMan,
  formatTooltipMan,
  getTickAges,
  niceAxisMax,
  niceAxisMin,
  useCoverageChartWindow,
  xAxisTotalHeight,
} from './requiredCoverageChartShared';

interface RequiredCoverageYearNetChartProps {
  points: RequiredCoverageChartPoint[];
  hasSpouse: boolean;
}

function YearNetTooltip({
  active,
  label,
  payload,
  points,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: RequiredCoverageChartPoint }>;
  points: RequiredCoverageChartPoint[];
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.calendarYear}年（{point.headAge}歳）
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">
        <p className="lifetime-chart-tooltip-row lifetime-chart-tooltip-row--emphasis">
          <span
            className="lifetime-chart-tooltip-swatch"
            style={{
              backgroundColor:
                point.yearNet >= 0
                  ? CHART_COLORS.yearNet
                  : CHART_COLORS.yearNetDeficit,
            }}
          />
          <span>年間収支</span>
          <span>{formatTooltipMan(point.yearNet)}</span>
        </p>
      </div>
    </div>
  );
}

export function RequiredCoverageYearNetChart({
  points,
  hasSpouse,
}: RequiredCoverageYearNetChartProps) {
  const {
    visiblePoints,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useCoverageChartWindow(points);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const tickAges = useMemo(() => getTickAges(visiblePoints), [visiblePoints]);
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisDomain = useMemo(() => {
    let peak = 0;
    let floor = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, point.yearNet, 0);
      floor = Math.min(floor, point.yearNet, 0);
    }
    return { min: niceAxisMin(floor), max: niceAxisMax(peak) };
  }, [visiblePoints]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);

  if (points.length === 0) return null;

  return (
    <section
      className="required-coverage-chart-card"
      aria-labelledby="required-coverage-year-net-chart-heading"
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3
            id="required-coverage-year-net-chart-heading"
            className="lifetime-chart-title"
          >
            万一後の年間収支
          </h3>
          <p className="required-coverage-chart-zero-note">
            黒字は緑、赤字は赤の棒です。住宅ローンは残債の一括ではなく、その年の返済額だけを支出に含みます。
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
            <ResponsiveContainer width="100%" height={CHART_HEIGHT + xAxisHeight}>
              <ComposedChart
                data={visiblePoints}
                barCategoryGap={getSimulationBarCategoryGapPx(
                  visiblePoints.length,
                )}
                barGap={0}
                maxBarSize={EXPENSE_BAR_MAX_SIZE}
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
                    <YearNetTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: RequiredCoverageChartPoint;
                        }>
                      }
                      points={visiblePoints}
                    />
                  )}
                />
                <Bar
                  yAxisId="main"
                  dataKey="yearNet"
                  name="年間収支"
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                >
                  {visiblePoints.map((point) => (
                    <Cell
                      key={point.headAge}
                      fill={
                        point.yearNet >= 0
                          ? CHART_COLORS.yearNet
                          : CHART_COLORS.yearNetDeficit
                      }
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="sim-align-gap" aria-hidden="true" />
          <aside className="sim-align-sidebar lifetime-chart-sidebar">
            <div className="lifetime-chart-legend-panel">
              <h3 className="lifetime-chart-legend-title">凡例</h3>
              <ul className="lifetime-chart-legend">
                <li className="lifetime-chart-legend-item">
                  <span className="lifetime-chart-legend-toggle">
                    <span
                      className="lifetime-chart-legend-icon lifetime-chart-legend-icon--bar lifetime-chart-legend-icon--net-fill"
                      aria-hidden
                    />
                    <span className="lifetime-chart-legend-label">
                      年間収支
                    </span>
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
