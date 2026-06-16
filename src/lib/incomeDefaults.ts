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
} from '../types/income';
import { calcAnnualAmountMan } from './incomeAmount';
import { CATEGORY_TO_STREAM } from './incomeLabels';

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
  'periods' | 'kenpoContinuationYears' | 'expenseManPerMonth' | 'filingType'
> &
  Partial<
    Pick<
      IncomeEntry,
      'kenpoContinuationYears' | 'expenseManPerMonth' | 'filingType'
    >
  > & {
    /** 旧ブロック単位の扶養区分（期間へ移行） */
    dependentStatus?: DependentStatus;
    streamType?: IncomeStreamType;
    monthlyAmountMan?: number;
    bonuses?: IncomeBonus[];
    annualAmountMan?: number;
    spouseContingencyRate?: number | null;
    annualIncreaseRate?: number | null;
    periods: LegacyIncomePeriod[];
  };

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
    return { taxDependent: true, socialInsuranceDependent: true };
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
    annualIncreaseRate: entry.annualIncreaseRate ?? null,
  };

  return {
    id: entry.id,
    memberId: entry.memberId,
    category,
    spouseContingencyOnly: entry.spouseContingencyOnly,
    periods: entry.periods.map((period) =>
      migrateIncomePeriod(period, fallback),
    ),
    kenpoContinuationYears:
      entry.kenpoContinuationYears ?? (category === 'employee' ? 2 : null),
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
  memberAge: number,
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
  return {
    id: createId(),
    startAge: memberAge,
    startMonth: referenceMonth,
    endAge: 60,
    endMonth: 3,
    streamType,
    monthlyAmountMan,
    bonuses,
    annualAmountMan: calcAnnualAmountMan(monthlyAmountMan, bonuses),
    ...dependentFields,
    spouseContingencyRate: null,
    annualIncreaseRate: null,
    lumpSumRestoreEndAge: null,
    lumpSumRestoreEndMonth: null,
  };
}

export function createIncomeEntry(
  memberId: string,
  category: IncomeCategory,
  memberAge = 40,
  referenceMonth = 1,
  member?: FamilyMember,
): IncomeEntry {
  const streamType = CATEGORY_TO_STREAM[category];
  const monthlyAmountMan = category === 'employee' ? 50 : 30;

  return {
    id: createId(),
    memberId,
    category,
    spouseContingencyOnly: false,
    periods: [
      createDefaultPeriod(
        memberAge,
        referenceMonth,
        streamType,
        monthlyAmountMan,
        member,
      ),
    ],
    kenpoContinuationYears: category === 'employee' ? 2 : null,
    expenseManPerMonth:
      category === 'self_employed' || category === 'other' ? 0 : null,
    filingType: category === 'self_employed' ? 'blue_65' : null,
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
