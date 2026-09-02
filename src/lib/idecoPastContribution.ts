import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';
import type {
  SavingsContributionMode,
  SavingsEntry,
  SavingsPastContributionSegment,
} from '../types/savings';
import { isCorporateDcEligibleIncomeCategory } from './dcContribution';
import { calcEnrollmentYearsFromAgeMonths } from './retirementIncomeTax';
import { nextAgeMonth } from './savingsWithdrawalPeriod';
import { resolveSavingsContributionMode } from './savingsLabels';

/** 過去積み立ての金額の入れ方 */
export type IdecoPastContributionInputMode = 'amount' | 'balance';

function clampMonth(month: number | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + clampMonth(month);
}

function createId(): string {
  return crypto.randomUUID();
}

function isIdecoOrDc(category: string): boolean {
  return category === 'ideco' || category === 'dc';
}

export function isIdecoPastContributionEnabled(entry: SavingsEntry): boolean {
  return entry.pastContributionEnabled === true;
}

export function resolveIdecoPastContributionInputMode(
  entry: SavingsEntry,
): IdecoPastContributionInputMode {
  return entry.pastContributionInputMode === 'balance' ? 'balance' : 'amount';
}

/** 過去セグメント配列の内容比較（参照が違っても値が同じなら true） */
export function arePastContributionSegmentsEqual(
  a: readonly SavingsPastContributionSegment[] | undefined,
  b: readonly SavingsPastContributionSegment[] | undefined,
): boolean {
  if (a === b) return true;
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen === 0 && bLen === 0) return true;
  if (!a || !b || aLen !== bLen) return false;
  for (let i = 0; i < aLen; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.startAge !== y.startAge ||
      x.startMonth !== y.startMonth ||
      x.endAge !== y.endAge ||
      x.endMonth !== y.endMonth ||
      x.expectedReturnRatePct !== y.expectedReturnRatePct ||
      x.contributionMode !== y.contributionMode ||
      x.contributionMan !== y.contributionMan
    ) {
      return false;
    }
  }
  return true;
}

function isSamePastSyncResult(prev: SavingsEntry, next: SavingsEntry): boolean {
  return (
    prev.pastContributionEnabled === next.pastContributionEnabled &&
    prev.pastContributionInputMode === next.pastContributionInputMode &&
    prev.pastStartAge === next.pastStartAge &&
    prev.pastStartMonth === next.pastStartMonth &&
    prev.pastEndAge === next.pastEndAge &&
    prev.pastEndMonth === next.pastEndMonth &&
    prev.pastExpectedReturnRatePct === next.pastExpectedReturnRatePct &&
    prev.pastContributionMode === next.pastContributionMode &&
    prev.pastContributionMan === next.pastContributionMan &&
    prev.pastBalanceMan === next.pastBalanceMan &&
    prev.startAge === next.startAge &&
    prev.startMonth === next.startMonth &&
    prev.endAge === next.endAge &&
    prev.endMonth === next.endMonth &&
    prev.endMode === next.endMode &&
    prev.balanceMan === next.balanceMan &&
    arePastContributionSegmentsEqual(
      prev.pastContributionSegments,
      next.pastContributionSegments,
    )
  );
}

function referenceNow(
  member: Pick<FamilyMember, 'age'>,
  referenceDate: Date,
): { age: number; month: number } {
  return {
    age: Math.max(0, Number(member.age) || 0),
    month: referenceDate.getMonth() + 1,
  };
}

/**
 * 月次積立＋年率（年初に残高へ利回り）で、期間内の推計残高を求める。
 * CF の運用口座と同じ簡略モデル。
 */
export function estimateContributionScheduleBalanceMan(input: {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
  contributionMode: SavingsContributionMode;
  contributionMan: number;
  /** DC で事業主＋加入者を合算したいとき */
  extraMonthlyMan?: number;
  expectedReturnRatePct: number;
  /** 期間開始時点の残高（運用のみの期間にも使う） */
  openingBalanceMan?: number;
}): number {
  const startIdx = ageMonthIndex(input.startAge, input.startMonth);
  const endIdx = ageMonthIndex(input.endAge, input.endMonth);
  const opening = Math.max(0, Number(input.openingBalanceMan) || 0);
  if (endIdx < startIdx) return opening;

  const mode = resolveSavingsContributionMode(input.contributionMode);
  const amount = Math.max(0, Number(input.contributionMan) || 0);
  const extraMonthly = Math.max(0, Number(input.extraMonthlyMan) || 0);
  const annualRate = Math.max(0, Number(input.expectedReturnRatePct) || 0) / 100;

  let balance = opening;
  let prevAge = -1;

  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const age = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    if (age !== prevAge) {
      balance += balance * annualRate;
      prevAge = age;
    }

    let add = extraMonthly;
    if (mode === 'monthly' && amount > 0) {
      add += amount;
    } else if (mode === 'annual' && amount > 0 && month === clampMonth(input.startMonth)) {
      add += amount;
    }
    balance += add;
  }

  return Math.max(0, Math.round(balance * 10) / 10);
}

