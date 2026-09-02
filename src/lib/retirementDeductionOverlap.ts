import { resolveMemberAge } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';
import type { SavingsEntry, SavingsState } from '../types/savings';
import { calcBirthYear } from './birthDate';
import {
  ensureDbEnrollmentFields,
  resolveDbEnrollmentPeriod,
} from './dbEnrollment';
import {
  calcPensionRetirementDeductionEnrollmentYears,
  resolveIdecoPayoutStart,
} from './idecoPayout';
import { resolveIdecoDcContributionJoin } from './idecoPastContribution';
import type { IdecoLumpSumTaxInput } from './idecoTax';
import { resolveRetirementEnrollmentMode, resolveRetirementEnrollmentYears, retirementAllowancesForEntry } from './retirementAllowance';
import {
  calcRetirementIncomeDeductionYen,
  calcRetirementIncomeTaxBreakdown,
  countInclusiveMonthRanges,
  mergeInclusiveMonthRanges,
  type EnrollmentAgeMonthPeriod,
  type RetirementIncomeTaxBreakdown,
} from './retirementIncomeTax';
import { getMemberSavingsEntries } from './savingsDefaults';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from './savingsLabels';

/**
 * 退職所得控除の重複調整用の一時金区分。
 * - company / db: 退職一時金系（会社退職金・DB）
 * - ideco / dc: DC一時金系（iDeCo・企業型DCの老齢一時金）
 *
 * ルックバックは「後受けの種類」で決まる（国税庁 No.2735 の整理）:
 * 1. DC/iDeCo → DB・会社退職金 … 10年ルール（前年以前9年以内）
 * 2. DB・会社退職金 → DC/iDeCo … 19年ルール（前年以前19年以内）
 * 3. DC/iDeCo → DC/iDeCo … 19年ルール（前年以前19年以内）
 * 4. DB・会社退職金どうし … 5年ルール（前年以前4年以内）
 */
export type RetirementLumpKind = 'company' | 'ideco' | 'dc' | 'db';

/** DC/iDeCo 先 → DB・会社退職金後: 前年以前9年内（通称・10年ルール） */
export const RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS = 9;

/** DB・会社退職金先 → DC/iDeCo 後: 前年以前19年内（通称・19年／20年ルール） */
export const RETIREMENT_DEDUCTION_COMPANY_THEN_DC_LOOKBACK_YEARS = 19;

/** DB・会社退職金どうし: 前年以前4年内（5年ルール） */
export const RETIREMENT_DEDUCTION_COMPANY_THEN_COMPANY_LOOKBACK_YEARS = 4;

/** DC/iDeCo どうし: 前年以前19年内（後受けがDC一時金のため19年ルール） */
export const RETIREMENT_DEDUCTION_DC_THEN_DC_LOOKBACK_YEARS = 19;

export interface RetirementLumpEvent {
  memberId: string;
  calendarYear: number;
  kind: RetirementLumpKind;
  revenueMan: number;
  enrollmentYears: number;
  periodStartAge: number;
  periodStartMonth: number;
  periodEndAge: number;
  periodEndMonth: number;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + Math.min(12, Math.max(1, month));
}

function clampMonth(month: number | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

function calendarYearFromAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  age: number,
  month: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const m = clampMonth(month);
  if (m >= (member.birthMonth || 1)) {
    return birthYear + age;
  }
  return birthYear + age + 1;
}

function isDcStyleKind(kind: RetirementLumpKind): boolean {
  return kind === 'ideco' || kind === 'dc';
}

function isCompanyStyleKind(kind: RetirementLumpKind): boolean {
  return kind === 'company' || kind === 'db';
}

/** 先行一時金 → 後行一時金のルックバック年数（前年以前◯年） */
export function resolveRetirementDeductionLookbackYears(
  priorKind: RetirementLumpKind,
  currentKind: RetirementLumpKind,
): number | null {
  if (isDcStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return RETIREMENT_DEDUCTION_DC_THEN_COMPANY_LOOKBACK_YEARS;
  }
  if (isCompanyStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return RETIREMENT_DEDUCTION_COMPANY_THEN_DC_LOOKBACK_YEARS;
  }
  if (isCompanyStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return RETIREMENT_DEDUCTION_COMPANY_THEN_COMPANY_LOOKBACK_YEARS;
  }
  if (isDcStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return RETIREMENT_DEDUCTION_DC_THEN_DC_LOOKBACK_YEARS;
  }
  return null;
}

