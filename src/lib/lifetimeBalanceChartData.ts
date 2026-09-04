import type { CashFlowTableData, CashFlowYearRow, IncomeBreakdown } from '../types/cashFlow';
import {
  sumBonusDetail,
  sumDisabilityPension,
  sumEducationExpense,
  sumInsuranceIncomeBreakdown,
  sumOldAgeBasicDetail,
  sumOldAgeEmployeesPension,
  sumSalaryDetail,
  sumSurvivorBasicDetail,
  sumSurvivorEmployeesDetail,
} from '../types/cashFlow';

export const RETIREMENT_HEAD_AGE = 65;

/** 収入グラフの表示単位（家計合算／個人） */
export type AssetIncomeChartScope = 'household' | 'head' | 'spouse';

export interface AssetIncomeChartScopeOption {
  value: AssetIncomeChartScope;
  label: string;
}

export interface AssetIncomeChartMemberIds {
  headMemberId: string | null;
  spouseMemberId: string | null;
}

export interface LifetimeBalanceChartPoint {
  calendarYear: number;
  headAge: number;
  spouseAge: number | null;
  income: number;
  /** 収入内訳（万円）。合計は income と一致 */
  salary: number;
  bonus: number;
  oldAgeBasic: number;
  oldAgeEmployees: number;
  disabilityPension: number;
  survivorBasic: number;
  survivorEmployees: number;
  childAllowance: number;
  insuranceIncome: number;
  retirementAllowance: number;
  businessCf: number;
  realEstateCf: number;
  transferCf: number;
  taxFreeIncome: number;
  otherIncome: number;
  living: number;
  housing: number;
  vehicle: number;
  education: number;
  lifeEvent: number;
  loan: number;
  insurance: number;
  /** 家計負担の運用積立（万円）。事業主掛金・貯蓄セクターは含まない */
  assetContribution: number;
  taxSocial: number;
  /** 年間収支（可処分所得 − 支出、万円） */
  annualBalance: number;
  /** 金融資産合計（貯蓄＋運用）の年末残高 */
  financialAssets: number;
  /** 現金・預金（普通・定期・その他貯蓄）の年末残高 */
  depositBalance: number;
}

export type LifetimeChartBalanceLineMode = 'financialAssets' | 'deposit';

/** グラフ凡例の表示 ON/OFF（Y軸計算にも使用） */
export type LifetimeChartSeriesVisibility = {
  lifeEvent: boolean;
  education: boolean;
  housing: boolean;
  vehicle: boolean;
  living: boolean;
  loan: boolean;
  insurance: boolean;
  assetContribution: boolean;
  taxSocial: boolean;
  income: boolean;
  financialAssets: boolean;
  depositBalance: boolean;
};

export const ALL_LIFETIME_CHART_SERIES_VISIBLE: LifetimeChartSeriesVisibility = {
  lifeEvent: true,
  education: true,
  housing: true,
  vehicle: true,
  living: true,
  loan: true,
  insurance: true,
  assetContribution: true,
  taxSocial: true,
  income: true,
  financialAssets: false,
  depositBalance: true,
};

export const LIFETIME_CHART_BALANCE_LINE_LABELS: Record<
  LifetimeChartBalanceLineMode,
  string
> = {
  financialAssets: '金融資産残高',
  deposit: '現金・預金残高',
};

export type LifetimeBalanceChartLinePoint = LifetimeBalanceChartPoint & {
  balancePositive: number | null;
  balanceNegative: number | null;
};

export function balanceValueForMode(
  point: LifetimeBalanceChartPoint,
  mode: LifetimeChartBalanceLineMode,
): number {
  return mode === 'deposit' ? point.depositBalance : point.financialAssets;
}

export type LifetimeChartSeriesKey = keyof LifetimeChartSeriesVisibility;

const BALANCE_SERIES_KEYS = new Set<LifetimeChartSeriesKey>([
  'financialAssets',
  'depositBalance',
]);

export function createDefaultLifetimeChartVisibleSeries(): LifetimeChartSeriesVisibility {
  return { ...ALL_LIFETIME_CHART_SERIES_VISIBLE };
}

