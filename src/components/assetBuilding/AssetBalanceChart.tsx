import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  buildBalanceLinePoints,
  formatLifetimeTotalMan,
  getLifetimeChartPlotAgeDomain,
  getLifetimeChartYTicks,
  LIFETIME_CHART_BALANCE_LINE_LABELS,
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import { SIMULATION_CHART_MARGIN_RIGHT } from '../../lib/simulationLayout';
import {
  ASSET_CHART_COLORS,
  ASSET_CHART_MARGIN_LEFT,
  ASSET_CHART_MARGIN_TOP,
  ASSET_LINE_X_AXIS_ID,
  ASSET_SAVINGS_CHART_HEIGHT,
  ASSET_SAVINGS_CHART_HEIGHT_FULLSCREEN,
  AssetChartSummaryPanel,
  AssetChartTooltipShell,
  AssetChartYAxisMaxPanel,
  AssetChartZoomToolbar,
  AssetTooltipRow,
  DualAgeAxisTick,
  formatAxisMan,
  niceAxisMax,
  niceAxisMin,
  resolveSignedAssetChartAxisDomain,
  signedAssetChartAutoAxisMax,
  useAssetChartWindow,
  useAssetChartYAxisMax,
  xAxisTotalHeight,
} from './assetBuildingChartShared';
import { useFullscreenPlotHeight } from '../layout/ShellFullscreenContext';

interface AssetBalanceChartProps {
  points: LifetimeBalanceChartPoint[];
  hasSpouse: boolean;
}

function BalanceTooltip({
  active,
  label,
  payload,
  points,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    payload?: LifetimeBalanceChartPoint;
  }>;
  points: LifetimeBalanceChartPoint[];
}) {
  if (!active) return null;

  const fromPayload = payload?.find((item) => {
    const age = item.payload?.headAge;
    return typeof age === 'number' && Number.isInteger(age);
  })?.payload;

  const roundedAge =
    typeof label === 'number' ? Math.round(label) : undefined;
  const point =
    fromPayload ??
    (roundedAge != null
      ? points.find((row) => row.headAge === roundedAge)
      : undefined);

  if (!point) return null;
  return renderBalanceTooltip(point);
}

function renderBalanceTooltip(point: LifetimeBalanceChartPoint) {
  return (
    <AssetChartTooltipShell
      calendarYear={point.calendarYear}
      headAge={point.headAge}
      spouseAge={point.spouseAge}
    >
      <AssetTooltipRow
        color={
          point.financialAssets >= 0
            ? ASSET_CHART_COLORS.financialAssets
            : ASSET_CHART_COLORS.financialAssetsNegative
        }
        label={LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets}
        value={point.financialAssets}
        emphasis
      />
      <AssetTooltipRow
        color={
          point.depositBalance >= 0
            ? ASSET_CHART_COLORS.depositBalance
            : ASSET_CHART_COLORS.depositBalanceNegative
        }
        label={LIFETIME_CHART_BALANCE_LINE_LABELS.deposit}
        value={point.depositBalance}
      />
    </AssetChartTooltipShell>
  );
}