/** 2期間の重複月数（両端含む）。重ならなければ 0 */
export function calcEnrollmentOverlapMonths(
  a: EnrollmentAgeMonthPeriod,
  b: EnrollmentAgeMonthPeriod,
): number {
  const a0 = ageMonthIndex(a.startAge, a.startMonth);
  const a1 = ageMonthIndex(a.endAge, a.endMonth);
  const b0 = ageMonthIndex(b.startAge, b.startMonth);
  const b1 = ageMonthIndex(b.endAge, b.endMonth);
  const start = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const end = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  if (end < start) return 0;
  return end - start + 1;
}

/**
 * 2期間の重複年数（国税庁: 1年未満の端数は切り捨て）。
 * 0〜11か月 → 0、12か月 → 1。
 */
export function calcEnrollmentOverlapYears(
  a: EnrollmentAgeMonthPeriod,
  b: EnrollmentAgeMonthPeriod,
): number {
  return Math.floor(calcEnrollmentOverlapMonths(a, b) / 12);
}

function eventToPeriod(event: RetirementLumpEvent): EnrollmentAgeMonthPeriod {
  return {
    startAge: event.periodStartAge,
    startMonth: event.periodStartMonth,
    endAge: event.periodEndAge,
    endMonth: event.periodEndMonth,
  };
}

function overlapMonthRange(
  a: EnrollmentAgeMonthPeriod,
  b: EnrollmentAgeMonthPeriod,
): { start: number; end: number } | null {
  const a0 = ageMonthIndex(a.startAge, a.startMonth);
  const a1 = ageMonthIndex(a.endAge, a.endMonth);
  const b0 = ageMonthIndex(b.startAge, b.startMonth);
  const b1 = ageMonthIndex(b.endAge, b.endMonth);
  const start = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const end = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  if (end < start) return null;
  return { start, end };
}

function isApplicablePrior(
  prior: RetirementLumpEvent,
  current: RetirementLumpEvent,
): boolean {
  if (prior.memberId !== current.memberId) return false;
  if (prior.calendarYear >= current.calendarYear) return false;
  const lookback = resolveRetirementDeductionLookbackYears(
    prior.kind,
    current.kind,
  );
  if (lookback == null) return false;
  const gap = current.calendarYear - prior.calendarYear;
  return gap >= 1 && gap <= lookback;
}

/**
 * 後続一時金の退職所得控除を、先行一時金との重複期間だけ減額する。
 * 複数の先行がある場合は重複月の和集合を取り、年数は切り捨て（No.2735）。
 * 同年合算は呼び出し側で済ませ、ここは別年のみ対象。
 */