function normalizeSegment(
  seg: Partial<SavingsPastContributionSegment>,
  defaults: {
    expectedReturnRatePct: number;
    contributionMan: number;
  },
): SavingsPastContributionSegment {
  const mode =
    resolveSavingsContributionMode(seg.contributionMode) === 'annual'
      ? 'annual'
      : 'monthly';
  return {
    id: seg.id ?? createId(),
    startAge: Math.max(0, Number(seg.startAge) || 0),
    startMonth: clampMonth(seg.startMonth),
    endAge: Math.max(0, Number(seg.endAge) || 0),
    endMonth: clampMonth(seg.endMonth),
    expectedReturnRatePct: Math.max(
      0,
      Number(seg.expectedReturnRatePct ?? defaults.expectedReturnRatePct) || 0,
    ),
    contributionMode: mode,
    contributionMan: Math.max(
      0,
      Number(seg.contributionMan ?? defaults.contributionMan) || 0,
    ),
  };
}

function defaultDcPastContributionMan(entry: SavingsEntry): number {
  return Math.max(
    0,
    (Number(entry.employerContributionMan ?? entry.contributionMan) || 0) +
      (Number(entry.employeeContributionMan) || 0),
  );
}

/** 旧スカラー past* から DC セグメント1本を作る */
export function migrateDcScalarPastToSegments(
  entry: SavingsEntry,
): SavingsPastContributionSegment[] {
  if (
    Array.isArray(entry.pastContributionSegments) &&
    entry.pastContributionSegments.length > 0
  ) {
    return entry.pastContributionSegments.map((seg) =>
      normalizeSegment(seg, {
        expectedReturnRatePct:
          entry.pastExpectedReturnRatePct ?? entry.expectedReturnRatePct,
        contributionMan: defaultDcPastContributionMan(entry),
      }),
    );
  }
  if (
    entry.pastStartAge == null &&
    entry.pastEndAge == null &&
    !(Number(entry.pastContributionMan) > 0)
  ) {
    return [];
  }
  return [
    normalizeSegment(
      {
        startAge: entry.pastStartAge,
        startMonth: entry.pastStartMonth,
        endAge: entry.pastEndAge,
        endMonth: entry.pastEndMonth,
        expectedReturnRatePct:
          entry.pastExpectedReturnRatePct ?? entry.expectedReturnRatePct,
        contributionMode: entry.pastContributionMode ?? 'monthly',
        contributionMan:
          Number(entry.pastContributionMan) || defaultDcPastContributionMan(entry),
      },
      {
        expectedReturnRatePct: entry.expectedReturnRatePct,
        contributionMan: defaultDcPastContributionMan(entry),
      },
    ),
  ];
}

export function createDcPastContributionSegment(
  defaults: Partial<SavingsPastContributionSegment> & {
    expectedReturnRatePct: number;
    contributionMan?: number;
  },
): SavingsPastContributionSegment {
  return normalizeSegment(defaults, {
    expectedReturnRatePct: defaults.expectedReturnRatePct,
    contributionMan: defaults.contributionMan ?? 0,
  });
}

/**
 * セグメントを開始順に並べ、終了≤now、重複時は後段開始を前段終了翌月へ押し上げ。
 */
export function normalizeDcPastContributionSegments(
  segments: readonly SavingsPastContributionSegment[],
  now: { age: number; month: number },
  defaults: { expectedReturnRatePct: number; contributionMan: number },
): SavingsPastContributionSegment[] {
  const nowIdx = ageMonthIndex(now.age, now.month);
  const sorted = segments
    .map((seg) => normalizeSegment(seg, defaults))
    .sort(
      (a, b) =>
        ageMonthIndex(a.startAge, a.startMonth) -
        ageMonthIndex(b.startAge, b.startMonth),
    );

  const result: SavingsPastContributionSegment[] = [];
  for (const seg of sorted) {
    let startAge = seg.startAge;
    let startMonth = seg.startMonth;
    let endAge = seg.endAge;
    let endMonth = seg.endMonth;

    if (ageMonthIndex(endAge, endMonth) > nowIdx) {
      endAge = now.age;
      endMonth = now.month;
    }

    const last = result[result.length - 1];
    if (last) {
      const afterPrev = nextAgeMonth(last.endAge, last.endMonth);
      if (
        ageMonthIndex(startAge, startMonth) <
        ageMonthIndex(afterPrev.age, afterPrev.month)
      ) {
        startAge = afterPrev.age;
        startMonth = afterPrev.month;
      }
    }

    if (ageMonthIndex(startAge, startMonth) > ageMonthIndex(endAge, endMonth)) {
      continue;
    }

    result.push({
      ...seg,
      startAge,
      startMonth,
      endAge,
      endMonth,
    });
  }
  return result;
}

