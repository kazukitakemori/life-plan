import { resolveMemberAge } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeCategory, IncomeEntry } from '../types/income';
import type {
  IdecoOccupancy,
  SavingsContributionMode,
  SavingsEntry,
} from '../types/savings';
import { calcBirthYear } from './birthDate';
import { ensureDcContributionFields, isDcCategory } from './dcContribution';
import {
  resolveMemberYearIncomeProfile,
  type MemberYearIncomeProfile,
} from './memberYearIncome';
import { resolveSavingsContributionMode } from './savingsLabels';
import { clampIdecoPayoutFields } from './idecoPayout';

export type { IdecoOccupancy };

export const IDECO_OCCUPANCY_LABELS: Record<IdecoOccupancy, string> = {
  self_employed: '自営業者等',
  employee: '会社員',
  civil_servant: '公務員',
  spouse_no_income: '専業主婦・主夫',
};

export const IDECO_OCCUPANCY_OPTIONS: IdecoOccupancy[] = [
  'employee',
  'civil_servant',
  'self_employed',
  'spouse_no_income',
];

/** 自営業者等（第1号）の月額上限（円） */
export const IDECO_LIMIT_TYPE1_YEN = 68_000;

/** 企業年金なしの第2号・第3号の月額上限（円） */
export const IDECO_LIMIT_NO_CORPORATE_PENSION_YEN = 23_000;

/** 企業年金ありの第2号の iDeCo 月額上限キャップ（円） */
export const IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN = 20_000;

/**
 * 企業型DCの法令上の月額拠出枠（円）。
 * DB等ありの場合はここから他制度掛金相当額を差し引く。
 */
export const CORPORATE_DC_COMBINED_CEILING_YEN = 55_000;

/**
 * DB等ありのときの他制度掛金相当額（円・簡略代表値）。
 * 実額入力がないため、試算では代表値を用いる。
 */
export const CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN = 27_500;

export interface IdecoCorporatePensionFlags {
  hasCorporateDc: boolean;
  hasDb: boolean;
}

export interface IdecoMonthlyLimitOptions {
  /** 同一メンバーの企業型DC事業主掛金（月額換算・円） */
  employerDcMonthlyYen?: number;
  /** 同一メンバーのDB等・他制度掛金相当額（月額・円） */
  dbOtherSystemMonthlyYen?: number;
}

export interface CorporateDcMonthlyYen {
  employerYen: number;
  employeeYen: number;
  totalYen: number;
}

export function isIdecoCategory(
  category: SavingsEntry['category'],
): category is 'ideco' {
  return category === 'ideco';
}

function mapIncomeCategoryToOccupancy(
  category: IncomeCategory | null,
): IdecoOccupancy | null {
  if (category === 'self_employed') return 'self_employed';
  if (category === 'civil_servant') return 'civil_servant';
  if (category === 'employee' || category === 'part_time') return 'employee';
  return null;
}

function occupancyFromProfile(
  member: FamilyMember,
  profile: MemberYearIncomeProfile,
): IdecoOccupancy {
  if (profile.socialInsuranceDependent) {
    return 'spouse_no_income';
  }

  const fromCategory = mapIncomeCategoryToOccupancy(profile.category);
  if (fromCategory) return fromCategory;

  if (
    !profile.hasActiveIncomeBlock &&
    (member.role === 'spouse' || profile.dependentStatus === 'dependent')
  ) {
    return 'spouse_no_income';
  }

  if (profile.category === 'benefit' || profile.category === 'other') {
    if (
      member.role === 'spouse' &&
      profile.dependentStatus === 'dependent'
    ) {
      return 'spouse_no_income';
    }
  }

  if (member.role === 'spouse' && !profile.hasActiveIncomeBlock) {
    return 'spouse_no_income';
  }

  return 'employee';
}

/** 年齢・月 → その時点の暦年 */
export function calendarYearFromAgeMonth(
  member: Pick<FamilyMember, 'age' | 'birthMonth'>,
  referenceDate: Date,
  age: number,
  month: number,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const m = Math.min(12, Math.max(1, month));
  if (m >= (member.birthMonth || 1)) {
    return birthYear + age;
  }
  return birthYear + age + 1;
}

/**
 * 指定年齢月の Q7 収入プロフィールから iDeCo 加入区分を判定する。
 */
