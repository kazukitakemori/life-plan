/** タイムライン左のカテゴリラベル列幅 */
export const TIMELINE_LABEL_COLUMN_WIDTH = 52;

/** Y軸・年齢ラベル列幅（Recharts margin.left と一致） */
export const SIMULATION_CHART_MARGIN_LEFT = 52;

/** プロット右端の余白（Recharts margin.right と一致） */
export const SIMULATION_CHART_MARGIN_RIGHT = 12;

/** 凡例サイドバー幅 */
export const SIMULATION_SIDEBAR_WIDTH = 168;

/** プロット列とサイドバー間の gap（lifetime-chart-layout と一致） */
export const SIMULATION_SIDEBAR_GAP = 16;

/** 棒グラフが Y 軸に食い込まないようプロット列内に取る余白 */
export const SIMULATION_PLOT_EDGE_PADDING = 8;

/** CSS の mm を px に換算（96dpi 基準） */
export function mmToCssPx(mm: number): number {
  return (mm * 96) / 25.4;
}

/** 隣接する棒グラフの間のすきま（mm） */
export const SIMULATION_BAR_GAP_MM = 1;

/** 棒本体の目標幅（px） */
const SIMULATION_BAR_BODY_WIDTH_PX = 16;

/**
 * Recharts の barCategoryGap（片側オフセット px）。
 * 棒と棒の見かけのすきま = 2 × この値 ≒ SIMULATION_BAR_GAP_MM
 * 年数が多いときはすきまを詰めて横幅に収まりやすくする。
 */
export function getSimulationBarCategoryGapPx(pointCount = 0): number {
  const ideal = mmToCssPx(SIMULATION_BAR_GAP_MM) / 2;
  if (pointCount <= 40) return ideal;
  if (pointCount <= 60) return ideal * 0.5;
  return Math.max(0.5, ideal * 0.25);
}

/** 1年あたりの最小幅（px）= 棒幅 + 棒間すきま */
export const SIMULATION_YEAR_SLOT_WIDTH =
  SIMULATION_BAR_BODY_WIDTH_PX + mmToCssPx(SIMULATION_BAR_GAP_MM);

/** 生涯収支グラフのプロット列の最小幅 */
export function getSimulationPlotMinWidth(pointCount: number): number {
  return Math.max(pointCount, 1) * SIMULATION_YEAR_SLOT_WIDTH;
}

/** タイムライン行を含むグリッド全体の最小幅（横スクロール用） */
export function getSimulationAlignMinWidth(pointCount: number): number {
  return (
    TIMELINE_LABEL_COLUMN_WIDTH +
    getSimulationPlotMinWidth(pointCount) +
    SIMULATION_SIDEBAR_GAP +
    SIMULATION_SIDEBAR_WIDTH +
    40
  );
}

export const SIMULATION_GRID_TEMPLATE = `
  ${TIMELINE_LABEL_COLUMN_WIDTH}px
  minmax(0, 1fr)
  ${SIMULATION_SIDEBAR_GAP}px
  ${SIMULATION_SIDEBAR_WIDTH}px
`;

/** グラフ・タイムライン共通の世帯主年齢→プロット位置（0〜1） */
export function headAgeToPlotRatio(
  age: number,
  minHeadAge: number,
  maxHeadAge: number,
): number {
  if (maxHeadAge <= minHeadAge) return 0;
  return (age - minHeadAge) / (maxHeadAge - minHeadAge);
}

export function headAgeToPlotPercent(
  age: number,
  minHeadAge: number,
  maxHeadAge: number,
): number {
  return headAgeToPlotRatio(age, minHeadAge, maxHeadAge) * 100;
}

/**
 * 隣接する期間バーが密着しないよう、終端をわずかに短くする（年換算）。
 * 例: 年収が65歳まで・年金が65歳からでも、見た目上のすき間を残す。
 */
const TIMELINE_SPAN_END_GAP_YEARS = 0.35;

export function getTimelineSpanPercent(
  startHeadAge: number,
  endHeadAge: number,
  minHeadAge: number,
  maxHeadAge: number,
  options?: { endGap?: boolean },
): { left: number; width: number } {
  const left = headAgeToPlotPercent(startHeadAge, minHeadAge, maxHeadAge);
  const right = headAgeToPlotPercent(
    Math.max(endHeadAge, startHeadAge),
    minHeadAge,
    maxHeadAge,
  );
  const useEndGap = options?.endGap !== false;
  const range = Math.max(maxHeadAge - minHeadAge, 1e-6);
  const endGapPercent = useEndGap
    ? (TIMELINE_SPAN_END_GAP_YEARS / range) * 100
    : 0;
  return {
    left,
    width: Math.max(right - left - endGapPercent, 1.2),
  };
}

/** グラフの年次ポイントとタイムラインの横位置を揃える */
export function resolveTimelinePlotHeadAge(
  item: { startHeadAge: number; calendarYear?: number },
  chartPoints: ReadonlyArray<{ calendarYear: number; headAge: number }>,
): number {
  return resolveTimelineHeadAgeFromChart(
    item.calendarYear,
    item.startHeadAge,
    chartPoints,
  );
}

export function resolveTimelineHeadAgeFromChart(
  calendarYear: number | undefined,
  fallbackHeadAge: number,
  chartPoints: ReadonlyArray<{ calendarYear: number; headAge: number }>,
): number {
  if (calendarYear != null) {
    const point = chartPoints.find(
      (chartPoint) => chartPoint.calendarYear === calendarYear,
    );
    if (point) return point.headAge;
  }
  return fallbackHeadAge;
}

/** Recharts の margin と同じ水平パディング（グラフ列内のタイムライン用） */
export const SIMULATION_PLOT_PADDING_STYLE = {
  paddingLeft: SIMULATION_CHART_MARGIN_LEFT,
  paddingRight: SIMULATION_CHART_MARGIN_RIGHT,
} as const;

/**
 * タイムライン行（プロット列〜右端）のパディング。
 * 左: グラフ内Y軸幅 → グラフの棒開始位置と一致
 * 右: サイドバーgap + サイドバー + グラフ右余白 → グラフのプロット終端と一致
 */
export const SIMULATION_TIMELINE_TRACK_PADDING_STYLE = {
  paddingLeft: SIMULATION_CHART_MARGIN_LEFT,
  paddingRight:
    SIMULATION_SIDEBAR_GAP +
    SIMULATION_SIDEBAR_WIDTH +
    SIMULATION_CHART_MARGIN_RIGHT,
} as const;
