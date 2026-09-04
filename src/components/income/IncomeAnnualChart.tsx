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
} from '../../lib/lifetimeBalanceChartData';
import {
  buildIncomeChartPoints,
  INCOME_CHART_SERIES,
  INCOME_CHART_STACK_ORDER,
  sumIncomeChartPoint,
  type IncomeChartPoint,
  type IncomeChartSeriesKey,
} from '../../lib/incomeChartData';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember } from '../../types/income';
import {
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
  useCoverageChartWindow,
  xAxisTotalHeight,
} from '../requiredCoverage/requiredCoverageChartShared';

interface IncomeAnnualChartProps {
  member: FamilyMember;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  referenceDate: Date;
}

type SeriesVisibility = Record<IncomeChartSeriesKey, boolean>;

function allVisible(): SeriesVisibility {
  return {
    salary: true,
    bonus: true,
    business: true,
    retirementAllowance: true,
    other: true,
  };
}

function noneVisible(): SeriesVisibility {
  return {
    salary: false,
    bonus: false,
    business: false,
    retirementAllowance: false,
    other: false,
  };
}

function IncomeChartTooltip({
  active,
  label,
  payload,
  points,
  visible,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: IncomeChartPoint }>;
  points: IncomeChartPoint[];
  visible: SeriesVisibility;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point = fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;

  const rows = INCOME_CHART_SERIES.filter(
    (item) => visible[item.key] && point[item.key] !== 0,
  );
  const total = sumIncomeChartPoint(point, visible);
  if (rows.length === 0 && total === 0) return null;

  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.calendarYear}年（{point.headAge}歳）
      </p>
      <div className="lifetime-chart-tooltip-body">
        {rows.map((item) => (
          <p key={item.key} className="lifetime-chart-tooltip-row">
            <span
              className="lifetime-chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
            <span>{formatTooltipMan(point[item.key])}</span>
          </p>
        ))}
        <p className="lifetime-chart-tooltip-row lifetime-chart-tooltip-row--emphasis">
          <span className="lifetime-chart-tooltip-swatch" />
          <span>合計</span>
          <span>{formatTooltipMan(total)}</span>
        </p>
      </div>
    </div>
  );
}

export function IncomeAnnualChart({
  member,
  familyMembers,
  incomeByMember,
  referenceDate,
}: IncomeAnnualChartProps) {
  const [visible, setVisible] = useState<SeriesVisibility>(allVisible);

  const points = useMemo(
    () =>
      buildIncomeChartPoints({
        member,
        familyMembers,
        incomeByMember,
        referenceDate,
      }),
    [member, familyMembers, incomeByMember, referenceDate],
  );

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
  const tickAges = useMemo(
    () => getTickAges(visiblePoints),
    [visiblePoints],
  );
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisMax = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, sumIncomeChartPoint(point, visible));
    }
    return niceAxisMax(peak);
  }, [visiblePoints, visible]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(0, axisMax),
    [axisMax],
  );
  const xAxisHeight = xAxisTotalHeight(1);
  const seriesByKey = new Map(
    INCOME_CHART_SERIES.map((item) => [item.key, item]),
  );

  return (
    <section className="income-annual-chart" aria-label="年収の推移">
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 className="lifetime-chart-title">年収の推移（額面）</h3>
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
                  domain={[0, axisMax]}
                />
                <ReferenceLine
                  yAxisId="main"
                  y={0}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <Tooltip
                  content={(props) => (
                    <IncomeChartTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: IncomeChartPoint;
                        }>
                      }
                      points={visiblePoints}
                      visible={visible}
                    />
                  )}
                />
                {INCOME_CHART_STACK_ORDER.map((key) => {
                  const item = seriesByKey.get(key);
                  if (!item) return null;
                  return (
                    <Bar
                      key={key}
                      yAxisId="main"
                      dataKey={key}
                      name={item.label}
                      stackId="income"
                      fill={item.color}
                      hide={!visible[key]}
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
                  onClick={() => setVisible(allVisible())}
                >
                  全表示
                </button>
                <button
                  type="button"
                  className="lifetime-chart-legend-bulk-btn"
                  onClick={() => setVisible(noneVisible())}
                >
                  全解除
                </button>
              </div>
              <ul className="lifetime-chart-legend">
                {INCOME_CHART_SERIES.map((item) => {
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
                            setVisible((current) => ({
                              ...current,
                              [item.key]: !current[item.key],
                            }))
                          }
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
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
