import { Fragment, useMemo } from 'react';

import type { LifetimeBalanceChartPoint } from '../../lib/lifetimeBalanceChartData';
import { SIMULATION_TIMELINE_TRACK_PADDING_STYLE, resolveTimelinePlotHeadAge } from '../../lib/simulationLayout';

import {

  buildLifeEventTimelineData,

  clipTimelineItemToRange,

  getTimelineSpanPercent,

  headAgeToPercent,

  type BuildLifeEventTimelineInput,

  type LifeEventTimelineItem,

} from '../../lib/lifeEventTimelineData';



const TRACK_LANE_HEIGHT = 34;

const TRACK_LANE_GAP = 8;



interface LifeEventTimelineRowsProps extends BuildLifeEventTimelineInput {

  chartPoints: LifetimeBalanceChartPoint[];

  minHeadAge: number;

  maxHeadAge: number;

  tickAges: number[];

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

          laneCount * TRACK_LANE_HEIGHT + (laneCount - 1) * TRACK_LANE_GAP + 16;



        const gridStepPercent =

          maxHeadAge > minHeadAge

            ? (5 / (maxHeadAge - minHeadAge)) * 100

            : 10;



        return (

          <Fragment key={category.id}>

            <div className={`sim-align-label life-event-label life-event-label--${category.tone}`}>

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

                      left: `${headAgeToPercent(age, minHeadAge, maxHeadAge)}%`,

                    }}

                    aria-hidden

                  />

                ))}



                {visibleItems.length === 0 ? (

                  <p className="life-event-timeline-empty">入力データなし</p>

                ) : (

                  visibleItems.map((item) => {

                    const isMarker = item.startHeadAge === item.endHeadAge;
                    const span = isMarker
                      ? getTimelineSpanPercent(
                          resolveTimelinePlotHeadAge(item, chartPoints),
                          resolveTimelinePlotHeadAge(item, chartPoints),
                          minHeadAge,
                          maxHeadAge,
                        )
                      : getTimelineSpanPercent(
                          item.startHeadAge,
                          item.endHeadAge,
                          minHeadAge,
                          maxHeadAge,
                        );



                    return (

                      <div

                        key={item.id}

                        className={`life-event-span life-event-span--${item.style}${isMarker ? ' life-event-span--marker' : ''}`}

                        style={{

                          left: `${span.left}%`,

                          width: isMarker ? undefined : `${span.width}%`,

                          top: 8 + item.lane * (TRACK_LANE_HEIGHT + TRACK_LANE_GAP),

                        }}

                      >

                        <TimelineItemCard item={item} />

                      </div>

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


