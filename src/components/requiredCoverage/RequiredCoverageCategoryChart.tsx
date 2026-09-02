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
import type { RequiredCoverageChartPoint } from '../../lib/requiredCoverage';
import {
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import { ASSET_CHART_COLORS } from '../assetBuilding/assetBuildingChartShared';
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
} from './requiredCoverageChartShared';

export type CoverageCategoryKind = 'expense' | 'income';
export type CoverageCategoryAggregation = 'year' | 'cumulative';

type ExpenseSeriesKey =
  | 'lifeEvent'
  | 'education'
  | 'housing'
  | 'vehicle'
  | 'living'
  | 'loan'
  | 'insurance'
  | 'taxSocial';

type IncomeSeriesKey =
  | 'earned'
  | 'survivorBasic'
  | 'survivorEmployees'
  | 'middleAgedWidowAdd'
  | 'oldAgeBasic'
  | 'oldAgeEmployees'
  | 'childAllowance';

type SeriesKey = ExpenseSeriesKey | IncomeSeriesKey;

interface SeriesItem<K extends SeriesKey> {
  key: K;
  label: string;
  color: string;
}

interface CategoryDisplayPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: number | null;
  lifeEvent: number;
  education: number;
  housing: number;
  vehicle: number;
  living: number;
  loan: number;
  insurance: number;
  taxSocial: number;
  earned: number;
  survivorBasic: number;
  survivorEmployees: number;
  middleAgedWidowAdd: number;
  childAllowance: number;
  oldAgeBasic: number;
  oldAgeEmployees: number;
}

/** 資産形成の支出凡例と同じ色・上→下の順 */
const EXPENSE_SERIES: SeriesItem<ExpenseSeriesKey>[] = [
  { key: 'lifeEvent', label: 'ライフイベント', color: ASSET_CHART_COLORS.lifeEvent },
  { key: 'education', label: '教育費', color: ASSET_CHART_COLORS.education },
  { key: 'housing', label: '住まい', color: ASSET_CHART_COLORS.housing },
  { key: 'vehicle', label: '乗り物', color: ASSET_CHART_COLORS.vehicle },
  { key: 'living', label: '生活費', color: ASSET_CHART_COLORS.living },
  { key: 'loan', label: 'ローン', color: ASSET_CHART_COLORS.loan },
  { key: 'insurance', label: '保険', color: ASSET_CHART_COLORS.insurance },
  { key: 'taxSocial', label: '税金・社保', color: ASSET_CHART_COLORS.taxSocial },
];

/** 凡例上→下と同じ見た目になるよう、積み上げは下→上（Recharts は先頭が底） */
const EXPENSE_STACK_ORDER: ExpenseSeriesKey[] = [
  ...EXPENSE_SERIES.map((item) => item.key),
].reverse();

/**
 * 資産形成の収入凡例のうち、必要保障額で使う項目だけを同じ相対順・色で並べる。
 * （就労は給与枠の色。中高齢寡婦加算は遺族厚生の直後）
 */
const INCOME_SERIES: SeriesItem<IncomeSeriesKey>[] = [
  { key: 'childAllowance', label: '児童手当', color: '#eda866' },
  { key: 'earned', label: '就労（額面）', color: '#5b8def' },
  { key: 'oldAgeBasic', label: '老齢基礎年金', color: '#4db8b8' },
  { key: 'oldAgeEmployees', label: '老齢厚生年金', color: '#8b7fd4' },
  { key: 'survivorBasic', label: '遺族基礎年金', color: '#6db86d' },
  { key: 'survivorEmployees', label: '遺族厚生年金', color: '#9cdb8a' },
  { key: 'middleAgedWidowAdd', label: '中高齢寡婦加算', color: '#c4e8a8' },
];

const INCOME_STACK_ORDER: IncomeSeriesKey[] = [
  ...INCOME_SERIES.map((item) => item.key),
].reverse();

const EMPTY_SERIES: Omit<
  CategoryDisplayPoint,
  'calendarYear' | 'headAge' | 'spouseAge'
> = {
  lifeEvent: 0,
  education: 0,
  housing: 0,
  vehicle: 0,
  living: 0,
  loan: 0,
  insurance: 0,
  taxSocial: 0,
  earned: 0,
  survivorBasic: 0,
  survivorEmployees: 0,
  middleAgedWidowAdd: 0,
  childAllowance: 0,
  oldAgeBasic: 0,
  oldAgeEmployees: 0,
};

