import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getLifetimeChartTickAges,
  type LifetimeBalanceChartPoint,
} from '../../lib/lifetimeBalanceChartData';
import { SIMULATION_CHART_MARGIN_LEFT } from '../../lib/simulationLayout';

export const ASSET_CHART_HEIGHT = 280;
export const ASSET_CHART_MARGIN_LEFT = SIMULATION_CHART_MARGIN_LEFT;
export const ASSET_CHART_MARGIN_TOP = 16;
export const ASSET_EXPENSE_BAR_MAX_SIZE = 36;
/** ゼロ跨ぎ補間点を含む折れ線専用の非表示 X 軸 */
export const ASSET_LINE_X_AXIS_ID = 'line';
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

/** 生涯収支シミュレーションと同じカテゴリ色 */
export const ASSET_CHART_COLORS = {
  lifeEvent: '#ee9cba',
  education: '#6db86d',
  housing: '#6a9fd8',
  vehicle: '#90c2e7',
  living: '#eda866',
  loan: '#c4b5fd',
  insurance: '#fb7185',
  assetContribution: '#22d3ee',
  taxSocial: '#c9b896',
  income: '#0000ff',
  annualBalance: '#1f9690',
  annualBalanceDeficit: '#e11d48',
  financialAssets: '#1f9690',
  financialAssetsNegative: '#ff0000',
  depositBalance: '#1e4a8a',
  depositBalanceNegative: '#e11d48',
} as const;

export type AssetExpenseSeriesKey =
  | 'taxSocial'
  | 'living'
  | 'housing'
  | 'vehicle'
  | 'lifeEvent'
  | 'education'
  | 'loan'
  | 'insurance'
  | 'assetContribution';

export type AssetExpenseSeriesVisibility = Record<AssetExpenseSeriesKey, boolean>;

export const ALL_ASSET_EXPENSE_SERIES_VISIBLE: AssetExpenseSeriesVisibility = {
  taxSocial: true,
  living: true,
  housing: true,
  vehicle: true,
  lifeEvent: true,
  education: true,
  loan: true,
  insurance: true,
  assetContribution: true,
};

export const ASSET_EXPENSE_LEGEND_ITEMS = [
  { key: 'lifeEvent', label: 'ライフイベント', color: ASSET_CHART_COLORS.lifeEvent },
  { key: 'education', label: '教育費', color: ASSET_CHART_COLORS.education },
  { key: 'housing', label: '住まい', color: ASSET_CHART_COLORS.housing },
  { key: 'vehicle', label: '乗り物', color: ASSET_CHART_COLORS.vehicle },
  { key: 'living', label: '生活費', color: ASSET_CHART_COLORS.living },
  { key: 'loan', label: 'ローン', color: ASSET_CHART_COLORS.loan },
  { key: 'insurance', label: '保険', color: ASSET_CHART_COLORS.insurance },
  {
    key: 'assetContribution',
    label: '運用積立',
    color: ASSET_CHART_COLORS.assetContribution,
  },
  { key: 'taxSocial', label: '税金・社保', color: ASSET_CHART_COLORS.taxSocial },
] as const satisfies ReadonlyArray<{
  key: AssetExpenseSeriesKey;
  label: string;
  color: string;
}>;

/** 凡例上→下と同じ見た目になるよう、積み上げは下→上（Recharts は先頭が底） */
export const ASSET_EXPENSE_STACK_ORDER: AssetExpenseSeriesKey[] = [
  ...ASSET_EXPENSE_LEGEND_ITEMS.map((item) => item.key),
].reverse();

/** 必要保障額の収入カテゴリに近い色・ラベル（CF 収入内訳ベース） */
export type AssetIncomeSeriesKey =
  | 'salary'
  | 'bonus'
  | 'oldAgeBasic'
  | 'oldAgeEmployees'
  | 'disabilityPension'
  | 'survivorBasic'
  | 'survivorEmployees'
  | 'childAllowance'
  | 'insuranceIncome'
  | 'retirementAllowance'
  | 'businessCf'
  | 'realEstateCf'
  | 'transferCf'
  | 'taxFreeIncome'
  | 'otherIncome';

