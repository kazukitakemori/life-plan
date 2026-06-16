import { calcBirthYear, calcYearAtAge, getMemberAgeMonth } from './birthDate';
import { getChildBirthOrder } from './educationCostContext';
import { calcMemberMonthlyEducationYen, yenToMan } from './educationCashFlow';
import { getMemberTabLabel } from './memberDisplay';
import type { FamilyMember } from '../types/family';
import type { EducationByMember, EducationExpenseEntry } from '../types/education';

export interface EducationChartPoint {
  year: number;
  annualMan: number;
  cumulativeMan: number;
  memberAge: number | null;
  spouseAge: number | null;
  headAge: number | null;
}

export interface EducationChartXAxisRow {
  label: string;
  getValue: (point: EducationChartPoint, year: number) => string | null;
}

export interface EducationChartSeries {
  memberLabel: string;
  memberColor: string;
  points: EducationChartPoint[];
  leftAxisMax: number;
  rightAxisMax: number;
}

export interface EducationChartMemberBar {
  dataKey: string;
  label: string;
  color: string;
}

export interface AggregatedEducationChartSeries {
  bars: EducationChartMemberBar[];
  points: EducationChartPoint[];
  leftAxisMax: number;
  rightAxisMax: number;
}

const EDUCATION_CHART_ROLE_COLORS: Record<FamilyMember['role'], string> = {
  head: '#4f86c6',
  spouse: '#48a999',
  child: '#52a447',
  other: '#8e8e8e',
  pet: '#8e8e8e',
};

const EDUCATION_CHART_CHILD_COLORS = [
  '#52a447',
  '#9b59b6',
  '#e67e22',
  '#e74c3c',
  '#3498db',
];

export function getEducationChartMemberColor(
  member: FamilyMember,
  familyMembers: FamilyMember[],
): string {
  if (member.role === 'child') {
    const order = getChildBirthOrder(member, familyMembers);
    return EDUCATION_CHART_CHILD_COLORS[
      (order - 1) % EDUCATION_CHART_CHILD_COLORS.length
    ];
  }

  return EDUCATION_CHART_ROLE_COLORS[member.role];
}

function getSortedChildren(familyMembers: FamilyMember[]): FamilyMember[] {
  return familyMembers
    .filter((member) => member.role === 'child')
    .sort(
      (a, b) =>
        getChildBirthOrder(a, familyMembers) -
        getChildBirthOrder(b, familyMembers),
    );
}

function getMembersWithEducationEntries(
  members: FamilyMember[],
  educationByMember: EducationByMember,
): FamilyMember[] {
  return members.filter(
    (member) => (educationByMember[member.id]?.length ?? 0) > 0,
  );
}