export function createAllHiddenLifetimeChartVisibleSeries(): LifetimeChartSeriesVisibility {
  return {
    lifeEvent: false,
    education: false,
    housing: false,
    vehicle: false,
    living: false,
    loan: false,
    insurance: false,
    assetContribution: false,
    taxSocial: false,
    income: false,
    financialAssets: false,
    depositBalance: false,
  };
}

export function resolveActiveBalanceLineMode(
  visibleSeries: LifetimeChartSeriesVisibility,
): LifetimeChartBalanceLineMode | null {
  if (visibleSeries.depositBalance) return 'deposit';
  if (visibleSeries.financialAssets) return 'financialAssets';
  return null;
}

export function toggleLifetimeChartVisibleSeries(
  current: LifetimeChartSeriesVisibility,
  key: LifetimeChartSeriesKey,
): LifetimeChartSeriesVisibility {
  if (BALANCE_SERIES_KEYS.has(key)) {
    const next = { ...current, [key]: !current[key] };
    if (key === 'financialAssets' && next.financialAssets) {
      next.depositBalance = false;
    }
    if (key === 'depositBalance' && next.depositBalance) {
      next.financialAssets = false;
    }
    return next;
  }

  return { ...current, [key]: !current[key] };
}

/** 残高折れ線をプラス／マイナスで色分けするための系列データ */
export function buildBalanceLinePoints(
  points: LifetimeBalanceChartPoint[],
  mode: LifetimeChartBalanceLineMode,
): LifetimeBalanceChartLinePoint[] {
  if (points.length === 0) return [];

  const enriched: LifetimeBalanceChartLinePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const value = balanceValueForMode(point, mode);

    if (i > 0) {
      const prev = points[i - 1];
      const prevValue = balanceValueForMode(prev, mode);
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
          depositBalance: 0,
          balancePositive: 0,
          balanceNegative: 0,
        });
      }
    }

    enriched.push({
      ...point,
      balancePositive: value >= 0 ? value : null,
      balanceNegative: value < 0 ? value : null,
    });
  }

  return enriched;
}

/** @deprecated buildBalanceLinePoints を使用 */
export function buildFinancialAssetsLinePoints(
  points: LifetimeBalanceChartPoint[],
): LifetimeBalanceChartLinePoint[] {
  return buildBalanceLinePoints(points, 'financialAssets');
}