/** 過去セグメントの最早開始・最遅終了 */
export function resolveDcPastSegmentsBounds(
  segments: readonly SavingsPastContributionSegment[],
): {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
} | null {
  if (segments.length === 0) return null;
  let start = segments[0];
  let end = segments[0];
  for (const seg of segments) {
    if (
      ageMonthIndex(seg.startAge, seg.startMonth) <
      ageMonthIndex(start.startAge, start.startMonth)
    ) {
      start = seg;
    }
    if (
      ageMonthIndex(seg.endAge, seg.endMonth) >
      ageMonthIndex(end.endAge, end.endMonth)
    ) {
      end = seg;
    }
  }
  return {
    startAge: start.startAge,
    startMonth: start.startMonth,
    endAge: end.endAge,
    endMonth: end.endMonth,
  };
}

/** セグメント全体から退職所得控除用の加入年数を算出 */
export function resolveDcPastEnrollmentYearsFromSegments(
  segments: readonly SavingsPastContributionSegment[],
): number {
  const bounds = resolveDcPastSegmentsBounds(segments);
  if (!bounds) return 1;
  return calcEnrollmentYearsFromAgeMonths(
    { age: bounds.startAge, month: bounds.startMonth },
    { age: bounds.endAge, month: bounds.endMonth },
  );
}

/**
 * 残高直接入力用: 加入年数から単一セグメントを作る（終了＝いま）。
 * 月は開始を誕生日月相当・終了を現在月に固定し、年数だけをユーザー入力にする。
 */
export function buildDcPastSegmentsFromEnrollmentYears(input: {
  years: number;
  now: { age: number; month: number };
  birthMonth?: number;
  expectedReturnRatePct: number;
  contributionMan?: number;
}): SavingsPastContributionSegment[] {
  const years = Math.max(1, Math.floor(Number(input.years) || 1));
  const endAge = input.now.age;
  const endMonth = clampMonth(input.now.month);
  const startMonth = clampMonth(input.birthMonth ?? 1);
  let startAge = Math.max(0, endAge - years);
  // 開始月が終了月より後なら、同じ年数になるよう開始年齢を1つ下げる（誕生日月固定の近似）
  if (
    startAge === endAge &&
    startMonth > endMonth
  ) {
    startAge = Math.max(0, startAge - 1);
  } else if (
    ageMonthIndex(startAge, startMonth) > ageMonthIndex(endAge, endMonth)
  ) {
    startAge = Math.max(0, startAge - 1);
  }
  // 年数が大きくずれないよう、終了から years*12-1 か月前を開始に近づける
  const targetStartIdx =
    ageMonthIndex(endAge, endMonth) - (years * 12 - 1);
  if (targetStartIdx >= 0) {
    startAge = Math.floor(targetStartIdx / 12);
    // birthMonth 固定ではなく、年数一致を優先
    const startMonthFromIdx = (targetStartIdx % 12) + 1;
    return [
      createDcPastContributionSegment({
        startAge,
        startMonth: startMonthFromIdx,
        endAge,
        endMonth,
        expectedReturnRatePct: input.expectedReturnRatePct,
        contributionMan: input.contributionMan ?? 0,
        contributionMode: 'monthly',
      }),
    ];
  }
  return [
    createDcPastContributionSegment({
      startAge: 0,
      startMonth: 1,
      endAge,
      endMonth,
      expectedReturnRatePct: input.expectedReturnRatePct,
      contributionMan: input.contributionMan ?? 0,
      contributionMode: 'monthly',
    }),
  ];
}

/**
 * 過去区間を1つ追加する。
 * 末尾がすでに今月まで埋まっている場合は、末尾区間を半分に分割して追加する
 * （開始が現在より後になって正規化で捨てられるのを防ぐ）。
 */