export function calcRetirementDeductionYenAfterOverlap(input: {
  current: RetirementLumpEvent;
  priors: RetirementLumpEvent[];
  /** 同年に複数区分を合算する前の構成期間。未指定なら current の1期間 */
  currentPeriods?: EnrollmentAgeMonthPeriod[];
}): {
  fullDeductionYen: number;
  overlapYears: number;
  deductionYen: number;
} {
  const fullDeductionYen = calcRetirementIncomeDeductionYen(
    input.current.enrollmentYears,
  );
  const currentPeriods =
    input.currentPeriods && input.currentPeriods.length > 0
      ? input.currentPeriods
      : [eventToPeriod(input.current)];

  const overlapRanges: { start: number; end: number }[] = [];
  for (const prior of input.priors) {
    if (!isApplicablePrior(prior, input.current)) continue;
    const priorPeriod = eventToPeriod(prior);
    for (const cur of currentPeriods) {
      const range = overlapMonthRange(cur, priorPeriod);
      if (range) overlapRanges.push(range);
    }
  }

  const currentRanges = currentPeriods
    .map((p) => {
      const a0 = ageMonthIndex(p.startAge, p.startMonth);
      const a1 = ageMonthIndex(p.endAge, p.endMonth);
      if (a1 < a0) return null;
      return { start: Math.min(a0, a1), end: Math.max(a0, a1) };
    })
    .filter((r): r is { start: number; end: number } => r != null);
  const currentMonths = countInclusiveMonthRanges(
    mergeInclusiveMonthRanges(currentRanges),
  );
  const overlapMonths = countInclusiveMonthRanges(
    mergeInclusiveMonthRanges(overlapRanges),
  );
  const uniqueMonths = Math.max(0, currentMonths - overlapMonths);

  // Method A: 本来の控除 − 重複期間の控除。
  // 全期間重複（または非重複が端数月のみで、切り上げ加入年数との差だけが残る場合）は
  // 控除0。例: 20年同士が完全重複 → 800万 − 800万 = 0（40万残しにしない）
  let overlapYears = Math.floor(overlapMonths / 12);
  if (
    input.current.enrollmentYears > 0 &&
    (uniqueMonths === 0 ||
      (uniqueMonths < 12 &&
        overlapYears === input.current.enrollmentYears - 1))
  ) {
    overlapYears = input.current.enrollmentYears;
  }
  overlapYears = Math.min(overlapYears, input.current.enrollmentYears);
  const reductionYen =
    overlapYears > 0 ? calcRetirementIncomeDeductionYen(overlapYears) : 0;
  return {
    fullDeductionYen,
    overlapYears,
    deductionYen: Math.max(0, fullDeductionYen - reductionYen),
  };
}

function contributionPeriodForSavingsEntry(
  entry: SavingsEntry,
  member: FamilyMember,
  payout: { age: number; month: number },
): {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
} {
  if (entry.category === 'db') {
    return resolveDbEnrollmentPeriod(
      ensureDbEnrollmentFields(entry, member),
      payout,
    );
  }
  // 図解と同じく、過去拠出があればその開始を期間起点にする
  const join =
    entry.category === 'ideco' || entry.category === 'dc'
      ? resolveIdecoDcContributionJoin(entry)
      : {
          age: Math.max(0, Number(entry.startAge) || 0),
          month: clampMonth(entry.startMonth),
        };
  const startAge = join.age;
  const startMonth = join.month;
  // 退職所得控除の重複判定は「拠出期間」が基準。
  // 受取月（画面では誕生日月）で切ると、同年内の終了月より前に見えて
  // わずかな非重複→控除40万残り、という誤判定になる。
  let endAge =
    entry.endMode === 'until'
      ? Math.max(0, Number(entry.endAge) || startAge)
      : payout.age;
  let endMonth =
    entry.endMode === 'until'
      ? clampMonth(entry.endMonth)
      : clampMonth(payout.month);
  if (ageMonthIndex(endAge, endMonth) < ageMonthIndex(startAge, startMonth)) {
    endAge = startAge;
    endMonth = startMonth;
  }
  return { startAge, startMonth, endAge, endMonth };
}

/**
 * シミュレーション上の全退職一時金イベント（会社・iDeCo・DC・DB）を列挙する。
 */
