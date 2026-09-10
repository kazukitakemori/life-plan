import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCashFlowValue } from '../../lib/cashFlow';
import {
  buildLifetimeBalanceChartData,
  buildBalanceLinePoints,
  balanceValueForMode,
  formatLifetimeTotalMan,
  getLifetimeChartPlotAgeDomain,
  getLifetimeChartTickAges,
  getLifetimeChartYTicks,
  LIFETIME_CHART_BALANCE_LINE_LABELS,
  createAllHiddenLifetimeChartVisibleSeries,
  createDefaultLifetimeChartIncomeVisibility,
  createDefaultLifetimeChartVisibleSeries,
  createHiddenLifetimeChartIncomeVisibility,
  hasVisibleLifetimeChartExpenseSeries,
  resolveActiveBalanceLineMode,
  resolveLifetimeChartAxisDomain,
  resolveLifetimeChartScaleMode,
  resolveLifetimeChartTooltipPoint,
  RETIREMENT_HEAD_AGE,
  setLifetimeChartExpenseSeriesVisible,
  sliceLifetimeChartPoints,
  toggleLifetimeChartVisibleSeries,
  visibleLifetimeChartExpenseTotal,
  type LifetimeBalanceChartData,
  type LifetimeBalanceChartPoint,
  type LifetimeChartBalanceLineMode,
  type LifetimeChartIncomeSeriesKey,
  type LifetimeChartIncomeSeriesVisibility,
  type LifetimeChartSeriesKey,
  type LifetimeChartSeriesVisibility,
} from '../../lib/lifetimeBalanceChartData';
import {
  ASSET_INCOME_LEGEND_ITEMS,
  ASSET_INCOME_STACK_ORDER,
  AssetChartYAxisMaxPanel,
  type AssetChartYAxisMaxMode,
} from './assetBuildingChartShared';
import {
  SIMULATION_CHART_MARGIN_LEFT,
  SIMULATION_CHART_MARGIN_RIGHT,
  getSimulationBarCategoryGapPx,
} from '../../lib/simulationLayout';
import type { CashFlowTableData } from '../../types/cashFlow';

/** 通常時：グラフ＋イベント表を1画面に収める高さ */
const CHART_HEIGHT_COMPACT = 360;
const CHART_MARGIN_LEFT = SIMULATION_CHART_MARGIN_LEFT;
const CHART_MARGIN_RIGHT = SIMULATION_CHART_MARGIN_RIGHT;
const CHART_MARGIN_TOP = 26;
/** ズームイン時などに棒が極端に太くならない上限（px） */
const EXPENSE_BAR_MAX_SIZE = 36;
/** ゼロ跨ぎ補間点を含む折れ線専用の非表示 X 軸（棒の帯域幅計算から除外する） */
const LINE_X_AXIS_ID = 'line';
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

const CHART_COLORS = {
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
  expenseTotal: '#e11d48',
  financialAssets: '#1f9690',
  financialAssetsNegative: '#ff0000',
} as const;

export type LifetimeChartVisibleSeries = LifetimeChartSeriesVisibility;
/** 収支切替え。初期は支出棒＋収入折れ線 */
export type LifetimeChartCashFlowBarFocus = 'expense' | 'income';

type LifetimeChartLegendItem = {
  key: LifetimeChartSeriesKey | LifetimeChartIncomeSeriesKey | 'expense';
  label: string;
  color: string;
  type: 'bar' | 'line' | 'step';
};

const EXPENSE_LEGEND_ITEMS = [
  { key: 'lifeEvent', label: 'ライフイベント', color: CHART_COLORS.lifeEvent },
  { key: 'education', label: '教育費', color: CHART_COLORS.education },
  { key: 'housing', label: '住まい', color: CHART_COLORS.housing },
  { key: 'vehicle', label: '乗り物', color: CHART_COLORS.vehicle },
  { key: 'living', label: '生活費', color: CHART_COLORS.living },
  { key: 'loan', label: 'ローン', color: CHART_COLORS.loan },
  { key: 'insurance', label: '保険', color: CHART_COLORS.insurance },
  {
    key: 'assetContribution',
    label: '運用積立',
    color: CHART_COLORS.assetContribution,
  },
  { key: 'taxSocial', label: '税金・社保', color: CHART_COLORS.taxSocial },
] as const satisfies ReadonlyArray<{
  key: LifetimeChartSeriesKey;
  label: string;
  color: string;
}>;