export function appendDcPastContributionSegment(
  segments: readonly SavingsPastContributionSegment[],
  now: { age: number; month: number },
  defaults: { expectedReturnRatePct: number; contributionMan: number },
): SavingsPastContributionSegment[] {
  const normalized = normalizeDcPastContributionSegments(
    segments,
    now,
    defaults,
  );
  const nowIdx = ageMonthIndex(now.age, now.month);

  if (normalized.length === 0) {
    return [
      createDcPastContributionSegment({
        startAge: Math.max(0, now.age - 10),
        startMonth: 1,
        endAge: now.age,
        endMonth: now.month,
        expectedReturnRatePct: defaults.expectedReturnRatePct,
        contributionMan: defaults.contributionMan,
        contributionMode: 'monthly',
      }),
    ];
  }

  const last = normalized[normalized.length - 1];
  const afterLast = nextAgeMonth(last.endAge, last.endMonth);

  if (ageMonthIndex(afterLast.age, afterLast.month) <= nowIdx) {
    return [
      ...normalized,
      createDcPastContributionSegment({
        startAge: afterLast.age,
        startMonth: afterLast.month,
        endAge: now.age,
        endMonth: now.month,
        expectedReturnRatePct: last.expectedReturnRatePct,
        contributionMan: last.contributionMan,
        contributionMode: 'monthly',
      }),
    ];
  }

  // 末尾が今月まで → 半分に分割
  const startIdx = ageMonthIndex(last.startAge, last.startMonth);
  const endIdx = ageMonthIndex(last.endAge, last.endMonth);
  const span = endIdx - startIdx + 1;
  if (span < 2) {
    // 1か月しかない場合は開始を最大12か月前に延ばしてから分割
    const extendedStartIdx = Math.max(0, startIdx - 12);
    const extAge = Math.floor(extendedStartIdx / 12);
    const extMonth = (extendedStartIdx % 12) + 1;
    const midIdx =
      extendedStartIdx + Math.floor((endIdx - extendedStartIdx + 1) / 2) - 1;
    const midAge = Math.floor(midIdx / 12);
    const midMonth = (midIdx % 12) + 1;
    const second = nextAgeMonth(midAge, midMonth);
    return [
      ...normalized.slice(0, -1),
      { ...last, startAge: extAge, startMonth: extMonth, endAge: midAge, endMonth: midMonth },
      createDcPastContributionSegment({
        startAge: second.age,
        startMonth: second.month,
        endAge: last.endAge,
        endMonth: last.endMonth,
        expectedReturnRatePct: last.expectedReturnRatePct,
        contributionMan: last.contributionMan,
        contributionMode: 'monthly',
      }),
    ];
  }

  const midIdx = startIdx + Math.floor(span / 2) - 1;
  const midAge = Math.floor(midIdx / 12);
  const midMonth = (midIdx % 12) + 1;
  const second = nextAgeMonth(midAge, midMonth);
  return [
    ...normalized.slice(0, -1),
    { ...last, endAge: midAge, endMonth: midMonth },
    createDcPastContributionSegment({
      startAge: second.age,
      startMonth: second.month,
      endAge: last.endAge,
      endMonth: last.endMonth,
      expectedReturnRatePct: last.expectedReturnRatePct,
      contributionMan: last.contributionMan,
      contributionMode: 'monthly',
    }),
  ];
}

function estimateBalanceFromDcSegments(
  segments: readonly SavingsPastContributionSegment[],
  now: { age: number; month: number },
): number {
  if (segments.length === 0) return 0;
  let balance = 0;
  let lastRate = segments[0].expectedReturnRatePct;
  let lastEndAge = segments[0].startAge;
  let lastEndMonth = segments[0].startMonth;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    // 隙間は運用のみでつなぐ
    if (i > 0) {
      const gapStart = nextAgeMonth(lastEndAge, lastEndMonth);
      if (
        ageMonthIndex(gapStart.age, gapStart.month) <
        ageMonthIndex(seg.startAge, seg.startMonth)
      ) {
        const gapEnd = (() => {
          const idx = ageMonthIndex(seg.startAge, seg.startMonth) - 1;
          return {
            age: Math.floor(idx / 12),
            month: (idx % 12) + 1,
          };
        })();
        if (
          ageMonthIndex(gapEnd.age, gapEnd.month) >=
          ageMonthIndex(gapStart.age, gapStart.month)
        ) {
          balance = estimateContributionScheduleBalanceMan({
            startAge: gapStart.age,
            startMonth: gapStart.month,
            endAge: gapEnd.age,
            endMonth: gapEnd.month,
            contributionMode: 'none',
            contributionMan: 0,
            expectedReturnRatePct: lastRate,
            openingBalanceMan: balance,
          });
        }
      }
    }

    balance = estimateContributionScheduleBalanceMan({
      startAge: seg.startAge,
      startMonth: seg.startMonth,
      endAge: seg.endAge,
      endMonth: seg.endMonth,
      contributionMode: seg.contributionMode,
      contributionMan: seg.contributionMan,
      expectedReturnRatePct: seg.expectedReturnRatePct,
      openingBalanceMan: balance,
    });
    lastRate = seg.expectedReturnRatePct;
    lastEndAge = seg.endAge;
    lastEndMonth = seg.endMonth;
  }

  if (ageMonthIndex(lastEndAge, lastEndMonth) < ageMonthIndex(now.age, now.month)) {
    const growFrom = nextAgeMonth(lastEndAge, lastEndMonth);
    balance = estimateContributionScheduleBalanceMan({
      startAge: growFrom.age,
      startMonth: growFrom.month,
      endAge: now.age,
      endMonth: now.month,
      contributionMode: 'none',
      contributionMan: 0,
      expectedReturnRatePct: lastRate,
      openingBalanceMan: balance,
    });
  }
  return balance;
}

/**
 * Q7 の会社員・パート期間から DC 過去セグメント候補を作る（終了は今月以下）。
 */
export function suggestDcPastSegmentsFromIncome(
  incomeEntries: IncomeEntry[],
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  defaults: { expectedReturnRatePct: number; contributionMan: number },
): SavingsPastContributionSegment[] {
  const now = referenceNow(member, referenceDate);
  const nowIdx = ageMonthIndex(now.age, now.month);
  const raw: SavingsPastContributionSegment[] = [];

  for (const entry of incomeEntries) {
    if (!isCorporateDcEligibleIncomeCategory(entry.category)) continue;
    for (const period of entry.periods) {
      let endAge = period.endAge;
      let endMonth = clampMonth(period.endMonth);
      if (ageMonthIndex(endAge, endMonth) > nowIdx) {
        endAge = now.age;
        endMonth = now.month;
      }
      if (
        ageMonthIndex(period.startAge, period.startMonth) >
        ageMonthIndex(endAge, endMonth)
      ) {
        continue;
      }
      // 将来のみの期間はスキップ
      if (ageMonthIndex(period.startAge, period.startMonth) > nowIdx) continue;

      raw.push(
        createDcPastContributionSegment({
          startAge: period.startAge,
          startMonth: period.startMonth,
          endAge,
          endMonth,
          expectedReturnRatePct: defaults.expectedReturnRatePct,
          contributionMan: defaults.contributionMan,
          contributionMode: 'monthly',
        }),
      );
    }
  }

  return normalizeDcPastContributionSegments(raw, now, defaults);
}

