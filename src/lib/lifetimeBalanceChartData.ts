import type { CashFlowTableData } from '../types/cashFlow';
import { sumEducationExpense } from '../types/cashFlow';

export const RETIREMENT_HEAD_AGE = 65;

export interface LifetimeBalanceChartPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: number | null;
  income: number;
  living: number;
  housing: number;
  childRelated: number;
  lifeEvent: number;
  taxSocial: number;
  financialAssets: number;
}

export type LifetimeBalanceChartLinePoint = LifetimeBalanceChartPoint & {
  financialAssetsPositive: number | null;
  financialAssetsNegative: number | null;
};

/** 金融資産残高をプラス／マイナスで色分けするための系列データ */
export function buildFinancialAssetsLinePoints(
  points: LifetimeBalanceChartPoint[],
): LifetimeBalanceChartLinePoint[] {
  if (points.length === 0) return [];

  const enriched: LifetimeBalanceChartLinePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const value = point.financialAssets;

    if (i > 0) {
      const prev = points[i - 1];
      const prevValue = prev.financialAssets;
      const crossesZero =
        (prevValue >= 0 && value < 0) || (prevValue < 0 && value >= 0);

      if (crossesZero && prevValue !== value) {
        const ratio = (0 - prevValue) / (value - prevValue);
        const crossHeadAge =
          prev.headAge + ratio * (point.headAge - prev.headAge);

        enriched.push({
          ...point,
          headAge: crossHeadAge,
          financialAssets: 0,
          financialAssetsPositive: 0,
          financialAssetsNegative: 0,
        });
      }
    }

    enriched.push({
      ...point,
      financialAssetsPositive: value >= 0 ? value : null,
      financialAssetsNegative: value < 0 ? value : null,
    });
  }

  return enriched;
}

const TOOLTIP_BAR_DATA_KEYS = new Set([
  'taxSocial',
  'living',
  'housing',
  'childRelated',
  'lifeEvent',
  'income',
]);

/** ツールチップ用にホバー年齢から年次データを解決する */
export function resolveLifetimeChartTooltipPoint(
  points: LifetimeBalanceChartPoint[],
  label: number | undefined,
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    payload?: LifetimeBalanceChartPoint;
  }>,
): LifetimeBalanceChartPoint | undefined {
  if (points.length === 0) return undefined;

  for (const item of payload ?? []) {
    if (!TOOLTIP_BAR_DATA_KEYS.has(String(item.dataKey ?? ''))) continue;
    const age = item.payload?.headAge;
    if (typeof age === 'number' && Number.isInteger(age)) {
      const match = points.find((point) => point.headAge === age);
      if (match) return match;
    }
  }

  if (label == null) return undefined;

  const exact = points.find((point) => point.headAge === label);
  if (exact) return exact;

  if (!Number.isInteger(label)) {
    const roundedAge = Math.round(label);
    return points.find((point) => point.headAge === roundedAge);
  }

  return undefined;
}

export interface LifetimeBalanceChartSummary {
  totalIncome: number;
  totalExpenditure: number;
}

export interface LifetimeBalanceChartData {
  points: LifetimeBalanceChartPoint[];
  headAxisLabel: string;
  spouseAxisLabel: string | null;
  summary: LifetimeBalanceChartSummary;
  yAxisMin: number;
  yAxisMax: number;
}

function roundAxisBound(value: number, roundTo: number, direction: 'down' | 'up'): number {
  if (direction === 'down') {
    return Math.floor(value / roundTo) * roundTo;
  }
  return Math.ceil(value / roundTo) * roundTo;
}

function findHeadRow(data: CashFlowTableData) {
  return data.memberAgeRows.find((row) => row.label.includes('世帯主'));
}

function findSpouseRow(data: CashFlowTableData) {
  return data.memberAgeRows.find((row) => row.label.includes('配偶者'));
}

export function buildLifetimeBalanceChartData(
  data: CashFlowTableData,
): LifetimeBalanceChartData {
  const headRow = findHeadRow(data);
  const spouseRow = findSpouseRow(data);

  const points: LifetimeBalanceChartPoint[] = data.years.map((year) => {
    const breakdown = year.expenseBreakdown;
    const headAge = headRow?.agesByYear[year.calendarYear] ?? 0;
    const spouseAge = spouseRow?.agesByYear[year.calendarYear] ?? null;

    return {
      calendarYear: year.calendarYear,
      headAge,
      spouseAge,
      income: year.income,
      living: breakdown.living,
      housing: breakdown.housing + breakdown.vehicle,
      childRelated: sumEducationExpense(breakdown),
      lifeEvent: breakdown.lifeEvent + breakdown.medicalCare,
      taxSocial: year.taxSocial,
      financialAssets: year.financialAssets,
    };
  });

  const totalIncome = data.years.reduce((sum, year) => sum + year.income, 0);
  const totalExpenditure = data.years.reduce(
    (sum, year) => sum + year.expenditure + year.taxSocial,
    0,
  );

  const expenseTotals = points.map(
    (point) =>
      point.living +
      point.housing +
      point.childRelated +
      point.lifeEvent +
      point.taxSocial,
  );
  const allValues = points.flatMap((point) => [
    point.income,
    point.financialAssets,
    ...expenseTotals,
  ]);

  const yAxisMin = roundAxisBound(Math.min(...allValues, 0), 100, 'down');
  const rawMax = Math.max(...allValues, 0);
  const yAxisMax = Math.max(
    roundAxisBound(rawMax * 1.05, 100, 'up'),
    300,
  );

  return {
    points,
    headAxisLabel: '世帯主',
    spouseAxisLabel: spouseRow ? '配偶者' : null,
    summary: {
      totalIncome,
      totalExpenditure,
    },
    yAxisMin: Math.min(yAxisMin, 0),
    yAxisMax,
  };
}

export function getLifetimeChartTickAges(points: LifetimeBalanceChartPoint[]): number[] {
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

export function getLifetimeChartYTicks(yMin: number, yMax: number): number[] {
  const min = Math.min(yMin, 0);
  const max = yMax;
  const range = Math.max(max - min, 1);
  const roughStep = range / 6;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = Math.max(magnitude, Math.ceil(roughStep / magnitude) * magnitude);

  const ticks: number[] = [];
  const start = Math.floor(min / step) * step;

  for (let value = start; value <= max; value += step) {
    ticks.push(Math.round(value));
  }

  if (!ticks.includes(0) && min <= 0 && max >= 0) {
    ticks.push(0);
  }

  return [...new Set(ticks)].sort((a, b) => a - b);
}

export function formatLifetimeTotalMan(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}億円`;
  }
  return `${Math.round(value).toLocaleString('ja-JP')}万円`;
}

export function sliceLifetimeChartPoints(
  points: LifetimeBalanceChartPoint[],
  startIndex: number,
  endIndex: number,
): LifetimeBalanceChartPoint[] {
  if (points.length === 0) return [];
  const safeStart = Math.max(0, Math.min(startIndex, points.length - 1));
  const safeEnd = Math.max(safeStart + 1, Math.min(endIndex, points.length));
  return points.slice(safeStart, safeEnd);
}

export function getVisibleHeadAgeRange(points: LifetimeBalanceChartPoint[]): {
  minHeadAge: number;
  maxHeadAge: number;
} {
  if (points.length === 0) {
    return { minHeadAge: 0, maxHeadAge: 0 };
  }

  return {
    minHeadAge: points[0].headAge,
    maxHeadAge: points[points.length - 1].headAge,
  };
}