export type AssetIncomeSeriesVisibility = Record<AssetIncomeSeriesKey, boolean>;

export const ASSET_INCOME_LEGEND_ITEMS = [
  { key: 'insuranceIncome', label: '保険収入', color: '#fb7185' },
  { key: 'childAllowance', label: '児童手当', color: '#eda866' },
  { key: 'retirementAllowance', label: '退職金', color: '#f59e0b' },
  { key: 'bonus', label: '賞与', color: '#93b7f5' },
  { key: 'salary', label: '給与', color: '#5b8def' },
  { key: 'oldAgeBasic', label: '老齢基礎年金', color: '#4db8b8' },
  { key: 'oldAgeEmployees', label: '老齢厚生年金', color: '#8b7fd4' },
  { key: 'disabilityPension', label: '障害年金', color: '#c4b5fd' },
  { key: 'survivorBasic', label: '遺族基礎年金', color: '#6db86d' },
  { key: 'survivorEmployees', label: '遺族厚生年金', color: '#9cdb8a' },
  { key: 'businessCf', label: '事業CF', color: '#94a3b8' },
  { key: 'realEstateCf', label: '不動産CF', color: '#64748b' },
  { key: 'transferCf', label: '譲渡CF', color: '#78716c' },
  { key: 'taxFreeIncome', label: '非課税収入', color: '#a8a29e' },
  { key: 'otherIncome', label: '収入(その他)', color: '#cbd5e1' },
] as const satisfies ReadonlyArray<{
  key: AssetIncomeSeriesKey;
  label: string;
  color: string;
}>;

/** 凡例上→下と同じ見た目になるよう、積み上げは下→上（Recharts は先頭が底） */
export const ASSET_INCOME_STACK_ORDER: AssetIncomeSeriesKey[] = [
  ...ASSET_INCOME_LEGEND_ITEMS.map((item) => item.key),
].reverse();

export function createDefaultAssetExpenseVisibility(): AssetExpenseSeriesVisibility {
  return { ...ALL_ASSET_EXPENSE_SERIES_VISIBLE };
}

export function createDefaultAssetIncomeVisibility(): AssetIncomeSeriesVisibility {
  const next = {} as AssetIncomeSeriesVisibility;
  for (const item of ASSET_INCOME_LEGEND_ITEMS) {
    next[item.key] = true;
  }
  return next;
}

export function createHiddenAssetIncomeVisibility(): AssetIncomeSeriesVisibility {
  const next = {} as AssetIncomeSeriesVisibility;
  for (const item of ASSET_INCOME_LEGEND_ITEMS) {
    next[item.key] = false;
  }
  return next;
}

export function sumVisibleAssetExpense(
  point: LifetimeBalanceChartPoint,
  visibility: AssetExpenseSeriesVisibility,
): number {
  let total = 0;
  if (visibility.taxSocial) total += point.taxSocial;
  if (visibility.living) total += point.living;
  if (visibility.housing) total += point.housing;
  if (visibility.vehicle) total += point.vehicle;
  if (visibility.lifeEvent) total += point.lifeEvent;
  if (visibility.education) total += point.education;
  if (visibility.loan) total += point.loan;
  if (visibility.insurance) total += point.insurance;
  if (visibility.assetContribution) total += point.assetContribution;
  return total;
}

export function sumVisibleAssetIncome(
  point: LifetimeBalanceChartPoint,
  visibility: AssetIncomeSeriesVisibility,
): number {
  let total = 0;
  for (const key of ASSET_INCOME_STACK_ORDER) {
    if (visibility[key]) total += point[key];
  }
  return total;
}

export type AssetChartAggregation = 'year' | 'cumulative';

