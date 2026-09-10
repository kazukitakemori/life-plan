import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import type { LifetimeBalanceChartPoint } from '../../lib/lifetimeBalanceChartData';
import { getLifetimeChartPlotAgeDomain } from '../../lib/lifetimeBalanceChartData';
import {
  SIMULATION_PLOT_PADDING_STYLE,
  resolveTimelineHeadAgeFromChart,
  resolveTimelinePlotHeadAge,
} from '../../lib/simulationLayout';
import {
  assignSameLanePlotRanges,
  buildLifeEventTimelineData,
  clipTimelineItemToRange,
  getTimelineSpanPercent,
  headAgeToPercent,
  type BuildLifeEventTimelineInput,
  type LifeEventTimelineItem,
  type TimelineOccurrence,
} from '../../lib/lifeEventTimelineData';

const TRACK_LANE_HEIGHT = 22;
const TRACK_LANE_GAP = 6;
const TRACK_TOP_PADDING = 4;
/** ライフイベント支出マーカーの統一サイズ */
const OCCURRENCE_MARKER_SIZE = 7;

interface LifeEventTimelineRowsProps extends BuildLifeEventTimelineInput {
  chartPoints: LifetimeBalanceChartPoint[];
  minHeadAge: number;
  maxHeadAge: number;
  tickAges: number[];
}

type TimelineDetailSelection = {
  item: LifeEventTimelineItem;
  occurrence?: TimelineOccurrence;
  leftPercent: number;
  top: number;
};

function formatOccurrenceAmount(amountMan: number): string {
  return `${Math.round(amountMan).toLocaleString('ja-JP')}万円`;
}

