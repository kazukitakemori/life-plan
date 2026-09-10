import { useEffect, useMemo, useRef, useState } from 'react';

import {
  buildLifetimeBalanceChartData,
  createDefaultLifetimeChartIncomeVisibility,
  createDefaultLifetimeChartVisibleSeries,
  getLifetimeChartTickAges,
  getVisibleHeadAgeRange,
  resolveActiveBalanceLineMode,
  resolveLifetimeChartAxisDomain,
  resolveLifetimeChartScaleMode,
  sliceLifetimeChartPoints,
} from '../../lib/lifetimeBalanceChartData';
import type { BuildLifeEventTimelineInput } from '../../lib/lifeEventTimelineData';
import { useShellFullscreen } from '../layout/ShellFullscreenContext';
import { LifeEventTimelineRows } from './LifeEventTimeline';
import {
  LifetimeChartGridRow,
  LifetimeChartHeader,
  LifetimeChartSidebar,
  type LifetimeChartCashFlowBarFocus,
  type LifetimeChartYAxisMaxMode,
} from './LifetimeBalanceSimulationChart';
import {
  LifetimeSummaryTable,
  type LifetimeSummaryYear,
} from './LifetimeSummaryTable';

export type SimulationBelowChartView = 'table' | 'timeline';

export const SIMULATION_BELOW_CHART_VIEWS: {
  id: SimulationBelowChartView;
  label: string;
}[] = [
  { id: 'table', label: '収支サマリー' },
  { id: 'timeline', label: 'タイムライン' },
];

export interface LifetimeSimulationPanelProps extends BuildLifeEventTimelineInput {
  showHeader?: boolean;
  belowChartView?: SimulationBelowChartView;
  onBelowChartViewChange?: (view: SimulationBelowChartView) => void;
}

