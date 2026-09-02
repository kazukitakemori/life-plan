import type { FamilyMember } from '../types/family';
import type { IncomeEntry } from '../types/income';
import type {
  DbEnrollmentMode,
  DcOccupancy,
  SavingsEntry,
} from '../types/savings';
import {
  isDcOccupancy,
  resolveDcContributionEndCap,
  resolveDcContributionPeriodForOccupancy,
  resolveDcOccupancy,
  resolveDcStatutoryContributionEndCap,
} from './dcContribution';
import { calcEnrollmentYearsFromAgeMonths } from './retirementIncomeTax';

/** DB 加入期間の既定年数（会社退職金の勤続年数と同程度の仮値） */
export const DB_ENROLLMENT_DEFAULT_YEARS = 30;

/** 年齢のみ入力時の内部月（年数モード／旧UI互換） */
export const DB_ENROLLMENT_AGE_ONLY_MONTH = 1;

function clampMonth(month: number | undefined): number {
  const value = Number(month) || 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

export function resolveDbEnrollmentMode(
  mode: DbEnrollmentMode | undefined,
): DbEnrollmentMode {
  return mode === 'period' ? 'period' : 'years';
}

/**
 * DB の退職所得控除用加入年数。
 * years … dbEnrollmentYears
 * period … 開始〜終了の月数を年換算（切り上げ）
 */
export function resolveDbEnrollmentYears(entry: SavingsEntry): number {
  if (resolveDbEnrollmentMode(entry.dbEnrollmentMode) === 'period') {
    const startAge = Math.max(0, Number(entry.dbEnrollmentStartAge) || 0);
    const startMonth = clampMonth(
      entry.dbEnrollmentStartMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
    );
    const endAge = Math.max(0, Number(entry.dbEnrollmentEndAge) || 0);
    const endMonth = clampMonth(
      entry.dbEnrollmentEndMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
    );
    return calcEnrollmentYearsFromAgeMonths(
      { age: startAge, month: startMonth },
      { age: endAge, month: endMonth },
    );
  }
  return Math.max(1, Math.floor(Number(entry.dbEnrollmentYears) || 1));
}

/** 図・イベント用の加入開始〜終了（年数モードは受給開始から逆算） */
export function resolveDbEnrollmentPeriod(
  entry: SavingsEntry,
  payout: { age: number; month: number },
): {
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
} {
  if (resolveDbEnrollmentMode(entry.dbEnrollmentMode) === 'period') {
    return {
      startAge: Math.max(0, Number(entry.dbEnrollmentStartAge) || 0),
      startMonth: clampMonth(
        entry.dbEnrollmentStartMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
      ),
      endAge: Math.max(0, Number(entry.dbEnrollmentEndAge) || 0),
      endMonth: clampMonth(
        entry.dbEnrollmentEndMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
      ),
    };
  }
  const years = resolveDbEnrollmentYears(entry);
  const endAge = payout.age;
  const month = DB_ENROLLMENT_AGE_ONLY_MONTH;
  return {
    startAge: Math.max(0, endAge - years),
    startMonth: month,
    endAge,
    endMonth: month,
  };
}

/** 口座に保存された区分があればそれを優先 */
export function resolveEffectiveDbOccupancy(
  entry: Pick<
    SavingsEntry,
    'dbOccupancy' | 'dbEnrollmentStartAge' | 'dbEnrollmentStartMonth'
  >,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): DcOccupancy {
  if (isDcOccupancy(entry.dbOccupancy)) return entry.dbOccupancy;
  return resolveDcOccupancy(member, incomeEntries, referenceDate, {
    age: Math.max(0, Number(entry.dbEnrollmentStartAge) || (member.age ?? 0)),
    month: clampMonth(
      entry.dbEnrollmentStartMonth ?? referenceDate.getMonth() + 1,
    ),
  });
}

/**
 * 加入区分を選び、期間モードで Q7 の同一区分連続期間を反映する。
 */
export function applyDbOccupancySelection(
  entry: SavingsEntry,
  occupancy: DcOccupancy,
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): SavingsEntry {
  if (entry.category !== 'db') return entry;
  const period = resolveDcContributionPeriodForOccupancy(
    occupancy,
    member,
    incomeEntries,
    referenceDate,
  );
  const years = calcEnrollmentYearsFromAgeMonths(
    { age: period.startAge, month: period.startMonth },
    { age: period.endAge, month: period.endMonth },
  );
  return ensureDbEnrollmentFields(
    {
      ...entry,
      dbOccupancy: occupancy,
      dbEnrollmentMode: 'period',
      dbEnrollmentStartAge: period.startAge,
      dbEnrollmentStartMonth: period.startMonth,
      dbEnrollmentEndAge: period.endAge,
      dbEnrollmentEndMonth: period.endMonth,
      dbEnrollmentYears: years,
    },
    member,
    { incomeEntries, referenceDate },
  );
}

export type DbEnrollmentEnsureContext = {
  incomeEntries?: IncomeEntry[];
  referenceDate?: Date;
};

/**
 * 期間モードの加入終了上限 = 加入区分の同一職歴連続終了 ∩ 制度目安（70歳）。
 * 年数モードや非DBでは null。
 */
export function resolveDbEnrollmentEndCap(
  entry: SavingsEntry,
  member: FamilyMember,
  incomeEntries: IncomeEntry[] = [],
  referenceDate: Date = new Date(),
): { endAge: number; endMonth: number } | null {
  if (entry.category !== 'db') return null;
  if (resolveDbEnrollmentMode(entry.dbEnrollmentMode) !== 'period') {
    return null;
  }
  const occupancy = resolveEffectiveDbOccupancy(
    entry,
    member,
    incomeEntries,
    referenceDate,
  );
  const startAge = Math.max(0, Number(entry.dbEnrollmentStartAge) || 0);
  const startMonth = clampMonth(
    entry.dbEnrollmentStartMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
  );
  return resolveDcContributionEndCap(member, {
    incomeEntries,
    referenceDate,
    startAge,
    startMonth,
    occupancy,
  });
}

/**
 * 期間モードかつ加入区分ありのとき、終了を同一区分の連続終了∩制度上限内へ抑える。
 * （DB に拠出上限年齢はないが、企業型と同様 70 歳到達月を目安上限とする）
 */
export function clampDbEnrollmentPeriod(
  entry: SavingsEntry,
  member: FamilyMember,
  incomeEntries: IncomeEntry[] = [],
  referenceDate: Date = new Date(),
): SavingsEntry {
  if (entry.category !== 'db') return entry;
  if (resolveDbEnrollmentMode(entry.dbEnrollmentMode) !== 'period') {
    return entry;
  }

  const occupancy = resolveEffectiveDbOccupancy(
    entry,
    member,
    incomeEntries,
    referenceDate,
  );
  const startAge = Math.max(0, Number(entry.dbEnrollmentStartAge) || 0);
  const startMonth = clampMonth(
    entry.dbEnrollmentStartMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
  );
  const capEnd = resolveDbEnrollmentEndCap(
    entry,
    member,
    incomeEntries,
    referenceDate,
  ) ?? resolveDcStatutoryContributionEndCap(member);

  let endAge = Math.max(0, Number(entry.dbEnrollmentEndAge) || 0);
  let endMonth = clampMonth(
    entry.dbEnrollmentEndMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
  );
  if (
    ageMonthIndex(endAge, endMonth) >
    ageMonthIndex(capEnd.endAge, capEnd.endMonth)
  ) {
    endAge = capEnd.endAge;
    endMonth = capEnd.endMonth;
  }
  if (ageMonthIndex(startAge, startMonth) > ageMonthIndex(endAge, endMonth)) {
    endAge = startAge;
    endMonth = startMonth;
  }

  const years = calcEnrollmentYearsFromAgeMonths(
    { age: startAge, month: startMonth },
    { age: endAge, month: endMonth },
  );

  if (
    entry.dbOccupancy === occupancy &&
    entry.dbEnrollmentStartAge === startAge &&
    entry.dbEnrollmentStartMonth === startMonth &&
    entry.dbEnrollmentEndAge === endAge &&
    entry.dbEnrollmentEndMonth === endMonth &&
    entry.dbEnrollmentYears === years
  ) {
    return entry;
  }

  return {
    ...entry,
    dbOccupancy: occupancy,
    dbEnrollmentStartAge: startAge,
    dbEnrollmentStartMonth: startMonth,
    dbEnrollmentEndAge: endAge,
    dbEnrollmentEndMonth: endMonth,
    dbEnrollmentYears: years,
  };
}

/** DB エントリに加入期間フィールドが無ければ既定を埋める */
export function ensureDbEnrollmentFields(
  entry: SavingsEntry,
  member?: Pick<FamilyMember, 'age'> | FamilyMember,
  ctx?: DbEnrollmentEnsureContext,
): SavingsEntry {
  if (entry.category !== 'db') return entry;

  const payoutAge = Math.max(
    0,
    Number(entry.withdrawalStartAge) || Number(member?.age) || 0,
  );
  const years =
    entry.dbEnrollmentYears != null
      ? Math.max(1, Math.floor(Number(entry.dbEnrollmentYears) || 1))
      : DB_ENROLLMENT_DEFAULT_YEARS;
  const startAge =
    entry.dbEnrollmentStartAge != null
      ? Math.max(0, Number(entry.dbEnrollmentStartAge) || 0)
      : Math.max(0, payoutAge - years);
  const endAge =
    entry.dbEnrollmentEndAge != null
      ? Math.max(0, Number(entry.dbEnrollmentEndAge) || 0)
      : payoutAge;
  const startMonth = clampMonth(
    entry.dbEnrollmentStartMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
  );
  const endMonth = clampMonth(
    entry.dbEnrollmentEndMonth ?? DB_ENROLLMENT_AGE_ONLY_MONTH,
  );

  let next: SavingsEntry = {
    ...entry,
    dbEnrollmentMode: entry.dbEnrollmentMode ?? 'years',
    dbEnrollmentYears: years,
    dbEnrollmentStartAge: startAge,
    dbEnrollmentStartMonth: startMonth,
    dbEnrollmentEndAge: endAge,
    dbEnrollmentEndMonth: endMonth,
  };

  if (
    member &&
    'role' in member &&
    ctx?.incomeEntries &&
    resolveDbEnrollmentMode(next.dbEnrollmentMode) === 'period'
  ) {
    next = clampDbEnrollmentPeriod(
      next,
      member as FamilyMember,
      ctx.incomeEntries,
      ctx.referenceDate ?? new Date(),
    );
  }

  if (
    next.dbEnrollmentMode === entry.dbEnrollmentMode &&
    next.dbEnrollmentYears === entry.dbEnrollmentYears &&
    next.dbEnrollmentStartAge === entry.dbEnrollmentStartAge &&
    next.dbEnrollmentStartMonth === entry.dbEnrollmentStartMonth &&
    next.dbEnrollmentEndAge === entry.dbEnrollmentEndAge &&
    next.dbEnrollmentEndMonth === entry.dbEnrollmentEndMonth &&
    next.dbOccupancy === entry.dbOccupancy
  ) {
    return entry;
  }
  return next;
}

/** createSavingsEntry 用の加入期間初期値 */
export function createDefaultDbEnrollmentFields(
  member: Pick<FamilyMember, 'age'>,
  payoutAge: number,
  _payoutMonth: number = 1,
): Pick<
  SavingsEntry,
  | 'dbEnrollmentMode'
  | 'dbEnrollmentYears'
  | 'dbEnrollmentStartAge'
  | 'dbEnrollmentStartMonth'
  | 'dbEnrollmentEndAge'
  | 'dbEnrollmentEndMonth'
> {
  const years = DB_ENROLLMENT_DEFAULT_YEARS;
  const month = DB_ENROLLMENT_AGE_ONLY_MONTH;
  const endAge = Math.max(member.age ?? 0, payoutAge);
  return {
    dbEnrollmentMode: 'years',
    dbEnrollmentYears: years,
    dbEnrollmentStartAge: Math.max(0, endAge - years),
    dbEnrollmentStartMonth: month,
    dbEnrollmentEndAge: endAge,
    dbEnrollmentEndMonth: month,
  };
}
