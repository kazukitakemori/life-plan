import { resolveMemberAge } from './familyDefaults';
import { getMemberAgeMonth } from './birthDate';
import {
  ensureDbEnrollmentFields,
  resolveDbEnrollmentPeriod,
} from './dbEnrollment';
import {
  calcPensionRetirementDeductionEnrollmentYears,
  resolveIdecoAnnuityPeriodMode,
  resolveIdecoPayoutStart,
} from './idecoPayout';
import { resolveIdecoDcContributionJoin } from './idecoPastContribution';
import { resolveIdecoOncePayoutMan } from './savingsCashFlow';
import { getMemberSavingsEntries } from './savingsDefaults';
import {
  isPensionStylePayoutCategory,
  resolveSavingsWithdrawalMode,
} from './savingsLabels';
import {
  calcRetirementIncomeTaxBreakdown,
  type RetirementIncomeTaxBreakdown,
} from './retirementIncomeTax';
import {
  resolveWithdrawalYears,
  withdrawalEndFromYears,
} from './savingsWithdrawalPeriod';
import type { FamilyMember } from '../types/family';
import type { SavingsEntry, SavingsState } from '../types/savings';

const MAN_TO_YEN = 10_000;

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function resolvePensionWithdrawalEnd(
  entry: SavingsEntry,
  member: FamilyMember,
): { age: number; month: number } {
  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  const start = resolveIdecoPayoutStart(entry, member, {
    age: entry.withdrawalStartAge ?? resolveMemberAge(member),
    month: entry.withdrawalStartMonth ?? 1,
  });
  if (mode === 'once') {
    return { age: start.age, month: start.month };
  }
  if (
    resolveIdecoAnnuityPeriodMode(entry.idecoAnnuityPeriodMode) === 'until_age' &&
    entry.withdrawalEndAge != null
  ) {
    return {
      age: entry.withdrawalEndAge,
      month: entry.withdrawalEndMonth ?? 12,
    };
  }
  return withdrawalEndFromYears(
    start.age,
    start.month,
    resolveWithdrawalYears(entry, member),
  );
}

/** iDeCo / 企業型DC: 残高見込み。DB: 入力の一時金見込み。 */
function resolvePensionOncePayoutMan(
  entry: SavingsEntry,
  member: FamilyMember,
  memberEntries: SavingsEntry[],
  referenceDate: Date,
): number {
  if (entry.category === 'db') {
    return Math.max(0, Number(entry.withdrawalMan) || 0);
  }
  if (entry.category === 'ideco' || entry.category === 'dc') {
    return resolveIdecoOncePayoutMan(
      entry,
      member,
      memberEntries,
      referenceDate,
    );
  }
  return 0;
}

export interface IdecoLumpSumTaxInput {
  revenueMan: number;
  enrollmentYears: number;
  /** 単一区分のときのみ。同年合算後は未設定 */
  kind?: 'company' | 'ideco' | 'dc' | 'db';
  periodStartAge?: number;
  periodStartMonth?: number;
  periodEndAge?: number;
  periodEndMonth?: number;
  /** 10年／19年ルールによる重複調整後の控除額（円）。あれば税計算で優先 */
  deductionYenOverride?: number;
  /** 重複調整に使った年数（表示用） */
  overlapYears?: number;
}

export interface IdecoMemberPayoutTax {
  /** その年の年金受取（万円） */
  annuityMan: number;
  /** その年の一時金（万円）。なければ 0 */
  lumpSumMan: number;
  enrollmentYears: number;
  retirement: RetirementIncomeTaxBreakdown | null;
  kind?: IdecoLumpSumTaxInput['kind'];
  periodStartAge?: number;
  periodStartMonth?: number;
  periodEndAge?: number;
  periodEndMonth?: number;
}

export interface IdecoPayoutTaxByMember {
  annuityManByMember: Record<string, number>;
  lumpSumByMember: Record<string, IdecoLumpSumTaxInput>;
  byMember: Record<string, IdecoMemberPayoutTax>;
}

/**
 * メンバーの iDeCo / 企業型DC / DB について、指定暦年の一時金・年金受取を集計する。
 * 一時金は退職所得、年金は公的年金等合算の対象。
 */
