import { resolveMemberAge } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';
import type { SavingsEntry } from '../types/savings';
import { calcBirthYear } from './birthDate';
import { resolveDbEnrollmentPeriod, ensureDbEnrollmentFields } from './dbEnrollment';
import {
  calcPensionRetirementDeductionEnrollmentYears,
  resolveIdecoPayoutStart,
} from './idecoPayout';
import { resolveIdecoDcContributionJoin } from './idecoPastContribution';
import {
  resolveIdecoOncePayoutMan,
} from './savingsCashFlow';
import {
  resolveRetirementEnrollmentMode,
  resolveRetirementEnrollmentYears,
  retirementAllowancesForEntry,
} from './retirementAllowance';
import {
  calcRetirementDeductionYenAfterOverlap,
  resolveRetirementDeductionLookbackYears,
  shortRetirementDeductionRuleName,
  RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS,
  type RetirementLumpEvent,
  type RetirementLumpKind,
} from './retirementDeductionOverlap';
import { calcMergedEnrollmentYearsFromPeriods, calcRetirementIncomeDeductionYen } from './retirementIncomeTax';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from './savingsLabels';

export type TimingRuleVariant =
  | 'tenYear'
  | 'nineteenYear'
  | 'sameYear'
  | 'solo'
  | 'chain';

export interface TimingMilestone {
  age: number;
  dateLabel: string;
  pct: number;
}

export interface ReceiptCallout {
  pct: number;
  title: string;
  detail: string;
  tone: 'ok' | 'warn';
}

export interface PeriodBar {
  label: string;
  startPct: number;
  endPct: number;
  tone: 'company' | 'ideco' | 'dc';
}

export interface GapAnnotation {
  startPct: number;
  endPct: number;
  label: string;
}

export interface TimingScenario {
  id: TimingRuleVariant;
  title: string;
  subtitle: string;
  milestones: TimingMilestone[];
  receipts: ReceiptCallout[];
  periods: PeriodBar[];
  /** 連続する受取のあいだの空き（複数可） */
  gaps: GapAnnotation[];
  /** @deprecated gaps[0] 相当。検証互換用 */
  gap: GapAnnotation | null;
  /** 軸上の省略線位置（複数可）。受取前を等間隔表示するときの区切り */
  axisBreakPcts: number[];
  footer: string | null;
  /** 実入力に基づく図か */
  isLive: boolean;
}

interface ReceiptPoint {
  kind: RetirementLumpKind;
  label: string;
  age: number;
  month: number;
  calendarYear: number;
  revenueMan: number;
  enrollmentYears: number;
  periodStartAge: number;
  periodStartMonth: number;
  periodEndAge: number;
  periodEndMonth: number;
}

function clampMonth(month: number | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + clampMonth(month);
}

function calendarYearFromAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  age: number,
  month: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const m = clampMonth(month);
  if (m >= (member.birthMonth || 1)) return birthYear + age;
  return birthYear + age + 1;
}

function formatDateLabel(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  age: number,
  month: number,
): string {
  const year = calendarYearFromAgeMonth(member, referenceDate, age, month);
  return `${year}`;
}