/**
 * iDeCo / 企業型DC の試算開始時点残高。
 * - 過去入力あり・残高直接 → pastBalanceMan
 * - DC・積立額 → セグメント連結推計
 * - iDeCo・積立額 → 単一 past* 推計
 * - 過去入力なし → 0（本体は将来分のため遡及なし）
 * - 移行直後の互換: past 未設定で balanceMan > 0 ならそれを返す
 */
export function resolveIdecoDcOpeningBalanceMan(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age'>,
  referenceDate: Date,
): number {
  if (!isIdecoOrDc(entry.category)) {
    return Math.max(0, Number(entry.balanceMan) || 0);
  }

  const now = referenceNow(member, referenceDate);

  if (isIdecoPastContributionEnabled(entry)) {
    if (resolveIdecoPastContributionInputMode(entry) === 'balance') {
      return Math.max(0, Number(entry.pastBalanceMan) || 0);
    }

    if (entry.category === 'dc') {
      const segments = normalizeDcPastContributionSegments(
        migrateDcScalarPastToSegments(entry),
        now,
        {
          expectedReturnRatePct:
            entry.pastExpectedReturnRatePct ?? entry.expectedReturnRatePct,
          contributionMan: defaultDcPastContributionMan(entry),
        },
      );
      return estimateBalanceFromDcSegments(segments, now);
    }

    const pastStartAge = Math.max(0, Number(entry.pastStartAge) || 0);
    const pastStartMonth = clampMonth(entry.pastStartMonth);
    let pastEndAge = Math.max(0, Number(entry.pastEndAge) || now.age);
    let pastEndMonth = clampMonth(entry.pastEndMonth ?? now.month);
    if (ageMonthIndex(pastEndAge, pastEndMonth) > ageMonthIndex(now.age, now.month)) {
      pastEndAge = now.age;
      pastEndMonth = now.month;
    }
    if (ageMonthIndex(pastEndAge, pastEndMonth) < ageMonthIndex(pastStartAge, pastStartMonth)) {
      return 0;
    }
    const rate =
      entry.pastExpectedReturnRatePct ?? entry.expectedReturnRatePct;
    const mode =
      resolveSavingsContributionMode(entry.pastContributionMode) === 'annual'
        ? 'annual'
        : 'monthly';
    let balance = estimateContributionScheduleBalanceMan({
      startAge: pastStartAge,
      startMonth: pastStartMonth,
      endAge: pastEndAge,
      endMonth: pastEndMonth,
      contributionMode: mode,
      contributionMan: Math.max(0, Number(entry.pastContributionMan) || 0),
      expectedReturnRatePct: rate,
    });
    if (ageMonthIndex(pastEndAge, pastEndMonth) < ageMonthIndex(now.age, now.month)) {
      const growFrom = nextAgeMonth(pastEndAge, pastEndMonth);
      balance = estimateContributionScheduleBalanceMan({
        startAge: growFrom.age,
        startMonth: growFrom.month,
        endAge: now.age,
        endMonth: now.month,
        contributionMode: 'none',
        contributionMan: 0,
        expectedReturnRatePct: rate,
        openingBalanceMan: balance,
      });
    }
    return balance;
  }

  return Math.max(0, Number(entry.balanceMan) || 0);
}

/** 試算上の「いま」（年齢・月） */
export function resolveIdecoDcReferenceNow(
  member: Pick<FamilyMember, 'age'>,
  referenceDate: Date,
): { age: number; month: number } {
  return referenceNow(member, referenceDate);
}

/** これからの積立開始の初期値（現在の翌月） */
export function resolveIdecoDcMainContributionStartDefault(
  member: Pick<FamilyMember, 'age'>,
  referenceDate: Date,
): { age: number; month: number } {
  const now = referenceNow(member, referenceDate);
  return nextAgeMonth(now.age, now.month);
}

/** @deprecated 別名互換。初期値用 */
export function resolveIdecoDcMainContributionStart(
  member: Pick<FamilyMember, 'age'>,
  referenceDate: Date,
): { age: number; month: number } {
  return resolveIdecoDcMainContributionStartDefault(member, referenceDate);
}