export function LifetimeSimulationPanel({
  cashFlowData,
  familyMembers,
  incomeByMember,
  pensionByMember,
  livingState,
  educationByMember,
  lifeEventState,
  referenceDate,
  secondLifeState = null,
  showHeader = true,
  belowChartView = 'table',
  onBelowChartViewChange,
}: LifetimeSimulationPanelProps) {
  const { isFullscreen, enterFullscreen } = useShellFullscreen();
  const chartData = useMemo(
    () => buildLifetimeBalanceChartData(cashFlowData),
    [cashFlowData],
  );
  const [visibleSeries, setVisibleSeries] = useState(() =>
    createDefaultLifetimeChartVisibleSeries(),
  );
  const [incomeSeriesVisibility, setIncomeSeriesVisibility] = useState(() =>
    createDefaultLifetimeChartIncomeVisibility(),
  );
  const [cashFlowBarFocus, setCashFlowBarFocus] =
    useState<LifetimeChartCashFlowBarFocus>('expense');
  const [yAxisMaxMode, setYAxisMaxMode] =
    useState<LifetimeChartYAxisMaxMode>('auto');
  const [manualYAxisMax, setManualYAxisMax] = useState(500);
  const [windowStart, setWindowStart] = useState(0);
  const [windowEnd, setWindowEnd] = useState<number | null>(null);

  const showTimeline = isFullscreen && belowChartView === 'timeline';
  const wasFullscreenRef = useRef(isFullscreen);

  useEffect(() => {
    const wasFullscreen = wasFullscreenRef.current;
    wasFullscreenRef.current = isFullscreen;

    // 全画面終了時のみ表に戻す（タイムライン選択直後の未全画面状態では戻さない）
    if (wasFullscreen && !isFullscreen && belowChartView === 'timeline') {
      onBelowChartViewChange?.('table');
    }
  }, [isFullscreen, belowChartView, onBelowChartViewChange]);

  useEffect(() => {
    if (belowChartView !== 'timeline') return;
    if (isFullscreen) return;

    let cancelled = false;
    void (async () => {
      const entered = await enterFullscreen();
      if (cancelled) return;
      if (!entered) onBelowChartViewChange?.('table');
    })();

    return () => {
      cancelled = true;
    };
  }, [
    belowChartView,
    isFullscreen,
    enterFullscreen,
    onBelowChartViewChange,
  ]);

  const endIndex = windowEnd ?? chartData.points.length;
  const visiblePoints = useMemo(
    () => sliceLifetimeChartPoints(chartData.points, windowStart, endIndex),
    [chartData.points, windowStart, endIndex],
  );
  const { minHeadAge, maxHeadAge } = useMemo(
    () => getVisibleHeadAgeRange(visiblePoints),
    [visiblePoints],
  );
  const tickAges = useMemo(
    () => getLifetimeChartTickAges(visiblePoints),
    [visiblePoints],
  );

  const autoYAxisMax = useMemo(() => {
    const balanceLineMode = resolveActiveBalanceLineMode(visibleSeries);
    const scaleMode = resolveLifetimeChartScaleMode(visibleSeries);
    return resolveLifetimeChartAxisDomain(
      visiblePoints,
      scaleMode,
      balanceLineMode,
      visibleSeries,
      null,
      cashFlowBarFocus === 'income' ? incomeSeriesVisibility : null,
    ).max;
  }, [visiblePoints, visibleSeries, cashFlowBarFocus, incomeSeriesVisibility]);

  const effectiveManualMax =
    yAxisMaxMode === 'manual' ? manualYAxisMax : null;

  const summaryYears = useMemo((): LifetimeSummaryYear[] => {
    const yearByCalendar = new Map(
      cashFlowData.years.map((year) => [year.calendarYear, year]),
    );
    return visiblePoints.flatMap((point) => {
      const year = yearByCalendar.get(point.calendarYear);
      if (!year) return [];
      return [
        {
          calendarYear: year.calendarYear,
          disposableIncome: year.disposableIncome,
          expenditure: year.expenditure,
          annualBalance: year.annualBalance,
        },
      ];
    });
  }, [cashFlowData.years, visiblePoints]);

  return (
    <div className="lifetime-simulation-panel">
      <div className="lifetime-simulation-unified" aria-label="生涯収支グラフ">
        <div className="lifetime-simulation-shell">
          <div className="lifetime-simulation-main">
            <LifetimeChartHeader
              showTitle={showHeader}
              canZoomIn={visiblePoints.length > 12}
              canZoomOut={windowStart > 0 || endIndex < chartData.points.length}
              showReset={windowStart > 0 || endIndex < chartData.points.length}
              onZoomIn={() => {
                const currentLength = endIndex - windowStart;
                const nextLength = Math.max(12, Math.floor(currentLength * 0.75));
                const center = windowStart + Math.floor(currentLength / 2);
                const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
                const nextEnd = Math.min(
                  chartData.points.length,
                  nextStart + nextLength,
                );
                setWindowStart(nextStart);
                setWindowEnd(nextEnd);
              }}
              onZoomOut={() => {
                const currentLength = endIndex - windowStart;
                const nextLength = Math.min(
                  chartData.points.length,
                  Math.ceil(currentLength * 1.35),
                );
                const center = windowStart + Math.floor(currentLength / 2);
                const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
                const nextEnd = Math.min(
                  chartData.points.length,
                  nextStart + nextLength,
                );
                setWindowStart(nextStart);
                setWindowEnd(
                  nextEnd === chartData.points.length ? null : nextEnd,
                );
              }}
              onReset={() => {
                setWindowStart(0);
                setWindowEnd(null);
              }}
            />

            <div
              className={
                showTimeline
                  ? 'lifetime-simulation-scroll lifetime-simulation-scroll--split'
                  : 'lifetime-simulation-scroll lifetime-simulation-scroll--chart-fill'
              }
            >
              {showTimeline ? (
                <>
                  <div className="lifetime-simulation-pane lifetime-simulation-pane--chart">
                    <div className="lifetime-simulation-align lifetime-simulation-align--plot-only lifetime-simulation-align--fill">
                      <LifetimeChartGridRow
                        chartData={chartData}
                        visiblePoints={visiblePoints}
                        minHeadAge={minHeadAge}
                        maxHeadAge={maxHeadAge}
                        tickAges={tickAges}
                        visibleSeries={visibleSeries}
                        incomeSeriesVisibility={incomeSeriesVisibility}
                        cashFlowBarFocus={cashFlowBarFocus}
                        manualYAxisMax={effectiveManualMax}
                        fillAvailableHeight
                      />
                    </div>
                  </div>
                  <div className="lifetime-simulation-pane lifetime-simulation-pane--timeline">
                    <div className="lifetime-simulation-align lifetime-simulation-align--plot-only">
                      <LifeEventTimelineRows
                        cashFlowData={cashFlowData}
                        familyMembers={familyMembers}
                        incomeByMember={incomeByMember}
                        pensionByMember={pensionByMember}
                        livingState={livingState}
                        educationByMember={educationByMember}
                        lifeEventState={lifeEventState}
                        referenceDate={referenceDate}
                        secondLifeState={secondLifeState}
                        chartPoints={visiblePoints}
                        minHeadAge={minHeadAge}
                        maxHeadAge={maxHeadAge}
                        tickAges={tickAges}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="lifetime-simulation-align lifetime-simulation-align--plot-only lifetime-simulation-align--fill">
                  <LifetimeChartGridRow
                    chartData={chartData}
                    visiblePoints={visiblePoints}
                    minHeadAge={minHeadAge}
                    maxHeadAge={maxHeadAge}
                    tickAges={tickAges}
                    visibleSeries={visibleSeries}
                    incomeSeriesVisibility={incomeSeriesVisibility}
                    cashFlowBarFocus={cashFlowBarFocus}
                    manualYAxisMax={effectiveManualMax}
                    fillAvailableHeight
                  />
                </div>
              )}
            </div>

            {!showTimeline && <LifetimeSummaryTable years={summaryYears} />}
          </div>

          <LifetimeChartSidebar
            summary={chartData.summary}
            visibleSeries={visibleSeries}
            onVisibleSeriesChange={setVisibleSeries}
            incomeSeriesVisibility={incomeSeriesVisibility}
            onIncomeSeriesVisibilityChange={setIncomeSeriesVisibility}
            cashFlowBarFocus={cashFlowBarFocus}
            onCashFlowBarFocusChange={setCashFlowBarFocus}
            yAxisMaxMode={yAxisMaxMode}
            manualYAxisMax={manualYAxisMax}
            autoYAxisMax={autoYAxisMax}
            onYAxisMaxModeChange={(mode) => {
              if (mode === 'manual') {
                setManualYAxisMax(Math.max(1, Math.round(autoYAxisMax)));
              }
              setYAxisMaxMode(mode);
            }}
            onManualYAxisMaxChange={setManualYAxisMax}
          />
        </div>
      </div>
    </div>
  );
}