function formatMan(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

function toEvent(
  memberId: string,
  point: ReceiptPoint,
): RetirementLumpEvent {
  return {
    memberId,
    calendarYear: point.calendarYear,
    kind: point.kind,
    revenueMan: point.revenueMan,
    enrollmentYears: point.enrollmentYears,
    periodStartAge: point.periodStartAge,
    periodStartMonth: point.periodStartMonth,
    periodEndAge: point.periodEndAge,
    periodEndMonth: point.periodEndMonth,
  };
}

function periodToneFor(point: ReceiptPoint): PeriodBar['tone'] {
  if (point.kind === 'dc') return 'dc';
  if (point.kind === 'ideco') return 'ideco';
  return 'company';
}

function periodLabelFor(point: ReceiptPoint): string {
  if (point.kind === 'company') {
    return `退職金の勤続 ${point.enrollmentYears}年`;
  }
  if (point.kind === 'db') {
    return `DB加入 ${point.enrollmentYears}年`;
  }
  return `${point.label}拠出 ${point.enrollmentYears}年`;
}

/**
 * 受取前のイベントは実年数に依らず等間隔。
 * 軸ラベルは年齢のみなので、同じ年齢は1本にまとめる。
 * 省略線は「開始同士」「最後の開始→最初の受取」の間に置く。
 */
function buildEqualIntervalScale(input: {
  periodStarts: { age: number; month: number }[];
  receipts: { age: number; month: number }[];
}): {
  toPct: (age: number, month: number) => number;
  axisBreakPcts: number[];
  milestones: { age: number; month: number; pct: number }[];
} {
  /** 表示が年齢単位のため、同一年齢は1アンカーに集約する */
  const uniqByAge = (points: { age: number; month: number }[]) => {
    const map = new Map<number, { age: number; month: number }>();
    for (const p of points) {
      const age = Math.max(0, Number(p.age) || 0);
      const month = clampMonth(p.month);
      if (!map.has(age)) {
        map.set(age, { age, month });
      }
    }
    return [...map.values()].sort((a, b) => a.age - b.age);
  };

  const receiptAnchors = uniqByAge(input.receipts);
  const receiptAgeMin = receiptAnchors[0]?.age ?? 0;

  // 受取より前の開始だけを「前半スロット」に使う
  const preAnchors = uniqByAge(input.periodStarts).filter(
    (p) => p.age < receiptAgeMin,
  );

  // 開始が受取と同年齢・以降しかない場合でも、軸が空にならないよう受取だけ等間隔
  const anchors = [...preAnchors, ...receiptAnchors];
  if (anchors.length === 0) {
    return {
      axisBreakPcts: [],
      milestones: [],
      toPct: () => 0,
    };
  }
  if (anchors.length === 1) {
    return {
      axisBreakPcts: [],
      milestones: [{ age: anchors[0].age, month: anchors[0].month, pct: 50 }],
      toPct: () => 50,
    };
  }

  const edgePad = 4;
  const span = 100 - edgePad * 2;
  const step = span / (anchors.length - 1);
  const placed = anchors.map((a, i) => ({
    ...a,
    pct: edgePad + step * i,
  }));

  const firstReceiptIndex = preAnchors.length;
  const axisBreakPcts: number[] = [];
  for (let i = 0; i < placed.length - 1; i += 1) {
    // 受取同士の間は空き年数の矢印を使うので省略線なし
    if (i >= firstReceiptIndex) continue;
    axisBreakPcts.push((placed[i].pct + placed[i + 1].pct) / 2);
  }

  const toPct = (age: number, _month: number): number => {
    const a = Math.max(0, Number(age) || 0);
    if (a <= placed[0].age) return placed[0].pct;
    if (a >= placed[placed.length - 1].age) {
      return placed[placed.length - 1].pct;
    }
    for (let i = 0; i < placed.length - 1; i += 1) {
      const left = placed[i];
      const right = placed[i + 1];
      if (a >= left.age && a <= right.age) {
        if (right.age <= left.age) return left.pct;
        const t = (a - left.age) / (right.age - left.age);
        return left.pct + t * (right.pct - left.pct);
      }
    }
    return placed[placed.length - 1].pct;
  };

  return {
    toPct,
    axisBreakPcts,
    milestones: placed.map((p) => ({
      age: p.age,
      month: p.month,
      pct: p.pct,
    })),
  };
}

function buildPeriodBar(
  point: ReceiptPoint,
  toPct: (age: number, month: number) => number,
): PeriodBar {
  const startPct = toPct(point.periodStartAge, point.periodStartMonth);
  const endPct = Math.max(
    startPct + 2,
    toPct(point.periodEndAge, point.periodEndMonth),
  );
  return {
    label: periodLabelFor(point),
    startPct,
    endPct,
    tone: periodToneFor(point),
  };
}

function collectCompanyPoints(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): ReceiptPoint[] {
  const points: ReceiptPoint[] = [];
  for (const entry of incomeEntries) {
    for (const allowance of retirementAllowancesForEntry(entry)) {
      const revenueMan = Math.max(0, Number(allowance.amountMan) || 0);
      if (revenueMan <= 0) continue;
      const enrollmentYears = resolveRetirementEnrollmentYears(allowance);
      let periodStartAge: number;
      let periodStartMonth: number;
      let periodEndAge: number;
      let periodEndMonth: number;
      if (resolveRetirementEnrollmentMode(allowance.enrollmentMode) === 'period') {
        periodStartAge = allowance.enrollmentStartAge;
        periodStartMonth = clampMonth(allowance.enrollmentStartMonth);
        periodEndAge = allowance.enrollmentEndAge;
        periodEndMonth = clampMonth(allowance.enrollmentEndMonth);
      } else {
        periodEndAge = allowance.receiveAge;
        periodEndMonth = clampMonth(allowance.receiveMonth);
        periodStartAge = Math.max(0, periodEndAge - enrollmentYears);
        periodStartMonth = 4;
      }
      points.push({
        kind: 'company',
        label: '退職金',
        age: allowance.receiveAge,
        month: clampMonth(allowance.receiveMonth),
        calendarYear: calendarYearFromAgeMonth(
          member,
          referenceDate,
          allowance.receiveAge,
          allowance.receiveMonth,
        ),
        revenueMan,
        enrollmentYears,
        periodStartAge,
        periodStartMonth,
        periodEndAge,
        periodEndMonth,
      });
    }
  }
  return points;
}

function collectPensionLumpPoints(
  member: FamilyMember,
  memberEntries: SavingsEntry[],
  referenceDate: Date,
): ReceiptPoint[] {
  const points: ReceiptPoint[] = [];

  for (const entry of memberEntries) {
    if (!isPensionStylePayoutCategory(entry.category)) continue;
    if (resolveSavingsWithdrawalMode(entry.withdrawalMode) !== 'once') continue;

    const lumpMonth = member.birthMonth || 1;
    const payout = resolveIdecoPayoutStart(entry, member, {
      age: entry.withdrawalStartAge ?? resolveMemberAge(member),
      month: lumpMonth,
    });
    const revenueMan =
      entry.category === 'db'
        ? Math.max(0, Number(entry.withdrawalMan) || 0)
        : resolveIdecoOncePayoutMan(
            entry,
            member,
            memberEntries,
            referenceDate,
          );

    const enrollmentYears = calcPensionRetirementDeductionEnrollmentYears(
      entry,
      member,
      { age: payout.age, month: lumpMonth },
    );
    let periodStartAge: number;
    let periodStartMonth: number;
    let periodEndAge: number;
    let periodEndMonth: number;
    if (entry.category === 'db') {
      const period = resolveDbEnrollmentPeriod(
        ensureDbEnrollmentFields(entry, member),
        {
          age: payout.age,
          month: lumpMonth,
        },
      );
      periodStartAge = period.startAge;
      periodStartMonth = period.startMonth;
      periodEndAge = period.endAge;
      periodEndMonth = period.endMonth;
    } else {
      const join =
        entry.category === 'ideco' || entry.category === 'dc'
          ? resolveIdecoDcContributionJoin(entry)
          : {
              age: Math.max(0, Number(entry.startAge) || 0),
              month: clampMonth(entry.startMonth),
            };
      periodStartAge = join.age;
      periodStartMonth = join.month;
      periodEndAge =
        entry.endMode === 'until'
          ? Math.max(0, Number(entry.endAge) || periodStartAge)
          : payout.age;
      periodEndMonth =
        entry.endMode === 'until' ? clampMonth(entry.endMonth) : lumpMonth;
      if (
        ageMonthIndex(periodEndAge, periodEndMonth) >
        ageMonthIndex(payout.age, lumpMonth)
      ) {
        periodEndAge = payout.age;
        periodEndMonth = lumpMonth;
      }
    }

    const kind: RetirementLumpKind =
      entry.category === 'ideco'
        ? 'ideco'
        : entry.category === 'dc'
          ? 'dc'
          : 'db';
    const label =
      entry.category === 'ideco'
        ? 'iDeCo'
        : entry.category === 'dc'
          ? '企業型DC'
          : 'DB';

    points.push({
      kind,
      label,
      age: payout.age,
      month: lumpMonth,
      calendarYear: calendarYearFromAgeMonth(
        member,
        referenceDate,
        payout.age,
        lumpMonth,
      ),
      revenueMan: Math.max(revenueMan, 0),
      enrollmentYears,
      periodStartAge,
      periodStartMonth,
      periodEndAge,
      periodEndMonth,
    });
  }
  return points;
}

function buildMilestones(
  member: FamilyMember,
  referenceDate: Date,
  scale: ReturnType<typeof buildEqualIntervalScale>,
): TimingMilestone[] {
  return scale.milestones.map((m) => ({
    age: m.age,
    dateLabel: formatDateLabel(member, referenceDate, m.age, m.month),
    pct: m.pct,
  }));
}

function sortReceiptPoints(points: ReceiptPoint[]): ReceiptPoint[] {
  return [...points].sort((a, b) => {
    if (a.calendarYear !== b.calendarYear) {
      return a.calendarYear - b.calendarYear;
    }
    return ageMonthIndex(a.age, a.month) - ageMonthIndex(b.age, b.month);
  });
}

function withGapCompat(scenario: Omit<TimingScenario, 'gap'>): TimingScenario {
  return {
    ...scenario,
    gap: scenario.gaps[0] ?? null,
  };
}

function buildSoloScenario(input: {
  member: FamilyMember;
  referenceDate: Date;
  point: ReceiptPoint;
}): TimingScenario {
  const scale = buildEqualIntervalScale({
    periodStarts: [
      { age: input.point.periodStartAge, month: input.point.periodStartMonth },
    ],
    receipts: [{ age: input.point.age, month: input.point.month }],
  });
  const fullDed = calcRetirementIncomeDeductionYen(input.point.enrollmentYears);
  const pct = scale.toPct(input.point.age, input.point.month);

  return withGapCompat({
    id: 'solo',
    title: `${input.point.label}の受取予定`,
    subtitle: '',
    isLive: true,
    milestones: buildMilestones(input.member, input.referenceDate, scale),
    receipts: [
      {
        pct,
        title: `${input.point.label}受取 ${formatMan(input.point.revenueMan)}万円`,
        detail: `控除${formatMan(fullDed / 10_000)}万（単独）`,
        tone: 'ok',
      },
    ],
    periods: [buildPeriodBar(input.point, scale.toPct)],
    gaps: [],
    axisBreakPcts: scale.axisBreakPcts,
    footer: null,
  });
}

function buildSameYearScenario(input: {
  member: FamilyMember;
  referenceDate: Date;
  points: ReceiptPoint[];
  scale: ReturnType<typeof buildEqualIntervalScale>;
}): TimingScenario {
  const mergedYears = calcMergedEnrollmentYearsFromPeriods(
    input.points.map((p) => ({
      startAge: p.periodStartAge,
      startMonth: p.periodStartMonth,
      endAge: p.periodEndAge,
      endMonth: p.periodEndMonth,
    })),
  );
  const mergedDed = calcRetirementIncomeDeductionYen(mergedYears);
  const totalMan = input.points.reduce((sum, p) => sum + p.revenueMan, 0);
  const labels = input.points.map((p) => p.label).join('・');
  const anchor = input.points[0];
  const pct = input.scale.toPct(anchor.age, anchor.month);

  return withGapCompat({
    id: 'sameYear',
    title: '同年合算',
    subtitle: `${labels}を同じ年に受け取る予定です`,
    isLive: true,
    milestones: buildMilestones(input.member, input.referenceDate, input.scale),
    receipts: [
      {
        pct,
        title: `同年受取 合計${formatMan(totalMan)}万円`,
        detail: `控除は期間の和集合 ${mergedYears}年 → ${formatMan(mergedDed / 10_000)}万円`,
        tone: 'ok',
      },
    ],
    periods: input.points.map((p) => buildPeriodBar(p, input.scale.toPct)),
    gaps: [],
    axisBreakPcts: input.scale.axisBreakPcts,
    footer:
      '同年は合算し、勤続・拠出期間の和集合（最長＋非重複）で控除を1本化します（重複調整の対象外）',
  });
}

/**
 * 2件以上の一時金を時系列で描き、各後受けについて先行すべてで重複調整する。
 */
function buildChainScenario(input: {
  member: FamilyMember;
  referenceDate: Date;
  points: ReceiptPoint[];
}): TimingScenario {
  const sorted = sortReceiptPoints(input.points);
  const scale = buildEqualIntervalScale({
    periodStarts: sorted.map((p) => ({
      age: p.periodStartAge,
      month: p.periodStartMonth,
    })),
    receipts: sorted.map((p) => ({ age: p.age, month: p.month })),
  });

  if (
    sorted.every((p) => p.calendarYear === sorted[0].calendarYear) ||
    sorted.every((p) => p.age === sorted[0].age)
  ) {
    return buildSameYearScenario({
      member: input.member,
      referenceDate: input.referenceDate,
      points: sorted,
      scale,
    });
  }

  const events = sorted.map((p) => toEvent(input.member.id, p));
  const receipts: ReceiptCallout[] = [];
  const gaps: GapAnnotation[] = [];
  let hitTen = false;
  let hitNineteen = false;

  for (let i = 0; i < sorted.length; i += 1) {
    const point = sorted[i];
    const fullDed = calcRetirementIncomeDeductionYen(point.enrollmentYears);
    const adjusted = calcRetirementDeductionYenAfterOverlap({
      current: events[i],
      priors: events.slice(0, i),
    });
    const hits = adjusted.overlapYears > 0;
    let ruleShort: string | null = null;
    for (let j = 0; j < i; j += 1) {
      const lookback = resolveRetirementDeductionLookbackYears(
        sorted[j].kind,
        point.kind,
      );
      if (lookback == null) continue;
      const gapYears = point.calendarYear - sorted[j].calendarYear;
      if (gapYears < 1 || gapYears > lookback) continue;
      ruleShort = shortRetirementDeductionRuleName(sorted[j].kind, point.kind);
      if (lookback === RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS) {
        hitTen = true;
      } else if (lookback >= 19) {
        hitNineteen = true;
      }
    }

    const circle = `${['①', '②', '③', '④', '⑤', '⑥'][i] ?? `${i + 1}.`}`;
    receipts.push({
      pct: scale.toPct(point.age, point.month),
      title: `${circle} ${point.label}受取 ${formatMan(point.revenueMan)}万円`,
      detail: hits
        ? `控除${formatMan(fullDed / 10_000)}→${formatMan(adjusted.deductionYen / 10_000)}万に減額${
            ruleShort ? `（${ruleShort}）` : ''
          }`
        : `控除${formatMan(fullDed / 10_000)}万 OK`,
      tone: hits ? 'warn' : 'ok',
    });

    if (i === 0) continue;
    const prev = sorted[i - 1];
    // 同一年齢は軸上で同じ位置（ギャップなし）
    if (prev.age === point.age || prev.calendarYear >= point.calendarYear) {
      continue;
    }
    const gapYears = point.calendarYear - prev.calendarYear;
    const adjacentRule = shortRetirementDeductionRuleName(prev.kind, point.kind);
    const adjacentLookback = resolveRetirementDeductionLookbackYears(
      prev.kind,
      point.kind,
    );
    const adjacentHits =
      adjacentLookback != null &&
      gapYears >= 1 &&
      gapYears <= adjacentLookback;
    gaps.push({
      startPct: scale.toPct(prev.age, prev.month),
      endPct: scale.toPct(point.age, point.month),
      label: adjacentRule
        ? `空き${gapYears}年${adjacentHits ? `・${adjacentRule}` : ''}`
        : `空き${gapYears}年`,
    });
  }

  const sequence = sorted.map((p) => `${p.label}${p.age}歳`).join(' → ');
  const id: TimingRuleVariant =
    hitTen && hitNineteen
      ? 'chain'
      : hitTen
        ? 'tenYear'
        : hitNineteen
          ? 'nineteenYear'
          : 'chain';
  const title =
    id === 'tenYear'
      ? '10年ルール（あなたの予定）'
      : id === 'nineteenYear'
        ? '19年ルール（あなたの予定）'
        : hitTen || hitNineteen
          ? '受取タイミング（10年・19年が混在）'
          : '受取タイミング（あなたの予定）';

  return withGapCompat({
    id,
    title,
    subtitle: sequence,
    isLive: true,
    milestones: buildMilestones(input.member, input.referenceDate, scale),
    receipts,
    periods: sorted.map((p) => buildPeriodBar(p, scale.toPct)),
    gaps,
    axisBreakPcts: scale.axisBreakPcts,
    footer:
      sorted.length >= 3
        ? '各受取は直前だけでなく、ルックバック内の先行一時金すべてと重複調整します'
        : null,
  });
}

/**
 * 実入力から、受取タイミング図のシナリオを組み立てる。
 * 会社退職金・iDeCo／DC／DB の一括をすべて時系列に載せる。
 */
export function buildLiveRetirementTimingScenario(input: {
  member: FamilyMember;
  incomeEntries: IncomeEntry[];
  memberEntries: SavingsEntry[];
  referenceDate: Date;
}): TimingScenario | null {
  const companies = collectCompanyPoints(
    input.member,
    input.incomeEntries,
    input.referenceDate,
  );
  const pensions = collectPensionLumpPoints(
    input.member,
    input.memberEntries,
    input.referenceDate,
  );
  const points = [...companies, ...pensions];
  if (points.length === 0) return null;

  if (points.length === 1) {
    return buildSoloScenario({
      member: input.member,
      referenceDate: input.referenceDate,
      point: points[0],
    });
  }

  return buildChainScenario({
    member: input.member,
    referenceDate: input.referenceDate,
    points,
  });
}