/** 退職所得控除・通算加入の起点（過去開始があればそちら） */
export function resolveIdecoDcContributionJoin(
  entry: SavingsEntry,
): { age: number; month: number } {
  if (isIdecoPastContributionEnabled(entry)) {
    if (entry.category === 'dc') {
      const segments = migrateDcScalarPastToSegments(entry);
      const bounds = resolveDcPastSegmentsBounds(segments);
      if (bounds) {
        return { age: bounds.startAge, month: bounds.startMonth };
      }
    }
    return {
      age: Math.max(0, Number(entry.pastStartAge) || 0),
      month: clampMonth(entry.pastStartMonth),
    };
  }
  return {
    age: Math.max(0, Number(entry.startAge) || 0),
    month: clampMonth(entry.startMonth),
  };
}

/**
 * 退職所得控除用の拠出期間年数。
 * 過去ブロックと本体が隣接・重複していれば1本に結合、隙間があれば合算。
 */
export function calcIdecoDcRetirementDeductionEnrollmentYears(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'expectedLifespan'>,
  payoutStart?: { age: number; month: number } | null,
): number {
  type Seg = { startAge: number; startMonth: number; endAge: number; endMonth: number };
  const segments: Seg[] = [];

  if (isIdecoPastContributionEnabled(entry)) {
    if (entry.category === 'dc') {
      for (const seg of migrateDcScalarPastToSegments(entry)) {
        segments.push({
          startAge: seg.startAge,
          startMonth: seg.startMonth,
          endAge: seg.endAge,
          endMonth: seg.endMonth,
        });
      }
    } else {
      segments.push({
        startAge: Math.max(0, Number(entry.pastStartAge) || 0),
        startMonth: clampMonth(entry.pastStartMonth),
        endAge: Math.max(0, Number(entry.pastEndAge) || 0),
        endMonth: clampMonth(entry.pastEndMonth),
      });
    }
  }

  let mainEndAge =
    entry.endMode === 'until'
      ? Math.max(0, Number(entry.endAge) || entry.startAge)
      : member.expectedLifespan;
  let mainEndMonth =
    entry.endMode === 'until' ? clampMonth(entry.endMonth) : 12;
  // 受取が拠出終了より「年齢として」早いときだけ期間を切る。
  // 同じ年齢で受取月だけ早い（画面の誕生日月）場合は、拠出終了月まで数える。
  if (payoutStart && payoutStart.age < mainEndAge) {
    mainEndAge = payoutStart.age;
    mainEndMonth = clampMonth(payoutStart.month);
  }
  segments.push({
    startAge: Math.max(0, Number(entry.startAge) || 0),
    startMonth: clampMonth(entry.startMonth),
    endAge: mainEndAge,
    endMonth: mainEndMonth,
  });

  const normalized = segments
    .map((s) => {
      if (ageMonthIndex(s.endAge, s.endMonth) < ageMonthIndex(s.startAge, s.startMonth)) {
        return null;
      }
      return s;
    })
    .filter((s): s is Seg => s != null)
    .sort(
      (a, b) =>
        ageMonthIndex(a.startAge, a.startMonth) -
        ageMonthIndex(b.startAge, b.startMonth),
    );

  if (normalized.length === 0) return 1;

  const merged: Seg[] = [];
  for (const seg of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...seg });
      continue;
    }
    const lastEnd = ageMonthIndex(last.endAge, last.endMonth);
    const segStart = ageMonthIndex(seg.startAge, seg.startMonth);
    if (segStart <= lastEnd + 1) {
      if (ageMonthIndex(seg.endAge, seg.endMonth) > lastEnd) {
        last.endAge = seg.endAge;
        last.endMonth = seg.endMonth;
      }
    } else {
      merged.push({ ...seg });
    }
  }

  let years = 0;
  for (const seg of merged) {
    years += calcEnrollmentYearsFromAgeMonths(
      { age: seg.startAge, month: seg.startMonth },
      { age: seg.endAge, month: seg.endMonth },
    );
  }
  return Math.max(1, years);
}

/**
 * 過去ブロックと本体の積立期間を整合させる。
 * - 過去終了 ≤ 現在（今月）… 最大値。値自体は編集可
 * - これからの開始 ≥ 来月… 最小値。初期値は来月（強制固定しない）
 * - 過去と本体の間に隙間があってもよい。重複時のみ本体開始を過去終了翌月へ押し上げ
 * - DC は pastContributionSegments を正規化し、スカラー past* にも同期
 * - 旧 balanceMan は過去「残高直接」へ移行
 */
