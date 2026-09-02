import {
  CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN,
  ensureIdecoFields,
  isIdecoCategory,
  yenToMan,
} from './idecoContributionLimit';
import { ensureDbEnrollmentFields } from './dbEnrollment';
import { ensureDcContributionFields } from './dcContribution';
import type { FamilyMember } from '../types/family';
import type {
  NisaUtilization,
  NisaValuationMode,
  SavingsCategory,
  SavingsContributionMode,
  SavingsEntry,
} from '../types/savings';
import { resolveSavingsContributionMode, isTaxableSavingsCategory } from './savingsLabels';
import {
  calcTaxableValuationMan,
  ensureTaxableFields,
} from './taxableCapitalGains';
import { ensureSavingsWithdrawalFields } from './savingsWithdrawalPeriod';
import { ensureTimeDepositFields } from './timeDeposit';

/** NISA つみたて投資枠の年間上限（万円） */
export const NISA_TSUMITATE_ANNUAL_LIMIT_MAN = 120;

/** NISA 成長投資枠の年間上限（万円） */
export const NISA_GROWTH_ANNUAL_LIMIT_MAN = 240;

/**
 * 非課税保有限度額（総枠・万円）。簿価＝投資元本ベース。
 * つみたて＋成長の合算上限。
 */
export const NISA_LIFETIME_LIMIT_MAN = 1800;

/**
 * 成長投資枠の生涯上限（万円）。総枠 1,800 万円の内数。
 */
export const NISA_GROWTH_LIFETIME_LIMIT_MAN = 1200;

export interface NisaLifetimeQuota {
  /** 総枠の使用済み元本（万円） */
  usedTotalMan: number;
  /** 成長投資枠の使用済み元本（万円） */
  usedGrowthMan: number;
  /** つみたて投資枠の使用済み元本（万円） */
  usedTsumitateMan: number;
  /** 総枠の残り（万円） */
  remainingTotalMan: number;
  /** 成長投資枠の残り（万円）。総枠残りとの小さい方 */
  remainingGrowthMan: number;
  /** つみたてへ追加できる残り（万円）。総枠残りと同じ */
  remainingTsumitateMan: number;
}

/** 積立ペースから見た枠消化の見込み */
export interface NisaQuotaFillEstimate {
  remainingLifetimeMan: number;
  plannedAnnualMan: number;
  /** 年間上限を踏まえた実効年間積立（万円） */
  effectiveAnnualMan: number;
  /** 枠が埋まるまでの月数。積立なしは null、残枠0 は 0 */
  monthsToFill: number | null;
  fillAge: number | null;
  fillMonth: number | null;
  /** 指定期間（一生涯含む）の積立予定合計（万円） */
  plannedTotalInPeriodMan: number;
  /** 指定期間の積立予定が生涯残り枠を超えるか */
  exceedsLifetimeQuota: boolean;
}

export function isNisaCategory(
  category: SavingsCategory,
): category is 'nisa_tsumitate' | 'nisa_growth' {
  return category === 'nisa_tsumitate' || category === 'nisa_growth';
}

export function getNisaAnnualLimitMan(category: SavingsCategory): number {
  if (category === 'nisa_tsumitate') return NISA_TSUMITATE_ANNUAL_LIMIT_MAN;
  if (category === 'nisa_growth') return NISA_GROWTH_ANNUAL_LIMIT_MAN;
  return 0;
}

export function resolveNisaUtilization(
  utilization: NisaUtilization | undefined,
): NisaUtilization {
  return utilization === 'active' ? 'active' : 'new';
}

export function resolveNisaValuationMode(
  mode: NisaValuationMode | undefined,
): NisaValuationMode {
  return mode === 'gains' ? 'gains' : 'rate';
}

export function resolveNisaPrincipalMan(entry: SavingsEntry): number {
  if (resolveNisaUtilization(entry.nisaUtilization) === 'new') return 0;
  return Math.max(0, Number(entry.principalMan) || 0);
}

