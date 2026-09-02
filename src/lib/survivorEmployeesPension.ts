/**
 * 遺族厚生年金（必要保障額の万一シナリオ）。
 * 受給中の手入力（Q8）とは別に、死亡した人の記録から自動計算する。
 *
 * 参照: 日本年金機構「遺族厚生年金（受給要件・対象者・年金額）」
 * https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150424.html
 *
 * v1 で未対応: 障害厚生による死亡、初診から5年以内の死亡、
 * 経過的寡婦加算、平成19年4月1日前の65歳以上の選択、物価スライド。
 */
import { calcBirthYear, getMemberAgeMonth } from './birthDate';
import {
  CHILDLESS_HUSBAND_MIN_AGE_AT_DEATH,
  CHILDLESS_HUSBAND_PAYMENT_START_AGE,
  CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE,
  DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS,
  MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR,
  MIDDLE_AGED_WIDOW_MIN_AGE,
  PENSION_ENROLLMENT_START_AGE,
  STANDARD_OLD_AGE_START,
  SURVIVOR_EMPLOYEES_DEEMED_MONTHS,
  SURVIVOR_EMPLOYEES_OLD_AGE_QUALIFYING_MONTHS,
  SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE,
  SURVIVOR_PARENT_MIN_AGE_AT_DEATH,
  SURVIVOR_PARENT_PAYMENT_START_AGE,
  SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_MONTH,
  SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR,
  UNIVERSITY_EXEMPTION_END_AGE,
  UNIVERSITY_EXEMPTION_END_MONTH,
  UNIVERSITY_EXEMPTION_START_AGE,
  UNIVERSITY_EXEMPTION_START_MONTH,
} from './pensionConstants';
import { createDefaultPensionMemberState, migrateTeikibinOver50Form } from './pensionDefaults';
import {
  accumulateEmployeesEnrollmentUntilAgeMonth,
  getActiveEmployeesMonthlyRemunerationMan,
  getNationalPensionCreditedMonthCount,
} from './pensionEnrollmentEstimate';
import {
  calcMemberEmployeesProportionalYenPerYear,
  calcMemberMonthlyPensionBreakdownMan,
  getTotalEmployeesMonths,
} from './pensionIncome';
import { toMonthlyMan } from './pensionOldAge';
import { calcProportionalPartAnnualYen } from './pensionProportionalPart';
import {
  listEligibleSurvivorBasicChildren,
  isEligibleSurvivorBasicChild,
} from './survivorBasicPension';
import {
  createEmptySurvivorEmployeesDetail,
  type OldAgePensionBreakdown,
  type SurvivorEmployeesDetail,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';
import type { PensionByMember, PensionMemberState } from '../types/pension';
import type { CalendarYearMonth } from './housingLoanAmortization';
import type { RequiredCoverageSubject } from '../types/requiredCoverage';

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isUniversityExemptionMonth(age: number, month: number): boolean {
  const current = ageMonthIndex(age, month);
  return (
    current >=
      ageMonthIndex(
        UNIVERSITY_EXEMPTION_START_AGE,
        UNIVERSITY_EXEMPTION_START_MONTH,
      ) &&
    current <=
      ageMonthIndex(UNIVERSITY_EXEMPTION_END_AGE, UNIVERSITY_EXEMPTION_END_MONTH)
  );
}

function possibleNationalPensionMonthsUntil(untilAge: number, untilMonth: number): number {
  let count = 0;
  for (let age = PENSION_ENROLLMENT_START_AGE; age < STANDARD_OLD_AGE_START; age++) {
    for (let month = 1; month <= 12; month++) {
      if (ageMonthIndex(age, month) > ageMonthIndex(untilAge, untilMonth)) continue;
      if (isUniversityExemptionMonth(age, month)) continue;
      count += 1;
    }
  }
  return count;
}

export function isEmployeesInsuredAt(
  entries: IncomeEntry[],
  age: number,
  calendarMonth: number,
  birthYear: number,
  birthMonth = 1,
): boolean {
  return (
    getActiveEmployeesMonthlyRemunerationMan(
      entries,
      age,
      calendarMonth,
      birthYear,
      birthMonth,
    ) > 0
  );
}

export function hasTwoThirdsPremiumPaid(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  deathAge: { age: number; month: number },
): boolean {
  const possible = possibleNationalPensionMonthsUntil(deathAge.age, deathAge.month);
  if (possible <= 0) return true;
  const credited = getNationalPensionCreditedMonthCount(member, entries, referenceDate, {
    age: deathAge.age,
    month: deathAge.month,
  });
  return credited * 3 >= possible * 2;
}

function isWithinOneYearPremiumException(
  deathYear: number,
  deathMonth: number,
  deceasedAge: number,
): boolean {
  if (deceasedAge >= STANDARD_OLD_AGE_START) return false;
  if (deathYear < SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR) return true;
  if (deathYear > SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR) return false;
  return deathMonth <= SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_MONTH;
}

export type SurvivorEmployeesDeathRequirement = 'short_term' | 'long_term' | 'none';

export function resolveSurvivorEmployeesDeathRequirement(
  deceased: FamilyMember,
  entries: IncomeEntry[],
  memberState: PensionMemberState,
  referenceDate: Date,
  death: CalendarYearMonth,
): SurvivorEmployeesDeathRequirement {
  const deathAge = getMemberAgeMonth(deceased, referenceDate, death.year, death.month);
  if (!deathAge) return 'none';

  const insured = isEmployeesInsuredAt(
    entries,
    deathAge.age,
    deathAge.month,
    calcBirthYear(deceased.age, deceased.birthMonth, referenceDate),
    deceased.birthMonth ?? 1,
  );
  if (insured) {
    if (
      isWithinOneYearPremiumException(death.year, death.month, deathAge.age) ||
      hasTwoThirdsPremiumPaid(deceased, entries, referenceDate, deathAge)
    ) {
      return 'short_term';
    }
    return 'none';
  }

  const credited = getNationalPensionCreditedMonthCount(
    deceased,
    entries,
    referenceDate,
    { age: deathAge.age, month: deathAge.month },
  );
  const monthsUntilDeath = calcEmployeesMonthsUntilDeath(
    deceased,
    entries,
    memberState,
    referenceDate,
    death,
  );
  if (
    Math.max(credited, monthsUntilDeath) >=
    SURVIVOR_EMPLOYEES_OLD_AGE_QUALIFYING_MONTHS
  ) {
    return 'long_term';
  }
  return 'none';
}

export function calcEmployeesMonthsUntilDeath(
  deceased: FamilyMember,
  entries: IncomeEntry[],
  memberState: PensionMemberState,
  referenceDate: Date,
  death: CalendarYearMonth,
): number {
  const deathAge = getMemberAgeMonth(deceased, referenceDate, death.year, death.month);
  if (!deathAge) return 0;
  const acc = accumulateEmployeesEnrollmentUntilAgeMonth(
    deceased,
    entries,
    referenceDate,
    deathAge.age,
    deathAge.month,
  );
  const q7Months =
    acc.general.preMonths +
    acc.general.postMonths +
    acc.publicServant.preMonths +
    acc.publicServant.postMonths;
  if (memberState.pastEnrollment === 'none') return q7Months;

  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-under50'
      ? memberState.teikibinUnder50
      : migrateTeikibinOver50Form(memberState.teikibinOver50);
  const teikibinMonths =
    (form.employeesPensionGeneralMonths ?? 0) +
    (form.employeesPensionPublicServantMonths ?? 0) +
    (form.employeesPensionPrivateSchoolMonths ?? 0);
  return Math.max(q7Months, teikibinMonths);
}

export function calcDeceasedProportionalYenPerYearUntilDeath(
  deceased: FamilyMember,
  entries: IncomeEntry[],
  memberState: PensionMemberState,
  referenceDate: Date,
  death: CalendarYearMonth,
): number {
  const deathAge = getMemberAgeMonth(deceased, referenceDate, death.year, death.month);
  if (!deathAge) return 0;
  const acc = accumulateEmployeesEnrollmentUntilAgeMonth(
    deceased,
    entries,
    referenceDate,
    deathAge.age,
    deathAge.month,
  );
  const q7Yen =
    calcProportionalPartAnnualYen(acc.general) +
    calcProportionalPartAnnualYen(acc.publicServant);
  if (q7Yen > 0) return q7Yen;

  const fullYen = calcMemberEmployeesProportionalYenPerYear(
    deceased,
    memberState,
    entries,
    referenceDate,
  );
  if (fullYen <= 0) return 0;
  const deathMonths = calcEmployeesMonthsUntilDeath(
    deceased,
    entries,
    memberState,
    referenceDate,
    death,
  );
  const fullMonths = (() => {
    const { general, publicServant } = getTotalEmployeesMonths(
      deceased,
      memberState,
      entries,
      referenceDate,
    );
    return general + publicServant;
  })();
  if (fullMonths <= 0 || deathMonths >= fullMonths) return fullYen;
  return fullYen * (deathMonths / fullMonths);
}

export function calcSurvivorEmployeesBaseYenPerYear(input: {
  proportionalYenPerYear: number;
  employeesMonthsUntilDeath: number;
  requirement: SurvivorEmployeesDeathRequirement;
}): number {
  if (input.requirement === 'none') return 0;
  let proportional = Math.max(0, input.proportionalYenPerYear);
  if (
    input.requirement === 'short_term' &&
    input.employeesMonthsUntilDeath > 0 &&
    input.employeesMonthsUntilDeath < SURVIVOR_EMPLOYEES_DEEMED_MONTHS
  ) {
    proportional *=
      SURVIVOR_EMPLOYEES_DEEMED_MONTHS / input.employeesMonthsUntilDeath;
  }
  return proportional * SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE;
}

function ownOldAgeEmployeesWithoutDependentMan(
  breakdown: OldAgePensionBreakdown,
): number {
  return (
    breakdown.generalEmployees.basic +
    breakdown.generalEmployees.transitional +
    breakdown.generalEmployees.payment +
    breakdown.generalEmployees.earlyPayment +
    breakdown.publicServant.basic +
    breakdown.publicServant.transitional +
    breakdown.publicServant.occupational +
    breakdown.publicServant.payment +
    breakdown.publicServant.earlyPayment
  );
}

export function applySurvivorEmployeesOwnOldAgeOffsetMan(
  baseMonthlyMan: number,
  ownEmployeesMonthlyMan: number,
  recipientAge: number,
): number {
  if (baseMonthlyMan <= 0) return 0;
  if (recipientAge < STANDARD_OLD_AGE_START || ownEmployeesMonthlyMan <= 0) {
    return baseMonthlyMan;
  }
  const deceasedPropMan =
    baseMonthlyMan / SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE;
  const optionB = deceasedPropMan * 0.5 + ownEmployeesMonthlyMan * 0.5;
  const amount = Math.max(baseMonthlyMan, optionB);
  return Math.max(0, amount - ownEmployeesMonthlyMan);
}

function fiveYearEnd(death: CalendarYearMonth): CalendarYearMonth {
  const total = calendarIndex(death.year, death.month) + 59;
  return {
    year: Math.floor((total - 1) / 12),
    month: ((total - 1) % 12) + 1,
  };
}

function isOnOrAfterAge(
  ageMonth: { age: number; month: number },
  minAge: number,
): boolean {
  return ageMonth.age > minAge || ageMonth.age === minAge;
}

export function isSurvivingSpouseEligibleForEmployees(
  spouse: FamilyMember,
  hadEligibleChildrenAtDeath: boolean,
  referenceDate: Date,
  death: CalendarYearMonth,
  now: CalendarYearMonth,
  receivesSurvivorBasicNow: boolean,
): boolean {
  const deathAge = getMemberAgeMonth(spouse, referenceDate, death.year, death.month);
  const nowAge = getMemberAgeMonth(spouse, referenceDate, now.year, now.month);
  if (!deathAge || !nowAge) return false;
  if (calendarIndex(now.year, now.month) < calendarIndex(death.year, death.month)) {
    return false;
  }

  if (hadEligibleChildrenAtDeath) return true;

  if (spouse.gender === 'female') {
    if (deathAge.age < CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE) {
      const end = fiveYearEnd(death);
      return calendarIndex(now.year, now.month) <= calendarIndex(end.year, end.month);
    }
    return true;
  }

  if (deathAge.age < CHILDLESS_HUSBAND_MIN_AGE_AT_DEATH) return false;
  if (receivesSurvivorBasicNow && isOnOrAfterAge(nowAge, CHILDLESS_HUSBAND_MIN_AGE_AT_DEATH)) {
    return true;
  }
  return isOnOrAfterAge(nowAge, CHILDLESS_HUSBAND_PAYMENT_START_AGE);
}

function isParentLikeEligible(
  member: FamilyMember,
  minRelationship: 'parent' | 'grandparent',
  referenceDate: Date,
  death: CalendarYearMonth,
  now: CalendarYearMonth,
): boolean {
  if (member.role !== 'other') return false;
  if (member.otherRelationship !== minRelationship) return false;
  const deathAge = getMemberAgeMonth(member, referenceDate, death.year, death.month);
  const nowAge = getMemberAgeMonth(member, referenceDate, now.year, now.month);
  if (!deathAge || !nowAge) return false;
  if (deathAge.age < SURVIVOR_PARENT_MIN_AGE_AT_DEATH) return false;
  return isOnOrAfterAge(nowAge, SURVIVOR_PARENT_PAYMENT_START_AGE);
}

export interface SurvivorEmployeesRecipient {
  member: FamilyMember;
  kind: 'spouse' | 'child' | 'parent' | 'grandparent';
}

export function resolveSurvivorEmployeesRecipient(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
  referenceDate: Date,
  death: CalendarYearMonth,
  now: CalendarYearMonth,
): SurvivorEmployeesRecipient | null {
  const deceased = familyMembers.find((member) => member.role === subject);
  const remaining = familyMembers.filter(
    (member) => member.role !== 'pet' && member.id !== deceased?.id,
  );
  const childrenAtDeath = listEligibleSurvivorBasicChildren(
    remaining,
    referenceDate,
    death.year,
    death.month,
  );
  const childrenNow = remaining.filter((member) =>
    isEligibleSurvivorBasicChild(member, referenceDate, now.year, now.month),
  );
  const survivorRole = subject === 'head' ? 'spouse' : 'head';
  const spouse = remaining.find((member) => member.role === survivorRole);
  const receivesSurvivorBasicNow = childrenNow.length > 0 && Boolean(spouse);

  if (
    spouse &&
    isSurvivingSpouseEligibleForEmployees(
      spouse,
      childrenAtDeath.length > 0,
      referenceDate,
      death,
      now,
      receivesSurvivorBasicNow,
    )
  ) {
    return { member: spouse, kind: 'spouse' };
  }

  if (childrenNow.length > 0) {
    return { member: childrenNow[0], kind: 'child' };
  }

  const parent = remaining.find((member) =>
    isParentLikeEligible(member, 'parent', referenceDate, death, now),
  );
  if (parent) return { member: parent, kind: 'parent' };

  const grandparent = remaining.find((member) =>
    isParentLikeEligible(member, 'grandparent', referenceDate, death, now),
  );
  if (grandparent) return { member: grandparent, kind: 'grandparent' };

  return null;
}

function ageAt(member: FamilyMember, referenceDate: Date, year: number, month: number): number | null {
  return getMemberAgeMonth(member, referenceDate, year, month)?.age ?? null;
}

function yearMonthWhenAgeReached(
  member: FamilyMember,
  referenceDate: Date,
  age: number,
): CalendarYearMonth | null {
  if (member.age == null || member.birthMonth == null) return null;
  return {
    year: calcBirthYear(member.age, member.birthMonth, referenceDate) + age,
    month: member.birthMonth,
  };
}

export function calcMiddleAgedWidowAddYenPerYear(input: {
  wife: FamilyMember;
  remainingFamilyMembers: FamilyMember[];
  referenceDate: Date;
  death: CalendarYearMonth;
  now: CalendarYearMonth;
  hadEligibleChildrenAtDeath: boolean;
  hasEligibleChildrenNow: boolean;
  requirement: SurvivorEmployeesDeathRequirement;
  deceasedEmployeesMonths: number;
}): number {
  if (input.wife.gender !== 'female') return 0;
  const nowAge = ageAt(input.wife, input.referenceDate, input.now.year, input.now.month);
  if (nowAge == null || nowAge < MIDDLE_AGED_WIDOW_MIN_AGE || nowAge >= STANDARD_OLD_AGE_START) {
    return 0;
  }
  if (input.hasEligibleChildrenNow) return 0;
  if (
    input.requirement === 'long_term' &&
    input.deceasedEmployeesMonths < DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS
  ) {
    return 0;
  }

  const deathAge = ageAt(
    input.wife,
    input.referenceDate,
    input.death.year,
    input.death.month,
  );
  if (deathAge == null) return 0;

  if (!input.hadEligibleChildrenAtDeath) {
    if (deathAge >= MIDDLE_AGED_WIDOW_MIN_AGE && deathAge < STANDARD_OLD_AGE_START) {
      return MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR;
    }
    return 0;
  }

  if (deathAge >= MIDDLE_AGED_WIDOW_MIN_AGE) {
    return MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR;
  }

  const atForty = yearMonthWhenAgeReached(
    input.wife,
    input.referenceDate,
    MIDDLE_AGED_WIDOW_MIN_AGE,
  );
  if (!atForty) return 0;
  const hadChildrenAtForty =
    listEligibleSurvivorBasicChildren(
      input.remainingFamilyMembers,
      input.referenceDate,
      atForty.year,
      atForty.month,
    ).length > 0;
  return hadChildrenAtForty ? MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR : 0;
}

export function calcCoverageSurvivorEmployeesDetail(input: {
  familyMembers: FamilyMember[];
  subject: RequiredCoverageSubject;
  pensionByMember: PensionByMember;
  originalIncomeByMember: IncomeByMember;
  coverageIncomeByMember: IncomeByMember;
  referenceDate: Date;
  death: CalendarYearMonth;
  year: number;
  month: number;
}): { detail: SurvivorEmployeesDetail; recipientId: string | null } {
  const empty = {
    detail: createEmptySurvivorEmployeesDetail(),
    recipientId: null,
  };
  const deceased = input.familyMembers.find((member) => member.role === input.subject);
  if (!deceased) return empty;

  const memberState =
    input.pensionByMember[deceased.id] ?? createDefaultPensionMemberState();
  const deceasedEntries = input.originalIncomeByMember[deceased.id] ?? [];
  const requirement = resolveSurvivorEmployeesDeathRequirement(
    deceased,
    deceasedEntries,
    memberState,
    input.referenceDate,
    input.death,
  );
  if (requirement === 'none') return empty;

  const now: CalendarYearMonth = { year: input.year, month: input.month };
  const recipient = resolveSurvivorEmployeesRecipient(
    input.familyMembers,
    input.subject,
    input.referenceDate,
    input.death,
    now,
  );
  if (!recipient) return empty;

  const monthsUntilDeath = calcEmployeesMonthsUntilDeath(
    deceased,
    deceasedEntries,
    memberState,
    input.referenceDate,
    input.death,
  );
  const proportionalYen = calcDeceasedProportionalYenPerYearUntilDeath(
    deceased,
    deceasedEntries,
    memberState,
    input.referenceDate,
    input.death,
  );
  const baseYen = calcSurvivorEmployeesBaseYenPerYear({
    proportionalYenPerYear: proportionalYen,
    employeesMonthsUntilDeath: monthsUntilDeath,
    requirement,
  });
  if (baseYen <= 0) return empty;

  const remaining = input.familyMembers.filter(
    (member) => member.role !== 'pet' && member.id !== deceased.id,
  );
  const childrenAtDeath = listEligibleSurvivorBasicChildren(
    remaining,
    input.referenceDate,
    input.death.year,
    input.death.month,
  );
  const childrenNow = listEligibleSurvivorBasicChildren(
    remaining,
    input.referenceDate,
    input.year,
    input.month,
  );

  let basicMan = toMonthlyMan(baseYen);
  const recipientState =
    input.pensionByMember[recipient.member.id] ?? createDefaultPensionMemberState();
  const recipientAge = getMemberAgeMonth(
    recipient.member,
    input.referenceDate,
    input.year,
    input.month,
  );
  if (recipient.kind === 'spouse' && recipientAge) {
    const ownBreakdown = calcMemberMonthlyPensionBreakdownMan(
      recipient.member,
      recipientState,
      input.coverageIncomeByMember[recipient.member.id] ?? [],
      input.referenceDate,
      input.year,
      input.month,
    );
    basicMan = applySurvivorEmployeesOwnOldAgeOffsetMan(
      basicMan,
      ownOldAgeEmployeesWithoutDependentMan(ownBreakdown.oldAge),
      recipientAge.age,
    );
  }

  let middleAgedMan = 0;
  if (recipient.kind === 'spouse') {
    middleAgedMan = toMonthlyMan(
      calcMiddleAgedWidowAddYenPerYear({
        wife: recipient.member,
        remainingFamilyMembers: remaining,
        referenceDate: input.referenceDate,
        death: input.death,
        now,
        hadEligibleChildrenAtDeath: childrenAtDeath.length > 0,
        hasEligibleChildrenNow: childrenNow.length > 0,
        requirement,
        deceasedEmployeesMonths: monthsUntilDeath,
      }),
    );
  }

  return {
    detail: {
      ...createEmptySurvivorEmployeesDetail(),
      basic: basicMan,
      middleAged: middleAgedMan,
    },
    recipientId: recipient.member.id,
  };
}

export function calcCoverageSurvivorEmployeesMonthlyMan(
  input: Parameters<typeof calcCoverageSurvivorEmployeesDetail>[0],
): number {
  const { detail } = calcCoverageSurvivorEmployeesDetail(input);
  return detail.basic + detail.middleAged + detail.occupational + detail.transitional + detail.payment;
}