const ASSET_INCOME_CUMULATIVE_KEYS = [
  ...ASSET_INCOME_STACK_ORDER,
  'income',
] as const satisfies ReadonlyArray<keyof LifetimeBalanceChartPoint>;

const ASSET_EXPENSE_CUMULATIVE_KEYS = [
  ...ASSET_EXPENSE_STACK_ORDER,
] as const satisfies ReadonlyArray<keyof LifetimeBalanceChartPoint>;

function accumulateSeriesValues(
  points: LifetimeBalanceChartPoint[],
  keys: ReadonlyArray<keyof LifetimeBalanceChartPoint>,
): LifetimeBalanceChartPoint[] {
  const totals = new Map<keyof LifetimeBalanceChartPoint, number>();
  for (const key of keys) {
    totals.set(key, 0);
  }
  return points.map((point) => {
    const next: LifetimeBalanceChartPoint = { ...point };
    for (const key of keys) {
      const raw = point[key];
      const value = typeof raw === 'number' ? raw : 0;
      const total = (totals.get(key) ?? 0) + value;
      totals.set(key, total);
      Object.assign(next, { [key]: total });
    }
    return next;
  });
}

/** 単年→計画開始からの累計に変換（収入内訳） */
export function toCumulativeAssetIncomePoints(
  points: LifetimeBalanceChartPoint[],
): LifetimeBalanceChartPoint[] {
  return accumulateSeriesValues(points, ASSET_INCOME_CUMULATIVE_KEYS);
}

/** 単年→計画開始からの累計に変換（支出内訳） */
export function toCumulativeAssetExpensePoints(
  points: LifetimeBalanceChartPoint[],
): LifetimeBalanceChartPoint[] {
  return accumulateSeriesValues(points, ASSET_EXPENSE_CUMULATIVE_KEYS);
}

export function niceAxisMax(value: number): number {
  if (value <= 0) return 100;
  const padded = value * 1.05;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(nice * magnitude, 100);
}

export function niceAxisMin(value: number): number {
  if (value >= 0) return 0;
  return -niceAxisMax(-value);
}

export function formatAxisMan(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
}

export function formatTooltipMan(value: number): string {
  return `${Math.round(value).toLocaleString('ja-JP')}万円`;
}

function xAxisRowStep(): number {
  return X_AXIS_ROW_HEIGHT + X_AXIS_ROW_GAP;
}

function xAxisRowY(rowIndex: number): number {
  return X_AXIS_ROW_START + rowIndex * xAxisRowStep() + X_AXIS_ROW_HEIGHT / 2;
}

export function xAxisTotalHeight(rowCount: number): number {
  return X_AXIS_ROW_START + rowCount * xAxisRowStep() + 4;
}