const BALANCE_LEGEND_ITEMS = [
  {
    key: 'financialAssets',
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.financialAssets,
    color: CHART_COLORS.financialAssets,
    type: 'step' as const,
  },
  {
    key: 'depositBalance',
    label: LIFETIME_CHART_BALANCE_LINE_LABELS.deposit,
    color: CHART_COLORS.financialAssets,
    type: 'step' as const,
  },
] as const satisfies ReadonlyArray<LifetimeChartLegendItem>;

const INCOME_LEGEND_ITEMS = ASSET_INCOME_LEGEND_ITEMS.map((item) => ({
  key: item.key,
  label: item.label,
  color: item.color,
  type: 'bar' as const,
}));

function legendItemsForBarFocus(
  barFocus: LifetimeChartCashFlowBarFocus,
): LifetimeChartLegendItem[] {
  if (barFocus === 'income') {
    return [
      ...INCOME_LEGEND_ITEMS,
      {
        key: 'expense',
        label: '支出',
        color: CHART_COLORS.expenseTotal,
        type: 'line',
      },
      ...BALANCE_LEGEND_ITEMS,
    ];
  }

  return [
    ...EXPENSE_LEGEND_ITEMS.map((item) => ({
      ...item,
      type: 'bar' as const,
    })),
    {
      key: 'income',
      label: '収入',
      color: CHART_COLORS.income,
      type: 'line',
    },
    ...BALANCE_LEGEND_ITEMS,
  ];
}

const LEGEND_ITEM_ORDER = new Map<
  LifetimeChartSeriesKey | LifetimeChartIncomeSeriesKey | 'expense',
  number
>([
  ...INCOME_LEGEND_ITEMS.map((item, index) => [item.key, index] as const),
  ...EXPENSE_LEGEND_ITEMS.map(
    (item, index) => [item.key, INCOME_LEGEND_ITEMS.length + index] as const,
  ),
  ['expense', INCOME_LEGEND_ITEMS.length + EXPENSE_LEGEND_ITEMS.length],
  ['income', INCOME_LEGEND_ITEMS.length + EXPENSE_LEGEND_ITEMS.length + 1],
  [
    'financialAssets',
    INCOME_LEGEND_ITEMS.length + EXPENSE_LEGEND_ITEMS.length + 2,
  ],
  [
    'depositBalance',
    INCOME_LEGEND_ITEMS.length + EXPENSE_LEGEND_ITEMS.length + 3,
  ],
]);

function isIncomeSeriesKey(
  key: LifetimeChartLegendItem['key'],
): key is LifetimeChartIncomeSeriesKey {
  return INCOME_LEGEND_ITEMS.some((item) => item.key === key);
}

interface LifetimeBalanceSimulationChartProps {
  data: CashFlowTableData;
  showHeader?: boolean;
  visiblePoints?: LifetimeBalanceChartPoint[];
  minHeadAge?: number;
  maxHeadAge?: number;
  tickAges?: number[];
  windowStart?: number;
  windowEnd?: number | null;
  totalPoints?: number;
  onWindowStartChange?: (value: number) => void;
  onWindowEndChange?: (value: number | null) => void;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: number;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    payload?: LifetimeBalanceChartPoint;
  }>;
  points: LifetimeBalanceChartPoint[];
  visibleSeries: LifetimeChartVisibleSeries;
  incomeSeriesVisibility: LifetimeChartIncomeSeriesVisibility;
  balanceLineMode: LifetimeChartBalanceLineMode | null;
  cashFlowBarFocus: LifetimeChartCashFlowBarFocus;
}

interface ChartMouseState {
  activeTooltipIndex?: number;
  activeLabel?: number | string;
  isTooltipActive?: boolean;
}

function headAgeFromChartMouseState(
  state: ChartMouseState,
  points: LifetimeBalanceChartPoint[],
): number | null {
  if (!state.isTooltipActive) return null;

  const byIndex =
    state.activeTooltipIndex != null && state.activeTooltipIndex >= 0
      ? points[state.activeTooltipIndex]?.headAge
      : undefined;
  if (byIndex != null) return byIndex;

  const label = state.activeLabel;
  if (typeof label === 'number' && Number.isInteger(label)) return label;

  return null;
}

