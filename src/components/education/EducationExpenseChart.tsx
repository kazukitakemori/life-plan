import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildAggregatedEducationChartSeries,
  buildAggregatedEducationChartXAxisRows,
  buildEducationChartSeries,
  buildEducationChartXAxisRows,
  formatEducationChartMemberAxisLabel,
  getEducationChartTickYears,
  type EducationChartPoint,
  type EducationChartXAxisRow,
} from '../../lib/educationChartData';
import type { FamilyMember } from '../../types/family';
import type { EducationByMember, EducationExpenseEntry } from '../../types/education';

const CHART_MARGIN_LEFT = 48;
const CHART_HEIGHT_MEMBER = 520;
const CHART_HEIGHT_AGGREGATE = 620;
const CHART_HEIGHT_MOBILE_MEMBER = 400;
const CHART_HEIGHT_MOBILE_AGGREGATE = 430;
const BAR_SIZE_MEMBER = 28;
const BAR_SIZE_AGGREGATE = 36;
const BAR_SIZE_MOBILE = 18;
const X_AXIS_LABEL_X = CHART_MARGIN_LEFT - 8;
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;
const MOBILE_CHART_MEDIA_QUERY = '(max-width: 768px)';

interface EducationExpenseChartBaseProps {
  headMember: FamilyMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
}

interface EducationExpenseMemberChartProps extends EducationExpenseChartBaseProps {
  mode?: 'member';
  member: FamilyMember;
  entries: EducationExpenseEntry[];
}

interface EducationExpenseAggregateChartProps
  extends EducationExpenseChartBaseProps {
  mode: 'aggregate';
  eligibleMembers: FamilyMember[];
  educationByMember: EducationByMember;
}

type EducationExpenseChartProps =
  | EducationExpenseMemberChartProps
  | EducationExpenseAggregateChartProps;

function useMobileChartLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_CHART_MEDIA_QUERY).matches
      : false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_CHART_MEDIA_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
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

function getLegendHeight(isAggregate: boolean, barCount: number): number {
  if (!isAggregate) return 28;
  const rows = Math.ceil((barCount + 1) / 3);
  return Math.max(36, rows * 22 + 12);
}

function limitTickYears(ticks: number[], maxTicks: number): number[] {
  if (ticks.length <= maxTicks) return ticks;
  if (maxTicks <= 1) return [ticks[0]];

  const result: number[] = [];
  const lastIndex = ticks.length - 1;

  for (let index = 0; index < maxTicks; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (maxTicks - 1));
    const value = ticks[sourceIndex];
    if (result[result.length - 1] !== value) result.push(value);
  }

  return result;
}

function removeCrowdedFinalTick(ticks: number[], minimumYearGap = 2): number[] {
  if (ticks.length < 2) return ticks;

  const last = ticks[ticks.length - 1];
  const previous = ticks[ticks.length - 2];
  if (last - previous > minimumYearGap) return ticks;

  return [...ticks.slice(0, -2), last];
}

function compactLegendLabel(value: string): string {
  return value.replace(/\s*\([^)]*生\)$/, '');
}

function formatAxisMan(value: number): string {
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
}

