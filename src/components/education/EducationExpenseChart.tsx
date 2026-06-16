import { useMemo, type ReactNode } from 'react';
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
  getEducationChartTickYears,
  type EducationChartPoint,
  type EducationChartXAxisRow,
} from '../../lib/educationChartData';
import type { FamilyMember } from '../../types/family';
import type { EducationByMember, EducationExpenseEntry } from '../../types/education';

const CHART_MARGIN_LEFT = 48;
const CHART_HEIGHT_MEMBER = 520;
const CHART_HEIGHT_AGGREGATE = 620;
const BAR_SIZE_MEMBER = 28;
const BAR_SIZE_AGGREGATE = 36;
const X_AXIS_LABEL_X = CHART_MARGIN_LEFT - 8;
const X_AXIS_ROW_HEIGHT = 14;
const X_AXIS_ROW_GAP = 2;
const X_AXIS_ROW_START = 18;

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
  }>;
  label?: number;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const items = payload.filter((item) => item.dataKey !== 'annualMan');

  return (
    <div className="education-chart-tooltip">
      <p className="education-chart-tooltip-title">西暦{label}年</p>
      <div className="education-chart-tooltip-body">
        {items.map((item) => (
          <p key={item.dataKey} className="education-chart-tooltip-row">
            <span
              className="education-chart-tooltip-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>
              {item.name} {formatTooltipMan(item.value)}
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
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: number };
  point: EducationChartPoint | undefined;
  xAxisRows: EducationChartXAxisRow[];
  labelX: number;
}

function XAxisTick({
  x = 0,
  y = 0,
  index = 0,
  payload,
  point,
  xAxisRows,
  labelX,
}: XAxisTickProps) {
  if (!payload || !point) return null;

  const labelXInGroup = labelX - x;
  const year = payload.value;

  return (
    <g transform={`translate(${x},${y})`}>
      {xAxisRows.map((row, rowIndex) => {
        const value = row.getValue(point, year);
        if (value == null) return null;

        const isYearRow = rowIndex === 0;

        return (
          <g key={row.label}>
            {index === 0 && (
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
      bars: [
        {
          dataKey: 'annualMan',
          label: series.memberLabel,
          color: series.memberColor,
        },
      ],
      leftAxisMax: series.leftAxisMax,
      rightAxisMax: series.rightAxisMax,
      xAxisRows: buildEducationChartXAxisRows(
        props.member,
        headMember,
        familyMembers,
      ),
    };
  }, [props, headMember, familyMembers, referenceDate, isAggregate]);

  const tickYears = useMemo(
    () => getEducationChartTickYears(chartData.points.map((point) => point.year)),
    [chartData.points],
  );

  const pointsByYear = useMemo(() => {
    const map = new Map<number, EducationChartPoint>();
    for (const point of chartData.points) {
      map.set(point.year, point);
    }
    return map;
  }, [chartData.points]);

  const xAxisHeight = xAxisTotalHeight(chartData.xAxisRows.length);
  const chartHeight = isAggregate ? CHART_HEIGHT_AGGREGATE : CHART_HEIGHT_MEMBER;
  const barSize = isAggregate ? BAR_SIZE_AGGREGATE : BAR_SIZE_MEMBER;
  const legendHeight = getLegendHeight(isAggregate, chartData.bars.length);

  return (
    <section
      className={`education-chart-card ${isAggregate ? 'education-chart-card--aggregate' : ''}`}
      aria-label="教育費のグラフ"
    >
      <h3 className="education-chart-title">
        {isAggregate ? '教育費のグラフ（合算）' : '教育費のグラフ'}
      </h3>
      <div className="education-chart-container">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart
            data={chartData.points}
            margin={{
              top: 12,
              right: 20,
              left: CHART_MARGIN_LEFT,
              bottom: xAxisHeight + legendHeight,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
            <XAxis
              dataKey="year"
              ticks={tickYears}
              tick={(tickProps) => (
                <XAxisTick
                  {...tickProps}
                  point={pointsByYear.get(tickProps.payload?.value ?? 0)}
                  xAxisRows={chartData.xAxisRows}
                  labelX={X_AXIS_LABEL_X}
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
              fontSize={11}
              width={48}
              label={{
                value: '万円',
                angle: -90,
                position: 'insideLeft',
                offset: 8,
                style: { fill: '#64748b', fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, chartData.rightAxisMax]}
              tickFormatter={formatAxisMan}
              stroke="#64748b"
              fontSize={11}
              width={52}
              label={{
                value: '万円',
                angle: 90,
                position: 'insideRight',
                offset: 8,
                style: { fill: '#64748b', fontSize: 11 },
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              content={<ChartLegendContent />}
            />
            {chartData.bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                yAxisId="left"
                stackId={isAggregate ? 'education' : undefined}
                dataKey={bar.dataKey}
                name={bar.label}
                fill={bar.color}
                barSize={barSize}
                radius={
                  isAggregate && index === chartData.bars.length - 1
                    ? [2, 2, 0, 0]
                    : isAggregate
                      ? [0, 0, 0, 0]
                      : [2, 2, 0, 0]
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
              dot={{ r: 4, fill: '#e67e22', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