export function collectAllRetirementLumpEvents(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  savingsState?: SavingsState;
  referenceDate: Date;
}): RetirementLumpEvent[] {
  const events: RetirementLumpEvent[] = [];

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;

    for (const entry of input.incomeByMember[member.id] ?? []) {
      for (const allowance of retirementAllowancesForEntry(entry)) {
        const revenueMan = Math.max(0, Number(allowance.amountMan) || 0);
        if (revenueMan <= 0) continue;
        const enrollmentYears = resolveRetirementEnrollmentYears(allowance);
        const calendarYear = calendarYearFromAgeMonth(
          member,
          input.referenceDate,
          allowance.receiveAge,
          allowance.receiveMonth,
        );
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
        events.push({
          memberId: member.id,
          calendarYear,
          kind: 'company',
          revenueMan,
          enrollmentYears,
          periodStartAge,
          periodStartMonth,
          periodEndAge,
          periodEndMonth,
        });
      }
    }

    if (!input.savingsState) continue;
    const entries = getMemberSavingsEntries(input.savingsState, member.id);
    for (const entry of entries) {
      if (!isPensionStylePayoutCategory(entry.category)) continue;
      if (resolveSavingsWithdrawalMode(entry.withdrawalMode) !== 'once') continue;
      const payout = resolveIdecoPayoutStart(entry, member, {
        age: entry.withdrawalStartAge ?? resolveMemberAge(member),
        month: entry.withdrawalStartMonth ?? 1,
      });
      const enrollmentYears = calcPensionRetirementDeductionEnrollmentYears(
        entry,
        member,
        payout,
      );
      const period = contributionPeriodForSavingsEntry(entry, member, payout);
      const calendarYear = calendarYearFromAgeMonth(
        member,
        input.referenceDate,
        payout.age,
        payout.month,
      );
      const kind: RetirementLumpKind =
        entry.category === 'ideco'
          ? 'ideco'
          : entry.category === 'dc'
            ? 'dc'
            : 'db';
      const revenueMan =
        entry.category === 'db'
          ? Math.max(0, Number(entry.withdrawalMan) || 0)
          : Math.max(0, Number(entry.balanceMan) || 0);
      // 残高0でもイベントとして残すと税が歪むので、DB以外は後段の実額集計に任せる
      // ここでは期間・年の履歴用に、受取設定があるものだけ登録（金額は実年集計で上書き）
      events.push({
        memberId: member.id,
        calendarYear,
        kind,
        revenueMan: Math.max(revenueMan, 0.01),
        enrollmentYears,
        periodStartAge: period.startAge,
        periodStartMonth: period.startMonth,
        periodEndAge: period.endAge,
        periodEndMonth: period.endMonth,
      });
    }
  }

  return events;
}

/**
 * 当該年の一時金入力に、別年の先行一時金との重複調整後控除額を付与する。
 */
export function attachOverlapAdjustedDeduction(
  memberId: string,
  calendarYear: number,
  lump: IdecoLumpSumTaxInput,
  allEvents: RetirementLumpEvent[],
): IdecoLumpSumTaxInput {
  if (!lump.kind) {
    // 同年合算（会社＋DC）は重複調整対象外（合算計算済み）
    return lump;
  }

  const current: RetirementLumpEvent = {
    memberId,
    calendarYear,
    kind: lump.kind,
    revenueMan: lump.revenueMan,
    enrollmentYears: lump.enrollmentYears,
    periodStartAge: lump.periodStartAge ?? 0,
    periodStartMonth: lump.periodStartMonth ?? 1,
    periodEndAge: lump.periodEndAge ?? lump.periodStartAge ?? 0,
    periodEndMonth: lump.periodEndMonth ?? 12,
  };

  // 同年同区分の構成イベントがあれば、重複は各期間の和集合で測る
  const sameYearComponents = allEvents.filter(
    (e) =>
      e.memberId === memberId &&
      e.calendarYear === calendarYear &&
      e.kind === lump.kind,
  );
  const currentPeriods =
    sameYearComponents.length > 0
      ? sameYearComponents.map(eventToPeriod)
      : undefined;

  const adjusted = calcRetirementDeductionYenAfterOverlap({
    current,
    priors: allEvents,
    currentPeriods,
  });

  if (adjusted.overlapYears <= 0) {
    return lump;
  }

  return {
    ...lump,
    deductionYenOverride: adjusted.deductionYen,
    overlapYears: adjusted.overlapYears,
  };
}

/** 表示用ラベル（後受け側の控除調整に効くルール） */
export function retirementDeductionOverlapRuleLabel(
  priorKind: RetirementLumpKind,
  currentKind: RetirementLumpKind,
): string | null {
  if (isDcStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return '10年ルール（DC/iDeCo先→DB・退職金後）';
  }
  if (isCompanyStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return '19年ルール（DB・退職金先→DC/iDeCo後）';
  }
  if (isCompanyStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return '5年ルール（DB・退職金どうし）';
  }
  if (isDcStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return '19年ルール（DC/iDeCoどうし）';
  }
  return null;
}