export function syncIdecoDcPastContributionPeriods(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'expectedLifespan' | 'birthMonth'>,
  referenceDate: Date,
): SavingsEntry {
  if (!isIdecoOrDc(entry.category)) return entry;

  const now = referenceNow(member, referenceDate);
  const mainFloor = nextAgeMonth(now.age, now.month);
  let next: SavingsEntry = { ...entry };

  // 旧データの移行（一度だけ）
  if (
    next.pastContributionEnabled == null &&
    Math.max(0, Number(next.balanceMan) || 0) > 0
  ) {
    const legacyBalance = Math.max(0, Number(next.balanceMan) || 0);
    let pastStartAge = Math.max(0, Number(next.startAge) || 0);
    let pastStartMonth = clampMonth(next.startMonth);
    if (ageMonthIndex(pastStartAge, pastStartMonth) > ageMonthIndex(now.age, now.month)) {
      pastStartAge = Math.max(0, now.age - 10);
      pastStartMonth = member.birthMonth || 1;
    }
    let pastEndAge = now.age;
    let pastEndMonth = now.month;
    if (next.endMode === 'until') {
      const endIdx = ageMonthIndex(next.endAge, next.endMonth);
      const nowIdx = ageMonthIndex(now.age, now.month);
      if (endIdx < nowIdx) {
        pastEndAge = next.endAge;
        pastEndMonth = clampMonth(next.endMonth);
      }
    }
    const legacySeg =
      next.category === 'dc'
        ? [
            createDcPastContributionSegment({
              startAge: pastStartAge,
              startMonth: pastStartMonth,
              endAge: pastEndAge,
              endMonth: pastEndMonth,
              expectedReturnRatePct: next.expectedReturnRatePct,
              contributionMan: 0,
              contributionMode: 'monthly',
            }),
          ]
        : undefined;
    next = {
      ...next,
      pastContributionEnabled: true,
      pastContributionInputMode: 'balance',
      pastBalanceMan: legacyBalance,
      pastStartAge,
      pastStartMonth,
      pastEndAge,
      pastEndMonth,
      pastExpectedReturnRatePct: next.expectedReturnRatePct,
      pastContributionMode: 'monthly',
      pastContributionMan: 0,
      pastContributionSegments: legacySeg,
      balanceMan: 0,
      startAge: mainFloor.age,
      startMonth: mainFloor.month,
    };
  }

  if (next.pastContributionEnabled == null) {
    next = { ...next, pastContributionEnabled: false };
  }

  // これからの開始: 来月未満なら押し上げ（編集下限）
  let startAge = Math.max(0, Number(next.startAge) || mainFloor.age);
  let startMonth = clampMonth(next.startMonth);
  if (ageMonthIndex(startAge, startMonth) < ageMonthIndex(mainFloor.age, mainFloor.month)) {
    startAge = mainFloor.age;
    startMonth = mainFloor.month;
  }

  let endAge = next.endMode === 'until' ? next.endAge : member.expectedLifespan;
  let endMonth = next.endMode === 'until' ? clampMonth(next.endMonth) : 12;
  if (ageMonthIndex(endAge, endMonth) < ageMonthIndex(startAge, startMonth)) {
    endAge = startAge;
    endMonth = startMonth;
  }

  if (!isIdecoPastContributionEnabled(next)) {
    const cleared: SavingsEntry = {
      ...next,
      pastContributionEnabled: false,
      startAge,
      startMonth,
      endAge,
      endMonth,
      endMode: 'until',
      balanceMan: 0,
    };
    const result: SavingsEntry = {
      ...cleared,
      balanceMan: resolveIdecoDcOpeningBalanceMan(cleared, member, referenceDate),
    };
    if (isSamePastSyncResult(entry, result)) {
      return entry;
    }
    return result;
  }

  const defaults = {
    expectedReturnRatePct:
      next.pastExpectedReturnRatePct ?? next.expectedReturnRatePct,
    contributionMan:
      next.category === 'dc'
        ? defaultDcPastContributionMan(next)
        : Math.max(0, Number(next.pastContributionMan) || 0),
  };

  let pastStartAge = Math.max(0, Number(next.pastStartAge) || 0);
  let pastStartMonth = clampMonth(next.pastStartMonth ?? member.birthMonth ?? undefined);
  let pastEndAge = Math.max(0, Number(next.pastEndAge) || now.age);
  let pastEndMonth = clampMonth(next.pastEndMonth ?? now.month);
  let pastSegments = next.pastContributionSegments;

  if (next.category === 'dc') {
    let segments = migrateDcScalarPastToSegments(next);
    if (segments.length === 0) {
      segments = [
        createDcPastContributionSegment({
          startAge: Math.max(0, now.age - 10),
          startMonth: member.birthMonth || 1,
          endAge: now.age,
          endMonth: now.month,
          expectedReturnRatePct: defaults.expectedReturnRatePct,
          contributionMan: defaults.contributionMan,
          contributionMode: 'monthly',
        }),
      ];
    }
    segments = normalizeDcPastContributionSegments(segments, now, defaults);
    pastSegments = segments;
    const bounds = resolveDcPastSegmentsBounds(segments);
    if (bounds) {
      pastStartAge = bounds.startAge;
      pastStartMonth = bounds.startMonth;
      pastEndAge = bounds.endAge;
      pastEndMonth = bounds.endMonth;
    }
  } else {
    if (ageMonthIndex(pastEndAge, pastEndMonth) > ageMonthIndex(now.age, now.month)) {
      pastEndAge = now.age;
      pastEndMonth = now.month;
    }
    if (ageMonthIndex(pastStartAge, pastStartMonth) > ageMonthIndex(pastEndAge, pastEndMonth)) {
      pastStartAge = pastEndAge;
      pastStartMonth = pastEndMonth;
    }
  }

  // 重複時のみ本体開始を過去終了翌月へ（隙間は許容）
  const afterPast = nextAgeMonth(pastEndAge, pastEndMonth);
  if (ageMonthIndex(startAge, startMonth) < ageMonthIndex(afterPast.age, afterPast.month)) {
    startAge = afterPast.age;
    startMonth = afterPast.month;
  }
  if (ageMonthIndex(startAge, startMonth) < ageMonthIndex(mainFloor.age, mainFloor.month)) {
    startAge = mainFloor.age;
    startMonth = mainFloor.month;
  }
  if (ageMonthIndex(endAge, endMonth) < ageMonthIndex(startAge, startMonth)) {
    endAge = startAge;
    endMonth = startMonth;
  }

  const synced: SavingsEntry = {
    ...next,
    pastContributionEnabled: true,
    pastStartAge,
    pastStartMonth,
    pastEndAge,
    pastEndMonth,
    pastExpectedReturnRatePct: defaults.expectedReturnRatePct,
    pastContributionMode: next.pastContributionMode ?? 'monthly',
    pastContributionMan: Math.max(0, Number(next.pastContributionMan) || 0),
    pastBalanceMan: Math.max(0, Number(next.pastBalanceMan) || 0),
    pastContributionInputMode: resolveIdecoPastContributionInputMode(next),
    pastContributionSegments:
      next.category === 'dc' ? pastSegments : next.pastContributionSegments,
    startAge,
    startMonth,
    endAge,
    endMonth,
    endMode: 'until',
    balanceMan: 0,
  };

  // DC amount モードでは先頭セグメント額をスカラーにもミラー（互換）
  if (
    next.category === 'dc' &&
    pastSegments &&
    pastSegments.length > 0 &&
    resolveIdecoPastContributionInputMode(synced) === 'amount'
  ) {
    synced.pastContributionMan = pastSegments[0].contributionMan;
    synced.pastExpectedReturnRatePct = pastSegments[0].expectedReturnRatePct;
  }

  const result: SavingsEntry = {
    ...synced,
    balanceMan: resolveIdecoDcOpeningBalanceMan(synced, member, referenceDate),
  };

  // 値が変わっていなければ元の参照を返し、useEffect の更新ループを防ぐ
  if (isSamePastSyncResult(entry, result)) {
    return entry;
  }
  // セグメント内容が同じなら配列参照も維持（依存配列の不要な再実行を防ぐ）
  if (
    arePastContributionSegmentsEqual(
      entry.pastContributionSegments,
      result.pastContributionSegments,
    )
  ) {
    result.pastContributionSegments = entry.pastContributionSegments;
  }
  return result;
}