function mapExpensePoint(
  point: RequiredCoverageChartPoint,
  yearly: boolean,
): CategoryDisplayPoint {
  return {
    ...EMPTY_SERIES,
    calendarYear: point.calendarYear,
    headAge: point.headAge,
    spouseAge: point.spouseAge,
    living: yearly ? point.yearLiving : point.living,
    housing: yearly ? point.yearHousing : point.housing,
    vehicle: yearly ? point.yearVehicle : point.vehicle,
    education: yearly ? point.yearEducation : point.education,
    lifeEvent: yearly ? point.yearLifeEvent : point.lifeEvent,
    loan: yearly ? point.yearLoan : point.loan,
    insurance: yearly ? point.yearInsurance : point.insurance,
    taxSocial: yearly ? point.yearTaxSocial : point.taxSocial,
  };
}

function mapIncomePoint(
  point: RequiredCoverageChartPoint,
  yearly: boolean,
): CategoryDisplayPoint {
  return {
    ...EMPTY_SERIES,
    calendarYear: point.calendarYear,
    headAge: point.headAge,
    spouseAge: point.spouseAge,
    earned: yearly ? point.yearEarned : point.remainingEarned,
    survivorBasic: yearly
      ? point.yearSurvivorBasic
      : point.remainingSurvivorBasic,
    survivorEmployees: yearly
      ? point.yearSurvivorEmployees
      : point.remainingSurvivorEmployees,
    middleAgedWidowAdd: yearly
      ? point.yearMiddleAgedWidowAdd
      : point.remainingMiddleAgedWidowAdd,
    childAllowance: yearly
      ? point.yearChildAllowance
      : point.remainingChildAllowance,
    oldAgeBasic: yearly ? point.yearOldAgeBasic : point.remainingOldAgeBasic,
    oldAgeEmployees: yearly
      ? point.yearOldAgeEmployees
      : point.remainingOldAgeEmployees,
  };
}

function seriesFor(kind: CoverageCategoryKind): SeriesItem<SeriesKey>[] {
  return kind === 'expense' ? EXPENSE_SERIES : INCOME_SERIES;
}

function stackOrderFor(kind: CoverageCategoryKind): SeriesKey[] {
  return kind === 'expense' ? EXPENSE_STACK_ORDER : INCOME_STACK_ORDER;
}

function defaultVisible(kind: CoverageCategoryKind): Record<SeriesKey, boolean> {
  const next = {
    lifeEvent: false,
    education: false,
    housing: false,
    vehicle: false,
    living: false,
    loan: false,
    insurance: false,
    taxSocial: false,
    earned: false,
    survivorBasic: false,
    survivorEmployees: false,
    middleAgedWidowAdd: false,
    childAllowance: false,
    oldAgeBasic: false,
    oldAgeEmployees: false,
  } as Record<SeriesKey, boolean>;
  for (const item of seriesFor(kind)) {
    next[item.key] = true;
  }
  return next;
}

function stackTotal(
  point: CategoryDisplayPoint,
  keys: SeriesKey[],
  visible: Record<SeriesKey, boolean>,
): number {
  let total = 0;
  for (const key of keys) {
    if (visible[key]) total += point[key];
  }
  return total;
}

function headingCopy(
  kind: CoverageCategoryKind,
  aggregation: CoverageCategoryAggregation,
): { title: string; note: string; headingId: string } {
  if (kind === 'expense') {
    return aggregation === 'year'
      ? {
          title: '支出（単年）',
          note: 'その年に残す支出です。税金・社保はキャッシュフロー表と同じく支出に含めます。上の設計を変えると、この棒も追従します。',
          headingId: 'required-coverage-expense-year-chart-heading',
        }
      : {
          title: '支出（累計残）',
          note: 'その年から保障終了までの残りです。住まいには、団信で消えない残元金を含みます。税金・社保も含みます。',
          headingId: 'required-coverage-expense-cumulative-chart-heading',
        };
  }
  return aggregation === 'year'
    ? {
        title: '収入（単年）',
        note: 'その年の万一後の収入（額面）です。上の働き方を変えると、この棒も追従します。',
        headingId: 'required-coverage-income-year-chart-heading',
      }
    : {
        title: '収入（累計残）',
        note: 'その年から保障終了までの残りの収入（額面）です。',
        headingId: 'required-coverage-income-cumulative-chart-heading',
      };
}