export function collectIdecoPayoutForMemberYear(
  member: FamilyMember,
  entries: SavingsEntry[],
  referenceDate: Date,
  calendarYear: number,
  monthStart = 1,
  monthEnd = 12,
): IdecoMemberPayoutTax {
  let annuityMan = 0;
  let lumpSumMan = 0;
  let enrollmentYears = 1;
  let kind: IdecoLumpSumTaxInput['kind'];
  let periodStartAge: number | undefined;
  let periodStartMonth: number | undefined;
  let periodEndAge: number | undefined;
  let periodEndMonth: number | undefined;

  for (const entry of entries) {
    if (!isPensionStylePayoutCategory(entry.category)) continue;
    const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
    if (mode === 'none') continue;

    const start = resolveIdecoPayoutStart(entry, member, {
      age: entry.withdrawalStartAge ?? resolveMemberAge(member),
      month: entry.withdrawalStartMonth ?? 1,
    });
    const startAge = start.age;
    const startMonth = start.month;

    if (mode === 'once') {
      const amountMan = resolvePensionOncePayoutMan(
        entry,
        member,
        entries,
        referenceDate,
      );
      if (amountMan <= 0) continue;
      const ageMonth = getMemberAgeMonth(
        member,
        referenceDate,
        calendarYear,
        startMonth,
      );
      if (
        ageMonth &&
        ageMonth.age === startAge &&
        startMonth >= monthStart &&
        startMonth <= monthEnd
      ) {
        lumpSumMan += amountMan;
        const years = calcPensionRetirementDeductionEnrollmentYears(
          entry,
          member,
          { age: startAge, month: startMonth },
        );
        const entryKind: IdecoLumpSumTaxInput['kind'] =
          entry.category === 'ideco'
            ? 'ideco'
            : entry.category === 'dc'
              ? 'dc'
              : 'db';
        let joinAge: number;
        let joinMonth: number;
        let endAge: number;
        let endMonth: number;
        if (entry.category === 'db') {
          const period = resolveDbEnrollmentPeriod(
            ensureDbEnrollmentFields(entry, member),
            { age: startAge, month: startMonth },
          );
          joinAge = period.startAge;
          joinMonth = period.startMonth;
          endAge = period.endAge;
          endMonth = period.endMonth;
        } else {
          const join = resolveIdecoDcContributionJoin(entry);
          joinAge = join.age;
          joinMonth = join.month;
          endAge = entry.endMode === 'until' ? entry.endAge : startAge;
          endMonth =
            entry.endMode === 'until'
              ? Math.min(12, Math.max(1, Number(entry.endMonth) || 12))
              : startMonth;
          if (
            entry.endMode === 'until' &&
            endAge * 12 + endMonth > startAge * 12 + startMonth
          ) {
            endAge = startAge;
            endMonth = startMonth;
          }
        }

        if (years >= enrollmentYears) {
          enrollmentYears = years;
          periodStartAge = joinAge;
          periodStartMonth = joinMonth;
          periodEndAge = endAge;
          periodEndMonth = endMonth;
        }
        if (kind == null) {
          kind = entryKind;
        } else if (kind !== entryKind) {
          kind = undefined;
        }
      }
      continue;
    }

    // drawdown = 年金
    const amountMan = Math.max(0, Number(entry.withdrawalMan) || 0);
    if (amountMan <= 0) continue;

    const end = resolvePensionWithdrawalEnd(entry, member);
    for (let month = monthStart; month <= monthEnd; month++) {
      const ageMonth = getMemberAgeMonth(
        member,
        referenceDate,
        calendarYear,
        month,
      );
      if (!ageMonth) continue;
      const current = ageMonthIndex(ageMonth.age, ageMonth.month);
      if (
        current >= ageMonthIndex(startAge, startMonth) &&
        current <= ageMonthIndex(end.age, end.month)
      ) {
        annuityMan += amountMan;
      }
    }
  }

  const retirement =
    lumpSumMan > 0
      ? calcRetirementIncomeTaxBreakdown(
          lumpSumMan * MAN_TO_YEN,
          enrollmentYears,
        )
      : null;

  return {
    annuityMan,
    lumpSumMan,
    enrollmentYears,
    retirement,
    kind,
    periodStartAge,
    periodStartMonth,
    periodEndAge,
    periodEndMonth,
  };
}

export function collectIdecoPayoutTaxByMember(input: {
  familyMembers: FamilyMember[];
  savingsState: SavingsState | undefined;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): IdecoPayoutTaxByMember {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const annuityManByMember: Record<string, number> = {};
  const lumpSumByMember: Record<string, IdecoLumpSumTaxInput> = {};
  const byMember: Record<string, IdecoMemberPayoutTax> = {};

  if (!input.savingsState) {
    return { annuityManByMember, lumpSumByMember, byMember };
  }

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const entries = getMemberSavingsEntries(input.savingsState, member.id);
    const detail = collectIdecoPayoutForMemberYear(
      member,
      entries,
      input.referenceDate,
      input.calendarYear,
      monthStart,
      monthEnd,
    );
    byMember[member.id] = detail;
    if (detail.annuityMan > 0) {
      annuityManByMember[member.id] = detail.annuityMan;
    }
    if (detail.lumpSumMan > 0) {
      lumpSumByMember[member.id] = {
        revenueMan: detail.lumpSumMan,
        enrollmentYears: detail.enrollmentYears,
        kind: detail.kind,
        periodStartAge: detail.periodStartAge,
        periodStartMonth: detail.periodStartMonth,
        periodEndAge: detail.periodEndAge,
        periodEndMonth: detail.periodEndMonth,
      };
    }
  }

  return { annuityManByMember, lumpSumByMember, byMember };
}

/** 公的年金マップに iDeCo / DC / DB 年金を加算したコピーを返す */
export function mergeIdecoAnnuityIntoPensionManByMember(
  pensionManByMember: Record<string, number>,
  annuityManByMember: Record<string, number>,
): Record<string, number> {
  const next = { ...pensionManByMember };
  for (const [memberId, annuityMan] of Object.entries(annuityManByMember)) {
    if (annuityMan <= 0) continue;
    next[memberId] = (next[memberId] ?? 0) + annuityMan;
  }
  return next;
}