function formatTooltipMan(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('ja-JP', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })}万円`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
    payload?: EducationChartPoint;
  }>;
  label?: number;
  xAxisRows?: EducationChartXAxisRow[];
  showContext?: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
  xAxisRows = [],
  showContext = false,
}: ChartTooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const hasMemberBars = payload.some((item) =>
    String(item.dataKey).startsWith('annual_'),
  );
  const items = payload.filter((item) => {
    if (item.dataKey === 'annualMan' && hasMemberBars) return false;
    return item.value !== 0;
  });

  if (items.length === 0) return null;

  const point = payload.find((item) => item.payload)?.payload;
  const contextRows =
    showContext && point
      ? xAxisRows
          .slice(1)
          .map((row) => ({
            label: row.label,
            value: row.getValue(point, label),
          }))
          .filter(
            (row): row is { label: string; value: string } => row.value != null,
          )
      : [];

  return (
    <div className="education-chart-tooltip">
      <p className="education-chart-tooltip-title">西暦{label}年</p>
      {contextRows.length > 0 && (
        <div className="education-chart-tooltip-context">
          {contextRows.map((row) => (
            <p
              key={`${row.label}-${row.value}`}
              className="education-chart-tooltip-context-row"
            >
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </p>
          ))}
        </div>
      )}
      <div className="education-chart-tooltip-body">
        {items.map((item) => (
          <p key={item.dataKey} className="education-chart-tooltip-row">
            <span
              className="education-chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>
              {compactLegendLabel(item.name)} {formatTooltipMan(item.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

interface XAxisRowTextProps {
  rowIndex: number;
  x: number;
  textAnchor: 'start' | 'middle' | 'end';
  fill: string;
  fontSize: number;
  children: ReactNode;
}

function XAxisRowText({
  rowIndex,
  x,
  textAnchor,
  fill,
  fontSize,
  children,
}: XAxisRowTextProps) {
  return (
    <text
      x={x}
      y={xAxisRowY(rowIndex)}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fill={fill}
      fontSize={fontSize}
    >
      {children}
    </text>
  );
}

interface XAxisTickProps {
  x?: string | number;
  y?: string | number;
  index?: number;
  payload?: { value: number };
  point: EducationChartPoint | undefined;
  xAxisRows: EducationChartXAxisRow[];
  labelX: number;
  showRowLabels?: boolean;
}

function XAxisTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  point,
  xAxisRows,
  labelX,
  showRowLabels = true,
}: XAxisTickProps) {
  if (!payload || !point) return null;

  const xOffset = typeof x === 'number' ? x : Number(x) || 0;
  const labelXInGroup = labelX - xOffset;
  const year = payload.value;

  return (
    <g transform={`translate(${x},${y})`}>
      {xAxisRows.map((row, rowIndex) => {
        const value = row.getValue(point, year);
        if (value == null) return null;

        const isYearRow = rowIndex === 0 && row.label === '西暦';

        return (
          <g key={row.label}>
            {showRowLabels && index === 0 && (
              <XAxisRowText
                rowIndex={rowIndex}
                x={labelXInGroup}
                textAnchor="end"
                fill="#64748b"
                fontSize={isYearRow ? 11 : 10}
              >
                {row.label}
              </XAxisRowText>
            )}
            <XAxisRowText
              rowIndex={rowIndex}
              x={0}
              textAnchor="middle"
              fill={isYearRow ? '#475569' : '#64748b'}
              fontSize={isYearRow ? 11 : 10}
            >
              {value}
            </XAxisRowText>
          </g>
        );
      })}
    </g>
  );
}

function ChartLegendContent({
  payload,
}: {
  payload?: Array<{ value: string; color: string; type?: string }>;
}) {
  if (!payload?.length) return null;

  return (
    <ul className="education-chart-legend">
      {payload.map((entry) => (
        <li key={entry.value} className="education-chart-legend-item">
          <span
            className={`education-chart-legend-icon education-chart-legend-icon--${entry.type === 'line' ? 'line' : 'bar'}`}
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          <span className="education-chart-legend-label">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function EducationExpenseChart(props: EducationExpenseChartProps) {
  const { headMember, familyMembers, referenceDate } = props;
  const isAggregate = props.mode === 'aggregate';
  const isMobile = useMobileChartLayout();

  const chartData = useMemo(() => {
    if (isAggregate) {
      const series = buildAggregatedEducationChartSeries(
        headMember,
        familyMembers,
        props.eligibleMembers,
        props.educationByMember,
        referenceDate,
      );
      return {
        points: series.points,
        bars: series.bars,
        leftAxisMax: series.leftAxisMax,
        rightAxisMax: series.rightAxisMax,
        xAxisRows: buildAggregatedEducationChartXAxisRows(familyMembers),
      };
    }

    const series = buildEducationChartSeries(
      props.member,
      headMember,
      familyMembers,
      props.entries,
      referenceDate,
    );
    return {
      points: series.points,
      bars: series.bars,
      leftAxisMax: series.leftAxisMax,
      rightAxisMax: series.rightAxisMax,
      xAxisRows: buildEducationChartXAxisRows(
        props.member,
        headMember,
        familyMembers,
      ),
    };
  }, [props, headMember, familyMembers, referenceDate, isAggregate]);

  const standardTickYears = useMemo(
    () => getEducationChartTickYears(chartData.points.map((point) => point.year)),
    [chartData.points],
  );

  const tickYears = useMemo(() => {
    if (!isMobile) return standardTickYears;

    const mobileTicks = isAggregate
      ? limitTickYears(standardTickYears, 5)
      : standardTickYears;

    return removeCrowdedFinalTick(mobileTicks);
  }, [isMobile, isAggregate, standardTickYears]);

  const pointsByYear = useMemo(() => {
    const map = new Map<number, EducationChartPoint>();
    for (const point of chartData.points) {
      map.set(point.year, point);
    }
    return map;
  }, [chartData.points]);

  const displayXAxisRows = useMemo(() => {
    if (!isMobile) return chartData.xAxisRows;
    if (isAggregate) return chartData.xAxisRows.slice(0, 1);

    const memberLabel = formatEducationChartMemberAxisLabel(
      props.member,
      familyMembers,
    );
    const memberAgeRow = chartData.xAxisRows.find(
      (row) => row.label === memberLabel,
    );

    return memberAgeRow ? [memberAgeRow] : chartData.xAxisRows.slice(0, 1);
  }, [isMobile, isAggregate, chartData.xAxisRows, props, familyMembers]);

  const mobileLegendPayload = useMemo(
    () => [
      ...chartData.bars.map((bar) => ({
        value: compactLegendLabel(bar.label),
        color: bar.color,
        type: 'bar',
      })),
      {
        value: '教育費累計額',
        color: '#e67e22',
        type: 'line',
      },
    ],
    [chartData.bars],
  );

  const xAxisHeight = xAxisTotalHeight(displayXAxisRows.length);
  const chartHeight = isMobile
    ? isAggregate
      ? CHART_HEIGHT_MOBILE_AGGREGATE
      : CHART_HEIGHT_MOBILE_MEMBER
    : isAggregate
      ? CHART_HEIGHT_AGGREGATE
      : CHART_HEIGHT_MEMBER;
  const barSize = isMobile
    ? BAR_SIZE_MOBILE
    : isAggregate
      ? BAR_SIZE_AGGREGATE
      : BAR_SIZE_MEMBER;
  const legendHeight = isMobile
    ? 0
    : getLegendHeight(isAggregate, chartData.bars.length);
  const mobileXAxisLabel = isAggregate
    ? '西暦'
    : `${displayXAxisRows[0]?.label ?? '対象者'}の年齢`;

  return (
    <section
      className={`education-chart-card ${isAggregate ? 'education-chart-card--aggregate' : ''}`}
      aria-label="教育費のグラフ"
    >
      <h3 className="education-chart-title">
        {isAggregate ? '教育費のグラフ（合算）' : '教育費のグラフ'}
      </h3>

      {isMobile && (
        <div className="education-chart-mobile-summary">
          <ChartLegendContent payload={mobileLegendPayload} />
          <div className="education-chart-mobile-meta">
            <span>横軸：{mobileXAxisLabel}</span>
            <span>左：年間 / 右：累計（万円）</span>
          </div>
          <p className="education-chart-mobile-hint">
            グラフをタップすると年齢・金額の詳細を確認できます
          </p>
        </div>
      )}

      <div className="education-chart-container">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart
            data={chartData.points}
            margin={
              isMobile
                ? { top: 8, right: 0, left: 0, bottom: 4 }
                : {
                    top: 12,
                    right: 20,
                    left: CHART_MARGIN_LEFT,
                    bottom: xAxisHeight + legendHeight,
                  }
            }
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#cbd5e1"
              vertical={!isMobile}
            />
            <XAxis
              dataKey="year"
              ticks={tickYears}
              tick={(tickProps) => (
                <XAxisTick
                  {...tickProps}
                  point={pointsByYear.get(tickProps.payload?.value ?? 0)}
                  xAxisRows={displayXAxisRows}
                  labelX={isMobile ? 0 : X_AXIS_LABEL_X}
                  showRowLabels={!isMobile}
                />
              )}
              stroke="#94a3b8"
              height={xAxisHeight}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              domain={[0, chartData.leftAxisMax]}
              tickFormatter={formatAxisMan}
              stroke="#64748b"
              fontSize={isMobile ? 11 : 13}
              width={isMobile ? 38 : 48}
              label={
                isMobile
                  ? undefined
                  : {
                      value: '万円',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 8,
                      style: { fill: '#64748b', fontSize: 13 },
                    }
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, chartData.rightAxisMax]}
              tickFormatter={formatAxisMan}
              stroke="#64748b"
              fontSize={isMobile ? 11 : 13}
              width={isMobile ? 44 : 52}
              label={
                isMobile
                  ? undefined
                  : {
                      value: '万円',
                      angle: 90,
                      position: 'insideRight',
                      offset: 8,
                      style: { fill: '#64748b', fontSize: 13 },
                    }
              }
            />
            <Tooltip
              content={
                <ChartTooltip
                  xAxisRows={chartData.xAxisRows}
                  showContext={isMobile}
                />
              }
            />
            {!isMobile && (
              <Legend
                verticalAlign="bottom"
                align="center"
                content={<ChartLegendContent />}
              />
            )}
            {chartData.bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                yAxisId="left"
                stackId="education"
                dataKey={bar.dataKey}
                name={bar.label}
                fill={bar.color}
                barSize={barSize}
                radius={
                  index === chartData.bars.length - 1
                    ? [2, 2, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeMan"
              name="教育費累計額"
              stroke="#e67e22"
              strokeWidth={2}
              dot={{
                r: isMobile ? 3 : 4,
                fill: '#e67e22',
                strokeWidth: 0,
              }}
              activeDot={{ r: isMobile ? 6 : 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
