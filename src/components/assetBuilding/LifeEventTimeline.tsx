import { Fragment, useMemo } from 'react';

import type { LifetimeBalanceChartPoint } from '../../lib/lifetimeBalanceChartData';
import { getLifetimeChartPlotAgeDomain } from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_TIMELINE_TRACK_PADDING_STYLE,
  resolveTimelineHeadAgeFromChart,
  resolveTimelinePlotHeadAge,
} from '../../lib/simulationLayout';
import {
  buildLifeEventTimelineData,
  clipTimelineItemToRange,
  getTimelineSpanPercent,
  headAgeToPercent,
  type BuildLifeEventTimelineInput,
  type LifeEventTimelineItem,
  type TimelineOccurrence,
} from '../../lib/lifeEventTimelineData';

const TRACK_LANE_HEIGHT = 34;
const TRACK_LANE_GAP = 8;
const TRACK_TOP_PADDING = 6;
/** 支出マーカーの大きさ（相対額で変化させる範囲） */
const MARKER_SIZE_MIN = 5;
const MARKER_SIZE_MAX = 8;

interface LifeEventTimelineRowsProps extends BuildLifeEventTimelineInput {
  chartPoints: LifetimeBalanceChartPoint[];
  minHeadAge: number;
  maxHeadAge: number;
  tickAges: number[];
}

function formatOccurrenceAmount(amountMan: number): string {
  return `${Math.round(amountMan).toLocaleString('ja-JP')}万円`;
}

function TimelineItemCard({ item }: { item: LifeEventTimelineItem }) {
  return (
    <div className={`life-event-item life-event-item--${item.style}`}>
      <span className="life-event-item-icon" aria-hidden>
        {item.icon}
      </span>
      <div className="life-event-item-text">
        <span className="life-event-item-title">{item.title}</span>
        {item.detail && (
          <span className="life-event-item-detail">{item.detail}</span>
        )}
      </div>
    </div>
  );
}

function markerSizeForAmount(amountMan: number, maxAmount: number): number {
  if (maxAmount <= 0) return MARKER_SIZE_MIN;
  const ratio = Math.min(1, Math.max(0, amountMan / maxAmount));
  return MARKER_SIZE_MIN + (MARKER_SIZE_MAX - MARKER_SIZE_MIN) * ratio;
}

function resolveOccurrenceHeadAge(
  occurrence: TimelineOccurrence,
  chartPoints: LifetimeBalanceChartPoint[],
): number {
  return resolveTimelineHeadAgeFromChart(
    occurrence.calendarYear,
    occurrence.headAge,
    chartPoints,
  );
}

function TimelineOccurrenceSeries({
  item,
  chartPoints,
  plotMinHeadAge,
  plotMaxHeadAge,
  top,
}: {
  item: LifeEventTimelineItem;
  chartPoints: LifetimeBalanceChartPoint[];
  plotMinHeadAge: number;
  plotMaxHeadAge: number;
  top: number;
}) {
  const occurrences = item.occurrences ?? [];
  if (occurrences.length === 0) return null;

  const maxAmount = Math.max(...occurrences.map((row) => row.amountMan), 0);
  const firstAge = resolveOccurrenceHeadAge(occurrences[0], chartPoints);
  const lastAge = resolveOccurrenceHeadAge(
    occurrences[occurrences.length - 1],
    chartPoints,
  );
  const span = getTimelineSpanPercent(
    firstAge,
    lastAge,
    plotMinHeadAge,
    plotMaxHeadAge,
    { endGap: false },
  );

  return (
    <div
      className={`life-event-series life-event-series--${item.style}`}
      style={{
        top,
        height: TRACK_LANE_HEIGHT,
      }}
    >
      <div
        className="life-event-series-label"
        style={{
          left: `${headAgeToPercent(firstAge, plotMinHeadAge, plotMaxHeadAge)}%`,
        }}
        title={
          item.detail
            ? `${item.title}（${item.detail}）・各丸が支出年`
            : `${item.title}・各丸が支出年`
        }
      >
        <TimelineItemCard
          item={{
            ...item,
            detail: undefined,
          }}
        />
      </div>

      {occurrences.length > 1 && (
        <div
          className="life-event-series-baseline"
          style={{
            left: `${span.left}%`,
            width: `${span.width}%`,
          }}
          aria-hidden
        />
      )}

      {occurrences.map((occurrence) => {
        const age = resolveOccurrenceHeadAge(occurrence, chartPoints);
        const size = markerSizeForAmount(occurrence.amountMan, maxAmount);
        return (
          <button
            key={`${item.id}-${occurrence.calendarYear}`}
            type="button"
            className="life-event-occurrence"
            style={{
              left: `${headAgeToPercent(age, plotMinHeadAge, plotMaxHeadAge)}%`,
              width: size,
              height: size,
            }}
            title={`${occurrence.calendarYear}年（${age}歳） ${formatOccurrenceAmount(occurrence.amountMan)}`}
            aria-label={`${item.title} ${occurrence.calendarYear}年 ${formatOccurrenceAmount(occurrence.amountMan)}`}
          />
        );
      })}
    </div>
  );
}