export function resolveNisaGainsMan(entry: SavingsEntry): number {
  if (resolveNisaUtilization(entry.nisaUtilization) !== 'active') return 0;
  if (resolveNisaValuationMode(entry.nisaValuationMode) === 'gains') {
    return Math.max(0, Number(entry.gainsMan) || 0);
  }
  const principal = resolveNisaPrincipalMan(entry);
  const ratePct = Math.max(0, Number(entry.nisaCurrentReturnRatePct) || 0);
  return principal * (ratePct / 100);
}

/** 試算開始時点の NISA 評価額（万円） */
export function calcNisaValuationMan(entry: SavingsEntry): number {
  const principal = resolveNisaPrincipalMan(entry);
  return principal + resolveNisaGainsMan(entry);
}

/** 試算開始時点の口座残高（万円） */
export function getSavingsOpeningBalanceMan(entry: SavingsEntry): number {
  if (isNisaCategory(entry.category)) {
    return calcNisaValuationMan(entry);
  }
  if (isTaxableSavingsCategory(entry.category)) {
    return calcTaxableValuationMan(entry);
  }
  return Math.max(0, Number(entry.balanceMan) || 0);
}

export function calcPlannedAnnualContributionMan(
  contributionMode: SavingsContributionMode | undefined,
  contributionMan: number,
): number {
  const mode = resolveSavingsContributionMode(contributionMode);
  const amount = Math.max(0, Number(contributionMan) || 0);
  if (mode === 'none' || amount <= 0) return 0;
  if (mode === 'monthly') return amount * 12;
  return amount;
}

/** 年間積立予定に対する残り枠（万円） */
export function calcNisaRemainingAnnualQuotaMan(entry: SavingsEntry): number {
  if (!isNisaCategory(entry.category)) return 0;
  const limit = getNisaAnnualLimitMan(entry.category);
  const planned = calcPlannedAnnualContributionMan(
    entry.contributionMode,
    entry.contributionMan,
  );
  return Math.max(0, limit - planned);
}

export function isNisaAnnualContributionOverLimit(entry: SavingsEntry): boolean {
  if (!isNisaCategory(entry.category)) return false;
  const limit = getNisaAnnualLimitMan(entry.category);
  const planned = calcPlannedAnnualContributionMan(
    entry.contributionMode,
    entry.contributionMan,
  );
  return planned > limit;
}

export function buildNisaLifetimeQuota(
  usedTsumitateMan: number,
  usedGrowthMan: number,
): NisaLifetimeQuota {
  const usedTotalMan = usedTsumitateMan + usedGrowthMan;
  const remainingTotalMan = Math.max(0, NISA_LIFETIME_LIMIT_MAN - usedTotalMan);
  const remainingGrowthMan = Math.max(
    0,
    Math.min(
      NISA_GROWTH_LIFETIME_LIMIT_MAN - usedGrowthMan,
      remainingTotalMan,
    ),
  );
  return {
    usedTotalMan,
    usedGrowthMan,
    usedTsumitateMan,
    remainingTotalMan,
    remainingGrowthMan,
    remainingTsumitateMan: remainingTotalMan,
  };
}

/** メンバー配下の NISA 口座から生涯枠（簿価）を集計 */
export function calcNisaLifetimeQuota(
  entries: SavingsEntry[],
): NisaLifetimeQuota {
  let usedTsumitateMan = 0;
  let usedGrowthMan = 0;
  for (const entry of entries) {
    if (!isNisaCategory(entry.category)) continue;
    const principal = resolveNisaPrincipalMan(entry);
    if (entry.category === 'nisa_tsumitate') {
      usedTsumitateMan += principal;
    } else {
      usedGrowthMan += principal;
    }
  }
  return buildNisaLifetimeQuota(usedTsumitateMan, usedGrowthMan);
}

/** 当該口座の枠種別における生涯残り（万円） */
export function getNisaLifetimeRemainingForCategory(
  quota: NisaLifetimeQuota,
  category: SavingsCategory,
): number {
  if (category === 'nisa_growth') return quota.remainingGrowthMan;
  if (category === 'nisa_tsumitate') return quota.remainingTsumitateMan;
  return 0;
}