function buildTooltipRows(
  point: LifetimeBalanceChartPoint,
  visibleSeries: LifetimeChartVisibleSeries,
  incomeSeriesVisibility: LifetimeChartIncomeSeriesVisibility,
  balanceLineMode: LifetimeChartBalanceLineMode | null,
  cashFlowBarFocus: LifetimeChartCashFlowBarFocus,
) {
  const rows: Array<{
    dataKey: LifetimeChartSeriesKey | LifetimeChartIncomeSeriesKey | 'expense';
    name: string;
    value: number;
    color: string;
  }> = [];

  if (cashFlowBarFocus === 'income') {
    for (const item of ASSET_INCOME_LEGEND_ITEMS) {
      if (!incomeSeriesVisibility[item.key]) continue;
      rows.push({
        dataKey: item.key,
        name: item.label,
        value: point[item.key],
        color: item.color,
      });
    }
    if (hasVisibleLifetimeChartExpenseSeries(visibleSeries)) {
      rows.push({
        dataKey: 'expense',
        name: '支出',
        value: visibleLifetimeChartExpenseTotal(point, visibleSeries),
        color: CHART_COLORS.expenseTotal,
      });
    }
  } else {
    if (visibleSeries.lifeEvent) {
      rows.push({
        dataKey: 'lifeEvent',
        name: 'ライフイベント',
        value: point.lifeEvent,
        color: CHART_COLORS.lifeEvent,
      });
    }
    if (visibleSeries.education) {
      rows.push({
        dataKey: 'education',
        name: '教育費',
        value: point.education,
        color: CHART_COLORS.education,
      });
    }
    if (visibleSeries.housing) {
      rows.push({
        dataKey: 'housing',
        name: '住まい',
        value: point.housing,
        color: CHART_COLORS.housing,
      });
    }
    if (visibleSeries.vehicle) {
      rows.push({
        dataKey: 'vehicle',
        name: '乗り物',
        value: point.vehicle,
        color: CHART_COLORS.vehicle,
      });
    }
    if (visibleSeries.living) {
      rows.push({
        dataKey: 'living',
        name: '生活費',
        value: point.living,
        color: CHART_COLORS.living,
      });
    }
    if (visibleSeries.loan) {
      rows.push({
        dataKey: 'loan',
        name: 'ローン',
        value: point.loan,
        color: CHART_COLORS.loan,
      });
    }
    if (visibleSeries.insurance) {
      rows.push({
        dataKey: 'insurance',
        name: '保険',
        value: point.insurance,
        color: CHART_COLORS.insurance,
      });
    }
    if (visibleSeries.assetContribution) {
      rows.push({
        dataKey: 'assetContribution',
        name: '運用積立',
        value: point.assetContribution,
        color: CHART_COLORS.assetContribution,
      });
    }
    if (visibleSeries.taxSocial) {
      rows.push({
        dataKey: 'taxSocial',
        name: '税金・社保',
        value: point.taxSocial,
        color: CHART_COLORS.taxSocial,
      });
    }
    if (visibleSeries.income) {
      rows.push({
        dataKey: 'income',
        name: '収入',
        value: point.income,
        color: CHART_COLORS.income,
      });
    }
  }
  if (balanceLineMode != null) {
    const balanceValue = balanceValueForMode(point, balanceLineMode);
    rows.push({
      dataKey:
        balanceLineMode === 'deposit' ? 'depositBalance' : 'financialAssets',
      name: LIFETIME_CHART_BALANCE_LINE_LABELS[balanceLineMode],
      value: balanceValue,
      color:
        balanceValue < 0
          ? CHART_COLORS.financialAssetsNegative
          : CHART_COLORS.financialAssets,
    });
  }

  return rows.filter((row) => {
    if (
      row.dataKey === 'income' ||
      row.dataKey === 'expense' ||
      row.dataKey === 'financialAssets' ||
      row.dataKey === 'depositBalance'
    ) {
      return true;
    }
    return row.value !== 0;
  });
}

export type LifetimeChartYAxisMaxMode = AssetChartYAxisMaxMode;
/** タイムライン付きは全画面時のみ有効 */
export type LifetimeChartContentMode = 'chart' | 'timeline';