export function AssetBalanceChart({
  points,
  hasSpouse,
}: AssetBalanceChartProps) {
  const {
    visiblePoints,
    tickAges,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useAssetChartWindow(points);

  const financialLinePoints = useMemo(
    () => buildBalanceLinePoints(visiblePoints, 'financialAssets'),
    [visiblePoints],
  );
  const depositLinePoints = useMemo(
    () => buildBalanceLinePoints(visiblePoints, 'deposit'),
    [visiblePoints],
  );

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const autoAxis = useMemo(() => {
    let peak = 0;
    let floor = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, point.financialAssets, point.depositBalance, 0);
      floor = Math.min(floor, point.financialAssets, point.depositBalance, 0);
    }
    return { min: niceAxisMin(floor), max: niceAxisMax(peak) };
  }, [visiblePoints]);
  const autoControlMax = useMemo(
    () => signedAssetChartAutoAxisMax(autoAxis.min, autoAxis.max),
    [autoAxis.min, autoAxis.max],
  );
  const {
    yAxisMaxMode,
    manualYAxisMax,
    axisMax,
    setYAxisMaxMode,
    setManualYAxisMax,
  } = useAssetChartYAxisMax(autoControlMax);
  const axisDomain = useMemo(
    () =>
      resolveSignedAssetChartAxisDomain(
        autoAxis.min,
        autoAxis.max,
        yAxisMaxMode,
        axisMax,
      ),
    [autoAxis.min, autoAxis.max, yAxisMaxMode, axisMax],
  );
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const plotHeight = useFullscreenPlotHeight(
    ASSET_SAVINGS_CHART_HEIGHT,
    ASSET_SAVINGS_CHART_HEIGHT_FULLSCREEN,
  );
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const [captureRenderReady, setCaptureRenderReady] = useState(false);

  useEffect(() => {
    const element = plotContainerRef.current;
    if (!element) return;

    let firstFrame = 0;
    let secondFrame = 0;
    const markReadyAfterLayout = () => {
      setCaptureRenderReady(false);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          setCaptureRenderReady(true);
        });
      });
    };

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      markReadyAfterLayout();
    });
    observer.observe(element);

    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) markReadyAfterLayout();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [visiblePoints, plotHeight, xAxisHeight]);
  const summaryRows = useMemo(() => {
    if (visiblePoints.length === 0) return [];

    let minCashPoint = visiblePoints[0];
    for (const point of visiblePoints) {
      const cash = point.depositBalance;
      const bestCash = minCashPoint.depositBalance;
      if (cash < bestCash) {
        minCashPoint = point;
        continue;
      }
      if (cash === bestCash) {
        const invest = point.financialAssets - point.depositBalance;
        const bestInvest =
          minCashPoint.financialAssets - minCashPoint.depositBalance;
        if (invest > bestInvest) minCashPoint = point;
      }
    }

    const investedAssets =
      minCashPoint.financialAssets - minCashPoint.depositBalance;

    return [
      {
        label: '最小現金・預金',
        value: formatLifetimeTotalMan(minCashPoint.depositBalance),
      },
      {
        label: '同時点の運用分',
        value: formatLifetimeTotalMan(investedAssets),
      },
    ];
  }, [visiblePoints]);

  if (points.length === 0) return null;

  return (
    <section
      className="asset-building-chart-card"
      aria-labelledby="asset-balance-chart-heading"
      data-content-capture-target="asset-balance-chart"
      data-content-capture-render-status={
        captureRenderReady ? 'ready' : 'pending'
      }
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 id="asset-balance-chart-heading" className="lifetime-chart-title">
            残高
          </h3>
          <p className="asset-building-chart-note">
            金融資産残高と現金・預金残高の年末値です。黒字は緑／紺、赤字は赤です。
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
          <div
            ref={plotContainerRef}
            className="sim-align-plot lifetime-chart-plot"
          >
            <p className="lifetime-chart-y-unit" aria-hidden>
              （万円）
            </p>
            <ResponsiveContainer
              width="100%"
              height={plotHeight + xAxisHeight}
            >
              <ComposedChart
                data={visiblePoints}
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
                    <BalanceTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          dataKey?: string | number;
                          payload?: LifetimeBalanceChartPoint;
                        }>
                      }
                      points={visiblePoints}
                    />
                  )}
                />
                <Line
                  xAxisId={ASSET_LINE_X_AXIS_ID}
                  yAxisId="main"
                  data={financialLinePoints}
                  type="stepAfter"
                  dataKey="balancePositive"
                  name={LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets}
                  stroke={ASSET_CHART_COLORS.financialAssets}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Line
                  xAxisId={ASSET_LINE_X_AXIS_ID}
                  yAxisId="main"
                  data={financialLinePoints}
                  type="stepAfter"
                  dataKey="balanceNegative"
                  name={LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets}
                  stroke={ASSET_CHART_COLORS.financialAssetsNegative}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Line
                  xAxisId={ASSET_LINE_X_AXIS_ID}
                  yAxisId="main"
                  data={depositLinePoints}
                  type="stepAfter"
                  dataKey="balancePositive"
                  name={LIFETIME_CHART_BALANCE_LINE_LABELS.deposit}
                  stroke={ASSET_CHART_COLORS.depositBalance}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Line
                  xAxisId={ASSET_LINE_X_AXIS_ID}
                  yAxisId="main"
                  data={depositLinePoints}
                  type="stepAfter"
                  dataKey="balanceNegative"
                  name={LIFETIME_CHART_BALANCE_LINE_LABELS.deposit}
                  stroke={ASSET_CHART_COLORS.depositBalanceNegative}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="sim-align-gap" aria-hidden="true" />
          <aside className="sim-align-sidebar lifetime-chart-sidebar">
            <AssetChartSummaryPanel title="表示期間" rows={summaryRows} />
            <AssetChartYAxisMaxPanel
              yAxisMaxMode={yAxisMaxMode}
              manualYAxisMax={manualYAxisMax}
              autoYAxisMax={autoControlMax}
              onYAxisMaxModeChange={setYAxisMaxMode}
              onManualYAxisMaxChange={setManualYAxisMax}
              title="Y軸の表示幅"
              ariaLabel="Y軸表示幅の設定"
            />
            <div className="lifetime-chart-legend-panel">
              <h3 className="lifetime-chart-legend-title">凡例</h3>
              <ul className="lifetime-chart-legend">
                <li className="lifetime-chart-legend-item">
                  <span className="lifetime-chart-legend-toggle">
                    <span
                      className="lifetime-chart-legend-icon lifetime-chart-legend-icon--step"
                      style={{
                        backgroundColor: ASSET_CHART_COLORS.financialAssets,
                      }}
                      aria-hidden
                    />
                    <span className="lifetime-chart-legend-label">
                      {LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets}
                    </span>
                  </span>
                </li>
                <li className="lifetime-chart-legend-item">
                  <span className="lifetime-chart-legend-toggle">
                    <span
                      className="lifetime-chart-legend-icon lifetime-chart-legend-icon--step"
                      style={{
                        backgroundColor: ASSET_CHART_COLORS.depositBalance,
                      }}
                      aria-hidden
                    />
                    <span className="lifetime-chart-legend-label">
                      {LIFETIME_CHART_BALANCE_LINE_LABELS.deposit}
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