/**
 * 編集中の entry をメンバー口座一覧に反映したうえで生涯枠を計算する。
 */
export function calcNisaLifetimeQuotaWithEntry(
  memberEntries: SavingsEntry[],
  entry: SavingsEntry,
): NisaLifetimeQuota {
  const merged = memberEntries.some((item) => item.id === entry.id)
    ? memberEntries.map((item) => (item.id === entry.id ? entry : item))
    : [...memberEntries, entry];
  return calcNisaLifetimeQuota(merged);
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function addMonthsToAgeMonth(
  age: number,
  month: number,
  addMonths: number,
): { age: number; month: number } {
  const total = ageMonthIndex(age, month) + addMonths;
  const nextAge = Math.floor((total - 1) / 12);
  const nextMonth = ((total - 1) % 12) + 1;
  return { age: nextAge, month: nextMonth };
}

function resolveContributionEndAgeMonth(
  entry: SavingsEntry,
  member: FamilyMember,
): { endAge: number; endMonth: number } {
  if (entry.endMode === 'lifetime') {
    return { endAge: member.expectedLifespan, endMonth: 12 };
  }
  return { endAge: entry.endAge, endMonth: entry.endMonth };
}

/** 積立期間内の予定積立合計（枠キャップ前・万円） */
export function calcNisaPlannedContributionInPeriodMan(
  entry: SavingsEntry,
  member: FamilyMember,
): number {
  if (!isNisaCategory(entry.category)) return 0;
  const mode = resolveSavingsContributionMode(entry.contributionMode);
  const amount = Math.max(0, Number(entry.contributionMan) || 0);
  if (mode === 'none' || amount <= 0) return 0;

  const end = resolveContributionEndAgeMonth(entry, member);
  const startIndex = ageMonthIndex(entry.startAge, entry.startMonth);
  const endIndex = ageMonthIndex(end.endAge, end.endMonth);
  if (endIndex < startIndex) return 0;

  if (mode === 'monthly') {
    return amount * (endIndex - startIndex + 1);
  }

  // 年額: 開始月に毎年1回
  let total = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    const month = ((index - 1) % 12) + 1;
    if (month === entry.startMonth) {
      total += amount;
    }
  }
  return total;
}

/**
 * 現在の積立ペースで生涯枠が埋まる時期を推計する。
 * 年間上限を超える積立設定は、年間上限までしか枠を消化しない前提。
 */
export function estimateNisaQuotaFill(
  entry: SavingsEntry,
  memberEntries: SavingsEntry[],
  member: FamilyMember,
): NisaQuotaFillEstimate {
  const lifetime = calcNisaLifetimeQuotaWithEntry(memberEntries, entry);
  const remainingLifetimeMan = getNisaLifetimeRemainingForCategory(
    lifetime,
    entry.category,
  );
  const plannedAnnualMan = calcPlannedAnnualContributionMan(
    entry.contributionMode,
    entry.contributionMan,
  );
  const annualLimit = getNisaAnnualLimitMan(entry.category);
  const effectiveAnnualMan = Math.min(plannedAnnualMan, annualLimit);
  const plannedTotalInPeriodMan = calcNisaPlannedContributionInPeriodMan(
    entry,
    member,
  );
  const exceedsLifetimeQuota =
    plannedTotalInPeriodMan > remainingLifetimeMan + 1e-9;

  if (effectiveAnnualMan <= 0 || remainingLifetimeMan <= 0) {
    return {
      remainingLifetimeMan,
      plannedAnnualMan,
      effectiveAnnualMan,
      monthsToFill: remainingLifetimeMan <= 0 ? 0 : null,
      fillAge: null,
      fillMonth: null,
      plannedTotalInPeriodMan,
      exceedsLifetimeQuota,
    };
  }

  const mode = resolveSavingsContributionMode(entry.contributionMode);
  let monthsToFill: number;
  if (mode === 'monthly') {
    const monthly = Math.max(0, Number(entry.contributionMan) || 0);
    const cappedMonthly = Math.min(monthly, annualLimit / 12);
    monthsToFill =
      cappedMonthly > 0 ? Math.ceil(remainingLifetimeMan / cappedMonthly) : 0;
  } else {
    const years = Math.ceil(remainingLifetimeMan / effectiveAnnualMan);
    monthsToFill = Math.max(0, (years - 1) * 12);
  }

  const fillPoint = addMonthsToAgeMonth(
    entry.startAge,
    entry.startMonth,
    Math.max(0, monthsToFill - (mode === 'monthly' ? 1 : 0)),
  );

  return {
    remainingLifetimeMan,
    plannedAnnualMan,
    effectiveAnnualMan,
    monthsToFill,
    fillAge: fillPoint.age,
    fillMonth: fillPoint.month,
    plannedTotalInPeriodMan,
    exceedsLifetimeQuota,
  };
}