function getPointNumericValue(
  point: EducationChartPoint,
  key: string,
): number | null {
  const value = (point as EducationChartPoint & Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

function roundMan(value: number): number {
  return Math.round(value * 10) / 10;
}

function niceAxisMax(value: number): number {
  if (value <= 0) return 100;
  const padded = value * 1.1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function getMemberEducationEndYear(
  member: FamilyMember,
  entries: EducationExpenseEntry[],
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const referenceYear = referenceDate.getFullYear();

  if (entries.length === 0) {
    return referenceYear + 5;
  }

  return entries.reduce((maxYear, entry) => {
    const endYear = calcYearAtAge(
      birthYear,
      member.birthMonth,
      entry.endAge,
      entry.endMonth,
    );
    return Math.max(maxYear, endYear);
  }, referenceYear);
}

function calcMemberAnnualEducationMan(
  member: FamilyMember,
  entries: EducationExpenseEntry[],
  referenceDate: Date,
  calendarYear: number,
): number {
  const monthStart =
    calendarYear === referenceDate.getFullYear()
      ? referenceDate.getMonth() + 1
      : 1;

  let totalYen = 0;
  for (let month = monthStart; month <= 12; month++) {
    totalYen += calcMemberMonthlyEducationYen(
      member,
      entries,
      referenceDate,
      calendarYear,
      month,
    );
  }

  return roundMan(yenToMan(totalYen));
}

export function formatEducationChartMemberAxisLabel(
  member: FamilyMember,
  familyMembers: FamilyMember[],
): string {
  if (member.role === 'child') {
    const order = getChildBirthOrder(member, familyMembers);
    return `第${order}子`;
  }

  const tabLabel = getMemberTabLabel(member).replace(/さん$/, '');
  return tabLabel;
}

export function formatEducationChartMemberLabel(
  member: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
): string {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthStr = `${birthYear}/${String(member.birthMonth).padStart(2, '0')}/01`;

  if (member.role === 'child') {
    const order = getChildBirthOrder(member, familyMembers);
    return `第${order}子 (${birthStr}生)`;
  }

  return `${getMemberTabLabel(member)} (${birthStr}生)`;
}

export function buildEducationChartXAxisRows(
  member: FamilyMember,
  headMember: FamilyMember,
  familyMembers: FamilyMember[],
): EducationChartXAxisRow[] {
  const rows: EducationChartXAxisRow[] = [
    {
      label: '西暦',
      getValue: (_point, year) => String(year),
    },
  ];

  const showMemberAge = member.id !== headMember.id;
  if (showMemberAge) {
    rows.push({
      label: formatEducationChartMemberAxisLabel(member, familyMembers),
      getValue: (point) =>
        point.memberAge != null ? `${point.memberAge}才` : null,
    });
  }

  if (member.role === 'child' && familyMembers.some((m) => m.role === 'spouse')) {
    rows.push({
      label: '世帯主',
      getValue: (point) =>
        point.headAge != null ? `${point.headAge}才` : null,
    });
    rows.push({
      label: '配偶者',
      getValue: (point) =>
        point.spouseAge != null ? `${point.spouseAge}才` : null,
    });
  } else {
    rows.push({
      label: '世帯主',
      getValue: (point) =>
        point.headAge != null ? `${point.headAge}才` : null,
    });
  }

  return rows;
}

export function buildAggregatedEducationChartXAxisRows(
  familyMembers: FamilyMember[],
): EducationChartXAxisRow[] {
  const rows: EducationChartXAxisRow[] = [
    {
      label: '西暦',
      getValue: (_point, year) => String(year),
    },
  ];

  for (const child of getSortedChildren(familyMembers)) {
    rows.push({
      label: formatEducationChartMemberAxisLabel(child, familyMembers),
      getValue: (point) => {
        const age = getPointNumericValue(point, `childAge_${child.id}`);
        return age != null ? `${age}才` : null;
      },
    });
  }

  rows.push({
    label: '世帯主',
    getValue: (point) =>
      point.headAge != null ? `${point.headAge}才` : null,
  });

  if (familyMembers.some((member) => member.role === 'spouse')) {
    rows.push({
      label: '配偶者',
      getValue: (point) =>
        point.spouseAge != null ? `${point.spouseAge}才` : null,
    });
  }

  return rows;
}

export function buildAggregatedEducationChartSeries(
  headMember: FamilyMember,
  familyMembers: FamilyMember[],
  eligibleMembers: FamilyMember[],
  educationByMember: EducationByMember,
  referenceDate: Date,
): AggregatedEducationChartSeries {
  const startYear = referenceDate.getFullYear();
  const headBirthYear = calcBirthYear(
    headMember.age,
    headMember.birthMonth,
    referenceDate,
  );
  const headEndYear = calcYearAtAge(
    headBirthYear,
    headMember.birthMonth,
    headMember.expectedLifespan,
    12,
  );
  const endYear = Math.min(
    headEndYear,
    getMembersWithEducationEntries(eligibleMembers, educationByMember).reduce(
      (maxYear, member) => {
        const entries = educationByMember[member.id] ?? [];
        return Math.max(
          maxYear,
          getMemberEducationEndYear(member, entries, referenceDate),
        );
      },
      startYear,
    ),
  );

  const spouseMember = familyMembers.find((m) => m.role === 'spouse');
  const children = getSortedChildren(familyMembers);
  const membersWithEducation = getMembersWithEducationEntries(
    eligibleMembers,
    educationByMember,
  );
  const bars: EducationChartMemberBar[] = membersWithEducation.map((member) => ({
    dataKey: `annual_${member.id}`,
    label: formatEducationChartMemberLabel(member, familyMembers, referenceDate),
    color: getEducationChartMemberColor(member, familyMembers),
  }));

  const points: EducationChartPoint[] = [];
  let cumulativeMan = 0;
  let maxAnnualStack = 0;

  for (let year = startYear; year <= endYear; year++) {
    let yearTotal = 0;
    const memberAnnual: Record<string, number> = {};
    const childAges: Record<string, number> = {};

    for (const child of children) {
      const childAgeMonth = getMemberAgeMonth(
        child,
        referenceDate,
        year,
        12,
      );
      if (childAgeMonth) {
        childAges[`childAge_${child.id}`] = childAgeMonth.age;
      }
    }

    for (const member of membersWithEducation) {
      const entries = educationByMember[member.id] ?? [];
      const annualMan = calcMemberAnnualEducationMan(
        member,
        entries,
        referenceDate,
        year,
      );
      memberAnnual[`annual_${member.id}`] = annualMan;
      yearTotal = roundMan(yearTotal + annualMan);
    }

    cumulativeMan = roundMan(cumulativeMan + yearTotal);
    maxAnnualStack = Math.max(maxAnnualStack, yearTotal);

    const headAgeMonth = getMemberAgeMonth(
      headMember,
      referenceDate,
      year,
      12,
    );
    const spouseAgeMonth = spouseMember
      ? getMemberAgeMonth(spouseMember, referenceDate, year, 12)
      : null;

    points.push({
      year,
      annualMan: yearTotal,
      cumulativeMan,
      memberAge: null,
      spouseAge: spouseAgeMonth?.age ?? null,
      headAge: headAgeMonth?.age ?? null,
      ...childAges,
      ...memberAnnual,
    });
  }

  return {
    bars,
    points,
    leftAxisMax: niceAxisMax(maxAnnualStack),
    rightAxisMax: niceAxisMax(cumulativeMan),
  };
}

export function buildEducationChartSeries(
  member: FamilyMember,
  headMember: FamilyMember,
  familyMembers: FamilyMember[],
  entries: EducationExpenseEntry[],
  referenceDate: Date,
): EducationChartSeries {
  const startYear = referenceDate.getFullYear();
  const headBirthYear = calcBirthYear(
    headMember.age,
    headMember.birthMonth,
    referenceDate,
  );
  const headEndYear = calcYearAtAge(
    headBirthYear,
    headMember.birthMonth,
    headMember.expectedLifespan,
    12,
  );
  const endYear = Math.min(
    headEndYear,
    Math.max(getMemberEducationEndYear(member, entries, referenceDate), startYear),
  );

  const spouseMember = familyMembers.find((m) => m.role === 'spouse');

  const points: EducationChartPoint[] = [];
  let cumulativeMan = 0;
  let maxAnnual = 0;

  for (let year = startYear; year <= endYear; year++) {
    const annualMan = calcMemberAnnualEducationMan(
      member,
      entries,
      referenceDate,
      year,
    );
    cumulativeMan = roundMan(cumulativeMan + annualMan);
    maxAnnual = Math.max(maxAnnual, annualMan);

    const memberAgeMonth = getMemberAgeMonth(
      member,
      referenceDate,
      year,
      12,
    );
    const headAgeMonth = getMemberAgeMonth(
      headMember,
      referenceDate,
      year,
      12,
    );
    const spouseAgeMonth = spouseMember
      ? getMemberAgeMonth(spouseMember, referenceDate, year, 12)
      : null;

    points.push({
      year,
      annualMan,
      cumulativeMan,
      memberAge: memberAgeMonth?.age ?? null,
      spouseAge: spouseAgeMonth?.age ?? null,
      headAge: headAgeMonth?.age ?? null,
    });
  }

  return {
    memberLabel: formatEducationChartMemberLabel(
      member,
      familyMembers,
      referenceDate,
    ),
    memberColor: getEducationChartMemberColor(member, familyMembers),
    points,
    leftAxisMax: niceAxisMax(maxAnnual),
    rightAxisMax: niceAxisMax(cumulativeMan),
  };
}

export function getEducationChartTickYears(years: number[]): number[] {
  if (years.length === 0) return [];
  const step = 3;
  const ticks: number[] = [];
  for (let i = 0; i < years.length; i += step) {
    ticks.push(years[i]);
  }
  const last = years[years.length - 1];
  if (ticks[ticks.length - 1] !== last) {
    ticks.push(last);
  }
  return ticks;
}
