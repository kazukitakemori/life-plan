import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeCategory, IncomeEntry } from '../types/income';
import type {
  DcOccupancy,
  SavingsContributionMode,
  SavingsEntry,
  SavingsState,
} from '../types/savings';
import { calcBirthYear, getMemberAgeMonth, isAgeCalendarMonthInRange } from './birthDate';
import { INCOME_CATEGORY_LABELS } from './incomeLabels';
import {
  resolveMemberYearIncomeProfile,
  type MemberYearIncomeProfile,
} from './memberYearIncome';
import { resolveSavingsContributionMode } from './savingsLabels';

/**
 * 企業型DCの法令上の拠出可能上限年齢。
 * 加入者となることができるのは原則70歳未満のため、試算では70歳到達月を上限とする。
 */
export const CORPORATE_DC_CONTRIBUTION_MAX_AGE = 70;

export const DC_OCCUPANCY_OPTIONS: DcOccupancy[] = ['employee', 'part_time'];

export const DC_OCCUPANCY_LABELS: Record<DcOccupancy, string> = {
  employee: INCOME_CATEGORY_LABELS.employee,
  part_time: INCOME_CATEGORY_LABELS.part_time,
};

/** @deprecated DC_OCCUPANCY_LABELS と同じ（DB でも共用） */
export const CORPORATE_PENSION_OCCUPANCY_LABELS = DC_OCCUPANCY_LABELS;

export function isDcCategory(
  category: SavingsEntry['category'],
): category is 'dc' {
  return category === 'dc';
}

export function isCorporateDcEligibleIncomeCategory(
  category: IncomeCategory | null | undefined,
): boolean {
  return category === 'employee' || category === 'part_time';
}

export function isDcOccupancy(
  value: string | null | undefined,
): value is DcOccupancy {
  return value === 'employee' || value === 'part_time';
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

function occupancyFromIncomeCategory(
  category: IncomeCategory | null | undefined,
): DcOccupancy | null {
  if (category === 'employee' || category === 'part_time') return category;
  return null;
}

function isMatchingDcOccupancyProfile(
  profile: MemberYearIncomeProfile,
  occupancy: DcOccupancy,
): boolean {
  return (
    profile.hasActiveIncomeBlock &&
    occupancyFromIncomeCategory(profile.category) === occupancy
  );
}

function isCorporateDcEligibleProfile(
  profile: MemberYearIncomeProfile,
): boolean {
  return (
    profile.hasActiveIncomeBlock &&
    isCorporateDcEligibleIncomeCategory(profile.category)
  );
}

/** 制度上の拠出終了上限（上限年齢の到達月 = 誕生日月） */
export function resolveDcStatutoryContributionEndCap(
  member: Pick<FamilyMember, 'birthMonth'>,
): { endAge: number; endMonth: number } {
  return {
    endAge: CORPORATE_DC_CONTRIBUTION_MAX_AGE,
    endMonth: clampMonth(resolveMemberBirthMonth(member)),
  };
}

/**
 * 指定年齢月の Q7 収入から企業型DC加入区分を判定する。
 * 対象外の月は employee を既定とする。
 */
export function resolveDcOccupancyAtAgeMonth(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  age: number,
  month: number,
): DcOccupancy {
  const profile = resolveIncomeProfileAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    age,
    month,
  );
  return occupancyFromIncomeCategory(profile.category) ?? 'employee';
}

export function resolveDcOccupancy(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  contributionStart?: { age: number; month: number },
): DcOccupancy {
  if (contributionStart) {
    return resolveDcOccupancyAtAgeMonth(
      member,
      incomeEntries,
      referenceDate,
      contributionStart.age,
      contributionStart.month,
    );
  }
  return resolveDcOccupancyAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    resolveMemberAge(member),
    referenceDate.getMonth() + 1,
  );
}

/** 口座に保存された区分があればそれを優先し、なければ積立開始時点から判定 */
export function resolveEffectiveDcOccupancy(
  entry: Pick<SavingsEntry, 'dcOccupancy' | 'startAge' | 'startMonth'>,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): DcOccupancy {
  if (isDcOccupancy(entry.dcOccupancy)) return entry.dcOccupancy;
  return resolveDcOccupancy(member, incomeEntries, referenceDate, {
    age: entry.startAge,
    month: entry.startMonth,
  });
}

/**
 * Q7 収入エントリから、選択可能な企業型DC加入区分一覧を返す。
 * 該当がなければ全区分を返す。
 */
