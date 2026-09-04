import {
  getMemberDependentDefaults,
  usesQ1DependentDefaults,
} from './memberDependentDefaults';
import type { FamilyMember, FamilyMemberRole } from '../types/family';
import type {
  DependentStatus,
  IncomeBonus,
  IncomeCategory,
  IncomeEntry,
  IncomePeriod,
  IncomeStreamType,
  RetirementAllowanceEntry,
} from '../types/income';
import { calcAnnualAmountMan } from './incomeAmount';
import {
  CATEGORY_TO_STREAM,
  incomeCategoryShowsRetirementAllowance,
} from './incomeLabels';
import { resolveDefaultStartAgeMonth } from './simulationTiming';

function createId(): string {
  return crypto.randomUUID();
}

type LegacyIncomePeriod = Omit<
  IncomePeriod,
  | 'streamType'
  | 'monthlyAmountMan'
  | 'bonuses'
  | 'annualAmountMan'
  | 'dependentStatus'
  | 'taxDependent'
  | 'socialInsuranceDependent'
  | 'spouseContingencyRate'
  | 'annualIncreaseRate'
> &
  Partial<
    Pick<
      IncomePeriod,
      | 'streamType'
      | 'monthlyAmountMan'
      | 'bonuses'
      | 'annualAmountMan'
      | 'dependentStatus'
      | 'taxDependent'
      | 'socialInsuranceDependent'
      | 'spouseContingencyRate'
      | 'annualIncreaseRate'
    >
  >;

type LegacyIncomeEntry = Omit<
  IncomeEntry,
  | 'periods'
  | 'expenseManPerMonth'
  | 'filingType'
  | 'retirementAllowances'
> &
  Partial<
    Pick<
      IncomeEntry,
      | 'expenseManPerMonth'
      | 'filingType'
      | 'retirementAllowances'
    >
  > & {
    /** @deprecated UI削除済み。読み込み時は無視する */
    kenpoContinuationYears?: number | null;
    /** 旧ブロック単位の扶養区分（期間へ移行） */
    dependentStatus?: DependentStatus;
    streamType?: IncomeStreamType;
    monthlyAmountMan?: number;
    bonuses?: IncomeBonus[];
    annualAmountMan?: number;
    spouseContingencyRate?: number | null;
    annualIncreaseRate?: number | null;
    spouseContingencyOnly?: boolean;
    isNewIncomeFromStart?: boolean;
    periods: LegacyIncomePeriod[];
  };

function migrateRetirementAllowance(
  raw: Partial<RetirementAllowanceEntry> & {
    id?: string;
    /** @deprecated */
    enrollmentYearsOverride?: number | null;
  },
): RetirementAllowanceEntry {
  const receiveAge = Math.max(0, Number(raw.receiveAge) || 60);
  const receiveMonth = Math.min(12, Math.max(1, Number(raw.receiveMonth) || 3));
  const legacyOverride =
    raw.enrollmentYearsOverride == null
      ? null
      : Math.max(1, Math.floor(Number(raw.enrollmentYearsOverride) || 1));
  const enrollmentYears = Math.max(
    1,
    Math.floor(
      Number(raw.enrollmentYears) ||
        legacyOverride ||
        30,
    ),
  );
  const enrollmentMode =
    raw.enrollmentMode === 'period' || raw.enrollmentMode === 'years'
      ? raw.enrollmentMode
      : 'years';
  return {
    id: raw.id ?? createId(),
    amountMan: Math.max(0, Number(raw.amountMan) || 0),
    receiveAge,
    receiveMonth,
    enrollmentMode,
    enrollmentYears,
    enrollmentStartAge: Math.max(
      0,
      Number(raw.enrollmentStartAge) || Math.max(0, receiveAge - enrollmentYears),
    ),
    enrollmentStartMonth: Math.min(
      12,
      Math.max(1, Number(raw.enrollmentStartMonth) || 4),
    ),
    enrollmentEndAge: Math.max(
      0,
      Number(raw.enrollmentEndAge) || receiveAge,
    ),
    enrollmentEndMonth: Math.min(
      12,
      Math.max(1, Number(raw.enrollmentEndMonth) || receiveMonth),
    ),
  };
}

