import { useMemo, useState } from 'react';

import {
  buildLifetimeBalanceChartData,
  createDefaultLifetimeChartVisibleSeries,
  getLifetimeChartTickAges,
  getVisibleHeadAgeRange,
  sliceLifetimeChartPoints,
  type LifetimeChartScaleMode,
} from '../../lib/lifetimeBalanceChartData';
import type { BuildLifeEventTimelineInput } from '../../lib/lifeEventTimelineData';
import { LifeEventTimelineRows } from './LifeEventTimeline';
import {
  LifetimeChartGridRow,
  LifetimeChartHeader,
} from './LifetimeBalanceSimulationChart';

export interface LifetimeSimulationPanelProps extends BuildLifeEventTimelineInput {
  showHeader?: boolean;
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
  showHeader = true,
}: LifetimeSimulationPanelProps) {
  const chartData = useMemo(
    () => buildLifetimeBalanceChartData(cashFlowData),
    [cashFlowData],
  );
  const [scaleMode, setScaleMode] = useState<LifetimeChartScaleMode>('cashFlow');
  const [visibleSeries, setVisibleSeries] = useState(() =>
    createDefaultLifetimeChartVisibleSeries(),
  );
  const [windowStart, setWindowStart] = useState(0);
  const [windowEnd, setWindowEnd] = useState<number | null>(null);

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

  return (
    <div className="lifetime-simulation-panel">
      <div className="lifetime-simulation-unified" aria-label="生涯収支シミュレーション">
        <LifetimeChartHeader
          showTitle={showHeader}
          scaleMode={scaleMode}
          onScaleModeChange={setScaleMode}
          canZoomIn={visiblePoints.length > 12}
          canZoomOut={windowStart > 0 || endIndex < chartData.points.length}
          showReset={windowStart > 0 || endIndex < chartData.points.length}
          onZoomIn={() => {
            const currentLength = endIndex - windowStart;
            const nextLength = Math.max(12, Math.floor(currentLength * 0.75));
            const center = windowStart + Math.floor(currentLength / 2);
            const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
            const nextEnd = Math.min(chartData.points.length, nextStart + nextLength);
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
            const nextEnd = Math.min(chartData.points.length, nextStart + nextLength);
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

        <div className="lifetime-simulation-scroll">
          <div className="lifetime-simulation-align">
          <LifetimeChartGridRow
            chartData={chartData}
            visiblePoints={visiblePoints}
            minHeadAge={minHeadAge}
            maxHeadAge={maxHeadAge}
            tickAges={tickAges}
            scaleMode={scaleMode}
            visibleSeries={visibleSeries}
            onVisibleSeriesChange={setVisibleSeries}
          />
          <LifeEventTimelineRows
            cashFlowData={cashFlowData}
            familyMembers={familyMembers}
            incomeByMember={incomeByMember}
            pensionByMember={pensionByMember}
            livingState={livingState}
            educationByMember={educationByMember}
            lifeEventState={lifeEventState}
            referenceDate={referenceDate}
            chartPoints={visiblePoints}
            minHeadAge={minHeadAge}
            maxHeadAge={maxHeadAge}
            tickAges={tickAges}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