const TOOLTIP_BAR_DATA_KEYS = new Set([
  'taxSocial',
  'living',
  'housing',
  'vehicle',
  'education',
  'lifeEvent',
  'loan',
  'insurance',
  'assetContribution',
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

export type LifetimeChartScaleMode = 'cashFlow' | 'assets';

export interface LifetimeChartAxisDomain {
  min: number;
  max: number;
}

export interface LifetimeBalanceChartData {
  points: LifetimeBalanceChartPoint[];
  headAxisLabel: string;
  spouseAxisLabel: string | null;
  summary: LifetimeBalanceChartSummary;
  yAxisMin: number;
  yAxisMax: number;
}

/** 収支スケールの下限（万円）。これ未満だと棒が極端に伸びるのを防ぐ */
const CASH_FLOW_AXIS_FLOOR = 100;

/**
 * 収支重視時、資産による軸拡大を抑える下限シェア。
 * 例: 0.4 → 収支ピークが軸上限の少なくとも約40%を占める。
 */
const MIN_CASH_FLOW_AXIS_SHARE = 0.4;

function niceAxisMax(value: number, floor: number): number {
  if (value <= 0) return floor;
  const padded = value * 1.05;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(nice * magnitude, floor);
}

function niceAxisMin(value: number): number {
  if (value >= 0) return 0;
  return -niceAxisMax(-value, 0);
}

function visibleExpenseStackTotal(
  point: LifetimeBalanceChartPoint,
  visibility: LifetimeChartSeriesVisibility,
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

function resolveAxisFloor(peak: number): number {
  if (peak <= 0) return 1;
  const scaled = niceAxisMax(peak * 1.1, 1);
  return Math.min(CASH_FLOW_AXIS_FLOOR, scaled);
}

function collectVisibleChartValues(
  points: LifetimeBalanceChartPoint[],
  visibility: LifetimeChartSeriesVisibility,
  balanceLineMode: LifetimeChartBalanceLineMode | null,
): number[] {
  const values: number[] = [];

  for (const point of points) {
    if (visibility.income) {
      values.push(point.income);
    }

    const stackTotal = visibleExpenseStackTotal(point, visibility);
    if (stackTotal !== 0 || hasVisibleExpenseSeries(visibility)) {
      values.push(stackTotal);
    }

    if (balanceLineMode != null) {
      values.push(balanceValueForMode(point, balanceLineMode));
    }
  }

  return values;
}

function hasVisibleExpenseSeries(
  visibility: LifetimeChartSeriesVisibility,
): boolean {
  return (
    visibility.taxSocial ||
    visibility.living ||
    visibility.housing ||
    visibility.vehicle ||
    visibility.lifeEvent ||
    visibility.education ||
    visibility.loan ||
    visibility.insurance ||
    visibility.assetContribution
  );
}

function hasAnyVisibleSeries(
  visibility: LifetimeChartSeriesVisibility,
  balanceLineMode: LifetimeChartBalanceLineMode | null,
): boolean {
  return (
    visibility.income ||
    hasVisibleExpenseSeries(visibility) ||
    balanceLineMode != null
  );
}

/**
 * 単一Y軸のドメイン。
 * - cashFlow: 収入・支出を優先（残高線が大きくても棒が見やすい）
 * - assets: 表示中の残高線を含む全系列が見えるよう軸を広げる
 * - visibility: 凡例で ON の系列のみを軸計算に反映
 */
export function resolveLifetimeChartAxisDomain(
  points: LifetimeBalanceChartPoint[],
  mode: LifetimeChartScaleMode = 'cashFlow',
  balanceLineMode: LifetimeChartBalanceLineMode | null = 'deposit',
  visibility: LifetimeChartSeriesVisibility = ALL_LIFETIME_CHART_SERIES_VISIBLE,
): LifetimeChartAxisDomain {
  if (
    points.length === 0 ||
    !hasAnyVisibleSeries(visibility, balanceLineMode)
  ) {
    return { min: 0, max: CASH_FLOW_AXIS_FLOOR };
  }

  const chartValues = collectVisibleChartValues(
    points,
    visibility,
    balanceLineMode,
  );

  const cashFlowValues: number[] = [];
  const balanceValues: number[] = [];

  for (const point of points) {
    if (visibility.income) {
      cashFlowValues.push(point.income);
    }
    const stackTotal = visibleExpenseStackTotal(point, visibility);
    if (stackTotal !== 0 || hasVisibleExpenseSeries(visibility)) {
      cashFlowValues.push(stackTotal);
    }
    if (balanceLineMode != null) {
      balanceValues.push(balanceValueForMode(point, balanceLineMode));
    }
  }

  const cashFlowMaxRaw = Math.max(...cashFlowValues, 0);
  const cashFlowMinRaw = Math.min(...cashFlowValues, 0);
  const balanceMaxRaw =
    balanceValues.length > 0 ? Math.max(...balanceValues, 0) : 0;
  const balanceMinRaw =
    balanceValues.length > 0 ? Math.min(...balanceValues, 0) : 0;

  const visiblePeak = Math.max(
    ...chartValues,
    -Math.min(...chartValues, 0),
    0,
  );
  const axisFloor = resolveAxisFloor(visiblePeak);

  if (mode === 'assets') {
    return {
      min: niceAxisMin(Math.min(cashFlowMinRaw, balanceMinRaw)),
      max: niceAxisMax(
        Math.max(cashFlowMaxRaw, balanceMaxRaw),
        axisFloor,
      ),
    };
  }

  const flowPeak = Math.max(cashFlowMaxRaw, -cashFlowMinRaw, 1);
  const balanceLimit = flowPeak / MIN_CASH_FLOW_AXIS_SHARE;

  return {
    min: niceAxisMin(
      Math.min(cashFlowMinRaw, Math.max(balanceMinRaw, -balanceLimit)),
    ),
    max: niceAxisMax(
      Math.max(cashFlowMaxRaw, Math.min(balanceMaxRaw, balanceLimit)),
      axisFloor,
    ),
  };
}

function findHeadRow(data: CashFlowTableData) {
  return data.memberAgeRows.find((row) => row.role === 'head');
}

function findSpouseRow(data: CashFlowTableData) {
  return data.memberAgeRows.find((row) => row.role === 'spouse');
}

export function resolveAssetIncomeChartMemberIds(
  data: CashFlowTableData,
): AssetIncomeChartMemberIds {
  return {
    headMemberId: findHeadRow(data)?.memberId ?? null,
    spouseMemberId: findSpouseRow(data)?.memberId ?? null,
  };
}

function memberHasIncomeSlice(
  data: CashFlowTableData,
  memberId: string | null,
): boolean {
  if (!memberId) return false;
  const firstYear = data.years[0];
  return firstYear?.memberYearByMemberId?.[memberId] != null;
}

/** 収入グラフで選択可能な表示単位（データがあるもののみ） */
export function resolveAssetIncomeChartScopes(
  data: CashFlowTableData,
): AssetIncomeChartScopeOption[] {
  const { headMemberId, spouseMemberId } = resolveAssetIncomeChartMemberIds(data);
  const options: AssetIncomeChartScopeOption[] = [
    { value: 'household', label: '家計' },
  ];

  if (memberHasIncomeSlice(data, headMemberId)) {
    options.push({ value: 'head', label: '世帯主' });
  }
  if (memberHasIncomeSlice(data, spouseMemberId)) {
    options.push({ value: 'spouse', label: '配偶者' });
  }

  return options;
}

function emptyIncomeChartFields(): Pick<
  LifetimeBalanceChartPoint,
  | 'income'
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
  | 'otherIncome'
> {
  return {
    income: 0,
    salary: 0,
    bonus: 0,
    oldAgeBasic: 0,
    oldAgeEmployees: 0,
    disabilityPension: 0,
    survivorBasic: 0,
    survivorEmployees: 0,
    childAllowance: 0,
    insuranceIncome: 0,
    retirementAllowance: 0,
    businessCf: 0,
    realEstateCf: 0,
    transferCf: 0,
    taxFreeIncome: 0,
    otherIncome: 0,
  };
}

function incomeBreakdownToChartFields(
  incomeBd: IncomeBreakdown,
  income: number,
): ReturnType<typeof emptyIncomeChartFields> {
  return {
    income,
    salary: sumSalaryDetail(incomeBd.salary),
    bonus: sumBonusDetail(incomeBd.bonus),
    oldAgeBasic: sumOldAgeBasicDetail(incomeBd.pension.oldAge.basic),
    oldAgeEmployees: sumOldAgeEmployeesPension(incomeBd.pension.oldAge),
    disabilityPension: sumDisabilityPension(incomeBd.pension.disability),
    survivorBasic: sumSurvivorBasicDetail(incomeBd.pension.survivor.basic),
    survivorEmployees: sumSurvivorEmployeesDetail(
      incomeBd.pension.survivor.employees,
    ),
    childAllowance: incomeBd.childAllowance ?? 0,
    insuranceIncome: sumInsuranceIncomeBreakdown(incomeBd.insurance),
    retirementAllowance: incomeBd.retirementAllowance,
    businessCf: incomeBd.businessCf,
    realEstateCf: incomeBd.realEstateCf,
    transferCf: incomeBd.transferCf,
    taxFreeIncome: incomeBd.taxFreeIncome,
    otherIncome: incomeBd.otherIncome,
  };
}

function resolveIncomeChartFieldsForYear(
  year: CashFlowYearRow,
  scope: AssetIncomeChartScope,
  memberIds: AssetIncomeChartMemberIds,
): ReturnType<typeof emptyIncomeChartFields> {
  if (scope === 'household') {
    return incomeBreakdownToChartFields(year.incomeBreakdown, year.income);
  }

  const memberId =
    scope === 'head' ? memberIds.headMemberId : memberIds.spouseMemberId;
  if (!memberId) {
    return emptyIncomeChartFields();
  }

  const slice = year.memberYearByMemberId?.[memberId];
  if (!slice) {
    return emptyIncomeChartFields();
  }

  return incomeBreakdownToChartFields(slice.incomeBreakdown, slice.income);
}

function buildExpenseChartFields(
  year: CashFlowYearRow,
): Pick<
  LifetimeBalanceChartPoint,
  | 'living'
  | 'housing'
  | 'vehicle'
  | 'education'
  | 'lifeEvent'
  | 'loan'
  | 'insurance'
  | 'assetContribution'
  | 'taxSocial'
  | 'annualBalance'
  | 'financialAssets'
  | 'depositBalance'
> {
  const breakdown = year.expenseBreakdown;
  const housingInsurance =
    breakdown.housingDetail.rentalInsurancePremium +
    breakdown.housingDetail.ownedInsurancePremium;
  const vehicleInsurance = breakdown.vehicleDetail.insurance;
  const unlinkedHousingLoan = breakdown.loanRepaymentDetail.housing;
  const unlinkedVehicleLoan = breakdown.loanRepaymentDetail.vehicle;

  return {
    living: breakdown.living,
    housing: breakdown.housing - housingInsurance + unlinkedHousingLoan,
    vehicle: breakdown.vehicle - vehicleInsurance + unlinkedVehicleLoan,
    education: sumEducationExpense(breakdown),
    lifeEvent: breakdown.lifeEvent,
    loan:
      breakdown.loanRepaymentDetail.education +
      breakdown.loanRepaymentDetail.free,
    insurance: breakdown.insuranceOther + housingInsurance + vehicleInsurance,
    assetContribution: year.investContribution,
    taxSocial: year.taxSocial,
    annualBalance: year.annualBalance,
    financialAssets: year.financialAssets,
    depositBalance: year.savings,
  };
}

/** 収入グラフ用の年次ポイント（表示単位に応じて収入内訳のみ切り替え） */
export function buildAssetIncomeChartPoints(
  data: CashFlowTableData,
  scope: AssetIncomeChartScope = 'household',
): LifetimeBalanceChartPoint[] {
  const headRow = findHeadRow(data);
  const spouseRow = findSpouseRow(data);
  const memberIds = resolveAssetIncomeChartMemberIds(data);

  return data.years.map((year) => {
    const headAge = headRow?.agesByYear[year.calendarYear] ?? 0;
    const spouseAge = spouseRow?.agesByYear[year.calendarYear] ?? null;

    return {
      calendarYear: year.calendarYear,
      headAge,
      spouseAge,
      ...resolveIncomeChartFieldsForYear(year, scope, memberIds),
      ...buildExpenseChartFields(year),
    };
  });
}

export function buildLifetimeBalanceChartData(
  data: CashFlowTableData,
): LifetimeBalanceChartData {
  const spouseRow = findSpouseRow(data);
  const points = buildAssetIncomeChartPoints(data, 'household');

  const totalIncome = data.years.reduce((sum, year) => sum + year.income, 0);
  const totalExpenditure = data.years.reduce(
    (sum, year) =>
      sum + year.expenditure + year.taxSocial,
    0,
  );

  const { min: yAxisMin, max: yAxisMax } = resolveLifetimeChartAxisDomain(points);

  return {
    points,
    headAxisLabel: '世帯主',
    spouseAxisLabel: spouseRow ? '配偶者' : null,
    summary: {
      totalIncome,
      totalExpenditure,
    },
    yAxisMin,
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

/**
 * 数値 X 軸で端の棒が半分に切れないよう、カテゴリ半幅ぶんドメインを広げる。
 * タイムラインの横位置も同じレンジで合わせる。
 */
export function getLifetimeChartPlotAgeDomain(
  minHeadAge: number,
  maxHeadAge: number,
): { plotMinHeadAge: number; plotMaxHeadAge: number } {
  if (maxHeadAge <= minHeadAge) {
    return {
      plotMinHeadAge: minHeadAge - 0.5,
      plotMaxHeadAge: minHeadAge + 0.5,
    };
  }
  return {
    plotMinHeadAge: minHeadAge - 0.5,
    plotMaxHeadAge: maxHeadAge + 0.5,
  };
}