export interface LifetimeChartHeaderProps {
  showTitle?: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showReset: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export interface LifetimeChartGridRowProps {
  chartData: LifetimeBalanceChartData;
  visiblePoints: LifetimeBalanceChartPoint[];
  minHeadAge: number;
  maxHeadAge: number;
  tickAges: number[];
  visibleSeries: LifetimeChartVisibleSeries;
  incomeSeriesVisibility?: LifetimeChartIncomeSeriesVisibility;
  cashFlowBarFocus?: LifetimeChartCashFlowBarFocus;
  manualYAxisMax?: number | null;
  /** 親ペインの高さに合わせてグラフを伸ばす（二分割表示用） */
  fillAvailableHeight?: boolean;
}

function xAxisRowStep(): number {
  return X_AXIS_ROW_HEIGHT + X_AXIS_ROW_GAP;
}

function xAxisRowY(rowIndex: number): number {
  return X_AXIS_ROW_START + rowIndex * xAxisRowStep() + X_AXIS_ROW_HEIGHT / 2;
}

function xAxisTotalHeight(rowCount: number): number {
  return X_AXIS_ROW_START + rowCount * xAxisRowStep() + 4;
}

function formatAxisMan(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
}

function DualAgeAxisTick({
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

  const rows = point.spouseAge != null
    ? [
        { value: String(point.headAge), label: '世帯主', rowIndex: 0 },
        { value: String(point.spouseAge), label: '配偶者', rowIndex: 1 },
      ]
    : [{ value: String(point.headAge), label: '世帯主', rowIndex: 0 }];
  const labelXInGroup = CHART_MARGIN_LEFT - 8 - x;

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

function ChartTooltip({
  active,
  label,
  payload,
  points,
  visibleSeries,
  incomeSeriesVisibility,
  balanceLineMode,
  cashFlowBarFocus,
}: ChartTooltipProps) {
  if (!active) return null;

  const point = resolveLifetimeChartTooltipPoint(points, label, payload);
  if (!point) return null;

  const tooltipRows = buildTooltipRows(
    point,
    visibleSeries,
    incomeSeriesVisibility,
    balanceLineMode,
    cashFlowBarFocus,
  ).sort(
    (left, right) =>
      (LEGEND_ITEM_ORDER.get(left.dataKey) ?? Number.MAX_SAFE_INTEGER) -
      (LEGEND_ITEM_ORDER.get(right.dataKey) ?? Number.MAX_SAFE_INTEGER),
  );

  if (tooltipRows.length === 0) return null;

  return (
    <div className="lifetime-chart-tooltip">
      <p className="lifetime-chart-tooltip-title">
        {point.calendarYear}年（{point.headAge}歳）
        {point.spouseAge != null ? ` / 配偶者${point.spouseAge}歳` : ''}
      </p>
      <div className="lifetime-chart-tooltip-body">
        {tooltipRows.map((item) => (
          <p key={item.dataKey} className="lifetime-chart-tooltip-row">
            <span
              className="lifetime-chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>{item.name}</span>
            <span>{formatCashFlowValue(item.value)}万円</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function LifetimeChartSidebar({
  summary,
  visibleSeries,
  onVisibleSeriesChange,
  incomeSeriesVisibility,
  onIncomeSeriesVisibilityChange,
  cashFlowBarFocus,
  onCashFlowBarFocusChange,
  yAxisMaxMode,
  manualYAxisMax,
  autoYAxisMax,
  onYAxisMaxModeChange,
  onManualYAxisMaxChange,
}: {
  summary: LifetimeBalanceChartData['summary'];
  visibleSeries: LifetimeChartVisibleSeries;
  onVisibleSeriesChange: (next: LifetimeChartVisibleSeries) => void;
  incomeSeriesVisibility: LifetimeChartIncomeSeriesVisibility;
  onIncomeSeriesVisibilityChange: (
    next: LifetimeChartIncomeSeriesVisibility,
  ) => void;
  cashFlowBarFocus: LifetimeChartCashFlowBarFocus;
  onCashFlowBarFocusChange: (focus: LifetimeChartCashFlowBarFocus) => void;
  yAxisMaxMode: LifetimeChartYAxisMaxMode;
  manualYAxisMax: number;
  autoYAxisMax: number;
  onYAxisMaxModeChange: (mode: LifetimeChartYAxisMaxMode) => void;
  onManualYAxisMaxChange: (value: number) => void;
}) {
  const legendItems = legendItemsForBarFocus(cashFlowBarFocus);
  const expenseVisible = hasVisibleLifetimeChartExpenseSeries(visibleSeries);

  const handleToggle = (key: LifetimeChartLegendItem['key']) => {
    if (key === 'expense') {
      onVisibleSeriesChange(
        setLifetimeChartExpenseSeriesVisible(visibleSeries, !expenseVisible),
      );
      return;
    }
    if (isIncomeSeriesKey(key)) {
      onIncomeSeriesVisibilityChange({
        ...incomeSeriesVisibility,
        [key]: !incomeSeriesVisibility[key],
      });
      return;
    }
    onVisibleSeriesChange(toggleLifetimeChartVisibleSeries(visibleSeries, key));
  };

  const isChecked = (key: LifetimeChartLegendItem['key']) => {
    if (key === 'expense') return expenseVisible;
    if (isIncomeSeriesKey(key)) return incomeSeriesVisibility[key];
    return visibleSeries[key];
  };

  const handleShowAll = () => {
    onVisibleSeriesChange(createDefaultLifetimeChartVisibleSeries());
    onIncomeSeriesVisibilityChange(createDefaultLifetimeChartIncomeVisibility());
  };

  const handleHideAll = () => {
    onVisibleSeriesChange(createAllHiddenLifetimeChartVisibleSeries());
    onIncomeSeriesVisibilityChange(createHiddenLifetimeChartIncomeVisibility());
  };

  return (
    <aside className="lifetime-chart-side-panel" aria-label="合計と凡例">
      <div className="lifetime-chart-summary">
        <h3 className="lifetime-chart-summary-title">合計金額</h3>
        <dl className="lifetime-chart-summary-list">
          <div className="lifetime-chart-summary-row">
            <dt>収入計</dt>
            <dd>{formatLifetimeTotalMan(summary.totalIncome)}</dd>
          </div>
          <div className="lifetime-chart-summary-row">
            <dt>支出計</dt>
            <dd>{formatLifetimeTotalMan(summary.totalExpenditure)}</dd>
          </div>
        </dl>
      </div>

      <AssetChartYAxisMaxPanel
        yAxisMaxMode={yAxisMaxMode}
        manualYAxisMax={manualYAxisMax}
        autoYAxisMax={autoYAxisMax}
        onYAxisMaxModeChange={onYAxisMaxModeChange}
        onManualYAxisMaxChange={onManualYAxisMaxChange}
      />

      <div className="lifetime-chart-cashflow-style-panel">
        <h3 className="lifetime-chart-summary-title">収支切替え</h3>
        <div
          className="lifetime-chart-yaxis-mode"
          role="group"
          aria-label="収支切替え"
        >
          <button
            type="button"
            className={
              cashFlowBarFocus === 'expense'
                ? 'lifetime-chart-yaxis-mode-btn is-active'
                : 'lifetime-chart-yaxis-mode-btn'
            }
            onClick={() => onCashFlowBarFocusChange('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={
              cashFlowBarFocus === 'income'
                ? 'lifetime-chart-yaxis-mode-btn is-active'
                : 'lifetime-chart-yaxis-mode-btn'
            }
            onClick={() => onCashFlowBarFocusChange('income')}
          >
            収入
          </button>
        </div>
      </div>

      <div className="lifetime-chart-legend-panel">
        <h3 className="lifetime-chart-legend-title">凡例</h3>
        <div className="lifetime-chart-legend-bulk">
          <button
            type="button"
            className="lifetime-chart-legend-bulk-btn"
            onClick={handleShowAll}
          >
            全表示
          </button>
          <button
            type="button"
            className="lifetime-chart-legend-bulk-btn"
            onClick={handleHideAll}
          >
            全解除
          </button>
        </div>
        <ul className="lifetime-chart-legend">
          {legendItems.map((item) => {
            const checked = isChecked(item.key);
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
                    onChange={() => handleToggle(item.key)}
                  />
                  <span
                    className={`lifetime-chart-legend-icon lifetime-chart-legend-icon--${item.type}`}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  <span className="lifetime-chart-legend-label">{item.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export function LifetimeChartHeader({
  showTitle = true,
  canZoomIn,
  canZoomOut,
  showReset,
  onZoomIn,
  onZoomOut,
  onReset,
}: LifetimeChartHeaderProps) {
  return (
    <div className="lifetime-chart-header">
      <div className="lifetime-chart-header-left">
        {showTitle ? (
          <h2 className="lifetime-chart-title">生涯収支グラフ</h2>
        ) : null}
      </div>
      <div className="lifetime-chart-toolbar">
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
        <button
          type="button"
          className="lifetime-chart-reset-btn"
          disabled={!showReset}
          onClick={onReset}
        >
          全期間
        </button>
      </div>
    </div>
  );
}

export function LifetimeChartGridRow({
  chartData,
  visiblePoints,
  minHeadAge,
  maxHeadAge,
  tickAges,
  visibleSeries,
  incomeSeriesVisibility = createDefaultLifetimeChartIncomeVisibility(),
  cashFlowBarFocus = 'expense',
  manualYAxisMax = null,
  fillAvailableHeight = false,
}: LifetimeChartGridRowProps) {
  const balanceLineMode = resolveActiveBalanceLineMode(visibleSeries);
  const scaleMode = resolveLifetimeChartScaleMode(visibleSeries);
  const showExpenseBars = cashFlowBarFocus === 'expense';
  const showIncomeBars = cashFlowBarFocus === 'income';
  const showIncomeLine = cashFlowBarFocus === 'expense' && visibleSeries.income;
  const showExpenseLine =
    cashFlowBarFocus === 'income' &&
    hasVisibleLifetimeChartExpenseSeries(visibleSeries);
  const incomeBreakdownForAxis =
    cashFlowBarFocus === 'income' ? incomeSeriesVisibility : null;

  const chartPoints = useMemo(
    () =>
      visiblePoints.map((point) => ({
        ...point,
        expenseTotal: visibleLifetimeChartExpenseTotal(point, visibleSeries),
      })),
    [visiblePoints, visibleSeries],
  );

  const axisDomain = useMemo(
    () =>
      resolveLifetimeChartAxisDomain(
        visiblePoints,
        scaleMode,
        balanceLineMode,
        visibleSeries,
        manualYAxisMax,
        incomeBreakdownForAxis,
      ),
    [
      visiblePoints,
      scaleMode,
      balanceLineMode,
      visibleSeries,
      manualYAxisMax,
      incomeBreakdownForAxis,
    ],
  );

  const chartHeight = CHART_HEIGHT_COMPACT;

  const yTicks = useMemo(
    () => getLifetimeChartYTicks(axisDomain.min, axisDomain.max),
    [axisDomain.min, axisDomain.max],
  );

  const { plotMinHeadAge, plotMaxHeadAge } = useMemo(
    () => getLifetimeChartPlotAgeDomain(minHeadAge, maxHeadAge),
    [minHeadAge, maxHeadAge],
  );

  const xAxisRowCount = chartData.spouseAxisLabel ? 2 : 1;
  const xAxisHeight = xAxisTotalHeight(xAxisRowCount);
  const fixedChartHeight = chartHeight + xAxisHeight;
  const chartContainerHeight = fillAvailableHeight
    ? '100%'
    : fixedChartHeight;

  const showRetirementLine = visiblePoints.some(
    (point) => point.headAge === RETIREMENT_HEAD_AGE,
  );

  const chartLinePoints = useMemo(
    () =>
      balanceLineMode == null
        ? []
        : buildBalanceLinePoints(visiblePoints, balanceLineMode),
    [visiblePoints, balanceLineMode],
  );

  const showBalanceLine = balanceLineMode != null;

  const balanceLineLabel =
    balanceLineMode == null
      ? ''
      : LIFETIME_CHART_BALANCE_LINE_LABELS[balanceLineMode];

  const [hoveredHeadAge, setHoveredHeadAge] = useState<number | null>(null);

  const hoveredPoint = useMemo(
    () => visiblePoints.find((point) => point.headAge === hoveredHeadAge) ?? null,
    [visiblePoints, hoveredHeadAge],
  );

  const hoveredBalance =
    hoveredPoint && balanceLineMode != null
      ? balanceValueForMode(hoveredPoint, balanceLineMode)
      : null;

  const handleChartMouseMove = (state: ChartMouseState) => {
    setHoveredHeadAge(headAgeFromChartMouseState(state, visiblePoints));
  };

  return (
    <>
      <div className="sim-align-label sim-chart-label-spacer" aria-hidden="true" />
      <div
        className={
          fillAvailableHeight
            ? 'sim-align-plot lifetime-chart-plot lifetime-chart-plot--fill'
            : 'sim-align-plot lifetime-chart-plot'
        }
        style={
          fillAvailableHeight
            ? undefined
            : { height: fixedChartHeight, flex: 'none' }
        }
      >
        <p className="lifetime-chart-y-unit" aria-hidden>
          （万円）
        </p>
        <ResponsiveContainer width="100%" height={chartContainerHeight}>
          <ComposedChart
            data={chartPoints}
            barCategoryGap={getSimulationBarCategoryGapPx(visiblePoints.length)}
            barGap={0}
            maxBarSize={EXPENSE_BAR_MAX_SIZE}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredHeadAge(null)}
            margin={{
              top: CHART_MARGIN_TOP,
              right: CHART_MARGIN_RIGHT,
              left: 0,
              bottom: xAxisHeight,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
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
            <XAxis
              xAxisId={LINE_X_AXIS_ID}
              dataKey="headAge"
              type="number"
              scale="linear"
              domain={[plotMinHeadAge, plotMaxHeadAge]}
              allowDataOverflow
              padding={{ left: 0, right: 0 }}
              hide
            />
            <YAxis
              yAxisId="main"
              tickFormatter={formatAxisMan}
              ticks={yTicks}
              stroke="#64748b"
              fontSize={11}
              width={CHART_MARGIN_LEFT}
              domain={[axisDomain.min, axisDomain.max]}
              allowDataOverflow
            />
            <ReferenceLine yAxisId="main" y={0} stroke="#cbd5e1" strokeWidth={1} />
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={props.label as number | undefined}
                  payload={
                    props.payload as ChartTooltipProps['payload']
                  }
                  points={visiblePoints}
                  visibleSeries={visibleSeries}
                  incomeSeriesVisibility={incomeSeriesVisibility}
                  balanceLineMode={balanceLineMode}
                  cashFlowBarFocus={cashFlowBarFocus}
                />
              )}
            />

            {showRetirementLine && (
              <ReferenceLine
                yAxisId="main"
                x={RETIREMENT_HEAD_AGE}
                stroke="#9aa3ad"
                strokeDasharray="4 4"
              />
            )}

            <Bar
              yAxisId="main"
              dataKey="taxSocial"
              name="税金・社保"
              stackId="expense"
              fill={CHART_COLORS.taxSocial}
              hide={!showExpenseBars || !visibleSeries.taxSocial}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="assetContribution"
              name="運用積立"
              stackId="expense"
              fill={CHART_COLORS.assetContribution}
              hide={!showExpenseBars || !visibleSeries.assetContribution}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="insurance"
              name="保険"
              stackId="expense"
              fill={CHART_COLORS.insurance}
              hide={!showExpenseBars || !visibleSeries.insurance}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="loan"
              name="ローン"
              stackId="expense"
              fill={CHART_COLORS.loan}
              hide={!showExpenseBars || !visibleSeries.loan}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="living"
              name="生活費"
              stackId="expense"
              fill={CHART_COLORS.living}
              hide={!showExpenseBars || !visibleSeries.living}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="vehicle"
              name="乗り物"
              stackId="expense"
              fill={CHART_COLORS.vehicle}
              hide={!showExpenseBars || !visibleSeries.vehicle}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="housing"
              name="住まい"
              stackId="expense"
              fill={CHART_COLORS.housing}
              hide={!showExpenseBars || !visibleSeries.housing}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="education"
              name="教育費"
              stackId="expense"
              fill={CHART_COLORS.education}
              hide={!showExpenseBars || !visibleSeries.education}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="main"
              dataKey="lifeEvent"
              name="ライフイベント"
              stackId="expense"
              fill={CHART_COLORS.lifeEvent}
              hide={!showExpenseBars || !visibleSeries.lifeEvent}
              isAnimationActive={false}
            />
            {ASSET_INCOME_STACK_ORDER.map((key) => {
              const item = ASSET_INCOME_LEGEND_ITEMS.find(
                (row) => row.key === key,
              );
              if (!item) return null;
              return (
                <Bar
                  key={key}
                  yAxisId="main"
                  dataKey={key}
                  name={item.label}
                  stackId="income"
                  fill={item.color}
                  hide={!showIncomeBars || !incomeSeriesVisibility[key]}
                  isAnimationActive={false}
                />
              );
            })}
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              type="monotone"
              dataKey="expenseTotal"
              name="支出"
              stroke={CHART_COLORS.expenseTotal}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              hide={!showExpenseLine}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              type="monotone"
              dataKey="income"
              name="収入"
              stroke={CHART_COLORS.income}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              hide={!showIncomeLine}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="balancePositive"
              name={balanceLineLabel}
              stroke={CHART_COLORS.financialAssets}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
              hide={!showBalanceLine}
              isAnimationActive={false}
            />
            <Line
              xAxisId={LINE_X_AXIS_ID}
              yAxisId="main"
              data={chartLinePoints}
              type="stepAfter"
              dataKey="balanceNegative"
              name={balanceLineLabel}
              stroke={CHART_COLORS.financialAssetsNegative}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              connectNulls={false}
              legendType="none"
              hide={!showBalanceLine}
              isAnimationActive={false}
            />
            {hoveredPoint &&
              hoveredBalance != null &&
              balanceLineMode != null &&
              hoveredBalance >= axisDomain.min &&
              hoveredBalance <= axisDomain.max && (
              <ReferenceDot
                xAxisId={LINE_X_AXIS_ID}
                yAxisId="main"
                x={hoveredPoint.headAge}
                y={hoveredBalance}
                r={5}
                fill={
                  hoveredBalance < 0
                    ? CHART_COLORS.financialAssetsNegative
                    : CHART_COLORS.financialAssets
                }
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="hidden"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function LifetimeBalanceSimulationChart({
  data,
  showHeader = true,
  visiblePoints: visiblePointsProp,
  minHeadAge: minHeadAgeProp,
  maxHeadAge: maxHeadAgeProp,
  tickAges: tickAgesProp,
  windowStart: windowStartProp,
  windowEnd: windowEndProp,
  totalPoints: totalPointsProp,
  onWindowStartChange,
  onWindowEndChange,
}: LifetimeBalanceSimulationChartProps) {
  const chartData = useMemo(() => buildLifetimeBalanceChartData(data), [data]);
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
  const [localWindowStart, setLocalWindowStart] = useState(0);
  const [localWindowEnd, setLocalWindowEnd] = useState<number | null>(null);

  const windowStart = windowStartProp ?? localWindowStart;
  const windowEnd = windowEndProp ?? localWindowEnd;
  const setWindowStart = onWindowStartChange ?? setLocalWindowStart;
  const setWindowEnd = onWindowEndChange ?? setLocalWindowEnd;
  const totalPoints = totalPointsProp ?? chartData.points.length;

  const endIndex = windowEnd ?? totalPoints;
  const visiblePoints = useMemo(
    () =>
      visiblePointsProp ??
      sliceLifetimeChartPoints(chartData.points, windowStart, endIndex),
    [visiblePointsProp, chartData.points, windowStart, endIndex],
  );

  const tickAges = useMemo(
    () => tickAgesProp ?? getLifetimeChartTickAges(visiblePoints),
    [tickAgesProp, visiblePoints],
  );

  const minHeadAge = minHeadAgeProp ?? visiblePoints[0]?.headAge ?? 0;
  const maxHeadAge =
    maxHeadAgeProp ??
    visiblePoints[visiblePoints.length - 1]?.headAge ??
    minHeadAge;

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

  const canZoomIn = visiblePoints.length > 12;
  const canZoomOut = windowStart > 0 || endIndex < totalPoints;

  const zoomIn = () => {
    if (!canZoomIn) return;
    const currentLength = endIndex - windowStart;
    const nextLength = Math.max(12, Math.floor(currentLength * 0.75));
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(totalPoints, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
  };

  const zoomOut = () => {
    if (!canZoomOut) return;
    const currentLength = endIndex - windowStart;
    const nextLength = Math.min(totalPoints, Math.ceil(currentLength * 1.35));
    const center = windowStart + Math.floor(currentLength / 2);
    const nextStart = Math.max(0, center - Math.floor(nextLength / 2));
    const nextEnd = Math.min(totalPoints, nextStart + nextLength);
    setWindowStart(nextStart);
    setWindowEnd(nextEnd === totalPoints ? null : nextEnd);
  };

  const resetZoom = () => {
    setWindowStart(0);
    setWindowEnd(null);
  };

  return (
    <section className="lifetime-chart-card" aria-label="生涯収支グラフ">
      <div className="lifetime-simulation-shell">
        <div className="lifetime-simulation-main">
          <LifetimeChartHeader
            showTitle={showHeader}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            showReset={canZoomOut}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
          />
          <div className="lifetime-simulation-scroll">
            <div className="lifetime-simulation-align lifetime-simulation-align--plot-only">
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
              />
            </div>
          </div>
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
    </section>
  );
}
