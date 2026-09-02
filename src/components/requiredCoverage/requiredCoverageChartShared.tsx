import { useEffect, useMemo, useState } from 'react';

import { formatLifetimeTotalMan } from '../../lib/lifetimeBalanceChartData';
import type { LifetimeChartBalanceLineMode } from '../../lib/lifetimeBalanceChartData';
import {
  calcDeathTimingCoverageRow,
  type RequiredCoverageChartPoint,
} from '../../lib/requiredCoverage';
import { SIMULATION_CHART_MARGIN_LEFT } from '../../lib/simulationLayout';

export const CHART_HEIGHT = 360;
export const NEED_LINE_CHART_HEIGHT = 280;
export const COMPACT_CHART_HEIGHT = 240;
export const CHART_MARGIN_LEFT = SIMULATION_CHART_MARGIN_LEFT;
export const CHART_MARGIN_TOP = 16;
export const EXPENSE_BAR_MAX_SIZE = 36;
export const LINE_X_AXIS_ID = 'line';
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

export const CHART_COLORS = {
  remainingIncome: '#5d9a62',
  remainingTotal: '#f97316',
  expenseBase: '#c5cdd6',
  yearNet: '#1f9690',
  yearNetDeficit: '#e11d48',
  savings: '#1e4a8a',
  savingsNegative: '#e11d48',
} as const;

export type CoverageChartDisplayPoint = RequiredCoverageChartPoint & {
  expenseBase: number;
  preparedSavings: number;
  preparedEarned: number;
  preparedSurvivor: number;
  preparedChild: number;
  preparedOldAgeBasic: number;
  preparedOldAgeEmployees: number;
  preparedTotal: number;
  shortfall: number;
  sufficiencyPct: number;
  preparedFill: number;
  incomeGap: number;
  savingsBalancePositive: number | null;
  savingsBalanceNegative: number | null;
};

export type CoverageAgePoint = {
  headAge: number;
  spouseAge: number | null;
};

function clipPreparedLayer(
  amount: number,
  remaining: number,
): { value: number; remaining: number } {
  const value = Math.max(0, Math.min(amount, remaining));
  return { value, remaining: remaining - value };
}

export function coveragePreparedResourceLabels(
  mode: LifetimeChartBalanceLineMode,
): { legend: string; formula: string; asset: string } {
  if (mode === 'financialAssets') {
    return {
      legend: '万一後の収入・金融資産',
      formula: '収入・金融資産',
      asset: '金融資産',
    };
  }
  return {
    legend: '万一後の収入・現預金',
    formula: '収入・現預金',
    asset: '現預金',
  };
}

export function deathTimeBalanceForMode(
  point: RequiredCoverageChartPoint,
  mode: LifetimeChartBalanceLineMode,
): number {
  return mode === 'financialAssets'
    ? point.deathTimeFinancialAssetsMan
    : point.deathTimeDepositMan;
}

export function withDeathTimingSweep(
  point: RequiredCoverageChartPoint,
  preparedBalance: number,
): CoverageChartDisplayPoint {
  const row = calcDeathTimingCoverageRow({
    remainingExpenseTotal: point.remainingExpenseTotal,
    remainingEarned: point.remainingEarned,
    remainingSurvivorBasic: point.remainingSurvivorBasic,
    remainingSurvivorEmployees: point.remainingSurvivorEmployees,
    remainingMiddleAgedWidowAdd: point.remainingMiddleAgedWidowAdd,
    remainingChildAllowance: point.remainingChildAllowance,
    remainingOldAgeBasic: point.remainingOldAgeBasic,
    remainingOldAgeEmployees: point.remainingOldAgeEmployees,
    initialSavings: preparedBalance,
  });
  let remaining = row.expenseBase;
  const savings = clipPreparedLayer(row.preparedSavings, remaining);
  remaining = savings.remaining;
  const earned = clipPreparedLayer(row.preparedEarned, remaining);
  remaining = earned.remaining;
  const survivor = clipPreparedLayer(row.preparedSurvivorBasic, remaining);
  remaining = survivor.remaining;
  const child = clipPreparedLayer(row.preparedChildAllowance, remaining);
  remaining = child.remaining;
  const oldAgeBasic = clipPreparedLayer(row.preparedOldAgeBasic, remaining);
  remaining = oldAgeBasic.remaining;
  const oldAgeEmployees = clipPreparedLayer(
    row.preparedOldAgeEmployees,
    remaining,
  );
  return {
    ...point,
    expenseBase: row.expenseBase,
    preparedSavings: savings.value,
    preparedEarned: earned.value,
    preparedSurvivor: survivor.value,
    preparedChild: child.value,
    preparedOldAgeBasic: oldAgeBasic.value,
    preparedOldAgeEmployees: oldAgeEmployees.value,
    preparedTotal: row.preparedTotal,
    shortfall: row.shortfall,
    sufficiencyPct: row.sufficiencyPct,
    preparedFill: row.preparedTotal,
    incomeGap: row.shortfall,
    savingsBalancePositive:
      point.savingsBalance >= 0 ? point.savingsBalance : null,
    savingsBalanceNegative:
      point.savingsBalance < 0 ? point.savingsBalance : null,
  };
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

export function getTickAges(points: CoverageAgePoint[]): number[] {
  if (points.length === 0) return [];
  const minAge = points[0].headAge;
  const maxAge = points[points.length - 1].headAge;
  const start = Math.ceil(minAge / 5) * 5;
  const ticks: number[] = [];
  for (let age = start; age <= maxAge; age += 5) {
    ticks.push(age);
  }
  if (ticks[ticks.length - 1] !== maxAge) {
    ticks.push(maxAge);
  }
  return ticks;
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
  points: CoverageAgePoint[];
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

export function CoverageFormulaPanel({
  expense,
  income,
  shortfall,
  incomeLabel = '収入・現預金',
}: {
  expense: number;
  income: number;
  shortfall: number;
  incomeLabel?: string;
}) {
  return (
    <div className="coverage-formula">
      <div className="coverage-formula-eq">
        <span className="coverage-formula-op" aria-hidden />
        <span className="coverage-formula-term">
          <span className="coverage-formula-label">
            <span
              className="coverage-formula-swatch"
              style={{ backgroundColor: CHART_COLORS.expenseBase }}
            />
            支出
          </span>
          <span className="coverage-formula-value">
            {formatLifetimeTotalMan(expense)}
          </span>
        </span>
        <span className="coverage-formula-op" aria-hidden>
          −
        </span>
        <span className="coverage-formula-term">
          <span className="coverage-formula-label">
            <span
              className="coverage-formula-swatch"
              style={{ backgroundColor: CHART_COLORS.remainingIncome }}
            />
            {incomeLabel}
          </span>
          <span className="coverage-formula-value">
            {formatLifetimeTotalMan(income)}
          </span>
        </span>
        <span className="coverage-formula-op" aria-hidden>
          ＝
        </span>
        <span className="coverage-formula-term">
          <span className="coverage-formula-label">
            <span
              className="coverage-formula-swatch"
              style={{ backgroundColor: CHART_COLORS.remainingTotal }}
            />
            必要保障額
          </span>
          <span className="coverage-formula-value coverage-formula-value--need">
            {formatLifetimeTotalMan(shortfall)}
          </span>
        </span>
      </div>
    </div>
  );
}

export function CoverageChartZoomToolbar({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
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

export function useCoverageChartWindow<T>(points: T[]) {
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

  return {
    visiblePoints,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    reset,
  };
}