export function resolveIdecoOccupancyAtAgeMonth(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  age: number,
  month: number,
): IdecoOccupancy {
  const calendarYear = calendarYearFromAgeMonth(
    member,
    referenceDate,
    age,
    month,
  );
  const profile = resolveMemberYearIncomeProfile(
    member,
    incomeEntries,
    referenceDate,
    calendarYear,
    month,
    month,
  );
  return occupancyFromProfile(member, profile);
}

function resolveIncomeProfileAtAgeMonth(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  age: number,
  month: number,
): MemberYearIncomeProfile {
  const calendarYear = calendarYearFromAgeMonth(
    member,
    referenceDate,
    age,
    month,
  );
  return resolveMemberYearIncomeProfile(
    member,
    incomeEntries,
    referenceDate,
    calendarYear,
    month,
    month,
  );
}

/**
 * Q7 収入と扶養状態から iDeCo 加入区分を自動判定する。
 * 既定は試算開始時点（現在年齢・基準月）のプロフィール。
 * 積立開始を渡す場合はそちらを優先する。
 */
export function resolveIdecoOccupancy(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  contributionStart?: { age: number; month: number },
): IdecoOccupancy {
  if (contributionStart) {
    return resolveIdecoOccupancyAtAgeMonth(
      member,
      incomeEntries,
      referenceDate,
      contributionStart.age,
      contributionStart.month,
    );
  }
  return resolveIdecoOccupancyAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    resolveMemberAge(member),
    referenceDate.getMonth() + 1,
  );
}

/** 口座に保存された区分があればそれを優先し、なければ積立開始時点から判定 */
export function resolveEffectiveIdecoOccupancy(
  entry: Pick<SavingsEntry, 'idecoOccupancy' | 'startAge' | 'startMonth'>,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): IdecoOccupancy {
  if (entry.idecoOccupancy) return entry.idecoOccupancy;
  return resolveIdecoOccupancy(member, incomeEntries, referenceDate, {
    age: entry.startAge,
    month: entry.startMonth,
  });
}

/**
 * Q7 収入エントリから、選択可能な加入区分一覧を返す。
 * 該当がなければ全区分を返す。
 */
export function listIdecoOccupancyOptionsFromIncome(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
): IdecoOccupancy[] {
  const found = new Set<IdecoOccupancy>();
  for (const entry of incomeEntries) {
    const occ = mapIncomeCategoryToOccupancy(entry.category);
    if (occ) found.add(occ);
  }
  if (member.role === 'spouse') {
    found.add('spouse_no_income');
  }
  if (found.size === 0) {
    return [...IDECO_OCCUPANCY_OPTIONS];
  }
  return IDECO_OCCUPANCY_OPTIONS.filter((occ) => found.has(occ));
}

export interface IdecoContributionPeriod {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
}

/**
 * 指定した加入区分に対応する Q7 収入期間から、積立開始・終了を決める。
 * 同一区分の最も早い連続区間を採用し、制度上限で切る。
 */
export function resolveIdecoContributionPeriodForOccupancy(
  occupancy: IdecoOccupancy,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): IdecoContributionPeriod {
  const statutory = resolveIdecoStatutoryContributionEndCap(occupancy, member);
  const fallbackStart = {
    age: resolveMemberAge(member),
    month: referenceDate.getMonth() + 1,
  };

  const matchingPeriods: {
    startAge: number;
    startMonth: number;
    endAge: number;
    endMonth: number;
  }[] = [];
  for (const entry of incomeEntries) {
    if (mapIncomeCategoryToOccupancy(entry.category) !== occupancy) continue;
    for (const period of entry.periods) {
      matchingPeriods.push({
        startAge: period.startAge,
        startMonth: period.startMonth,
        endAge: period.endAge,
        endMonth: period.endMonth,
      });
    }
  }

  if (matchingPeriods.length === 0) {
    return {
      startAge: fallbackStart.age,
      startMonth: fallbackStart.month,
      endAge: statutory.endAge,
      endMonth: statutory.endMonth,
    };
  }

  let startAge = matchingPeriods[0].startAge;
  let startMonth = matchingPeriods[0].startMonth;
  for (const period of matchingPeriods) {
    if (
      ageMonthIndex(period.startAge, period.startMonth) <
      ageMonthIndex(startAge, startMonth)
    ) {
      startAge = period.startAge;
      startMonth = period.startMonth;
    }
  }

  const segmentEnd = resolveContinuousIdecoOccupancySegmentEnd(
    member,
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
  );
  const capped = minAgeMonth(statutory, {
    endAge: segmentEnd.endAge,
    endMonth: segmentEnd.endMonth,
  });

  // 開始が終了より後にならないよう補正
  if (
    ageMonthIndex(startAge, startMonth) >
    ageMonthIndex(capped.endAge, capped.endMonth)
  ) {
    return {
      startAge: capped.endAge,
      startMonth: capped.endMonth,
      endAge: capped.endAge,
      endMonth: capped.endMonth,
    };
  }

  return {
    startAge,
    startMonth,
    endAge: capped.endAge,
    endMonth: capped.endMonth,
  };
}

