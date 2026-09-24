import {
  absoluteMonthIndexFromMemberAgeMonth,
  absoluteMonthIndexFromPeriodAgeMonth,
  calcBirthYear,
  getMemberAgeMonth,
} from './birthDate';
import { resolveMemberYearIncomeProfile } from './memberYearIncome';
import type {
  FamilyMember,
  PensionChildLivelihoodStatus,
} from '../types/family';
import type { IncomeEntry } from '../types/income';

const PENSION_LIVELIHOOD_GROSS_INCOME_LIMIT_MAN = 850;
const PENSION_LIVELIHOOD_TOTAL_INCOME_LIMIT_MAN = 655.5;

function resolveMemberInHeadHousehold(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean | null {
  if (member.role === 'head') return true;

  const period = member.householdPeriod;
  if (period.mode === 'lifetime') return true;

  // 「最終学歴にあわせる」はQ2の教育データとの突合が必要。
  // 年金計算だけで推測せず、例外確認へ回す。
  if (period.mode === 'by_education') return null;

  if (member.age == null || member.birthMonth == null) return null;
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return null;

  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
    member.birthDay,
  );
  const current = absoluteMonthIndexFromMemberAgeMonth(
    birthYear,
    member.birthMonth,
    ageMonth.age,
    calendarMonth,
  );
  const end = absoluteMonthIndexFromPeriodAgeMonth(
    birthYear,
    period.endAge,
    period.endMonth,
  );
  return current <= end;
}

function resolveSameLivelihoodRelationship(
  child: FamilyMember,
  pensioner: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): boolean | null {
  const childWithHead = resolveMemberInHeadHousehold(
    child,
    referenceDate,
    calendarYear,
    calendarMonth,
  );

  if (pensioner.role === 'head') {
    return childWithHead;
  }

  const pensionerWithHead = resolveMemberInHeadHousehold(
    pensioner,
    referenceDate,
    calendarYear,
    calendarMonth,
  );

  // 子と受給者の双方が世帯主と生計を一にしていれば、
  // 同一世帯の入力事実から生計同一を確認できる。
  if (childWithHead === true && pensionerWithHead === true) return true;

  // 世帯主以外の受給者では、世帯主との生計同一が外れていても
  // 子と受給者が別途生計を一にしている可能性があるため断定しない。
  return null;
}

function resolveChildIncomeRequirement(
  child: FamilyMember,
  childIncomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
): boolean | null {
  const incomeReferenceYear = calendarYear - 1;
  const profile = resolveMemberYearIncomeProfile(
    child,
    childIncomeEntries,
    referenceDate,
    incomeReferenceYear,
  );

  if (childIncomeEntries.length > 0) {
    // 収入カードはあるが前年に有効期間がない場合は、試算上の前年収入は0円と確認できる。
    if (!profile.hasActiveIncomeBlock) return true;

    if (
      profile.grossIncomeMan < PENSION_LIVELIHOOD_GROSS_INCOME_LIMIT_MAN ||
      profile.totalIncomeMan < PENSION_LIVELIHOOD_TOTAL_INCOME_LIMIT_MAN
    ) {
      return true;
    }

    // 基準超過でも、おおむね5年以内に基準未満となる見込み等の個別認定があり得る。
    // Q7の数値だけで「満たさない」と断定しない。
    return null;
  }

  // Q1で税法上または社会保険上の扶養に入れることが明示されていれば、
  // それぞれの収入基準は年金上の生計維持の収入基準より厳しいため、
  // 収入要件を満たす材料として利用する。
  if (
    child.taxDependentDefault === true ||
    child.socialInsuranceDependentDefault === true
  ) {
    return true;
  }

  return null;
}

export function resolveAutomaticPensionChildLivelihood(input: {
  child: FamilyMember;
  pensioner: FamilyMember;
  childIncomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  calendarMonth: number;
}): PensionChildLivelihoodStatus {
  const {
    child,
    pensioner,
    childIncomeEntries,
    referenceDate,
    calendarYear,
    calendarMonth,
  } = input;

  if (child.role !== 'child') return 'not_met';

  const sameLivelihood = resolveSameLivelihoodRelationship(
    child,
    pensioner,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (sameLivelihood === false) return 'not_met';

  const incomeRequirement = resolveChildIncomeRequirement(
    child,
    childIncomeEntries,
    referenceDate,
    calendarYear,
  );

  if (sameLivelihood === true && incomeRequirement === true) return 'met';
  return 'unknown';
}

/**
 * 通常ケースはQ1/Q7から自動判定する。
 * 自動判定できない場合だけ、旧データまたはQ8の個別確認値をフォールバックに使う。
 */
export function resolvePensionChildLivelihood(input: {
  child: FamilyMember;
  pensioner: FamilyMember;
  childIncomeEntries: IncomeEntry[];
  referenceDate: Date;
  calendarYear: number;
  calendarMonth: number;
}): PensionChildLivelihoodStatus {
  const automatic = resolveAutomaticPensionChildLivelihood(input);
  if (automatic !== 'unknown') return automatic;

  return (
    input.child.pensionChildLivelihoodByMember?.[input.pensioner.id] ?? 'unknown'
  );
}
