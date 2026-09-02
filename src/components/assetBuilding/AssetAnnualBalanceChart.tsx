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
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import {
  ASSET_CHART_COLORS,
  ASSET_CHART_HEIGHT,
  ASSET_CHART_MARGIN_LEFT,
  ASSET_CHART_MARGIN_TOP,
  ASSET_EXPENSE_BAR_MAX_SIZE,
  AssetChartTooltipShell,
  AssetChartZoomToolbar,
  AssetTooltipRow,
  DualAgeAxisTick,
  formatAxisMan,
  niceAxisMax,
  niceAxisMin,
  useAssetChartWindow,
  xAxisTotalHeight,
} from './assetBuildingChartShared';

interface AssetAnnualBalanceChartProps {
  points: LifetimeBalanceChartPoint[];
  hasSpouse: boolean;
}

function AnnualBalanceTooltip({
  active,
  label,
  payload,
  points,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: LifetimeBalanceChartPoint }>;
  points: LifetimeBalanceChartPoint[];
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  return (
    <AssetChartTooltipShell
      calendarYear={point.calendarYear}
      headAge={point.headAge}
      spouseAge={point.spouseAge}
    >
      <AssetTooltipRow
        color={
          point.annualBalance >= 0
            ? ASSET_CHART_COLORS.annualBalance
            : ASSET_CHART_COLORS.annualBalanceDeficit
        }
        label="年間収支"
        value={point.annualBalance}
        emphasis
      />
    </AssetChartTooltipShell>
  );
}

export function AssetAnnualBalanceChart({
  points,
  hasSpouse,
}: AssetAnnualBalanceChartProps) {
  const {
    visiblePoints,
    tickAges,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useAssetChartWindow(points);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisDomain = useMemo(() => {
    let peak = 0;
    let floor = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, point.annualBalance, 0);
      floor = Math.min(floor, point.annualBalance, 0);
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
      className="asset-building-chart-card"
      aria-labelledby="asset-annual-balance-chart-heading"
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3
            id="asset-annual-balance-chart-heading"
            className="lifetime-chart-title"
          >
            年間収支
          </h3>
          <p className="asset-building-chart-note">
            黒字は緑、赤字は赤の棒です。
          </p>
        </div>
        <AssetChartZoomToolbar
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={reset}
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
                    <AnnualBalanceTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: LifetimeBalanceChartPoint;
                        }>
                      }
                      points={visiblePoints}
                    />
                  )}
                />
                <Bar
                  yAxisId="main"
                  dataKey="annualBalance"
                  name="年間収支"
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                >
                  {visiblePoints.map((point) => (
                    <Cell
                      key={point.headAge}
                      fill={
                        point.annualBalance >= 0
                          ? ASSET_CHART_COLORS.annualBalance
                          : ASSET_CHART_COLORS.annualBalanceDeficit
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