function TimelineSpanBar({
  item,
  chartPoints,
  plotMinHeadAge,
  plotMaxHeadAge,
  top,
}: {
  item: LifeEventTimelineItem;
  chartPoints: LifetimeBalanceChartPoint[];
  plotMinHeadAge: number;
  plotMaxHeadAge: number;
  top: number;
}) {
  const isMarker = item.startHeadAge === item.endHeadAge;
  const startHeadAge = isMarker
    ? resolveTimelinePlotHeadAge(item, chartPoints)
    : resolveTimelineHeadAgeFromChart(
        item.startCalendarYear,
        item.startHeadAge,
        chartPoints,
      );
  const endHeadAge = isMarker
    ? startHeadAge
    : resolveTimelineHeadAgeFromChart(
        item.endCalendarYear,
        item.endHeadAge,
        chartPoints,
      );
  const span = getTimelineSpanPercent(
    startHeadAge,
    endHeadAge,
    plotMinHeadAge,
    plotMaxHeadAge,
  );

  return (
    <div
      className={`life-event-span life-event-span--${item.style}${
        isMarker ? ' life-event-span--marker' : ' life-event-span--range'
      }`}
      style={{
        left: isMarker
          ? `${headAgeToPercent(startHeadAge, plotMinHeadAge, plotMaxHeadAge)}%`
          : `${span.left}%`,
        width: isMarker ? undefined : `${span.width}%`,
        top,
        height: TRACK_LANE_HEIGHT,
      }}
    >
      <TimelineItemCard item={item} />
    </div>
  );
}

export function LifeEventTimelineRows({
  minHeadAge,
  maxHeadAge,
  tickAges,
  cashFlowData,
  familyMembers,
  incomeByMember,
  pensionByMember,
  livingState,
  educationByMember,
  lifeEventState,
  referenceDate,
  chartPoints,
}: LifeEventTimelineRowsProps) {
  const timeline = useMemo(
    () =>
      buildLifeEventTimelineData({
        cashFlowData,
        familyMembers,
        incomeByMember,
        pensionByMember,
        livingState,
        educationByMember,
        lifeEventState,
        referenceDate,
      }),
    [
      cashFlowData,
      familyMembers,
      incomeByMember,
      pensionByMember,
      livingState,
      educationByMember,
      lifeEventState,
      referenceDate,
      chartPoints,
    ],
  );

  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );

  return (
    <>
      {timeline.categories.map((category) => {
        const visibleItems = category.items
          .map((item) => clipTimelineItemToRange(item, minHeadAge, maxHeadAge))
          .filter((item): item is LifeEventTimelineItem => item != null);

        const laneCount =
          visibleItems.length > 0
            ? Math.max(...visibleItems.map((item) => item.lane)) + 1
            : 1;
        const trackHeight =
          laneCount * TRACK_LANE_HEIGHT +
          (laneCount - 1) * TRACK_LANE_GAP +
          TRACK_TOP_PADDING * 2;

        const gridStepPercent =
          plotMaxHeadAge > plotMinHeadAge
            ? (5 / (plotMaxHeadAge - plotMinHeadAge)) * 100
            : 10;

        return (
          <Fragment key={category.id}>
            <div
              className={`sim-align-label life-event-label life-event-label--${category.tone}`}
            >
              {category.label}
            </div>

            <div
              className="life-event-track-wrap life-event-track-wrap--fill"
              style={{
                ...SIMULATION_TIMELINE_TRACK_PADDING_STYLE,
                ['--life-event-grid-step' as string]: `${gridStepPercent}%`,
              }}
            >
              <div className="life-event-track" style={{ minHeight: trackHeight }}>
                {tickAges.map((age) => (
                  <span
                    key={`${category.id}-grid-${age}`}
                    className="life-event-grid-line"
                    style={{
                      left: `${headAgeToPercent(age, plotMinHeadAge, plotMaxHeadAge)}%`,
                    }}
                    aria-hidden
                  />
                ))}

                {visibleItems.length === 0 ? (
                  <p className="life-event-timeline-empty">入力データなし</p>
                ) : (
                  visibleItems.map((item) => {
                    const top =
                      TRACK_TOP_PADDING +
                      item.lane * (TRACK_LANE_HEIGHT + TRACK_LANE_GAP);
                    const hasOccurrences =
                      (item.occurrences?.length ?? 0) > 0;

                    if (hasOccurrences) {
                      return (
                        <TimelineOccurrenceSeries
                          key={item.id}
                          item={item}
                          chartPoints={chartPoints}
                          plotMinHeadAge={plotMinHeadAge}
                          plotMaxHeadAge={plotMaxHeadAge}
                          top={top}
                        />
                      );
                    }

                    return (
                      <TimelineSpanBar
                        key={item.id}
                        item={item}
                        chartPoints={chartPoints}
                        plotMinHeadAge={plotMinHeadAge}
                        plotMaxHeadAge={plotMaxHeadAge}
                        top={top}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </Fragment>
        );
      })}
    </>
  );
}

/** @deprecated Use LifeEventTimelineRows inside LifetimeSimulationPanel unified grid */
export function LifeEventTimeline(props: LifeEventTimelineRowsProps) {
  return (
    <section className="life-event-timeline" aria-label="ライフイベント">
      <div className="lifetime-simulation-align">
        <LifeEventTimelineRows {...props} />
      </div>
    </section>
  );
}