function CategoryTooltip({
  active,
  label,
  payload,
  points,
  series,
  visible,
}: {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{ payload?: CategoryDisplayPoint }>;
  points: CategoryDisplayPoint[];
  series: SeriesItem<SeriesKey>[];
  visible: Record<SeriesKey, boolean>;
}) {
  if (!active) return null;
  const fromPayload = payload?.find((item) => item.payload)?.payload;
  const point =
    fromPayload ?? points.find((row) => row.headAge === label);
  if (!point) return null;
  const rows = series.filter(
    (item) => visible[item.key] && point[item.key] !== 0,
  );
  const total = rows.reduce((sum, item) => sum + point[item.key], 0);
  if (rows.length === 0 && total === 0) return null;
  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.calendarYear}年（{point.headAge}歳）
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
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

interface RequiredCoverageCategoryChartProps {
  points: RequiredCoverageChartPoint[];
  hasSpouse: boolean;
  kind: CoverageCategoryKind;
  aggregation: CoverageCategoryAggregation;
}

function RequiredCoverageCategoryChart({
  points,
  hasSpouse,
  kind,
  aggregation,
}: RequiredCoverageCategoryChartProps) {
  const yearly = aggregation === 'year';
  const series = seriesFor(kind);
  const stackKeys = stackOrderFor(kind);
  const [visible, setVisible] = useState(() => defaultVisible(kind));
  const displayPoints = useMemo(
    () =>
      points.map((point) =>
        kind === 'expense'
          ? mapExpensePoint(point, yearly)
          : mapIncomePoint(point, yearly),
      ),
    [points, kind, yearly],
  );
  const {
    visiblePoints,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  } = useCoverageChartWindow(displayPoints);

  const minHeadAge = visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge = visiblePoints[visiblePoints.length - 1]?.headAge ?? 0;
  const tickAges = useMemo(() => getTickAges(visiblePoints), [visiblePoints]);
  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );
  const axisDomain = useMemo(() => {
    let peak = 0;
    for (const point of visiblePoints) {
      peak = Math.max(peak, stackTotal(point, stackKeys, visible));
    }
    return { min: 0, max: niceAxisMax(peak) };
  }, [visiblePoints, stackKeys, visible]);
  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );
  const xAxisRowCount = hasSpouse ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const copy = headingCopy(kind, aggregation);
  const seriesByKey = new Map(series.map((item) => [item.key, item]));

  if (points.length === 0) return null;

  return (
    <section
      className="required-coverage-chart-card"
      aria-labelledby={copy.headingId}
    >
      <div className="lifetime-chart-header">
        <div className="lifetime-chart-header-left">
          <h3 id={copy.headingId} className="lifetime-chart-title">
            {copy.title}
          </h3>
          <p className="required-coverage-chart-zero-note">{copy.note}</p>
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
                  domain={[axisDomain.min, axisDomain.max]}
                />
                <ReferenceLine
                  yAxisId="main"
                  y={0}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <Tooltip
                  content={(props) => (
                    <CategoryTooltip
                      active={props.active}
                      label={props.label as number | undefined}
                      payload={
                        props.payload as ReadonlyArray<{
                          payload?: CategoryDisplayPoint;
                        }>
                      }
                      points={visiblePoints}
                      series={series}
                      visible={visible}
                    />
                  )}
                />
                {stackKeys.map((key) => {
                  const item = seriesByKey.get(key);
                  if (!item) return null;
                  return (
                    <Bar
                      key={key}
                      yAxisId="main"
                      dataKey={key}
                      name={item.label}
                      stackId="category"
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
                  onClick={() => setVisible(defaultVisible(kind))}
                >
                  全表示
                </button>
                <button
                  type="button"
                  className="lifetime-chart-legend-bulk-btn"
                  onClick={() =>
                    setVisible((current) => {
                      const next = { ...current };
                      for (const item of series) next[item.key] = false;
                      return next;
                    })
                  }
                >
                  全解除
                </button>
              </div>
              <ul className="lifetime-chart-legend">
                {series.map((item) => {
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

interface RequiredCoverageCategoryChartsProps {
  points: RequiredCoverageChartPoint[];
  hasSpouse: boolean;
  kind: CoverageCategoryKind;
}

export function RequiredCoverageCategoryCharts({
  points,
  hasSpouse,
  kind,
}: RequiredCoverageCategoryChartsProps) {
  if (points.length === 0) return null;
  return (
    <>
      <RequiredCoverageCategoryChart
        points={points}
        hasSpouse={hasSpouse}
        kind={kind}
        aggregation="year"
      />
      <RequiredCoverageCategoryChart
        points={points}
        hasSpouse={hasSpouse}
        kind={kind}
        aggregation="cumulative"
      />
    </>
  );
}