function formatAgeRange(item: LifeEventTimelineItem): string {
  if (item.startHeadAge === item.endHeadAge) {
    return `${item.startHeadAge}歳`;
  }
  return `${item.startHeadAge}〜${item.endHeadAge}歳`;
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

function TimelineDetailPopover({
  selection,
  onClose,
}: {
  selection: TimelineDetailSelection;
  onClose: () => void;
}) {
  const { item, occurrence, leftPercent, top } = selection;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('[data-life-event-detail-trigger]')
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="life-event-detail-popover"
      role="dialog"
      aria-label={`${item.title}の詳細`}
      style={{
        left: `${Math.min(Math.max(leftPercent, 4), 72)}%`,
        top: top + TRACK_LANE_HEIGHT + 4,
      }}
    >
      <div className="life-event-detail-popover-header">
        <p className="life-event-detail-popover-title">{item.title}</p>
        <button
          type="button"
          className="life-event-detail-popover-close"
          aria-label="詳細を閉じる"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <dl className="life-event-detail-popover-body">
        <div>
          <dt>期間</dt>
          <dd>{formatAgeRange(item)}</dd>
        </div>
        {item.detail ? (
          <div>
            <dt>金額</dt>
            <dd>{item.detail}</dd>
          </div>
        ) : null}
        {occurrence ? (
          <div>
            <dt>支出年</dt>
            <dd>
              {occurrence.calendarYear}年（{occurrence.headAge}歳）{' '}
              {formatOccurrenceAmount(occurrence.amountMan)}
            </dd>
          </div>
        ) : null}
        {!occurrence && item.occurrences && item.occurrences.length > 0 ? (
          <div>
            <dt>支出回数</dt>
            <dd>{item.occurrences.length}回（各丸が支出年）</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function TimelineItemBar({
  item,
  selected,
  onSelect,
}: {
  item: LifeEventTimelineItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`life-event-item life-event-item--${item.style}${
        selected ? ' is-selected' : ''
      }`}
      data-life-event-detail-trigger
      aria-pressed={selected}
      aria-label={`${item.title}の詳細`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="life-event-item-title">{item.title}</span>
    </button>
  );
}

function TimelineOccurrenceSeries({
  item,
  chartPoints,
  plotMinHeadAge,
  plotMaxHeadAge,
  top,
  selected,
  selectedOccurrenceYear,
  onSelectOccurrence,
}: {
  item: LifeEventTimelineItem;
  chartPoints: LifetimeBalanceChartPoint[];
  plotMinHeadAge: number;
  plotMaxHeadAge: number;
  top: number;
  selected: boolean;
  selectedOccurrenceYear?: number;
  onSelectOccurrence: (
    occurrence: TimelineOccurrence,
    leftPercent: number,
  ) => void;
}) {
  const occurrences = item.occurrences ?? [];
  if (occurrences.length === 0) return null;

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
      aria-label={item.title}
    >
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
        const leftPercent = headAgeToPercent(
          age,
          plotMinHeadAge,
          plotMaxHeadAge,
        );
        const isOccurrenceSelected =
          selected && selectedOccurrenceYear === occurrence.calendarYear;
        return (
          <button
            key={`${item.id}-${occurrence.calendarYear}`}
            type="button"
            className={`life-event-occurrence${
              isOccurrenceSelected ? ' is-selected' : ''
            }`}
            data-life-event-detail-trigger
            style={{
              left: `${leftPercent}%`,
              width: OCCURRENCE_MARKER_SIZE,
              height: OCCURRENCE_MARKER_SIZE,
            }}
            aria-label={`${item.title} ${occurrence.calendarYear}年 ${formatOccurrenceAmount(occurrence.amountMan)}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectOccurrence(occurrence, leftPercent);
            }}
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
  selected,
  onSelect,
}: {
  item: LifeEventTimelineItem;
  chartPoints: LifetimeBalanceChartPoint[];
  plotMinHeadAge: number;
  plotMaxHeadAge: number;
  top: number;
  selected: boolean;
  onSelect: (leftPercent: number) => void;
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
  const plotStartHeadAge = item.plotStartHeadAge ?? startHeadAge - 0.5;
  const plotEndHeadAge = item.plotEndHeadAge ?? endHeadAge + 0.5;
  const span = getTimelineSpanPercent(
    plotStartHeadAge,
    plotEndHeadAge,
    plotMinHeadAge,
    plotMaxHeadAge,
    { endGap: false },
  );
  const leftPercent = isMarker
    ? headAgeToPercent(startHeadAge, plotMinHeadAge, plotMaxHeadAge)
    : span.left;

  return (
    <div
      className={`life-event-span life-event-span--${item.style}${
        isMarker ? ' life-event-span--marker' : ' life-event-span--range'
      }`}
      style={{
        left: isMarker ? `${leftPercent}%` : `${span.left}%`,
        width: isMarker ? undefined : `${span.width}%`,
        top,
        height: TRACK_LANE_HEIGHT,
      }}
    >
      {!isMarker ? (
        <span className="life-event-span-line" aria-hidden />
      ) : null}
      <TimelineItemBar
        item={item}
        selected={selected}
        onSelect={() => onSelect(leftPercent)}
      />
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
  secondLifeState,
  chartPoints,
}: LifeEventTimelineRowsProps) {
  const [detail, setDetail] = useState<TimelineDetailSelection | null>(null);

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
        secondLifeState,
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
      secondLifeState,
      chartPoints,
    ],
  );

  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );

  useEffect(() => {
    setDetail(null);
  }, [minHeadAge, maxHeadAge, timeline]);

  const openDetail = (
    item: LifeEventTimelineItem,
    leftPercent: number,
    top: number,
    occurrence?: TimelineOccurrence,
  ) => {
    setDetail((current) => {
      if (
        current &&
        current.item.id === item.id &&
        current.occurrence?.calendarYear === occurrence?.calendarYear
      ) {
        return null;
      }
      return { item, occurrence, leftPercent, top };
    });
  };

  return (
    <>
      {timeline.categories.map((category) => {
        const visibleItems = assignSameLanePlotRanges(
          category.items
            .map((item) =>
              clipTimelineItemToRange(item, minHeadAge, maxHeadAge),
            )
            .filter((item): item is LifeEventTimelineItem => item != null),
        );

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

        const categoryDetail =
          detail && visibleItems.some((item) => item.id === detail.item.id)
            ? detail
            : null;

        return (
          <Fragment key={category.id}>
            <div
              className={`sim-align-label life-event-label life-event-label--${category.tone}`}
            >
              <span className="life-event-label-text">{category.label}</span>
            </div>

            <div
              className="life-event-track-wrap life-event-track-wrap--fill"
              style={{
                ...SIMULATION_PLOT_PADDING_STYLE,
                ['--life-event-grid-step' as string]: `${gridStepPercent}%`,
              }}
            >
              <div
                className="life-event-track"
                style={{ minHeight: trackHeight }}
              >
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
                    const selected = detail?.item.id === item.id;

                    if (hasOccurrences) {
                      return (
                        <TimelineOccurrenceSeries
                          key={item.id}
                          item={item}
                          chartPoints={chartPoints}
                          plotMinHeadAge={plotMinHeadAge}
                          plotMaxHeadAge={plotMaxHeadAge}
                          top={top}
                          selected={selected}
                          selectedOccurrenceYear={
                            detail?.occurrence?.calendarYear
                          }
                          onSelectOccurrence={(occurrence, leftPercent) =>
                            openDetail(item, leftPercent, top, occurrence)
                          }
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
                        selected={selected}
                        onSelect={(leftPercent) =>
                          openDetail(item, leftPercent, top)
                        }
                      />
                    );
                  })
                )}

                {categoryDetail ? (
                  <TimelineDetailPopover
                    selection={categoryDetail}
                    onClose={() => setDetail(null)}
                  />
                ) : null}
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