function migrateIncomePeriod(
  period: LegacyIncomePeriod,
  entryFallback: {
    streamType: IncomeStreamType;
    monthlyAmountMan: number;
    bonuses: IncomeBonus[];
    dependentStatus: DependentStatus;
    spouseContingencyRate: number | null;
    annualIncreaseRate: number | null;
  },
): IncomePeriod {
  const monthlyAmountMan =
    period.monthlyAmountMan ?? entryFallback.monthlyAmountMan;
  const bonuses = period.bonuses ?? entryFallback.bonuses;
  return {
    id: period.id,
    startAge: period.startAge,
    startMonth: period.startMonth,
    endAge: period.endAge,
    endMonth: period.endMonth,
    streamType: period.streamType ?? entryFallback.streamType,
    monthlyAmountMan,
    bonuses,
    annualAmountMan:
      period.annualAmountMan ??
      calcAnnualAmountMan(monthlyAmountMan, bonuses),
    ...resolvePeriodDependentFields(period, entryFallback.dependentStatus),
    spouseContingencyRate:
      period.spouseContingencyRate ?? entryFallback.spouseContingencyRate,
    annualIncreaseRate:
      period.annualIncreaseRate ?? entryFallback.annualIncreaseRate,
    lumpSumRestoreEndAge: period.lumpSumRestoreEndAge ?? null,
    lumpSumRestoreEndMonth: period.lumpSumRestoreEndMonth ?? null,
  };
}

function defaultDependentStatus(memberRole?: FamilyMemberRole): DependentStatus {
  return memberRole === 'spouse' ? 'dependent' : 'none';
}

function dependentFlagsForStatus(
  dependentStatus: DependentStatus,
): Pick<IncomePeriod, 'taxDependent' | 'socialInsuranceDependent'> {
  if (dependentStatus === 'dependent') {
    return { taxDependent: false, socialInsuranceDependent: false };
  }
  return { taxDependent: false, socialInsuranceDependent: false };
}

function resolvePeriodDependentFields(
  period: LegacyIncomePeriod,
  fallbackStatus: DependentStatus,
): Pick<
  IncomePeriod,
  'dependentStatus' | 'taxDependent' | 'socialInsuranceDependent'
> {
  const dependentStatus = period.dependentStatus ?? fallbackStatus;
  const defaults = dependentFlagsForStatus(dependentStatus);
  return {
    dependentStatus,
    taxDependent: period.taxDependent ?? defaults.taxDependent,
    socialInsuranceDependent:
      period.socialInsuranceDependent ?? defaults.socialInsuranceDependent,
  };
}

export function migrateIncomeEntry(
  entry: LegacyIncomeEntry,
  memberRole?: FamilyMemberRole,
): IncomeEntry {
  const category = entry.category;
  const streamType = entry.streamType ?? CATEGORY_TO_STREAM[category];
  const monthlyAmountMan =
    entry.monthlyAmountMan ?? (category === 'employee' ? 50 : 30);
  const bonuses = entry.bonuses ?? [];
  const fallback = {
    streamType,
    monthlyAmountMan,
    bonuses,
    dependentStatus:
      entry.dependentStatus ?? defaultDependentStatus(memberRole),
    spouseContingencyRate: entry.spouseContingencyRate ?? null,
    annualIncreaseRate: entry.annualIncreaseRate ?? 0,
  };

  return {
    id: entry.id,
    memberId: entry.memberId,
    category,
    isNewIncomeFromStart: entry.isNewIncomeFromStart ?? false,
    periods: entry.periods.map((period) =>
      migrateIncomePeriod(period, fallback),
    ),
    retirementAllowances: incomeCategoryShowsRetirementAllowance(category)
      ? (entry.retirementAllowances ?? []).map(migrateRetirementAllowance)
      : [],
    expenseManPerMonth:
      entry.expenseManPerMonth ??
      (category === 'self_employed' || category === 'other' ? 0 : null),
    filingType:
      entry.filingType ?? (category === 'self_employed' ? 'blue_65' : null),
  };
}

