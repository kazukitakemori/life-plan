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
  buildPensionBenefitChartPoints,
  type PensionBenefitChartPoint,
} from '../../lib/pensionBenefitChartData';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import type { FamilyMember } from '../../types/family';
import type { IncomeEntry } from '../../types/income';
import type { PensionMemberState } from '../../types/pension';
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

interface PensionBenefitEstimatePanelProps {
  member: FamilyMember;
  memberState: PensionMemberState;
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
}

type SeriesKey =
  | 'oldAgeBasic'
  | 'oldAgeEmployeesGeneral'
  | 'oldAgeEmployeesPublic';

interface SeriesItem {
  key: SeriesKey;
  label: string;
  color: string;
}

/**
 * 凡例の上→下＝グラフの上→下。
 * （積み上げは STACK_ORDER で反転し、老齢基礎が底になる）
 */
const SERIES: SeriesItem[] = [
  {
    key: 'oldAgeEmployeesPublic',
    label: '老齢厚生年金（公務員・私学）',
    color: '#c47a3a',
  },
  {
    key: 'oldAgeEmployeesGeneral',
    label: '老齢厚生年金（一般）',
    color: '#8b7fd4',
  },
  { key: 'oldAgeBasic', label: '老齢基礎年金', color: '#4db8b8' },
];

/** Recharts は先頭が底。凡例上→下と同じ見た目になるよう下→上に積む */
const STACK_ORDER: SeriesKey[] = [...SERIES.map((item) => item.key)].reverse();

function allVisible(): Record<SeriesKey, boolean> {
  return {
    oldAgeBasic: true,
    oldAgeEmployeesGeneral: true,
    oldAgeEmployeesPublic: true,
  };
}

function noneVisible(): Record<SeriesKey, boolean> {
  return {
    oldAgeBasic: false,
    oldAgeEmployeesGeneral: false,
    oldAgeEmployeesPublic: false,
  };
}

function stackTotal(
  point: PensionBenefitChartPoint,
  visible: Record<SeriesKey, boolean>,
): number {
  let total = 0;
  for (const item of SERIES) {
    if (visible[item.key]) total += point[item.key];
  }
  return total;
}

function PensionBenefitTooltip({
  active,
  label,
  payload,
  points,
  visible,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: PensionBenefitChartPoint }>;
  points: PensionBenefitChartPoint[];
  visible: Record<SeriesKey, boolean>;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point = fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;

  const rows = SERIES.filter(
    (item) => visible[item.key] && point[item.key] !== 0,
  );
  const total = rows.reduce((sum, item) => sum + point[item.key], 0);
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

export function PensionBenefitEstimatePanel({
  member,
  memberState,
  incomeEntries,
  referenceDate,
}: PensionBenefitEstimatePanelProps) {
  const [visible, setVisible] =
    useState<Record<SeriesKey, boolean>>(allVisible);

  const points = useMemo(
    () =>
      buildPensionBenefitChartPoints({
        member,
        memberState,
        incomeEntries,
        referenceDate,
      }),
    [member, memberState, incomeEntries, referenceDate],
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
      peak = Math.max(peak, stackTotal(point, visible));
    }
    return niceAxisMax(peak);
  }, [visiblePoints, visible]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(0, axisMax),
    [axisMax],
  );
  const xAxisHeight = xAxisTotalHeight(1);
  const seriesByKey = new Map(SERIES.map((item) => [item.key, item]));

  return (
    <section className="pension-estimate-panel" aria-label="年金試算結果">
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 className="lifetime-chart-title">試算結果（老齢年金・年齢別）</h3>
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
                    <PensionBenefitTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: PensionBenefitChartPoint;
                        }>
                      }
                      points={visiblePoints}
                      visible={visible}
                    />
                  )}
                />
                {STACK_ORDER.map((key) => {
                  const item = seriesByKey.get(key);
                  if (!item) return null;
                  return (
                    <Bar
                      key={key}
                      yAxisId="main"
                      dataKey={key}
                      name={item.label}
                      stackId="pension"
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
                {SERIES.map((item) => {
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