/** 過去積み立てのオン／オフ切替時の初期値 */
export function applyIdecoPastContributionEnabled(
  entry: SavingsEntry,
  enabled: boolean,
  member: Pick<FamilyMember, 'age' | 'expectedLifespan' | 'birthMonth'>,
  referenceDate: Date,
): SavingsEntry {
  if (!isIdecoOrDc(entry.category)) return entry;
  const now = referenceNow(member, referenceDate);
  const mainFloor = nextAgeMonth(now.age, now.month);

  if (!enabled) {
    return syncIdecoDcPastContributionPeriods(
      { ...entry, pastContributionEnabled: false },
      member,
      referenceDate,
    );
  }

  const contributionMan =
    entry.category === 'dc'
      ? defaultDcPastContributionMan(entry)
      : Math.max(0, Number(entry.contributionMan) || 0);

  const basePast = {
    ...entry,
    pastContributionEnabled: true as const,
    pastContributionInputMode: 'amount' as const,
    pastStartAge: Math.max(0, now.age - 10),
    pastStartMonth: member.birthMonth || 1,
    pastEndAge: now.age,
    pastEndMonth: now.month,
    pastExpectedReturnRatePct: entry.expectedReturnRatePct,
    pastContributionMode: 'monthly' as const,
    pastContributionMan: contributionMan,
    pastBalanceMan: 0,
    startAge:
      ageMonthIndex(entry.startAge, entry.startMonth) <
      ageMonthIndex(mainFloor.age, mainFloor.month)
        ? mainFloor.age
        : entry.startAge,
    startMonth:
      ageMonthIndex(entry.startAge, entry.startMonth) <
      ageMonthIndex(mainFloor.age, mainFloor.month)
        ? mainFloor.month
        : entry.startMonth,
  };

  if (entry.category === 'dc') {
    return syncIdecoDcPastContributionPeriods(
      {
        ...basePast,
        pastContributionSegments: [
          createDcPastContributionSegment({
            startAge: basePast.pastStartAge,
            startMonth: basePast.pastStartMonth,
            endAge: basePast.pastEndAge,
            endMonth: basePast.pastEndMonth,
            expectedReturnRatePct: entry.expectedReturnRatePct,
            contributionMan,
            contributionMode: 'monthly',
          }),
        ],
      },
      member,
      referenceDate,
    );
  }

  return syncIdecoDcPastContributionPeriods(basePast, member, referenceDate);
}