export function migrateIncomeByMember(
  incomeByMember: Record<string, LegacyIncomeEntry[]>,
  memberRoles?: Record<string, FamilyMemberRole>,
): Record<string, IncomeEntry[]> {
  const result: Record<string, IncomeEntry[]> = {};
  for (const [memberId, entries] of Object.entries(incomeByMember)) {
    result[memberId] = entries.map((entry) =>
      migrateIncomeEntry(entry, memberRoles?.[memberId]),
    );
  }
  return result;
}

export function createDefaultPeriod(
  memberAge: number | null | undefined,
  referenceMonth: number,
  streamType: IncomeStreamType,
  monthlyAmountMan = 50,
  member?: FamilyMember,
): IncomePeriod {
  const bonuses: IncomeBonus[] = [];
  const dependentFields =
    member && usesQ1DependentDefaults(member)
      ? getMemberDependentDefaults(member)
      : {
          dependentStatus: defaultDependentStatus(member?.role),
          ...dependentFlagsForStatus(defaultDependentStatus(member?.role)),
        };
  // 60歳超で非就労想定の場合は、就労履歴を過去期間として持たせる
  const age = memberAge ?? 0;
  const useCareerHistory = age > 60;
  const defaultStart = resolveDefaultStartAgeMonth(memberAge, referenceMonth);
  return {
    id: createId(),
    startAge: useCareerHistory ? 25 : defaultStart.startAge,
    startMonth: useCareerHistory ? 4 : defaultStart.startMonth,
    endAge: useCareerHistory ? 60 : Math.max(60, age),
    endMonth: 3,
    streamType,
    monthlyAmountMan,
    bonuses,
    annualAmountMan: calcAnnualAmountMan(monthlyAmountMan, bonuses),
    ...dependentFields,
    spouseContingencyRate: null,
    annualIncreaseRate: 0,
    lumpSumRestoreEndAge: null,
    lumpSumRestoreEndMonth: null,
  };
}

export function createIncomeEntry(
  memberId: string,
  category: IncomeCategory,
  memberAge: number | null | undefined = 40,
  referenceMonth = 1,
  member?: FamilyMember,
): IncomeEntry {
  const streamType = CATEGORY_TO_STREAM[category];
  const monthlyAmountMan = category === 'employee' ? 50 : 30;

  return {
    id: createId(),
    memberId,
    category,
    isNewIncomeFromStart: false,
    periods: [
      createDefaultPeriod(
        memberAge,
        referenceMonth,
        streamType,
        monthlyAmountMan,
        member,
      ),
    ],
    retirementAllowances: [],
    expenseManPerMonth:
      category === 'self_employed' || category === 'other' ? 0 : null,
    filingType: category === 'self_employed' ? 'blue_65' : null,
  };
}

/** 本業給与に加える副業・事業収入（社保は本業側のまま） */
export function createSideBusinessIncomeEntry(
  memberId: string,
  memberAge: number | null | undefined = 40,
  referenceMonth = 1,
  member?: FamilyMember,
): IncomeEntry {
  return {
    ...createIncomeEntry(
      memberId,
      'self_employed',
      memberAge,
      referenceMonth,
      member,
    ),
    incomePurpose: 'side_business',
    expenseManPerMonth: 0,
    filingType: 'blue_65',
    periods: [
      createDefaultPeriod(
        memberAge,
        referenceMonth,
        'business_national_insurance',
        10,
        member,
      ),
    ],
  };
}

export function createDefaultHeadIncome(
  member: FamilyMember,
  referenceMonth = 6,
): IncomeEntry[] {
  return [
    createIncomeEntry(
      member.id,
      'employee',
      member.age,
      referenceMonth,
      member,
    ),
  ];
}
