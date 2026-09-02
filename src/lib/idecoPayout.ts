import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type {
  IdecoAnnuityPeriodMode,
  SavingsCategory,
  SavingsEntry,
} from '../types/savings';
import { calcEnrollmentYearsFromAgeMonths } from './retirementIncomeTax';
import { resolveDbEnrollmentYears, ensureDbEnrollmentFields } from './dbEnrollment';
import {
  isDbDeferredPayout,
  isDbLumpAtExit,
  isDbTransferToIdeco,
  resolveDbQualificationEnd,
} from './dbEarlyExit';
import {
  calcIdecoDcRetirementDeductionEnrollmentYears,
  resolveIdecoDcContributionJoin,
} from './idecoPastContribution';
import {
  calcDrawdownAmounts,
  nextAgeMonth,
  resolveContributionEndPoint,
  suggestWithdrawalStart,
  withdrawalEndFromYears,
} from './savingsWithdrawalPeriod';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from './savingsLabels';

export const IDECO_PAYOUT_MIN_AGE = 60;
export const IDECO_PAYOUT_MAX_AGE = 75;
/** 通算加入者等期間が短い場合の最早受給年齢の上限 */
export const IDECO_PAYOUT_ENROLLMENT_FLOOR_MAX_AGE = 65;
export const IDECO_ANNUITY_MIN_YEARS = 5;
export const IDECO_ANNUITY_MAX_YEARS = 20;
export const IDECO_ANNUITY_DEFAULT_YEARS = 10;

/** DB・企業型DCの受給開始の既定年齢 */
export const CORPORATE_PENSION_PAYOUT_DEFAULT_AGE = 60;

export const IDECO_PAYOUT_MODE_LABELS: Record<'once' | 'drawdown', string> = {
  once: '一括受取',
  drawdown: '年金受取',
};

export const IDECO_PAYOUT_MODES: Array<'once' | 'drawdown'> = [
  'once',
  'drawdown',
];

export const IDECO_ANNUITY_PERIOD_MODE_LABELS: Record<
  IdecoAnnuityPeriodMode,
  string
> = {
  years: '年数で指定',
  until_age: '受給完了年齢で指定',
};

export const IDECO_ANNUITY_YEAR_OPTIONS: number[] = Array.from(
  { length: IDECO_ANNUITY_MAX_YEARS - IDECO_ANNUITY_MIN_YEARS + 1 },
  (_, i) => IDECO_ANNUITY_MIN_YEARS + i,
);

export function isPensionPayoutCategory(
  category: SavingsCategory,
): category is 'ideco' | 'dc' | 'db' {
  return isPensionStylePayoutCategory(category);
}

