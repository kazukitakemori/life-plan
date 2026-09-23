import { useEffect, useMemo, useState } from 'react';
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
  CHART_HEIGHT_FULLSCREEN,
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
import { useFullscreenPlotHeight } from '../layout/ShellFullscreenContext';

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

const MOBILE_CHART_MEDIA_QUERY = '(max-width: 768px)';

function useMobileChartLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_CHART_MEDIA_QUERY).matches
      : false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_CHART_MEDIA_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function limitTicks(ticks: number[], maxTicks: number): number[] {
  if (ticks.length <= maxTicks) return ticks;
  if (maxTicks <= 1) return [ticks[0]];

  const result: number[] = [];
  const lastIndex = ticks.length - 1;

  for (let index = 0; index < maxTicks; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (maxTicks - 1));
    const value = ticks[sourceIndex];
    if (result[result.length - 1] !== value) result.push(value);
  }

  return result;
}

function PensionLegend({
  visible,
  onToggle,
}: {
  visible: Record<SeriesKey, boolean>;
  onToggle: (key: SeriesKey) => void;
}) {
  return (
    <ul className="education-chart-legend pension-chart-legend">
      {SERIES.map((item) => (
        <li
          key={item.key}
          className={`education-chart-legend-item pension-chart-legend-item${visible[item.key] ? '' : ' is-hidden'}`}
        >
          <label className="pension-chart-legend-toggle">
            <input
              type="checkbox"
              checked={visible[item.key]}
              onChange={() => onToggle(item.key)}
            />
            <span
              className="education-chart-legend-icon education-chart-legend-icon--bar"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="education-chart-legend-label">{item.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

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
  const isMobile = useMobileChartLayout();

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

  const chartPoints = useMemo(
    () => points.filter((point) => point.headAge >= 60),
    [points],
  );

  const {
    visiblePoints,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useCoverageChartWindow(chartPoints);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const tickAges = useMemo(() => {
    const ticks = getTickAges(visiblePoints);
    return isMobile ? limitTicks(ticks, 7) : ticks;
  }, [visiblePoints, isMobile]);
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
  const plotHeight = useFullscreenPlotHeight(
    isMobile ? 360 : CHART_HEIGHT,
    CHART_HEIGHT_FULLSCREEN,
  );
  const seriesByKey = new Map(SERIES.map((item) => [item.key, item]));

  const toggleSeries = (key: SeriesKey) => {
    setVisible((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <section
      className="pension-estimate-panel education-chart-card pension-chart-card"
      aria-label="年金試算結果"
    >
      <div className="pension-chart-title-row">
        <h3 className="education-chart-title pension-chart-title">
          老齢年金のグラフ
        </h3>
        <div className="pension-chart-desktop-controls">
          <CoverageChartZoomToolbar
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
          />
        </div>
      </div>

      {isMobile && (
        <div className="pension-chart-mobile-summary">
          <PensionLegend visible={visible} onToggle={toggleSeries} />
          <div className="pension-chart-mobile-meta">
            <span>横軸：年齢（60歳以降）</span>
            <span>縦軸：年額（万円）</span>
          </div>
          <p className="pension-chart-mobile-hint">
            グラフをタップすると西暦・年齢・年金額の詳細を確認できます
          </p>
        </div>
      )}

      <div className="education-chart-container pension-chart-container">
        <ResponsiveContainer width="100%" height={plotHeight + xAxisHeight}>
          <ComposedChart
            data={visiblePoints}
            barCategoryGap={getSimulationBarCategoryGapPx(
              visiblePoints.length,
            )}
            barGap={0}
            maxBarSize={EXPENSE_BAR_MAX_SIZE}
            margin={
              isMobile
                ? {
                    top: 8,
                    right: 0,
                    left: 0,
                    bottom: xAxisHeight,
                  }
                : {
                    top: CHART_MARGIN_TOP,
                    right: SIMULATION_CHART_MARGIN_RIGHT,
                    left: 0,
                    bottom: xAxisHeight,
                  }
            }
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isMobile ? '#cbd5e1' : '#e5e7eb'}
              vertical={!isMobile}
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
              stroke="#94a3b8"
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
              fontSize={isMobile ? 11 : 13}
              width={isMobile ? 38 : CHART_MARGIN_LEFT}
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
            {STACK_ORDER.map((key, index) => {
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
                  radius={
                    index === STACK_ORDER.length - 1
                      ? [2, 2, 0, 0]
                      : [0, 0, 0, 0]
                  }
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!isMobile && (
        <PensionLegend visible={visible} onToggle={toggleSeries} />
      )}
    </section>
  );}