/** 図解ギャップ用の短いルール名 */
export function shortRetirementDeductionRuleName(
  priorKind: RetirementLumpKind,
  currentKind: RetirementLumpKind,
): string | null {
  if (isDcStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return '10年ルール';
  }
  if (isCompanyStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return '19年ルール';
  }
  if (isCompanyStyleKind(priorKind) && isCompanyStyleKind(currentKind)) {
    return '5年ルール';
  }
  if (isDcStyleKind(priorKind) && isDcStyleKind(currentKind)) {
    return '19年ルール';
  }
  return null;
}

export interface PensionOnceTaxOverlapPreview {
  breakdown: RetirementIncomeTaxBreakdown;
  /** 重複調整前の控除額（円） */
  fullDeductionYen: number;
  overlapYears: number;
  ruleLabel: string | null;
  /** 収入タブの会社退職金などにより控除が減ったか */
  adjusted: boolean;
  payoutCalendarYear: number;
}

/**
 * 貯蓄画面の税プレビュー用。
 * 会社退職金・DB・他口座の一時金との10年／19年ルールを反映する
 *（後受けがDC/iDeCoなら19年、DB・退職金なら10年。DCどうしも19年）。
 */
export function previewPensionOnceTaxWithOverlap(input: {
  entry: SavingsEntry;
  member: FamilyMember;
  incomeEntries: IncomeEntry[];
  memberEntries: SavingsEntry[];
  referenceDate: Date;
  revenueMan: number;
  payoutStart: { age: number; month: number };
}): PensionOnceTaxOverlapPreview | null {
  if (!isPensionStylePayoutCategory(input.entry.category)) return null;
  if (input.revenueMan <= 0) return null;

  const kind: RetirementLumpKind =
    input.entry.category === 'ideco'
      ? 'ideco'
      : input.entry.category === 'dc'
        ? 'dc'
        : 'db';

  const enrollmentYears = calcPensionRetirementDeductionEnrollmentYears(
    input.entry,
    input.member,
    input.payoutStart,
  );
  const period = contributionPeriodForSavingsEntry(
    input.entry,
    input.member,
    input.payoutStart,
  );
  const payoutCalendarYear = calendarYearFromAgeMonth(
    input.member,
    input.referenceDate,
    input.payoutStart.age,
    input.payoutStart.month,
  );

  const current: RetirementLumpEvent = {
    memberId: input.member.id,
    calendarYear: payoutCalendarYear,
    kind,
    revenueMan: input.revenueMan,
    enrollmentYears,
    periodStartAge: period.startAge,
    periodStartMonth: period.startMonth,
    periodEndAge: period.endAge,
    periodEndMonth: period.endMonth,
  };

  const savingsState: SavingsState = {
    byMember: { [input.member.id]: input.memberEntries },
  };
  const incomeByMember: IncomeByMember = {
    [input.member.id]: input.incomeEntries,
  };
  const allEvents = collectAllRetirementLumpEvents({
    familyMembers: [input.member],
    incomeByMember,
    savingsState,
    referenceDate: input.referenceDate,
  });

  // 先行イベントのうち、実際に調整に効いたものを特定（表示用）
  let ruleLabel: string | null = null;
  let bestOverlapMonths = 0;
  for (const prior of allEvents) {
    if (!isApplicablePrior(prior, current)) continue;
    const months = calcEnrollmentOverlapMonths(
      eventToPeriod(current),
      eventToPeriod(prior),
    );
    if (months > bestOverlapMonths) {
      bestOverlapMonths = months;
      ruleLabel = retirementDeductionOverlapRuleLabel(prior.kind, current.kind);
    }
  }

  const adjusted = calcRetirementDeductionYenAfterOverlap({
    current,
    priors: allEvents,
  });
  const fullDeductionYen = adjusted.fullDeductionYen;
  const breakdown = calcRetirementIncomeTaxBreakdown(
    input.revenueMan * 10_000,
    enrollmentYears,
    adjusted.overlapYears > 0
      ? { deductionYenOverride: adjusted.deductionYen }
      : undefined,
  );

  return {
    breakdown,
    fullDeductionYen,
    overlapYears: adjusted.overlapYears,
    ruleLabel,
    adjusted: adjusted.overlapYears > 0,
    payoutCalendarYear,
  };
}