export function resolveIdecoAnnuityPeriodMode(
  mode: IdecoAnnuityPeriodMode | undefined,
): IdecoAnnuityPeriodMode {
  return mode === 'until_age' ? 'until_age' : 'years';
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function clampMonth(month: number | null | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

function yearsFromInclusiveMonths(months: number): number {
  return Math.max(1, Math.round(months / 12));
}

/** 開始〜終了（inclusive）の月数 */
export function calcInclusiveMonthCount(
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): number {
  return Math.max(
    1,
    ageMonthIndex(endAge, endMonth) - ageMonthIndex(startAge, startMonth) + 1,
  );
}

/**
 * 通算加入者等期間（年）→ 最早受給年齢。
 * 10年以上→60歳 … 2年未満→65歳。
 * ※税務の「10年ルール」（退職所得控除の重複調整）とは別概念。
 */
export function resolveMinPayoutAgeFromEnrollmentYears(
  enrollmentYears: number,
): number {
  const years = Math.max(0, Number(enrollmentYears) || 0);
  if (years >= 10) return 60;
  if (years >= 8) return 61;
  if (years >= 6) return 62;
  if (years >= 4) return 63;
  if (years >= 2) return 64;
  return 65;
}

/**
 * 加入開始〜指定時点の通算加入者等期間（年）。
 * 試算では積立開始（過去ブロックがあればその開始）〜当該時点。
 * 受給開始年齢の判定に使う。退職所得控除の加入年数には使わない。
 */
export function calcPensionEnrollmentYearsAsOf(
  entry: Pick<SavingsEntry, 'startAge' | 'startMonth'> | SavingsEntry,
  asOf: { age: number; month: number },
): number {
  const join =
    'category' in entry &&
    (entry.category === 'ideco' || entry.category === 'dc')
      ? resolveIdecoDcContributionJoin(entry as SavingsEntry)
      : {
          age: Math.max(0, Number(entry.startAge) || 0),
          month: clampMonth(entry.startMonth),
        };
  return calcEnrollmentYearsFromAgeMonths(join, {
    age: Math.max(0, Number(asOf.age) || 0),
    month: clampMonth(asOf.month),
  });
}

/**
 * 退職所得控除用の加入年数（掛金拠出期間のみ）。
 * 運用指図者期間は算入しない。終了は積立終了（until）。
 * 積立終了が受給開始より後なら受給開始までにクリップ。
 * iDeCo / DC は過去ブロックがあれば結合して計算する。
 * DB は dbEnrollment*（年数／期間）を使う。
 */
export function calcPensionRetirementDeductionEnrollmentYears(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'expectedLifespan'>,
  payoutStart?: { age: number; month: number } | null,
): number {
  if (entry.category === 'ideco' || entry.category === 'dc') {
    return calcIdecoDcRetirementDeductionEnrollmentYears(
      entry,
      member,
      payoutStart,
    );
  }

  if (entry.category === 'db') {
    return resolveDbEnrollmentYears(ensureDbEnrollmentFields(entry, member));
  }

  const join = {
    age: Math.max(0, Number(entry.startAge) || 0),
    month: clampMonth(entry.startMonth),
  };

  let endAge: number;
  let endMonth: number;
  if (entry.endMode === 'until') {
    endAge = Math.max(0, Number(entry.endAge) || join.age);
    endMonth = clampMonth(entry.endMonth);
  } else {
    endAge = member.expectedLifespan;
    endMonth = 12;
  }

  if (payoutStart) {
    if (
      ageMonthIndex(endAge, endMonth) >
      ageMonthIndex(payoutStart.age, clampMonth(payoutStart.month))
    ) {
      endAge = payoutStart.age;
      endMonth = clampMonth(payoutStart.month);
    }
  }

  if (ageMonthIndex(endAge, endMonth) < ageMonthIndex(join.age, join.month)) {
    return 1;
  }
  return calcEnrollmentYearsFromAgeMonths(join, { age: endAge, month: endMonth });
}

/**
 * 通算加入者等期間に基づく最早受給年齢。
 * 待機中も通算期間（運用指図者期間を含む）が伸びるため、60歳到達月から65歳まで順に判定する。
 * ※退職所得控除の加入年数には運用指図者期間は算入されない（別関数）。
 */
export function resolveEarliestPayoutAgeFromJoin(
  join: { age: number; month: number },
  birthMonth: number | null | undefined = 1,
): number {
  const reachMonth = clampMonth(birthMonth);
  for (
    let age = IDECO_PAYOUT_MIN_AGE;
    age <= IDECO_PAYOUT_ENROLLMENT_FLOOR_MAX_AGE;
    age += 1
  ) {
    const years = calcEnrollmentYearsFromAgeMonths(join, {
      age,
      month: reachMonth,
    });
    const required = resolveMinPayoutAgeFromEnrollmentYears(years);
    if (age >= required) return age;
  }
  return IDECO_PAYOUT_ENROLLMENT_FLOOR_MAX_AGE;
}

/**
 * iDeCo / 企業型DC の通算加入者等期間による受給下限年齢。
 * DB は規約依存のため適用しない。
 */
export function resolvePensionEnrollmentPayoutFloorAge(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'birthMonth'>,
): number | null {
  if (entry.category !== 'ideco' && entry.category !== 'dc') return null;
  return resolveEarliestPayoutAgeFromJoin(
    resolveIdecoDcContributionJoin(entry),
    member.birthMonth,
  );
}

export function calcMonthlyDrawdownFromMonths(
  assetsMan: number,
  months: number,
): { monthlyMan: number; annualMan: number; years: number } {
  const m = Math.max(1, Math.round(months));
  const assets = Math.max(0, assetsMan);
  const monthlyMan = Math.round((assets / m) * 10) / 10;
  const annualMan = Math.round(monthlyMan * 12);
  return { monthlyMan, annualMan, years: yearsFromInclusiveMonths(m) };
}

/**
 * 受給開始をクランプする。
 * - iDeCo: max(60, 通算加入者等期間による最早年齢, 積立終了翌月) 〜 75歳
 * - 企業型DC: max(60, 通算加入者等期間による最早年齢, 積立終了翌月) 〜 余命
 * - DB: 現在年齢以降（余命まで）。未設定時の下限目安は 60歳
 */
export function resolvePensionPayoutStart(
  entry: SavingsEntry,
  member: FamilyMember,
  preferred?: { age: number; month: number } | null,
): { age: number; month: number } {
  const hasPreferred =
    preferred != null ||
    entry.withdrawalStartAge != null ||
    entry.withdrawalStartMonth != null;

  const suggested =
    preferred ??
    (hasPreferred
      ? {
          age: entry.withdrawalStartAge ?? resolveMemberAge(member),
          month: entry.withdrawalStartMonth ?? 1,
        }
      : entry.category === 'db'
        ? {
            age: Math.max(resolveMemberAge(member), CORPORATE_PENSION_PAYOUT_DEFAULT_AGE),
            month: 1,
          }
        : suggestWithdrawalStart(entry, member, null));

  let floorAge = resolveMemberAge(member);
  let floorMonth = 1;

  if (entry.category === 'db') {
    if (isDbLumpAtExit(entry, member)) {
      const exit = resolveDbQualificationEnd(entry, member);
      if (exit) {
        floorAge = exit.age;
        floorMonth = exit.month;
      }
    } else if (isDbDeferredPayout(entry, member)) {
      floorAge = IDECO_PAYOUT_MIN_AGE;
      floorMonth = 1;
    } else if (isDbTransferToIdeco(entry, member)) {
      // 受取は iDeCo 側。開始年齢は参照されないが下限は維持
      floorAge = resolveMemberAge(member);
      floorMonth = 1;
    }
  } else if (entry.category === 'ideco' || entry.category === 'dc') {
    floorAge = IDECO_PAYOUT_MIN_AGE;
    floorMonth = 1;

    const enrollmentFloor = resolvePensionEnrollmentPayoutFloorAge(
      entry,
      member,
    );
    if (enrollmentFloor != null && enrollmentFloor > floorAge) {
      floorAge = enrollmentFloor;
      floorMonth = clampMonth(resolveMemberBirthMonth(member));
    }

    const contributionEnd =
      entry.endMode === 'until'
        ? { age: entry.endAge, month: entry.endMonth }
        : resolveContributionEndPoint(entry, member, null);
    if (contributionEnd) {
      const next = nextAgeMonth(contributionEnd.age, contributionEnd.month);
      if (
        ageMonthIndex(next.age, next.month) >
        ageMonthIndex(floorAge, floorMonth)
      ) {
        floorAge = next.age;
        floorMonth = next.month;
      }
    }
  }

  let age = Math.round(suggested.age);
  let month = clampMonth(suggested.month);

  if (ageMonthIndex(age, month) < ageMonthIndex(floorAge, floorMonth)) {
    age = floorAge;
    month = floorMonth;
  }

  const maxAge =
    entry.category === 'ideco'
      ? IDECO_PAYOUT_MAX_AGE
      : member.expectedLifespan;

  if (
    (entry.category === 'ideco' || entry.category === 'dc') &&
    age < IDECO_PAYOUT_MIN_AGE
  ) {
    age = IDECO_PAYOUT_MIN_AGE;
    month = 1;
  }

  if (age > maxAge || (age === maxAge && month > 12)) {
    age = maxAge;
    month = 12;
  }

  if (ageMonthIndex(floorAge, floorMonth) > ageMonthIndex(maxAge, 12)) {
    return { age: maxAge, month: 12 };
  }

  return { age, month };
}

/** iDeCo 互換エイリアス */
export function resolveIdecoPayoutStart(
  entry: SavingsEntry,
  member: FamilyMember,
  preferred?: { age: number; month: number } | null,
): { age: number; month: number } {
  return resolvePensionPayoutStart(entry, member, preferred);
}

export function resolveIdecoAnnuityYears(entry: SavingsEntry): number {
  const raw = Number(entry.withdrawalYears);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(
      IDECO_ANNUITY_MAX_YEARS,
      Math.max(IDECO_ANNUITY_MIN_YEARS, Math.round(raw)),
    );
  }
  return IDECO_ANNUITY_DEFAULT_YEARS;
}

function sameIdecoPayout(a: SavingsEntry, b: SavingsEntry): boolean {
  return (
    a.withdrawalMode === b.withdrawalMode &&
    a.withdrawalMan === b.withdrawalMan &&
    a.withdrawalStartAge === b.withdrawalStartAge &&
    a.withdrawalStartMonth === b.withdrawalStartMonth &&
    a.withdrawalYears === b.withdrawalYears &&
    a.withdrawalEndMode === b.withdrawalEndMode &&
    a.withdrawalEndAge === b.withdrawalEndAge &&
    a.withdrawalEndMonth === b.withdrawalEndMonth &&
    a.idecoAnnuityPeriodMode === b.idecoAnnuityPeriodMode
  );
}

/**
 * iDeCo / 企業型DC / DB の受取フィールドを補正する。
 * - ideco/dc: assetsMan があるとき一括・年金月額を残高から再計算
 * - db: 見込み額はユーザー入力（withdrawalMan）を維持。期間のみ補正
 */
export function clampPensionPayoutFields(
  entry: SavingsEntry,
  member: FamilyMember,
  assetsMan?: number,
): SavingsEntry {
  if (!isPensionPayoutCategory(entry.category)) return entry;

  // 企業型DC→iDeCo移管時は DC 側で受取しない（iDeCo 側で設定）
  if (
    entry.category === 'dc' &&
    entry.transferBalanceToIdecoOnEnd &&
    Math.max(0, Number(entry.endAge) || 0) < IDECO_PAYOUT_MIN_AGE
  ) {
    if (entry.withdrawalMode === 'none') return entry;
    return { ...entry, withdrawalMode: 'none' };
  }

  // DB→iDeCo移換時は DB 側で受取しない
  if (entry.category === 'db' && isDbTransferToIdeco(entry, member)) {
    if (entry.withdrawalMode === 'none') return entry;
    return { ...entry, withdrawalMode: 'none' };
  }

  // DB 脱退一時金: 加入終了月に一括
  if (entry.category === 'db' && isDbLumpAtExit(entry, member)) {
    const exit = resolveDbQualificationEnd(entry, member);
    if (exit) {
      return {
        ...entry,
        withdrawalMode: 'once',
        withdrawalStartAge: exit.age,
        withdrawalStartMonth: exit.month,
        withdrawalEndMode: 'until',
        withdrawalEndAge: exit.age,
        withdrawalEndMonth: exit.month,
        withdrawalYears: undefined,
      };
    }
  }

  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  const effectiveMode = mode === 'none' ? 'once' : mode;
  const isDb = entry.category === 'db';
  const useAssets = !isDb && assetsMan != null;

  const start = resolvePensionPayoutStart(entry, member, {
    age: entry.withdrawalStartAge ?? resolveMemberAge(member),
    month: resolveMemberBirthMonth(member),
  });

  let next: SavingsEntry;

  if (effectiveMode === 'once') {
    const amount = useAssets
      ? Math.max(0, Math.round(assetsMan!))
      : Math.max(0, Number(entry.withdrawalMan) || 0);
    next = {
      ...entry,
      withdrawalMode: 'once',
      withdrawalMan: amount,
      withdrawalStartAge: start.age,
      withdrawalStartMonth: start.month,
      withdrawalYears: undefined,
      withdrawalEndMode: 'until',
      withdrawalEndAge: start.age,
      withdrawalEndMonth: start.month,
    };
  } else {
    const periodMode = resolveIdecoAnnuityPeriodMode(
      entry.idecoAnnuityPeriodMode,
    );

    if (periodMode === 'until_age') {
      let endAge = Math.max(
        start.age,
        Number(entry.withdrawalEndAge) ||
          start.age + IDECO_ANNUITY_DEFAULT_YEARS,
      );
      // 受給開始・完了とも誕生日月（UIは年齢のみ）
      let endMonth = start.month;
      if (endAge > member.expectedLifespan) {
        endAge = member.expectedLifespan;
        endMonth = 12;
      }
      if (
        ageMonthIndex(endAge, endMonth) <=
        ageMonthIndex(start.age, start.month)
      ) {
        const minEnd = withdrawalEndFromYears(
          start.age,
          start.month,
          IDECO_ANNUITY_MIN_YEARS,
        );
        endAge = minEnd.age;
        endMonth = minEnd.month;
      }
      let finalMonths = calcInclusiveMonthCount(
        start.age,
        start.month,
        endAge,
        endMonth,
      );
      const yearsApprox = finalMonths / 12;
      if (yearsApprox > IDECO_ANNUITY_MAX_YEARS) {
        const capped = withdrawalEndFromYears(
          start.age,
          start.month,
          IDECO_ANNUITY_MAX_YEARS,
        );
        endAge = capped.age;
        endMonth = capped.month;
        finalMonths = calcInclusiveMonthCount(
          start.age,
          start.month,
          endAge,
          endMonth,
        );
      } else if (yearsApprox < IDECO_ANNUITY_MIN_YEARS) {
        const capped = withdrawalEndFromYears(
          start.age,
          start.month,
          IDECO_ANNUITY_MIN_YEARS,
        );
        endAge = capped.age;
        endMonth = capped.month;
        finalMonths = calcInclusiveMonthCount(
          start.age,
          start.month,
          endAge,
          endMonth,
        );
      }
      const amounts = useAssets
        ? calcMonthlyDrawdownFromMonths(assetsMan!, finalMonths)
        : {
            monthlyMan: Math.max(0, Number(entry.withdrawalMan) || 0),
            annualMan: Math.round(
              Math.max(0, Number(entry.withdrawalMan) || 0) * 12,
            ),
            years: yearsFromInclusiveMonths(finalMonths),
          };

      next = {
        ...entry,
        withdrawalMode: 'drawdown',
        idecoAnnuityPeriodMode: 'until_age',
        withdrawalStartAge: start.age,
        withdrawalStartMonth: start.month,
        withdrawalEndMode: 'until',
        withdrawalEndAge: endAge,
        withdrawalEndMonth: endMonth,
        withdrawalYears: amounts.years,
        withdrawalMan: amounts.monthlyMan,
      };
    } else {
      const years = resolveIdecoAnnuityYears(entry);
      const end = withdrawalEndFromYears(start.age, start.month, years);
      const amounts = useAssets
        ? calcDrawdownAmounts(assetsMan!, years)
        : {
            monthlyMan: Math.max(0, Number(entry.withdrawalMan) || 0),
            annualMan: Math.round(
              Math.max(0, Number(entry.withdrawalMan) || 0) * 12,
            ),
          };

      next = {
        ...entry,
        withdrawalMode: 'drawdown',
        idecoAnnuityPeriodMode: 'years',
        withdrawalStartAge: start.age,
        withdrawalStartMonth: start.month,
        withdrawalYears: years,
        withdrawalEndMode: 'until',
        withdrawalEndAge: end.age,
        withdrawalEndMonth: end.month,
        withdrawalMan: amounts.monthlyMan,
      };
    }
  }

  return sameIdecoPayout(entry, next) ? entry : next;
}

export function clampIdecoPayoutFields(
  entry: SavingsEntry,
  member: FamilyMember,
  assetsMan?: number,
): SavingsEntry {
  return clampPensionPayoutFields(entry, member, assetsMan);
}

export function getIdecoPayoutAgeOptions(
  minAge: number = IDECO_PAYOUT_MIN_AGE,
): number[] {
  const min = Math.min(
    IDECO_PAYOUT_MAX_AGE,
    Math.max(IDECO_PAYOUT_MIN_AGE, Math.round(minAge)),
  );
  return Array.from(
    { length: IDECO_PAYOUT_MAX_AGE - min + 1 },
    (_, i) => min + i,
  );
}

export function getPensionPayoutAgeOptions(
  member: FamilyMember,
  category: SavingsCategory,
  minAge?: number,
): number[] {
  if (category === 'ideco') {
    return getIdecoPayoutAgeOptions(minAge ?? IDECO_PAYOUT_MIN_AGE);
  }
  const enrollmentMin =
    minAge != null
      ? Math.max(resolveMemberAge(member), minAge)
      : resolveMemberAge(member);
  const min =
    category === 'dc'
      ? Math.max(enrollmentMin, IDECO_PAYOUT_MIN_AGE)
      : enrollmentMin;
  const max = member.expectedLifespan;
  if (max < min) return [min];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