/**
 * NISA 積立の当該月分を年間・生涯枠でキャップする。
 * @returns 実際に買付できる額（万円）
 */
export function capNisaContributionMan(params: {
  category: SavingsCategory;
  requestedMan: number;
  annualUsedMan: number;
  lifetimeQuota: NisaLifetimeQuota;
}): number {
  const requested = Math.max(0, params.requestedMan);
  if (requested <= 0 || !isNisaCategory(params.category)) return 0;
  const annualRemaining = Math.max(
    0,
    getNisaAnnualLimitMan(params.category) - params.annualUsedMan,
  );
  const lifetimeRemaining = getNisaLifetimeRemainingForCategory(
    params.lifetimeQuota,
    params.category,
  );
  return Math.min(requested, annualRemaining, lifetimeRemaining);
}

export function ensureNisaFields(entry: SavingsEntry): SavingsEntry {
  const utilization = resolveNisaUtilization(entry.nisaUtilization);
  const valuationMode = resolveNisaValuationMode(entry.nisaValuationMode);
  return ensureSavingsWithdrawalFields({
    ...entry,
    nisaUtilization: utilization,
    nisaValuationMode: valuationMode,
    principalMan:
      utilization === 'active'
        ? Math.max(0, Number(entry.principalMan) || 0)
        : 0,
    gainsMan:
      utilization === 'active' && valuationMode === 'gains'
        ? Math.max(0, Number(entry.gainsMan) || 0)
        : 0,
    nisaCurrentReturnRatePct:
      utilization === 'active' && valuationMode === 'rate'
        ? Math.max(0, Number(entry.nisaCurrentReturnRatePct) || 0)
        : 0,
    balanceMan: 0,
  });
}

/** 旧カテゴリ `nisa` や未設定フィールドを正規化 */
export function normalizeSavingsEntry(entry: SavingsEntry): SavingsEntry {
  let normalized: SavingsEntry = { ...entry };

  if ((normalized.category as string) === 'nisa') {
    const legacyBalance = Math.max(0, Number(normalized.balanceMan) || 0);
    normalized = {
      ...normalized,
      category: 'nisa_tsumitate',
      nisaUtilization: legacyBalance > 0 ? 'active' : 'new',
      principalMan: legacyBalance,
      nisaValuationMode: 'rate',
      gainsMan: 0,
      balanceMan: 0,
    };
  }

  if (isNisaCategory(normalized.category)) {
    return ensureNisaFields(normalized);
  }

  if (normalized.category === 'taxable') {
    return ensureTaxableFields(normalized);
  }

  if (normalized.category === 'time_deposit') {
    return ensureTimeDepositFields(normalized);
  }

  if (isIdecoCategory(normalized.category)) {
    return ensureIdecoFields(normalized);
  }

  if (normalized.category === 'dc') {
    return ensureDcContributionFields(normalized);
  }

  if (normalized.category === 'db') {
    let db = normalized;
    if (db.otherSystemContributionMan == null) {
      db = {
        ...db,
        otherSystemContributionMan: yenToMan(
          CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN,
        ),
      };
    }
    return ensureDbEnrollmentFields(db);
  }

  return normalized;
}