/** 同一メンバーに企業型DC口座があるか（iDeCo上限の真実源） */
export function memberHasCorporateDcEntry(
  entries: readonly SavingsEntry[],
): boolean {
  return entries.some((entry) => entry.category === 'dc');
}

/** 同一メンバーに DB 口座があるか（iDeCo上限の真実源） */
export function memberHasDbEntry(entries: readonly SavingsEntry[]): boolean {
  return entries.some((entry) => entry.category === 'db');
}

export function isDbCategory(
  category: SavingsEntry['category'],
): category is 'db' {
  return category === 'db';
}

/** 掛金のみを月額／年額上限へクランプする */
export function clampIdecoContributionToLimit(
  entry: SavingsEntry,
  occupancy: IdecoOccupancy,
  flags: IdecoCorporatePensionFlags,
  options?: IdecoMonthlyLimitOptions,
): SavingsEntry {
  const limitYen = resolveIdecoMonthlyLimitYen(occupancy, flags, options);
  const limitMan = yenToMan(limitYen);
  const mode = resolveSavingsContributionMode(entry.contributionMode);
  let contributionMan = Math.max(0, Number(entry.contributionMan) || 0);
  if (mode === 'monthly' && contributionMan > limitMan) {
    contributionMan = limitMan;
  } else if (mode === 'annual' && contributionMan > limitMan * 12) {
    contributionMan = limitMan * 12;
  }
  if (contributionMan === entry.contributionMan) return entry;
  return { ...entry, contributionMan };
}

/**
 * 企業型DC口座の有無 → 全 iDeCo の hasCorporateDc を双方向同期する。
 * 口座がなければ false、あれば true。
 */
export function syncIdecoCorporateDcFlags(
  entries: SavingsEntry[],
): SavingsEntry[] {
  const hasDc = memberHasCorporateDcEntry(entries);
  let changed = false;
  const next = entries.map((entry) => {
    if (!isIdecoCategory(entry.category)) return entry;
    if (entry.hasCorporateDc === hasDc) return entry;
    changed = true;
    return { ...entry, hasCorporateDc: hasDc };
  });
  return changed ? next : entries;
}

/**
 * DB口座の有無 → 全 iDeCo の hasDb を双方向同期する。
 * 口座がなければ false、あれば true。
 */
export function syncIdecoHasDbFlags(entries: SavingsEntry[]): SavingsEntry[] {
  const hasDb = memberHasDbEntry(entries);
  let changed = false;
  const next = entries.map((entry) => {
    if (!isIdecoCategory(entry.category)) return entry;
    if (entry.hasDb === hasDb) return entry;
    changed = true;
    return { ...entry, hasDb };
  });
  return changed ? next : entries;
}

/**
 * DC/DB口座有無を同期し、各 iDeCo の掛金を現行上限へクランプする。
 */
