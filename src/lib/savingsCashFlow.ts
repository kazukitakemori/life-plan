import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import {
  clampDcContributionPeriod,
  isDcCategory,
  resolveDcContributionAmountsAtAgeMonth,
} from './dcContribution';
import {
  applyDcBalanceTransferToIdeco,
  findIdecoTransferTarget,
  isDcIdecoTransferMonth,
  needsDcIdecoTransferOnEnd,
  resolveDcIdecoTransferAgeMonth,
} from './dcIdecoTransfer';
import {
  applyDbAmountTransferToIdeco,
  isDbIdecoTransferMonth,
  isDbTransferToIdeco,
} from './dbEarlyExit';
import {
  calcBirthYear,
  getMemberAgeMonth,
  isAgeCalendarMonthInRange,
  isSamePeriodAgeMonth,
} from './birthDate';
import { isIdecoCategory } from './idecoContributionLimit';
import { resolveIdecoDcOpeningBalanceMan } from './idecoPastContribution';
import { resolveIdecoPayoutStart } from './idecoPayout';
import {
  buildNisaLifetimeQuota,
  capNisaContributionMan,
  getSavingsOpeningBalanceMan,
  isNisaCategory,
  resolveNisaPrincipalMan,
} from './nisaQuota';
import { getAllSavingsEntries, getMemberSavingsEntries } from './savingsDefaults';
import {
  isEmployerFundedSavingsContribution,
  isInvestSavingsCategory,
  isTaxableSavingsCategory,
  resolveSavingsContributionMode,
  resolveSavingsWithdrawalMode,
  supportsSavingsWithdrawal,
} from './savingsLabels';
import {
  applyTaxableWithdrawal,
  resolveTaxablePrincipalMan,
  TAXABLE_CAPITAL_GAINS_TAX_RATE,
} from './taxableCapitalGains';
import {
  calcTimeDepositMaturityProceeds,
  getTimeDepositDepositMan,
  getTimeDepositMaturity,
  isTimeDepositCategory,
  resolveTimeDepositTermYears,
} from './timeDeposit';
import {
  resolveWithdrawalYears,
  withdrawalEndFromYears,
} from './savingsWithdrawalPeriod';
import type { FamilyMember } from '../types/family';
import type {
  SavingsCategory,
  SavingsEntry,
  SavingsState,
} from '../types/savings';
import type { InvestBreakdown, SavingsBreakdown } from '../types/cashFlow';
import {
  createEmptyInvestBreakdown,
  createEmptySavingsBreakdown,
  sumInvestBreakdown,
} from '../types/cashFlow';

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function resolveContributionEnd(
  entry: SavingsEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (isDcCategory(entry.category)) {
    const clamped = clampDcContributionPeriod(entry, member);
    return { endAge: clamped.endAge, endMonth: clamped.endMonth };
  }
  if (entry.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

function resolveWithdrawalEnd(
  entry: SavingsEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  if (mode === 'drawdown') {
    const startAge = entry.withdrawalStartAge ?? entry.startAge;
    const startMonth = entry.withdrawalStartMonth ?? 1;
    // iDeCo / 企業型DC / DB 受給完了年齢指定は保存済み終了年月を優先
    if (
      (entry.category === 'ideco' ||
        entry.category === 'dc' ||
        entry.category === 'db') &&
      entry.idecoAnnuityPeriodMode === 'until_age' &&
      entry.withdrawalEndMode === 'until' &&
      entry.withdrawalEndAge != null
    ) {
      return {
        endAge: entry.withdrawalEndAge,
        endMonth: entry.withdrawalEndMonth ?? 12,
      };
    }
    const end = withdrawalEndFromYears(
      startAge,
      startMonth,
      resolveWithdrawalYears(entry, member),
    );
    return { endAge: end.age, endMonth: end.month };
  }
  if (entry.withdrawalEndMode === 'lifetime' || entry.withdrawalEndMode == null) {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return {
    endAge: entry.withdrawalEndAge ?? member.expectedLifespan,
    endMonth: entry.withdrawalEndMonth ?? 12,
  };
}

/** 当該暦月に計上する取崩しリクエスト額（万円）。NISA・特定口座・iDeCo・企業型DC・DB。 */
export function calcSavingsWithdrawalManForMonth(
  entry: SavingsEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
  memberEntries: SavingsEntry[] = [entry],
): number {
  if (!supportsSavingsWithdrawal(entry.category)) return 0;
  // 企業型DC→iDeCo移管あり（60歳前終了時のみ）: 受取は iDeCo 側のみ
  if (
    entry.category === 'dc' &&
    entry.transferBalanceToIdecoOnEnd &&
    needsDcIdecoTransferOnEnd(entry)
  ) {
    return 0;
  }
  // DB→iDeCo移換: 受取は iDeCo 側のみ
  if (entry.category === 'db' && isDbTransferToIdeco(entry, member)) {
    return 0;
  }
  const mode = resolveSavingsWithdrawalMode(entry.withdrawalMode);
  if (mode === 'none') return 0;

  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  // iDeCo / 企業型DC 一括: 残高見込みを正とする
  if (
    (entry.category === 'ideco' || entry.category === 'dc') &&
    mode === 'once'
  ) {
    const start = resolveIdecoPayoutStart(entry, member, {
      age: entry.withdrawalStartAge ?? resolveMemberAge(member),
      month: entry.withdrawalStartMonth ?? 1,
    });
    if (ageMonth.age !== start.age || ageMonth.month !== start.month) {
      return 0;
    }
    return resolveIdecoOncePayoutMan(
      entry,
      member,
      memberEntries,
      referenceDate,
    );
  }

  // DB 一括: ユーザー入力の見込み額
  if (entry.category === 'db' && mode === 'once') {
    const start = resolveIdecoPayoutStart(entry, member, {
      age: entry.withdrawalStartAge ?? resolveMemberAge(member),
      month: entry.withdrawalStartMonth ?? 1,
    });
    if (ageMonth.age !== start.age || ageMonth.month !== start.month) {
      return 0;
    }
    return Math.max(0, Number(entry.withdrawalMan) || 0);
  }

  const amount = Math.max(0, Number(entry.withdrawalMan) || 0);
  if (amount <= 0) return 0;

  const startAge = entry.withdrawalStartAge ?? entry.startAge;
  const startMonth = entry.withdrawalStartMonth ?? 1;

  // 一括: 指定年齢・月に一度だけ
  if (mode === 'once') {
    const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
    return isSamePeriodAgeMonth(
      ageMonth.age,
      ageMonth.month,
      startAge,
      startMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
      ? amount
      : 0;
  }

  // drawdown（および legacy monthly）: 期間内の毎月
  const end = resolveWithdrawalEnd(entry, member);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      startAge,
      startMonth,
      end.endAge,
      end.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return 0;
  }

  if (mode === 'drawdown') {
    return amount;
  }

  // legacy annual: 取崩期間内の開始月に毎年計上
  if (calendarMonth === startMonth) {
    return amount;
  }
  return 0;
}

function savingsBreakdownKey(
  category: SavingsCategory,
): keyof SavingsBreakdown | null {
  if (category === 'deposit') return 'deposit';
  if (category === 'time_deposit') return 'timeDeposit';
  if (category === 'savings_other') return 'savingsOther';
  return null;
}

function investBreakdownKey(
  category: SavingsCategory,
): keyof InvestBreakdown | null {
  if (category === 'nisa_tsumitate') return 'nisaTsumitate';
  if (category === 'nisa_growth') return 'nisaGrowth';
  if (category === 'taxable') return 'taxable';
  if (category === 'ideco') return 'ideco';
  if (category === 'dc') return 'dc';
  if (category === 'db') return 'db';
  if (category === 'invest_other') return 'investOther';
  return null;
}

/** 当該暦月に計上する積立額（万円） */
export function calcSavingsContributionManForMonth(
  entry: SavingsEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  // 貯蓄（普通・定期・その他）は積立設定の対象外。残現金の振分のみ。
  if (!isInvestSavingsCategory(entry.category)) {
    return 0;
  }

  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  const end = resolveContributionEnd(entry, member);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      entry.startAge,
      entry.startMonth,
      end.endAge,
      end.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return 0;
  }

  if (isDcCategory(entry.category)) {
    const amounts = resolveDcContributionAmountsAtAgeMonth(
      entry,
      ageMonth.age,
      ageMonth.month,
      member,
      birthYear,
    );
    return amounts.employerMan + amounts.employeeMan;
  }

  const mode = resolveSavingsContributionMode(entry.contributionMode);
  if (mode === 'none') return 0;
  const amount = Math.max(0, Number(entry.contributionMan) || 0);
  if (amount <= 0) return 0;

  if (mode === 'monthly') {
    return amount;
  }

  // 年額: 積立期間内の最初の月（開始月）に一括計上
  if (calendarMonth === entry.startMonth) {
    return amount;
  }
  return 0;
}

/** 企業型DCの加入者掛金（選択型）のみ・当該暦月（万円）。期間外は 0 */
export function calcDcEmployeeContributionManForMonthInPeriod(
  entry: SavingsEntry,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (!isDcCategory(entry.category)) return 0;
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  return resolveDcContributionAmountsAtAgeMonth(
    entry,
    ageMonth.age,
    ageMonth.month,
    member,
    calcBirthYear(member.age, member.birthMonth, referenceDate),
  ).employeeMan;
}

export interface SavingsYearProjectionInput {
  savingsState: SavingsState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  /** 口座残高（entryId → 万円）。呼び出し側で年をまたいで保持する */
  accountBalances: Record<string, number>;
  /**
   * 運用・定期預金の簿価（entryId → 万円）。
   * NISA 生涯枠消化と定期の元本保持に使う。initialize 時は元本で初期化する。
   */
  investPrincipalByEntry: Record<string, number>;
  /** 口座に振り分けなかった現金（万円） */
  residualCash: number;
  /** その年の年間収支（万円）。運用積立控除前の余剰。積立の原資として残現金に加算 */
  annualBalance: number;
  /** 初回呼び出し時 true。現在残高で口座を初期化する */
  initialize: boolean;
}

export interface SavingsYearProjectionResult {
  accountBalances: Record<string, number>;
  investPrincipalByEntry: Record<string, number>;
  residualCash: number;
  /** その年の積立合計（万円） */
  contributionMan: number;
  /**
   * その年の運用益・利息合計（万円）
   * （未実現。特定口座の売却益税は別途 capitalGainsTaxMan）
   */
  returnMan: number;
  /** その年の取崩し（売却）合計（万円） */
  withdrawalMan: number;
  /** その年の特定口座売却益税合計（万円） */
  capitalGainsTaxMan: number;
  /** 年始の金融資産（万円） */
  openingFinancialAssets: number;
  /** 年末の金融資産（万円） */
  financialAssets: number;
  /**
   * 金融資産の増減（万円）。
   * 投資リターン等を含む全体の増減。
   */
  financialAssetsChange: number;
  /**
   * CF表「貯蓄額」＝貯蓄カテゴリ（普通・定期・その他）の年末残高
   * ＋未振分現金（普通預金扱い）。毎年のストック。
   */
  savingsMan: number;
  /** CF表「貯蓄額」の内訳（年末残高） */
  savingsBreakdown: SavingsBreakdown;
  /**
   * CF表「運用残高」＝運用カテゴリ口座の年末残高合計（ストック）。
   */
  investMan: number;
  /** CF表「運用残高」の内訳（年末残高＋当年フロー） */
  investBreakdown: InvestBreakdown;
  /**
   * CF表・グラフ「運用積立」＝家計負担の運用積立合計（万円）。
   * 企業型DCの事業主掛金など、残現金を減らさない積立は含めない。
   * 定期預金の預入は貯蓄側のため含めない。
   */
  personalInvestContributionMan: number;
}

function findOwnerMember(
  familyMembers: FamilyMember[],
  entryId: string,
  savingsState: SavingsState,
): FamilyMember | undefined {
  for (const [memberId, entries] of Object.entries(savingsState.byMember)) {
    if (entries.some((entry) => entry.id === entryId)) {
      return familyMembers.find((member) => member.id === memberId);
    }
  }
  return undefined;
}

/**
 * Q11 貯蓄・運用の年次投影。
 *
 * - 積立は年間収支からの振分（支出にはしない）ため二重計上しない
 * - 運用口座の利回りは年初残高に対して年1回（複利）
 * - 定期預金は期中元本のみ。満期月に単利利息を一括計上し、利息に 20.315% 課税後を残現金へ
 * - その後に月次で積立→取崩し（特定口座は売却益に 20.315%、NISA は非課税）
 * - 取崩し税引後（NISA は全額）の現金は残現金へ
 * - 積立しなかった年間収支は残現金へ（CF上は普通預金に計上）
 * - CF「貯蓄額」は貯蓄カテゴリ＋残現金の年末残高（ストック）。投資は「運用残高」行へ
 * - CF「運用積立」は家計負担の運用積立のみ（事業主掛金は含めない）
 * - CF「運用残高」内訳は年末残高＋当年積立／当年運用益／当年取崩し／売却益税
 */
export function projectSavingsForYear(
  input: SavingsYearProjectionInput,
): SavingsYearProjectionResult {
  const entries = getAllSavingsEntries(input.savingsState);
  const nextBalances: Record<string, number> = { ...input.accountBalances };
  const nextPrincipals: Record<string, number> = {
    ...input.investPrincipalByEntry,
  };
  let residualCash = input.residualCash;

  if (input.initialize) {
    residualCash = 0;
    const refYear = input.referenceDate.getFullYear();
    const refMonth = input.referenceDate.getMonth() + 1;
    for (const entry of entries) {
      if (isTimeDepositCategory(entry.category)) {
        const member = findOwnerMember(
          input.familyMembers,
          entry.id,
          input.savingsState,
        );
        const depositMan = getTimeDepositDepositMan(entry);
        const maturity = getTimeDepositMaturity(entry);
        const now = member
          ? getMemberAgeMonth(
              member,
              input.referenceDate,
              refYear,
              refMonth,
            )
          : null;
        if (!now || depositMan <= 0) {
          nextBalances[entry.id] = 0;
          nextPrincipals[entry.id] = 0;
          continue;
        }
        const nowIndex = ageMonthIndex(now.age, now.month);
        const startIndex = ageMonthIndex(entry.startAge, entry.startMonth);
        const maturityIndex = ageMonthIndex(maturity.age, maturity.month);
        if (nowIndex >= maturityIndex) {
          // 試算開始時点で既に満期 → 税引後を残現金へ
          const proceeds = calcTimeDepositMaturityProceeds(
            depositMan,
            Math.max(0, Number(entry.expectedReturnRatePct) || 0),
            resolveTimeDepositTermYears(entry),
          );
          residualCash += proceeds.netProceedsMan;
          nextBalances[entry.id] = 0;
          nextPrincipals[entry.id] = 0;
        } else if (nowIndex >= startIndex) {
          nextBalances[entry.id] = depositMan;
          nextPrincipals[entry.id] = depositMan;
        } else {
          nextBalances[entry.id] = 0;
          nextPrincipals[entry.id] = 0;
        }
        continue;
      }

      const opening =
        isDcCategory(entry.category) || isIdecoCategory(entry.category)
          ? (() => {
              const owner = findOwnerMember(
                input.familyMembers,
                entry.id,
                input.savingsState,
              );
              return owner
                ? resolveIdecoDcOpeningBalanceMan(
                    entry,
                    owner,
                    input.referenceDate,
                  )
                : getSavingsOpeningBalanceMan(entry);
            })()
          : getSavingsOpeningBalanceMan(entry);
      nextBalances[entry.id] = opening;
      if (isInvestSavingsCategory(entry.category)) {
        nextPrincipals[entry.id] = isNisaCategory(entry.category)
          ? resolveNisaPrincipalMan(entry)
          : isTaxableSavingsCategory(entry.category)
            ? resolveTaxablePrincipalMan(entry)
            : nextBalances[entry.id];
      } else {
        delete nextPrincipals[entry.id];
      }
    }
  }

  // 削除された口座の残高は残現金へ戻す
  const activeIds = new Set(entries.map((entry) => entry.id));
  for (const [entryId, balance] of Object.entries(nextBalances)) {
    if (!activeIds.has(entryId)) {
      residualCash += balance;
      delete nextBalances[entryId];
      delete nextPrincipals[entryId];
    }
  }

  const sumBalances = () =>
    Object.values(nextBalances).reduce((sum, value) => sum + value, 0);

  const openingFinancialAssets = sumBalances() + residualCash;

  const returnByEntry: Record<string, number> = {};
  let returnMan = 0;
  for (const entry of entries) {
    if (isTimeDepositCategory(entry.category)) {
      // 定期は満期月に一括計上（期中の年次利息なし）
      returnByEntry[entry.id] = 0;
      continue;
    }
    const opening = nextBalances[entry.id] ?? 0;
    const rate = Math.max(0, Number(entry.expectedReturnRatePct) || 0) / 100;
    const earned = opening * rate;
    returnByEntry[entry.id] = earned;
    returnMan += earned;
    nextBalances[entry.id] = opening + earned;
  }

  const annualUsedByMemberCategory: Record<string, number> = {};
  const memberEntriesCache = new Map<string, SavingsEntry[]>();
  for (const [memberId, memberEntries] of Object.entries(
    input.savingsState.byMember,
  )) {
    memberEntriesCache.set(memberId, memberEntries);
  }

  const findMemberId = (entryId: string): string | undefined => {
    for (const [memberId, memberEntries] of Object.entries(
      input.savingsState.byMember,
    )) {
      if (memberEntries.some((entry) => entry.id === entryId)) {
        return memberId;
      }
    }
    return undefined;
  };

  const lifetimeQuotaForMember = (memberId: string) => {
    const memberEntries = memberEntriesCache.get(memberId) ?? [];
    let usedTsumitate = 0;
    let usedGrowth = 0;
    for (const entry of memberEntries) {
      if (!isNisaCategory(entry.category)) continue;
      const principal = nextPrincipals[entry.id] ?? 0;
      if (entry.category === 'nisa_tsumitate') usedTsumitate += principal;
      else usedGrowth += principal;
    }
    return buildNisaLifetimeQuota(usedTsumitate, usedGrowth);
  };

  const contributionByEntry: Record<string, number> = {};
  /** 家計負担分の積立（entryId → 万円） */
  const personalContributionByEntry: Record<string, number> = {};
  const withdrawalByEntry: Record<string, number> = {};
  const capitalGainsTaxByEntry: Record<string, number> = {};
  let contributionMan = 0;
  /** 世帯の残現金から差し引く積立（iDeCo 等）。企業型DCの事業主掛金は含めない */
  let personalContributionMan = 0;
  /** 家計負担の運用積立のみ（定期預金の預入は含めない） */
  let personalInvestContributionMan = 0;
  let withdrawalMan = 0;
  let capitalGainsTaxMan = 0;
  for (let month = input.monthStart; month <= input.monthEnd; month += 1) {
    for (const entry of entries) {
      const member = findOwnerMember(
        input.familyMembers,
        entry.id,
        input.savingsState,
      );
      if (!member) continue;

      const requested = calcSavingsContributionManForMonth(
        entry,
        member,
        input.referenceDate,
        input.calendarYear,
        month,
      );
      if (requested > 0) {
        let applied = requested;
        if (isNisaCategory(entry.category)) {
          const memberId = findMemberId(entry.id);
          if (!memberId) continue;
          const annualKey = `${memberId}:${entry.category}`;
          const annualUsed = annualUsedByMemberCategory[annualKey] ?? 0;
          applied = capNisaContributionMan({
            category: entry.category,
            requestedMan: requested,
            annualUsedMan: annualUsed,
            lifetimeQuota: lifetimeQuotaForMember(memberId),
          });
          if (applied > 0) {
            annualUsedByMemberCategory[annualKey] = annualUsed + applied;
          }
        }

        if (applied > 0) {
          contributionMan += applied;
          let personalPart = 0;
          if (isDcCategory(entry.category)) {
            personalPart = calcDcEmployeeContributionManForMonthInPeriod(
              entry,
              member,
              input.referenceDate,
              input.calendarYear,
              month,
            );
          } else if (!isEmployerFundedSavingsContribution(entry.category)) {
            personalPart = applied;
          }
          personalContributionMan += personalPart;
          personalInvestContributionMan += personalPart;
          contributionByEntry[entry.id] =
            (contributionByEntry[entry.id] ?? 0) + applied;
          if (personalPart > 0) {
            personalContributionByEntry[entry.id] =
              (personalContributionByEntry[entry.id] ?? 0) + personalPart;
          }
          nextBalances[entry.id] = (nextBalances[entry.id] ?? 0) + applied;
          if (isInvestSavingsCategory(entry.category)) {
            nextPrincipals[entry.id] =
              (nextPrincipals[entry.id] ?? 0) + applied;
          }
        }
      }
    }

    // 企業型DC → iDeCo 残高移管（拠出終了月・積立反映後）
    for (const entry of entries) {
      if (!isDcCategory(entry.category) || !entry.transferBalanceToIdecoOnEnd) {
        continue;
      }
      const member = findOwnerMember(
        input.familyMembers,
        entry.id,
        input.savingsState,
      );
      if (!member) continue;
      if (
        !isDcIdecoTransferMonth(
          entry,
          member,
          input.referenceDate,
          input.calendarYear,
          month,
        )
      ) {
        continue;
      }
      const memberId = findMemberId(entry.id);
      if (!memberId) continue;
      const memberEntries = memberEntriesCache.get(memberId) ?? [];
      const ideco = findIdecoTransferTarget(memberEntries, entry.id);
      if (!ideco) continue;
      const transferred = applyDcBalanceTransferToIdeco({
        dcEntry: entry,
        idecoEntry: ideco,
        balances: nextBalances,
        principals: nextPrincipals,
      });
      Object.assign(nextBalances, transferred.balances);
      Object.assign(nextPrincipals, transferred.principals);
    }

    // DB → iDeCo 移換（加入終了月・脱退一時金相当額）
    for (const entry of entries) {
      if (entry.category !== 'db') continue;
      const member = findOwnerMember(
        input.familyMembers,
        entry.id,
        input.savingsState,
      );
      if (!member) continue;
      if (
        !isDbIdecoTransferMonth(
          entry,
          member,
          input.referenceDate,
          input.calendarYear,
          month,
        )
      ) {
        continue;
      }
      const memberId = findMemberId(entry.id);
      if (!memberId) continue;
      const memberEntries = memberEntriesCache.get(memberId) ?? [];
      const ideco = findIdecoTransferTarget(memberEntries, entry.id);
      if (!ideco) continue;
      const transferred = applyDbAmountTransferToIdeco({
        dbEntry: entry,
        idecoEntry: ideco,
        balances: nextBalances,
        principals: nextPrincipals,
      });
      Object.assign(nextBalances, transferred.balances);
      Object.assign(nextPrincipals, transferred.principals);
    }

    // 定期預金: 預入開始月に元本を置き、満期月に単利利息＋課税後を残現金へ
    for (const entry of entries) {
      if (!isTimeDepositCategory(entry.category)) continue;
      const member = findOwnerMember(
        input.familyMembers,
        entry.id,
        input.savingsState,
      );
      if (!member) continue;
      const ageMonth = getMemberAgeMonth(
        member,
        input.referenceDate,
        input.calendarYear,
        month,
      );
      if (!ageMonth) continue;

      const depositMan = getTimeDepositDepositMan(entry);
      if (
        ageMonth.age === entry.startAge &&
        ageMonth.month === entry.startMonth &&
        depositMan > 0 &&
        (nextBalances[entry.id] ?? 0) <= 0
      ) {
        nextBalances[entry.id] = depositMan;
        nextPrincipals[entry.id] = depositMan;
        contributionMan += depositMan;
        personalContributionMan += depositMan;
        contributionByEntry[entry.id] =
          (contributionByEntry[entry.id] ?? 0) + depositMan;
      }

      const maturity = getTimeDepositMaturity(entry);
      if (
        ageMonth.age === maturity.age &&
        ageMonth.month === maturity.month
      ) {
        const principal =
          nextPrincipals[entry.id] ?? nextBalances[entry.id] ?? 0;
        if (principal > 0) {
          const proceeds = calcTimeDepositMaturityProceeds(
            principal,
            Math.max(0, Number(entry.expectedReturnRatePct) || 0),
            resolveTimeDepositTermYears(entry),
          );
          returnByEntry[entry.id] =
            (returnByEntry[entry.id] ?? 0) + proceeds.interestMan;
          returnMan += proceeds.interestMan;
          capitalGainsTaxMan += proceeds.taxMan;
          residualCash += proceeds.netProceedsMan;
          nextBalances[entry.id] = 0;
          nextPrincipals[entry.id] = 0;
        }
      }
    }

    // 積立後に取崩し（特定口座は売却益税、NISA は非課税で簿価のみ減額）
    for (const entry of entries) {
      if (!supportsSavingsWithdrawal(entry.category)) continue;
      const member = findOwnerMember(
        input.familyMembers,
        entry.id,
        input.savingsState,
      );
      if (!member) continue;

      const memberId =
        Object.entries(input.savingsState.byMember).find(([, list]) =>
          list.some((e) => e.id === entry.id),
        )?.[0] ?? null;
      const memberEntries = memberId
        ? getMemberSavingsEntries(input.savingsState, memberId)
        : [entry];
      const requestedWithdrawal = calcSavingsWithdrawalManForMonth(
        entry,
        member,
        input.referenceDate,
        input.calendarYear,
        month,
        memberEntries,
      );
      if (requestedWithdrawal <= 0) continue;

      // DB（確定給付）: 残高運用ではなく見込み給付を残現金へ直接計上
      if (entry.category === 'db') {
        withdrawalMan += requestedWithdrawal;
        withdrawalByEntry[entry.id] =
          (withdrawalByEntry[entry.id] ?? 0) + requestedWithdrawal;
        residualCash += requestedWithdrawal;
        continue;
      }

      const taxRate = isTaxableSavingsCategory(entry.category)
        ? TAXABLE_CAPITAL_GAINS_TAX_RATE
        : 0;
      const result = applyTaxableWithdrawal(
        nextBalances[entry.id] ?? 0,
        nextPrincipals[entry.id] ?? 0,
        requestedWithdrawal,
        taxRate,
      );
      if (result.withdrawnMan <= 0) continue;

      nextBalances[entry.id] = result.nextBalanceMan;
      nextPrincipals[entry.id] = result.nextPrincipalMan;
      withdrawalMan += result.withdrawnMan;
      capitalGainsTaxMan += result.taxMan;
      withdrawalByEntry[entry.id] =
        (withdrawalByEntry[entry.id] ?? 0) + result.withdrawnMan;
      capitalGainsTaxByEntry[entry.id] =
        (capitalGainsTaxByEntry[entry.id] ?? 0) + result.taxMan;
      // 特定口座は税引後、NISA は全額を残現金へ
      residualCash += result.withdrawnMan - result.taxMan;
    }
  }

  // 年間収支から差し引くのは自己資金の積立のみ（企業型DCの事業主掛金は残現金を減らさない）
  residualCash += input.annualBalance - personalContributionMan;

  const financialAssets = sumBalances() + residualCash;
  const financialAssetsChange = financialAssets - openingFinancialAssets;

  // 貯蓄額・運用残高は年末残高。運用内訳に当年フローも載せる
  const savingsBreakdown = createEmptySavingsBreakdown();
  const investBreakdown = createEmptyInvestBreakdown();
  for (const entry of entries) {
    const savingsKey = savingsBreakdownKey(entry.category);
    if (savingsKey) {
      savingsBreakdown[savingsKey] += nextBalances[entry.id] ?? 0;
      continue;
    }
    const investKey = investBreakdownKey(entry.category);
    if (investKey) {
      investBreakdown[investKey].balance += nextBalances[entry.id] ?? 0;
      investBreakdown[investKey].contribution +=
        contributionByEntry[entry.id] ?? 0;
      investBreakdown[investKey].personalContribution +=
        personalContributionByEntry[entry.id] ?? 0;
      investBreakdown[investKey].annualReturn += returnByEntry[entry.id] ?? 0;
      investBreakdown[investKey].withdrawal +=
        withdrawalByEntry[entry.id] ?? 0;
      investBreakdown[investKey].capitalGainsTax +=
        capitalGainsTaxByEntry[entry.id] ?? 0;
    }
  }
  savingsBreakdown.deposit += residualCash;

  const savingsMan =
    savingsBreakdown.deposit +
    savingsBreakdown.timeDeposit +
    savingsBreakdown.savingsOther;
  const investMan = sumInvestBreakdown(investBreakdown);

  return {
    accountBalances: nextBalances,
    investPrincipalByEntry: nextPrincipals,
    residualCash,
    contributionMan,
    returnMan,
    withdrawalMan,
    capitalGainsTaxMan,
    openingFinancialAssets,
    financialAssets,
    financialAssetsChange,
    savingsMan,
    savingsBreakdown,
    investMan,
    investBreakdown,
    personalInvestContributionMan,
  };
}

/**
 * 指定年齢・月時点の見込み残高（万円）。
 * CF 投影と同じく年初に利回り→月次積立。一括取崩しの初期額に使う。
 * iDeCo は同一メンバーの企業型DC→移管も反映する。
 */
export function estimateInvestBalanceManAt(input: {
  entry: SavingsEntry;
  member: FamilyMember;
  memberEntries: SavingsEntry[];
  referenceDate: Date;
  targetAge: number;
  targetMonth: number;
}): number {
  const {
    entry,
    member,
    memberEntries,
    referenceDate,
    targetAge,
    targetMonth,
  } = input;
  const targetIndex = ageMonthIndex(targetAge, targetMonth);
  const startYear = referenceDate.getFullYear();
  const startMonth = referenceDate.getMonth() + 1;
  const startAgeMonth = getMemberAgeMonth(
    member,
    referenceDate,
    startYear,
    startMonth,
  );
  const openingFor = (e: SavingsEntry) =>
    isDcCategory(e.category) || isIdecoCategory(e.category)
      ? resolveIdecoDcOpeningBalanceMan(e, member, referenceDate)
      : getSavingsOpeningBalanceMan(e);

  if (!startAgeMonth) {
    return openingFor(entry);
  }
  if (targetIndex < ageMonthIndex(startAgeMonth.age, startAgeMonth.month)) {
    return openingFor(entry);
  }

  let balance = openingFor(entry);
  let principal = isNisaCategory(entry.category)
    ? resolveNisaPrincipalMan(entry)
    : isTaxableSavingsCategory(entry.category)
      ? resolveTaxablePrincipalMan(entry)
      : balance;
  const rate = Math.max(0, Number(entry.expectedReturnRatePct) || 0) / 100;

  const outgoingTransfer = resolveDcIdecoTransferAgeMonth(entry);
  const outgoingTransferIndex = outgoingTransfer
    ? ageMonthIndex(outgoingTransfer.age, outgoingTransfer.month)
    : null;

  const incomingDcEntries = isIdecoCategory(entry.category)
    ? memberEntries.filter(
        (other) =>
          other.id !== entry.id &&
          isDcCategory(other.category) &&
          other.transferBalanceToIdecoOnEnd &&
          needsDcIdecoTransferOnEnd(other) &&
          findIdecoTransferTarget(memberEntries, other.id)?.id === entry.id,
      )
    : [];
  const incomingDbEntries = isIdecoCategory(entry.category)
    ? memberEntries.filter(
        (other) =>
          other.id !== entry.id &&
          other.category === 'db' &&
          isDbTransferToIdeco(other, member) &&
          findIdecoTransferTarget(memberEntries, other.id)?.id === entry.id,
      )
    : [];
  const dcBalances = new Map<string, number>();
  const dcRates = new Map<string, number>();
  const dcTransferred = new Set<string>();
  const dbTransferred = new Set<string>();
  for (const dc of incomingDcEntries) {
    dcBalances.set(dc.id, openingFor(dc));
    dcRates.set(
      dc.id,
      Math.max(0, Number(dc.expectedReturnRatePct) || 0) / 100,
    );
  }

  const otherPrincipalById: Record<string, number> = {};
  for (const other of memberEntries) {
    if (other.id === entry.id || !isNisaCategory(other.category)) continue;
    otherPrincipalById[other.id] = resolveNisaPrincipalMan(other);
  }

  const lifetimeQuota = () => {
    let usedTsumitate = 0;
    let usedGrowth = 0;
    for (const other of memberEntries) {
      if (!isNisaCategory(other.category)) continue;
      const p =
        other.id === entry.id
          ? principal
          : (otherPrincipalById[other.id] ?? 0);
      if (other.category === 'nisa_tsumitate') usedTsumitate += p;
      else usedGrowth += p;
    }
    return buildNisaLifetimeQuota(usedTsumitate, usedGrowth);
  };

  let annualUsed = 0;
  let prevYear = startYear - 1;

  for (let year = startYear; year <= startYear + 120; year += 1) {
    const monthStart = year === startYear ? startMonth : 1;
    const probe = getMemberAgeMonth(
      member,
      referenceDate,
      year,
      monthStart,
    );
    if (!probe) break;
    if (ageMonthIndex(probe.age, probe.month) > targetIndex) {
      return balance;
    }

    if (year !== prevYear) {
      annualUsed = 0;
      prevYear = year;
    }

    balance += balance * rate;
    for (const [dcId, dcBalance] of dcBalances) {
      const dcRate = dcRates.get(dcId) ?? 0;
      dcBalances.set(dcId, dcBalance + dcBalance * dcRate);
    }

    for (let month = monthStart; month <= 12; month += 1) {
      const ageMonth = getMemberAgeMonth(
        member,
        referenceDate,
        year,
        month,
      );
      if (!ageMonth) continue;
      const idx = ageMonthIndex(ageMonth.age, ageMonth.month);
      if (idx > targetIndex) return balance;

      // 移管元 DC: 拠出終了月に残高を移したあとは 0
      if (
        outgoingTransferIndex != null &&
        idx === outgoingTransferIndex
      ) {
        balance = 0;
        principal = 0;
        if (idx === targetIndex) return 0;
        continue;
      }
      if (
        outgoingTransferIndex != null &&
        idx > outgoingTransferIndex
      ) {
        balance = 0;
        if (idx === targetIndex) return 0;
        continue;
      }

      let requested = calcSavingsContributionManForMonth(
        entry,
        member,
        referenceDate,
        year,
        month,
      );
      if (requested > 0 && isNisaCategory(entry.category)) {
        requested = capNisaContributionMan({
          category: entry.category,
          requestedMan: requested,
          annualUsedMan: annualUsed,
          lifetimeQuota: lifetimeQuota(),
        });
        if (requested > 0) {
          annualUsed += requested;
        }
      }

      if (requested > 0) {
        balance += requested;
        if (
          isInvestSavingsCategory(entry.category) ||
          entry.category === 'time_deposit'
        ) {
          principal += requested;
        }
      }

      // 移管先 iDeCo: 同一メンバー DC からの残高受入
      for (const dc of incomingDcEntries) {
        if (dcTransferred.has(dc.id)) continue;
        const dcContrib = calcSavingsContributionManForMonth(
          dc,
          member,
          referenceDate,
          year,
          month,
        );
        if (dcContrib > 0) {
          dcBalances.set(dc.id, (dcBalances.get(dc.id) ?? 0) + dcContrib);
        }
        if (
          !isDcIdecoTransferMonth(
            dc,
            member,
            referenceDate,
            year,
            month,
          )
        ) {
          continue;
        }
        const amount = Math.max(0, dcBalances.get(dc.id) ?? 0);
        balance += amount;
        principal += amount;
        dcBalances.set(dc.id, 0);
        dcTransferred.add(dc.id);
      }

      for (const db of incomingDbEntries) {
        if (dbTransferred.has(db.id)) continue;
        if (
          !isDbIdecoTransferMonth(
            db,
            member,
            referenceDate,
            year,
            month,
          )
        ) {
          continue;
        }
        const amount = Math.max(0, Number(db.withdrawalMan) || 0);
        balance += amount;
        principal += amount;
        dbTransferred.add(db.id);
      }

      if (idx === targetIndex) return balance;
    }
  }

  return balance;
}

/**
 * iDeCo 一括受取額（万円）。
 * 受給開始時点の残高見込みを正とし、保存済み withdrawalMan が 0／古くても税・CF がずれないようにする。
 */
export function resolveIdecoOncePayoutMan(
  entry: SavingsEntry,
  member: FamilyMember,
  memberEntries: SavingsEntry[],
  referenceDate: Date,
): number {
  const start = resolveIdecoPayoutStart(entry, member, {
    age: entry.withdrawalStartAge ?? resolveMemberAge(member),
    month: entry.withdrawalStartMonth ?? 1,
  });
  return Math.max(
    0,
    Math.round(
      estimateInvestBalanceManAt({
        entry,
        member,
        memberEntries,
        referenceDate,
        targetAge: start.age,
        targetMonth: start.month,
      }),
    ),
  );
}

/** 口座未登録時は従来どおり（年間収支の累積） */
export function hasSavingsEntries(state: SavingsState | undefined): boolean {
  if (!state) return false;
  return getAllSavingsEntries(state).length > 0;
}

export function hasDepositSavingsEntries(
  state: SavingsState | undefined,
): boolean {
  if (!state) return false;
  return getAllSavingsEntries(state).some(
    (entry) => !isInvestSavingsCategory(entry.category),
  );
}