export function DualAgeAxisTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  points,
}: {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: number };
  points: LifetimeBalanceChartPoint[];
}) {
  if (!payload) return null;
  const point = points.find((row) => row.headAge === payload.value);
  if (!point) return null;
  const rows =
    point.spouseAge != null
      ? [
          { value: String(point.headAge), label: '世帯主', rowIndex: 0 },
          { value: String(point.spouseAge), label: '配偶者', rowIndex: 1 },
        ]
      : [{ value: String(point.headAge), label: '世帯主', rowIndex: 0 }];
  const labelXInGroup = ASSET_CHART_MARGIN_LEFT - 8 - x;

  return (
    <g transform={`translate(${x},${y})`}>
      {rows.map((row) => (
        <g key={row.rowIndex}>
          {index === 0 ? (
            <text
              x={labelXInGroup}
              y={xAxisRowY(row.rowIndex)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#64748b"
              fontSize={10}
            >
              {row.label}
            </text>
          ) : null}
          <text
            x={0}
            y={xAxisRowY(row.rowIndex)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={row.rowIndex === 0 ? '#555' : '#666'}
            fontSize={11}
          >
            {row.value}
          </text>
        </g>
      ))}
    </g>
  );
}

export function AssetChartZoomToolbar({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
  aggregation,
  onAggregationChange,
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  aggregation?: AssetChartAggregation;
  onAggregationChange?: (mode: AssetChartAggregation) => void;
}) {
  return (
    <div className="lifetime-chart-toolbar">
      {aggregation != null && onAggregationChange != null ? (
        <div
          className="lifetime-chart-scale-toggle"
          role="group"
          aria-label="集計方法"
        >
          <button
            type="button"
            className={
              aggregation === 'year'
                ? 'lifetime-chart-scale-btn is-active'
                : 'lifetime-chart-scale-btn'
            }
            aria-pressed={aggregation === 'year'}
            onClick={() => onAggregationChange('year')}
          >
            単年
          </button>
          <button
            type="button"
            className={
              aggregation === 'cumulative'
                ? 'lifetime-chart-scale-btn is-active'
                : 'lifetime-chart-scale-btn'
            }
            aria-pressed={aggregation === 'cumulative'}
            onClick={() => onAggregationChange('cumulative')}
          >
            累計
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="lifetime-chart-zoom-btn"
        aria-label="ズームイン"
        disabled={!canZoomIn}
        onClick={onZoomIn}
      >
        +
      </button>
      <button
        type="button"
        className="lifetime-chart-zoom-btn"
        aria-label="ズームアウト"
        disabled={!canZoomOut}
        onClick={onZoomOut}
      >
        −
      </button>
      {canZoomOut ? (
        <button
          type="button"
          className="lifetime-chart-reset-btn"
          onClick={onReset}
        >
          全期間
        </button>
      ) : null}
    </div>
  );
}

export function useAssetChartWindow(points: LifetimeBalanceChartPoint[]) {
  const [windowStart, setWindowStart] = useState(0);
  const [windowEnd, setWindowEnd] = useState<number | null>(null);

  useEffect(() => {
    setWindowStart(0);
    setWindowEnd(null);
  }, [points]);

  const endIndex = windowEnd ?? points.length;
  const visiblePoints = useMemo(
    () => points.slice(windowStart, Math.max(windowStart + 1, endIndex)),
    [points, windowStart, endIndex],
  );
  const canZoomIn = visiblePoints.length > 12;
  const canZoomOut = windowStart > 0 || endIndex < points.length;

  const zoomIn = () => {
    const currentLength = endIndex - windowStart;
    const nextLength = Math.max(12, Math.floor(currentLength * 0.75));
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(points.length, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
  };

  const zoomOut = () => {
    const currentLength = endIndex - windowStart;
    const nextLength = Math.min(
      points.length,
      Math.ceil(currentLength * 1.35),
    );
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(points.length, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd === points.length ? null : nextEnd);
  };

  const reset = () => {
    setWindowStart(0);
    setWindowEnd(null);
  };

  const tickAges = useMemo(
    () => getLifetimeChartTickAges(visiblePoints),
    [visiblePoints],
  );

  return {
    visiblePoints,
    tickAges,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  };
}

export function AssetChartTooltipShell({
  calendarYear,
  headAge,
  spouseAge,
  children,
}: {
  calendarYear: number;
  headAge: number;
  spouseAge: number | null;
  children: ReactNode;
}) {
  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {calendarYear}年（{headAge}歳）
        {spouseAge != null ? ` / 配偶者${spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">{children}</div>
    </div>
  );
}

export function AssetTooltipRow({
  color,
  label,
  value,
  emphasis = false,
}: {
  color: string;
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <p
      className={
        emphasis
          ? 'lifetime-chart-tooltip-row lifetime-chart-tooltip-row--emphasis'
          : 'lifetime-chart-tooltip-row'
      }
    >
      <span
        className="lifetime-chart-tooltip-swatch"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
      <span>{formatTooltipMan(value)}</span>
    </p>
  );
}