export function listDcOccupancyOptionsFromIncome(
  incomeEntries: IncomeEntry[],
): DcOccupancy[] {
  const found = new Set<DcOccupancy>();
  for (const entry of incomeEntries) {
    const occ = occupancyFromIncomeCategory(entry.category);
    if (occ) found.add(occ);
  }
  if (found.size === 0) return [...DC_OCCUPANCY_OPTIONS];
  return DC_OCCUPANCY_OPTIONS.filter((occ) => found.has(occ));
}

export interface DcContributionPeriod {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
}

/**
 * 指定した加入区分に対応する Q7 収入期間から、積立開始・終了を決める。
 * 同一区分の最も早い連続区間を採用し、制度上限で切る。
 */
export function resolveDcContributionPeriodForOccupancy(
  occupancy: DcOccupancy,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): DcContributionPeriod {
  const statutory = resolveDcStatutoryContributionEndCap(member);
  const fallbackStart = {
    age: resolveMemberAge(member),
    month: referenceDate.getMonth() + 1,
  };

  const matchingPeriods: DcContributionPeriod[] = [];
  for (const entry of incomeEntries) {
    if (occupancyFromIncomeCategory(entry.category) !== occupancy) continue;
    for (const period of entry.periods) {
      matchingPeriods.push({
        startAge: period.startAge,
        startMonth: clampMonth(period.startMonth),
        endAge: period.endAge,
        endMonth: clampMonth(period.endMonth),
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

  const segmentEnd = resolveContinuousDcOccupancySegmentEnd(
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

/**
 * 積立開始月から、同一加入区分が連続する最後の月。
 * 開始月に対象収入がない場合は制度上限まで（職歴で切れない）。
 */
export function resolveContinuousDcOccupancySegmentEnd(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  startAge: number,
  startMonth: number,
): { endAge: number; endMonth: number } {
  const statutory = resolveDcStatutoryContributionEndCap(member);
  const statutoryIndex = ageMonthIndex(statutory.endAge, statutory.endMonth);
  const startProfile = resolveIncomeProfileAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
  );
  const startOcc = occupancyFromIncomeCategory(startProfile.category);
  if (!startProfile.hasActiveIncomeBlock || !startOcc) {
    return statutory;
  }

  let lastAge = startAge;
  let lastMonth = clampMonth(startMonth);
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
    if (!isMatchingDcOccupancyProfile(profile, startOcc)) break;

    lastAge = cursor.age;
    lastMonth = cursor.month;
  }

  return { endAge: lastAge, endMonth: lastMonth };
}

/**
 * 積立開始月から、企業型DC対象の就労（会社員・パート等）が連続する最後の月。
 * 開始月に対象収入がない場合は制度上限まで（職歴で切れない）。
 * @deprecated 加入区分指定時は resolveContinuousDcOccupancySegmentEnd を使う
 */
export function resolveContinuousCorporateDcEmploymentSegmentEnd(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  startAge: number,
  startMonth: number,
): { endAge: number; endMonth: number } {
  const statutory = resolveDcStatutoryContributionEndCap(member);
  const statutoryIndex = ageMonthIndex(statutory.endAge, statutory.endMonth);

  const startProfile = resolveIncomeProfileAtAgeMonth(
    member,
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
  );
  if (!isCorporateDcEligibleProfile(startProfile)) {
    return statutory;
  }

  let lastAge = startAge;
  let lastMonth = clampMonth(startMonth);
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
    if (!isCorporateDcEligibleProfile(profile)) break;

    lastAge = cursor.age;
    lastMonth = cursor.month;
  }

  return { endAge: lastAge, endMonth: lastMonth };
}

/**
 * 拠出終了の上限 = min(制度上限70歳, 積立開始からの同一区分連続終了)。
 * incomeEntries / 積立開始を渡さない場合は制度上限のみ。
 */
export function resolveDcContributionEndCap(
  member: FamilyMember | Pick<FamilyMember, 'birthMonth'>,
  options?: {
    incomeEntries: IncomeEntry[];
    referenceDate: Date;
    startAge: number;
    startMonth: number;
    occupancy?: DcOccupancy;
  },
): { endAge: number; endMonth: number } {
  const statutory = resolveDcStatutoryContributionEndCap(member);
  if (!options || !('age' in member) || !('role' in member)) {
    return statutory;
  }
  const fullMember = member as FamilyMember;
  const occupancy =
    options.occupancy ??
    resolveDcOccupancy(fullMember, options.incomeEntries, options.referenceDate, {
      age: options.startAge,
      month: options.startMonth,
    });
  const segment = resolveContinuousDcOccupancySegmentEnd(
    fullMember,
    options.incomeEntries,
    options.referenceDate,
    options.startAge,
    options.startMonth,
  );
  // 開始月の区分が選択区分と異なる場合は「対象就労の連続」へフォールバック
  const startProfile = resolveIncomeProfileAtAgeMonth(
    fullMember,
    options.incomeEntries,
    options.referenceDate,
    options.startAge,
    options.startMonth,
  );
  const startOcc = occupancyFromIncomeCategory(startProfile.category);
  const resolved =
    startOcc === occupancy
      ? segment
      : resolveContinuousCorporateDcEmploymentSegmentEnd(
          fullMember,
          options.incomeEntries,
          options.referenceDate,
          options.startAge,
          options.startMonth,
        );
  return minAgeMonth(statutory, {
    endAge: resolved.endAge,
    endMonth: resolved.endMonth,
  });
}

export type DcContributionEnsureContext = {
  incomeEntries?: IncomeEntry[];
  referenceDate?: Date;
};

/** 加入区分を選び、対応する積立期間を反映したエントリを返す */
export function applyDcOccupancySelection(
  entry: SavingsEntry,
  occupancy: DcOccupancy,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry {
  const period = resolveDcContributionPeriodForOccupancy(
    occupancy,
    member,
    incomeEntries,
    referenceDate,
  );
  return clampDcContributionPeriod(
    {
      ...entry,
      dcOccupancy: occupancy,
      startAge: period.startAge,
      startMonth: period.startMonth,
      endMode: 'until',
      endAge: period.endAge,
      endMonth: period.endMonth,
    },
    member,
    incomeEntries,
    referenceDate,
  );
}

/**
 * 企業型DCの積立期間を補正する。
 * - endMode は常に until（一生涯不可）
 * - 終了は制度上限 ∩ 同一加入区分の連続終了を超えない
 */
export function clampDcContributionPeriod(
  entry: SavingsEntry,
  member: Pick<FamilyMember, 'age' | 'birthMonth'> | FamilyMember,
  incomeEntries: IncomeEntry[] = [],
  referenceDate: Date = new Date(),
): SavingsEntry {
  if (!isDcCategory(entry.category)) return entry;

  const startAge = Math.max(0, Number(entry.startAge) || resolveMemberAge(member));
  const startMonth = clampMonth(entry.startMonth);
  const occupancy =
    isDcOccupancy(entry.dcOccupancy) && 'role' in member
      ? entry.dcOccupancy
      : 'role' in member
        ? resolveDcOccupancy(member as FamilyMember, incomeEntries, referenceDate, {
            age: startAge,
            month: startMonth,
          })
        : 'employee';

  const cap = resolveDcContributionEndCap(member, {
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
    occupancy,
  });
  const capIndex = ageMonthIndex(cap.endAge, cap.endMonth);

  let endAge = entry.endMode === 'lifetime' ? cap.endAge : entry.endAge;
  let endMonth = entry.endMode === 'lifetime' ? cap.endMonth : entry.endMonth;
  endAge = Math.max(0, Number(endAge) || cap.endAge);
  endMonth = clampMonth(endMonth);

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
    entry.startMonth === nextStartMonth &&
    entry.dcOccupancy === occupancy
  ) {
    return entry;
  }

  return {
    ...entry,
    dcOccupancy: occupancy,
    endMode: 'until',
    endAge,
    endMonth,
    startAge: nextStartAge,
    startMonth: nextStartMonth,
  };
}

/**
 * 既存の contribution* を事業主掛金へ読み替え、加入者掛金を既定 none にする。
 * contribution* は事業主側のミラーとして同期する。
 */
export function ensureDcContributionFields(
  entry: SavingsEntry,
  member?: Pick<FamilyMember, 'age' | 'birthMonth'> | FamilyMember,
  ctx?: DcContributionEnsureContext,
): SavingsEntry {
  if (!isDcCategory(entry.category)) return entry;

  const legacyMode = resolveSavingsContributionMode(entry.contributionMode);
  const legacyMan = Math.max(0, Number(entry.contributionMan) || 0);

  const employerMode =
    entry.employerContributionMode != null
      ? resolveSavingsContributionMode(entry.employerContributionMode)
      : legacyMode;
  const employerMan =
    entry.employerContributionMan != null
      ? Math.max(0, Number(entry.employerContributionMan) || 0)
      : legacyMan;

  const employeeMode = resolveSavingsContributionMode(
    entry.employeeContributionMode,
  );
  const employeeMan = Math.max(0, Number(entry.employeeContributionMan) || 0);

  let next: SavingsEntry = {
    ...entry,
    employerContributionMode: employerMode,
    employerContributionMan: employerMode === 'none' ? 0 : employerMan,
    employeeContributionMode: employeeMode,
    employeeContributionMan: employeeMode === 'none' ? 0 : employeeMan,
    contributionMode: employerMode,
    contributionMan: employerMode === 'none' ? 0 : employerMan,
  };

  // 旧・複数区間データがあれば先頭区間の掛金と期間境界へ畳む
  const legacySegments = (
    entry as SavingsEntry & {
      contributionSegments?: Array<{
        startAge: number;
        startMonth: number;
        endAge: number;
        endMonth: number;
        employerContributionMode?: SavingsContributionMode;
        employerContributionMan?: number;
        employeeContributionMode?: SavingsContributionMode;
        employeeContributionMan?: number;
      }>;
    }
  ).contributionSegments;
  if (Array.isArray(legacySegments) && legacySegments.length > 0) {
    const primary = legacySegments[0];
    let start = legacySegments[0];
    let end = legacySegments[0];
    for (const seg of legacySegments) {
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
    const empMode = resolveSavingsContributionMode(
      primary.employerContributionMode,
    );
    const eeMode = resolveSavingsContributionMode(
      primary.employeeContributionMode,
    );
    next = {
      ...next,
      startAge: start.startAge,
      startMonth: clampMonth(start.startMonth),
      endMode: 'until',
      endAge: end.endAge,
      endMonth: clampMonth(end.endMonth),
      employerContributionMode: empMode,
      employerContributionMan:
        empMode === 'none'
          ? 0
          : Math.max(0, Number(primary.employerContributionMan) || 0),
      employeeContributionMode: eeMode,
      employeeContributionMan:
        eeMode === 'none'
          ? 0
          : Math.max(0, Number(primary.employeeContributionMan) || 0),
      contributionMode: empMode,
      contributionMan:
        empMode === 'none'
          ? 0
          : Math.max(0, Number(primary.employerContributionMan) || 0),
    };
    delete (next as { contributionSegments?: unknown }).contributionSegments;
  }

  if (next.endMode === 'lifetime' || next.endAge > CORPORATE_DC_CONTRIBUTION_MAX_AGE) {
    const fallbackEndAge = Math.min(
      Math.max(0, Number(next.endAge) || CORPORATE_DC_CONTRIBUTION_MAX_AGE),
      CORPORATE_DC_CONTRIBUTION_MAX_AGE,
    );
    next = {
      ...next,
      endMode: 'until',
      endAge: fallbackEndAge,
      endMonth: clampMonth(next.endMonth || 12),
    };
  }

  if (member) {
    next = clampDcContributionPeriod(
      next,
      member,
      ctx?.incomeEntries ?? [],
      ctx?.referenceDate ?? new Date(),
    );
  }

  if (
    next.employerContributionMode === entry.employerContributionMode &&
    next.employerContributionMan === entry.employerContributionMan &&
    next.employeeContributionMode === entry.employeeContributionMode &&
    next.employeeContributionMan === entry.employeeContributionMan &&
    next.contributionMode === entry.contributionMode &&
    next.contributionMan === entry.contributionMan &&
    next.endMode === entry.endMode &&
    next.endAge === entry.endAge &&
    next.endMonth === entry.endMonth &&
    next.startAge === entry.startAge &&
    next.startMonth === entry.startMonth &&
    next.dcOccupancy === entry.dcOccupancy
  ) {
    return entry;
  }
  return next;
}

function amountForMonth(
  mode: SavingsContributionMode,
  amountMan: number,
  startMonth: number,
  calendarMonth: number,
): number {
  if (mode === 'none') return 0;
  const amount = Math.max(0, Number(amountMan) || 0);
  if (amount <= 0) return 0;
  if (mode === 'monthly') return amount;
  return calendarMonth === startMonth ? amount : 0;
}

/** 指定年齢月の DC 掛金。積立期間外は 0 */
export function resolveDcContributionAmountsAtAgeMonth(
  entry: SavingsEntry,
  age: number,
  month: number,
  member?: Pick<FamilyMember, 'age' | 'birthMonth'> | FamilyMember,
  birthYear?: number,
): { employerMan: number; employeeMan: number } {
  if (!isDcCategory(entry.category)) {
    return { employerMan: 0, employeeMan: 0 };
  }
  const ensured = member
    ? ensureDcContributionFields(entry, member)
    : ensureDcContributionFields(entry);
  const m = clampMonth(month);
  const birthMonth = member
    ? resolveMemberBirthMonth(member)
    : 1;
  const resolvedBirthYear =
    birthYear ??
    (member
      ? calcBirthYear(member.age, member.birthMonth, new Date())
      : 2000);
  if (
    !isAgeCalendarMonthInRange(
      age,
      m,
      ensured.startAge,
      ensured.startMonth,
      ensured.endAge,
      ensured.endMonth,
      resolvedBirthYear,
      birthMonth,
    )
  ) {
    return { employerMan: 0, employeeMan: 0 };
  }
  return {
    employerMan: amountForMonth(
      resolveSavingsContributionMode(ensured.employerContributionMode),
      ensured.employerContributionMan ?? 0,
      ensured.startMonth,
      m,
    ),
    employeeMan: amountForMonth(
      resolveSavingsContributionMode(ensured.employeeContributionMode),
      ensured.employeeContributionMan ?? 0,
      ensured.startMonth,
      m,
    ),
  };
}

/** 企業型DC・事業主掛金の当該暦月分（万円）※期間判定なし */
export function calcDcEmployerContributionManForMonth(
  entry: SavingsEntry,
  calendarMonth: number,
): number {
  const ensured = ensureDcContributionFields(entry);
  return amountForMonth(
    resolveSavingsContributionMode(ensured.employerContributionMode),
    ensured.employerContributionMan ?? 0,
    entry.startMonth,
    calendarMonth,
  );
}

/** 企業型DC・加入者掛金（選択型）の当該暦月分（万円）※期間判定なし */
export function calcDcEmployeeContributionManForMonth(
  entry: SavingsEntry,
  calendarMonth: number,
): number {
  const ensured = ensureDcContributionFields(entry);
  return amountForMonth(
    resolveSavingsContributionMode(ensured.employeeContributionMode),
    ensured.employeeContributionMan ?? 0,
    entry.startMonth,
    calendarMonth,
  );
}

/** メンバーの選択型DC加入者掛金（暦月・万円）。標準報酬の控除に使用 */
export function calcMemberSelectiveDcManForMonth(
  member: FamilyMember,
  savingsState: SavingsState | undefined,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (!savingsState) return 0;
  const entries = savingsState.byMember[member.id] ?? [];
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;
  let total = 0;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  for (const entry of entries) {
    if (!isDcCategory(entry.category)) continue;
    total += resolveDcContributionAmountsAtAgeMonth(
      entry,
      ageMonth.age,
      ageMonth.month,
      member,
      birthYear,
    ).employeeMan;
  }
  return total;
}

/** 世帯の選択型DC加入者掛金（指定年・月範囲・万円） */
export function calcHouseholdSelectiveDcManForYear(input: {
  savingsState: SavingsState;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
}): number {
  let total = 0;
  for (const [memberId, list] of Object.entries(input.savingsState.byMember)) {
    const member = input.familyMembers.find((m) => m.id === memberId);
    if (!member) continue;
    for (const entry of list) {
      if (!isDcCategory(entry.category)) continue;
      for (let month = input.monthStart; month <= input.monthEnd; month += 1) {
        const ageMonth = getMemberAgeMonth(
          member,
          input.referenceDate,
          input.calendarYear,
          month,
        );
        if (!ageMonth) continue;
        total += resolveDcContributionAmountsAtAgeMonth(
          entry,
          ageMonth.age,
          ageMonth.month,
          member,
          calcBirthYear(member.age, member.birthMonth, input.referenceDate),
        ).employeeMan;
      }
    }
  }
  return total;
}

/**
 * 給与内訳に選択型DCを振り替える（合計不変）。
 * 加入者掛金分を主たる給与ストリームから減らし selectiveDc に移す。
 */
export function reclassifySalaryForSelectiveDc(
  salary: {
    socialInsurance: number;
    civilMutual: number;
    nationalInsurance: number;
    selectiveDc: number;
  },
  selectiveDcMan: number,
): {
  socialInsurance: number;
  civilMutual: number;
  nationalInsurance: number;
  selectiveDc: number;
} {
  const amount = Math.max(0, selectiveDcMan);
  if (amount <= 0) return { ...salary };

  const next = {
    socialInsurance: Math.max(0, salary.socialInsurance),
    civilMutual: Math.max(0, salary.civilMutual),
    nationalInsurance: Math.max(0, salary.nationalInsurance),
    selectiveDc: Math.max(0, salary.selectiveDc),
  };

  let remaining = amount;
  const streams = (
    ['socialInsurance', 'civilMutual', 'nationalInsurance'] as const
  )
    .slice()
    .sort((a, b) => next[b] - next[a]);

  for (const key of streams) {
    if (remaining <= 0) break;
    const take = Math.min(next[key], remaining);
    next[key] -= take;
    remaining -= take;
  }
  next.selectiveDc += amount - remaining;
  return next;
}
