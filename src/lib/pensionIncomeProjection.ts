import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import { calcBirthYear, isAgeCalendarMonthInRange } from './birthDate';
import { calcAnnualAmountMan } from './incomeAmount';
import type { FamilyMember } from '../types/family';
import type { IncomeCategory, IncomeEntry, IncomeStreamType } from '../types/income';
import { ASSUMED_EMPLOYMENT_START_AGE } from './pensionConstants';

/** 22歳時点の年収（会社員・公務員・自営業） */
export const CAREER_START_ANNUAL_STANDARD_YEN = 2_400_000;

/** 22歳時点の年収（アルバイト・パート） */
export const CAREER_START_ANNUAL_PART_TIME_YEN = 1_800_000;

export type CurrentWorkSituation =
  | 'employee'
  | 'civil_servant'
  | 'self_employed'
  | 'part_time'
  | 'not_working';

export interface CurrentWorkProfile {
  situation: CurrentWorkSituation;
  /** 現時点の年収（円） */
  currentAnnualYen: number;
  /** 厚生年金に加入する働き方か */
  hasEmployeesPension: boolean;
  employeesKind: 'general' | 'publicServant' | null;
}

function findActivePeriodAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  birthYear: number,
  birthMonth: number,
): {
  category: IncomeCategory;
  streamType: IncomeStreamType;
  monthlyAmountMan: number;
  bonuses: IncomeEntry['periods'][number]['bonuses'];
} | null {
  for (const entry of entries) {
    for (const period of entry.periods) {
      if (
        isAgeCalendarMonthInRange(
          age,
          month,
          period.startAge,
          period.startMonth,
          period.endAge,
          period.endMonth,
          birthYear,
          birthMonth,
        )
      ) {
        return {
          category: entry.category,
          streamType: period.streamType,
          monthlyAmountMan: period.monthlyAmountMan,
          bonuses: period.bonuses,
        };
      }
    }
  }
  return null;
}

function resolveEmployeesKind(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): 'general' | 'publicServant' | null {
  switch (category) {
    case 'employee':
    case 'part_time':
      if (streamType === 'salary_social_insurance') return 'general';
      if (streamType === 'salary_civil_mutual') return 'publicServant';
      return null;
    case 'civil_servant':
      return 'publicServant';
    default:
      return null;
  }
}

function mapCategoryToSituation(
  category: IncomeCategory,
): CurrentWorkSituation | null {
  switch (category) {
    case 'employee':
      return 'employee';
    case 'civil_servant':
      return 'civil_servant';
    case 'self_employed':
      return 'self_employed';
    case 'part_time':
      return 'part_time';
    default:
      return null;
  }
}

/**
 * 基準日時点の働き方を判定する。
 * 該当する収入がなければ「現時点で働いていない」。
 */
export function resolveCurrentWorkProfile(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): CurrentWorkProfile {
  const referenceMonth = referenceDate.getMonth() + 1;
  const active = findActivePeriodAtAgeMonth(
    entries,
    resolveMemberAge(member),
    referenceMonth,
    calcBirthYear(member.age, member.birthMonth, referenceDate),
    resolveMemberBirthMonth(member),
  );

  if (!active) {
    return {
      situation: 'not_working',
      currentAnnualYen: 0,
      hasEmployeesPension: false,
      employeesKind: null,
    };
  }

  const situation = mapCategoryToSituation(active.category);
  if (!situation) {
    return {
      situation: 'not_working',
      currentAnnualYen: 0,
      hasEmployeesPension: false,
      employeesKind: null,
    };
  }

  const employeesKind = resolveEmployeesKind(
    active.category,
    active.streamType,
  );

  return {
    situation,
    currentAnnualYen: calcAnnualAmountMan(
      active.monthlyAmountMan,
      active.bonuses,
    ) * 10000,
    hasEmployeesPension: employeesKind !== null,
    employeesKind,
  };
}

export function getCareerStartAnnualYen(situation: CurrentWorkSituation): number {
  if (situation === 'part_time') {
    return CAREER_START_ANNUAL_PART_TIME_YEN;
  }
  if (
    situation === 'employee' ||
    situation === 'civil_servant' ||
    situation === 'self_employed'
  ) {
    return CAREER_START_ANNUAL_STANDARD_YEN;
  }
  return 0;
}

/**
 * 22歳から現年齢まで、毎年一定額ずつ変動して現時点年収に到達するよう線形補間。
 */
export function interpolateCareerAnnualIncomeYen(
  age: number,
  currentAge: number,
  startAnnualYen: number,
  currentAnnualYen: number,
): number {
  if (age <= ASSUMED_EMPLOYMENT_START_AGE) {
    return startAnnualYen;
  }
  if (currentAge <= ASSUMED_EMPLOYMENT_START_AGE) {
    return currentAnnualYen;
  }
  if (age >= currentAge) {
    return currentAnnualYen;
  }

  const ratio =
    (age - ASSUMED_EMPLOYMENT_START_AGE) /
    (currentAge - ASSUMED_EMPLOYMENT_START_AGE);
  return startAnnualYen + (currentAnnualYen - startAnnualYen) * ratio;
}

export function careerAnnualIncomeToMonthlyMan(annualYen: number): number {
  return annualYen / 12 / 10000;
}