export function reconcileMemberIdecoCorporatePensions(
  entries: SavingsEntry[],
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry[] {
  const syncedDc = syncIdecoCorporateDcFlags(entries);
  const synced = syncIdecoHasDbFlags(syncedDc);
  const hasDc = memberHasCorporateDcEntry(synced);
  const hasDb = memberHasDbEntry(synced);
  const dcMonthly = calcMemberCorporateDcMonthlyYen(synced);
  const dbOtherYen = calcMemberDbOtherSystemMonthlyYen(synced);
  let changed = synced !== entries;
  const next = synced.map((entry) => {
    if (!isIdecoCategory(entry.category)) return entry;
    const occupancy = resolveEffectiveIdecoOccupancy(
      entry,
      member,
      incomeEntries,
      referenceDate,
    );
    const flags = resolveIdecoCorporatePensionFlags(
      entry,
      occupancy,
      hasDc,
      hasDb,
    );
    const clamped = clampIdecoContributionToLimit(entry, occupancy, flags, {
      employerDcMonthlyYen: dcMonthly.employerYen,
      dbOtherSystemMonthlyYen: dbOtherYen,
    });
    const resolved: SavingsEntry = {
      ...clamped,
      hasCorporateDc: flags.hasCorporateDc,
      hasDb: flags.hasDb,
    };
    if (
      resolved.hasCorporateDc !== entry.hasCorporateDc ||
      resolved.hasDb !== entry.hasDb ||
      resolved.contributionMan !== entry.contributionMan
    ) {
      changed = true;
    }
    return resolved;
  });
  return changed ? next : entries;
}

/** 加入区分を選び、対応する積立期間を反映したエントリを返す */
export function applyIdecoOccupancySelection(
  entry: SavingsEntry,
  occupancy: IdecoOccupancy,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  memberEntries?: readonly SavingsEntry[],
): SavingsEntry {
  const period = resolveIdecoContributionPeriodForOccupancy(
    occupancy,
    member,
    incomeEntries,
    referenceDate,
  );
  const memberHasDc =
    memberEntries != null
      ? memberHasCorporateDcEntry(memberEntries)
      : entry.hasCorporateDc === true;
  const memberHasDb =
    memberEntries != null
      ? memberHasDbEntry(memberEntries)
      : entry.hasDb === true;
  const flags = resolveIdecoCorporatePensionFlags(
    entry,
    occupancy,
    memberHasDc,
    memberHasDb,
  );
  const withFlags: SavingsEntry = {
    ...entry,
    idecoOccupancy: occupancy,
    hasCorporateDc: flags.hasCorporateDc,
    hasDb: flags.hasDb,
    startAge: period.startAge,
    startMonth: period.startMonth,
    endMode: 'until',
    endAge: period.endAge,
    endMonth: period.endMonth,
  };
  const employerDcMonthlyYen =
    memberEntries != null
      ? calcMemberCorporateDcMonthlyYen([...memberEntries]).employerYen
      : 0;
  const dbOtherSystemMonthlyYen =
    memberEntries != null
      ? calcMemberDbOtherSystemMonthlyYen([...memberEntries])
      : 0;
  const clamped = clampIdecoContributionToLimit(withFlags, occupancy, flags, {
    employerDcMonthlyYen,
    dbOtherSystemMonthlyYen,
  });

  return clampIdecoContributionPeriod(
    clamped,
    member,
    occupancy,
    incomeEntries,
    referenceDate,
  );
}

/** 企業型DC・DB の有無選択を表示する区分か */
export function showsIdecoCorporatePensionFlags(
  occupancy: IdecoOccupancy,
): boolean {
  return occupancy === 'employee' || occupancy === 'civil_servant';
}

/**
 * 企業年金フラグを解決する。
 * `memberHasCorporateDc` / `memberHasDb` を渡した場合はそれを真実源とし、
 * 未指定時のみ entry のキャッシュ（公務員の DB 既定あり）を使う。
 */
export function resolveIdecoCorporatePensionFlags(
  entry: Pick<SavingsEntry, 'hasCorporateDc' | 'hasDb'>,
  occupancy: IdecoOccupancy,
  memberHasCorporateDc?: boolean,
  memberHasDb?: boolean,
): IdecoCorporatePensionFlags {
  if (!showsIdecoCorporatePensionFlags(occupancy)) {
    return { hasCorporateDc: false, hasDb: false };
  }
  return {
    hasCorporateDc:
      memberHasCorporateDc !== undefined
        ? memberHasCorporateDc
        : entry.hasCorporateDc === true,
    hasDb:
      memberHasDb !== undefined
        ? memberHasDb
        : entry.hasDb === true ||
          (entry.hasDb === undefined && occupancy === 'civil_servant'),
  };
}

export function resolveIdecoMonthlyLimitYen(
  occupancy: IdecoOccupancy,
  flags: IdecoCorporatePensionFlags,
  options?: IdecoMonthlyLimitOptions,
): number {
  if (occupancy === 'self_employed') return IDECO_LIMIT_TYPE1_YEN;
  if (occupancy === 'spouse_no_income') {
    return IDECO_LIMIT_NO_CORPORATE_PENSION_YEN;
  }
  if (flags.hasCorporateDc) {
    // 残余方式: min(2万円, 5.5万円 − 事業主掛金 − DB等相当)（千円未満切捨て）
    const other = flags.hasDb
      ? Math.max(0, Number(options?.dbOtherSystemMonthlyYen) || 0)
      : 0;
    const employer = Math.max(0, Number(options?.employerDcMonthlyYen) || 0);
    const residual =
      CORPORATE_DC_COMBINED_CEILING_YEN - employer - other;
    const floored = Math.floor(Math.max(0, residual) / 1000) * 1000;
    return Math.min(IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN, floored);
  }
  if (flags.hasDb) {
    return IDECO_LIMIT_WITH_CORPORATE_PENSION_YEN;
  }
  return IDECO_LIMIT_NO_CORPORATE_PENSION_YEN;
}

/** 積立 mode/額を月額換算（円） */
export function calcSavingsContributionMonthlyYen(
  mode: SavingsContributionMode | undefined,
  amountMan: number,
): number {
  const resolved = resolveSavingsContributionMode(mode);
  const man = Math.max(0, Number(amountMan) || 0);
  if (resolved === 'none' || man <= 0) return 0;
  if (resolved === 'annual') return manToYen(man) / 12;
  return manToYen(man);
}

/** 同一メンバーの企業型DC事業主／加入者掛金の月額換算（円） */
export function calcMemberCorporateDcMonthlyYen(
  entries: SavingsEntry[],
): CorporateDcMonthlyYen {
  let employerYen = 0;
  let employeeYen = 0;
  for (const entry of entries) {
    if (!isDcCategory(entry.category)) continue;
    const dc = ensureDcContributionFields(entry);
    employerYen += calcSavingsContributionMonthlyYen(
      dc.employerContributionMode,
      dc.employerContributionMan ?? 0,
    );
    employeeYen += calcSavingsContributionMonthlyYen(
      dc.employeeContributionMode,
      dc.employeeContributionMan ?? 0,
    );
  }
  return {
    employerYen,
    employeeYen,
    totalYen: employerYen + employeeYen,
  };
}

/**
 * 同一メンバーの DB 等・他制度掛金相当額（月額・円）。
 * DB口座の入力合計。未設定の口座は代表値を用いる。
 */
export function calcMemberDbOtherSystemMonthlyYen(
  entries: SavingsEntry[],
): number {
  let total = 0;
  let hasDbEntry = false;
  for (const entry of entries) {
    if (entry.category !== 'db') continue;
    hasDbEntry = true;
    if (entry.otherSystemContributionMan == null) {
      total += CORPORATE_DC_DB_OTHER_EQUIVALENT_YEN;
    } else {
      total += manToYen(Math.max(0, Number(entry.otherSystemContributionMan) || 0));
    }
  }
  return hasDbEntry ? total : 0;
}

/** 企業型DC（事業主＋加入者）の月額拠出枠（円） */
export function resolveCorporateDcCombinedCeilingYen(
  hasDb: boolean,
  dbOtherSystemMonthlyYen?: number,
): number {
  const other = hasDb
    ? Math.max(0, Number(dbOtherSystemMonthlyYen) || 0)
    : 0;
  return Math.max(0, CORPORATE_DC_COMBINED_CEILING_YEN - other);
}

export function isCorporateDcContributionOverCeiling(
  monthly: Pick<CorporateDcMonthlyYen, 'totalYen'>,
  hasDb: boolean,
  dbOtherSystemMonthlyYen?: number,
): boolean {
  return (
    monthly.totalYen >
    resolveCorporateDcCombinedCeilingYen(hasDb, dbOtherSystemMonthlyYen) + 0.5
  );
}

export function yenToMan(yen: number): number {
  return yen / 10_000;
}

export function manToYen(man: number): number {
  return man * 10_000;
}

/** 入力掛金の月額換算（円）。積立なしは 0 */
export function calcIdecoMonthlyContributionYen(
  entry: Pick<SavingsEntry, 'contributionMode' | 'contributionMan'>,
): number {
  const mode = resolveSavingsContributionMode(entry.contributionMode);
  const amountMan = Math.max(0, Number(entry.contributionMan) || 0);
  if (mode === 'none') return 0;
  if (mode === 'annual') return manToYen(amountMan) / 12;
  return manToYen(amountMan);
}

export function isIdecoContributionOverLimit(
  entry: Pick<SavingsEntry, 'contributionMode' | 'contributionMan'>,
  monthlyLimitYen: number,
): boolean {
  const mode = resolveSavingsContributionMode(
    entry.contributionMode as SavingsContributionMode,
  );
  if (mode === 'none') return false;
  return calcIdecoMonthlyContributionYen(entry) > monthlyLimitYen + 0.5;
}

export function formatIdecoYen(yen: number): string {
  return `${Math.round(yen).toLocaleString('ja-JP')}円`;
}

/** 掛金・上限の表示用（万円単位。積立入力欄と揃える） */
export function formatIdecoMan(yen: number): string {
  return `${yenToMan(yen)}万円`;
}

/**
 * 加入区分ごとの拠出可能上限年齢。
 * 原則は国民年金被保険者である間、最大65歳到達月まで。
 * 第3号（専業主婦・主夫）は第3号資格が60歳未満のため 60歳到達月を上限とする。
 */
export const IDECO_CONTRIBUTION_MAX_AGE_BY_OCCUPANCY: Record<
  IdecoOccupancy,
  number
> = {
  self_employed: 65,
  employee: 65,
  civil_servant: 65,
  spouse_no_income: 60,
};

export function resolveIdecoContributionMaxAge(
  occupancy: IdecoOccupancy,
): number {
  return IDECO_CONTRIBUTION_MAX_AGE_BY_OCCUPANCY[occupancy];
}

/** 制度上の拠出終了上限（上限年齢の到達月 = 誕生日月） */
export function resolveIdecoStatutoryContributionEndCap(
  occupancy: IdecoOccupancy,
  member: Pick<FamilyMember, 'birthMonth'>,
): { endAge: number; endMonth: number } {
  return {
    endAge: resolveIdecoContributionMaxAge(occupancy),
    endMonth: Math.min(12, Math.max(1, member.birthMonth || 1)),
  };
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function nextAgeMonth(age: number, month: number): { age: number; month: number } {
  if (month >= 12) return { age: age + 1, month: 1 };
  return { age, month: month + 1 };
}

function minAgeMonth(
  a: { endAge: number; endMonth: number },
  b: { endAge: number; endMonth: number },
): { endAge: number; endMonth: number } {
  return ageMonthIndex(a.endAge, a.endMonth) <= ageMonthIndex(b.endAge, b.endMonth)
    ? a
    : b;
}

/**
 * 積立開始月から、同一加入区分が連続する最後の月を返す。
 * 区分が変わった／（第3号以外で）収入ブロックが途切れた直前まで。
 */
export function resolveContinuousIdecoOccupancySegmentEnd(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  startAge: number,
  startMonth: number,
): { endAge: number; endMonth: number } {
  const startProfile = resolveIncomeProfileAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
  );
  const startOcc = occupancyFromProfile(member, startProfile);
  const statutory = resolveIdecoStatutoryContributionEndCap(startOcc, member);
  const statutoryIndex = ageMonthIndex(statutory.endAge, statutory.endMonth);

  // Q7に該当収入がない場合は制度上限まで（職歴で切れない）
  if (!startProfile.hasActiveIncomeBlock && startOcc !== 'spouse_no_income') {
    return statutory;
  }

  let lastAge = startAge;
  let lastMonth = Math.min(12, Math.max(1, startMonth));
  let cursor = { age: lastAge, month: lastMonth };

  while (ageMonthIndex(cursor.age, cursor.month) < statutoryIndex) {
    cursor = nextAgeMonth(cursor.age, cursor.month);
    if (ageMonthIndex(cursor.age, cursor.month) > statutoryIndex) break;

    const profile = resolveIncomeProfileAtAgeMonth(
      member,
      incomeEntries,
      referenceDate,
      cursor.age,
      cursor.month,
    );
    const occ = occupancyFromProfile(member, profile);
    if (occ !== startOcc) break;
    // 開始時に収入ブロックがあった区分は、途切れたら期間終了
    if (
      startOcc !== 'spouse_no_income' &&
      startProfile.hasActiveIncomeBlock &&
      !profile.hasActiveIncomeBlock
    ) {
      break;
    }

    lastAge = cursor.age;
    lastMonth = cursor.month;
  }

  return { endAge: lastAge, endMonth: lastMonth };
}

/**
 * 拠出終了の上限 = min(制度上限, 積立開始区分の連続期間終了)。
 * incomeEntries / 積立開始を渡さない場合は制度上限のみ。
 */
export function resolveIdecoContributionEndCap(
  occupancy: IdecoOccupancy,
  member: FamilyMember | Pick<FamilyMember, 'birthMonth'>,
  options?: {
    incomeEntries: IncomeEntry[];
    referenceDate: Date;
    startAge: number;
    startMonth: number;
  },
): { endAge: number; endMonth: number } {
  const statutory = resolveIdecoStatutoryContributionEndCap(occupancy, member);
  if (!options || !('age' in member)) {
    return statutory;
  }
  const segment = resolveContinuousIdecoOccupancySegmentEnd(
    member as FamilyMember,
    options.incomeEntries,
    options.referenceDate,
    options.startAge,
    options.startMonth,
  );
  return minAgeMonth(statutory, {
    endAge: segment.endAge,
    endMonth: segment.endMonth,
  });
}

/**
 * iDeCo の積立期間を制度上・職歴上の拠出上限内に補正する。
 * - endMode は常に until（一生涯不可）
 * - 終了は加入区分の上限 ∩ 同一区分の連続終了を超えない
 * - 開始が終了より後なら開始を終了に合わせる
 */
export function clampIdecoContributionPeriod(
  entry: SavingsEntry,
  member: FamilyMember,
  occupancy: IdecoOccupancy,
  incomeEntries: IncomeEntry[] = [],
  referenceDate: Date = new Date(),
): SavingsEntry {
  if (!isIdecoCategory(entry.category)) return entry;

  const startAge = Math.max(0, Number(entry.startAge) || resolveMemberAge(member));
  const startMonth = Math.min(12, Math.max(1, Number(entry.startMonth) || 1));
  const effectiveOccupancy =
    occupancy ??
    entry.idecoOccupancy ??
    resolveIdecoOccupancy(member, incomeEntries, referenceDate, {
      age: startAge,
      month: startMonth,
    });

  const cap = resolveIdecoContributionEndCap(effectiveOccupancy, member, {
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
  });
  const capIndex = ageMonthIndex(cap.endAge, cap.endMonth);

  let endAge = entry.endMode === 'lifetime' ? cap.endAge : entry.endAge;
  let endMonth = entry.endMode === 'lifetime' ? cap.endMonth : entry.endMonth;
  endAge = Math.max(0, Number(endAge) || cap.endAge);
  endMonth = Math.min(12, Math.max(1, Number(endMonth) || 12));

  if (ageMonthIndex(endAge, endMonth) > capIndex) {
    endAge = cap.endAge;
    endMonth = cap.endMonth;
  }

  let nextStartAge = startAge;
  let nextStartMonth = startMonth;
  if (
    ageMonthIndex(nextStartAge, nextStartMonth) >
    ageMonthIndex(endAge, endMonth)
  ) {
    nextStartAge = endAge;
    nextStartMonth = endMonth;
  }

  if (
    entry.endMode === 'until' &&
    entry.endAge === endAge &&
    entry.endMonth === endMonth &&
    entry.startAge === nextStartAge &&
    entry.startMonth === nextStartMonth
  ) {
    return entry;
  }

  return {
    ...entry,
    idecoOccupancy: effectiveOccupancy,
    endMode: 'until',
    endAge,
    endMonth,
    startAge: nextStartAge,
    startMonth: nextStartMonth,
  };
}

export function ensureIdecoFields(
  entry: SavingsEntry,
  ctx?: {
    member: FamilyMember;
    occupancy: IdecoOccupancy;
    assetsMan?: number;
    incomeEntries?: IncomeEntry[];
    referenceDate?: Date;
  },
): SavingsEntry {
  if (!isIdecoCategory(entry.category)) return entry;
  if (!ctx) return entry;
  const withPeriod = clampIdecoContributionPeriod(
    entry,
    ctx.member,
    ctx.occupancy,
    ctx.incomeEntries ?? [],
    ctx.referenceDate ?? new Date(),
  );
  return clampIdecoPayoutFields(withPeriod, ctx.member, ctx.assetsMan);
}

/** iDeCo 新規作成時の企業年金フラグ初期値 */
export function defaultIdecoCorporatePensionFlags(input: {
  occupancy: IdecoOccupancy;
  memberHasCorporateDcEntry: boolean;
  memberHasDbEntry?: boolean;
}): IdecoCorporatePensionFlags {
  return {
    hasCorporateDc: input.memberHasCorporateDcEntry,
    hasDb:
      input.memberHasDbEntry === true ||
      input.occupancy === 'civil_servant',
  };
}
