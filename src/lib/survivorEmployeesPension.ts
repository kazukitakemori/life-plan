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
import { resolveMemberYearIncomeProfile } from './memberYearIncome';
import { buildMemberYearIncomeProfileFromOverride } from './priorYearIncomeResolution';
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
import type {
  IncomeByMember,
  IncomeEntry,
  PriorYearIncomeByMember,
} from '../types/income';
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

function isUnpaidNationalPensionStatus(status: string): boolean {
  return (
    status === 'unpaid' ||
    status === 'half-unpaid' ||
    status === 'three-quarter-unpaid' ||
    status === 'quarter-unpaid'
  );
}

export function hasConfirmedNoUnpaidInRecentYear(
  memberState: PensionMemberState,
  deathYear: number,
  deathMonth: number,
): boolean {
  if (memberState.pastEnrollment === 'none') return false;
  // 通常のねんきん定期便は「最近の月別状況」を直近13月掲載する。
  // 現行データでは over50 のみ 12行 + recentMonthlyInputRow で13月目を保持する。
  // under50 は12行しか保持していないため、ここでは特例成立を断定しない。
  if (memberState.pastEnrollment !== 'nenkin-teikibin-over50') return false;
  const form = migrateTeikibinOver50Form(memberState.teikibinOver50);

  const rows = [...form.monthlyRows.slice(0, 12), form.recentMonthlyInputRow];
  if (rows.length !== 13) return false;

  // recentMonthlyYear/month は13月目（最新月）の年月。
  // 死亡月の前々月までの直近12月を13月の記録から切り出せる場合だけ判定する。
  const latestSerial =
    form.recentMonthlyYear * 12 + (form.recentMonthlyMonth - 1);
  const requiredEndSerial = deathYear * 12 + (deathMonth - 1) - 2;
  const startSerial = latestSerial - 12;
  if (requiredEndSerial < startSerial + 11 || requiredEndSerial > latestSerial) {
    return false;
  }

  const requiredStartSerial = requiredEndSerial - 11;
  const selected = rows.filter((_, index) => {
    const serial = startSerial + index;
    return serial >= requiredStartSerial && serial <= requiredEndSerial;
  });
  if (selected.length !== 12) return false;

  // 空欄・確認中は「未納なし」と断定できない。
  if (
    selected.some(
      (row) =>
        !row.nationalPensionStatus ||
        row.nationalPensionStatus === 'pending',
    )
  ) {
    return false;
  }
  return selected.every(
    (row) => !isUnpaidNationalPensionStatus(row.nationalPensionStatus),
  );
}

export function isWithinOneYearPremiumException(
  memberState: PensionMemberState,
  deathYear: number,
  deathMonth: number,
  deceasedAge: number,
): boolean {
  if (deceasedAge >= STANDARD_OLD_AGE_START) return false;
  if (deathYear > SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR) return false;
  if (
    deathYear === SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR &&
    deathMonth > SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_MONTH
  ) {
    return false;
  }
  return hasConfirmedNoUnpaidInRecentYear(memberState, deathYear, deathMonth);
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
      isWithinOneYearPremiumException(
        memberState,
        death.year,
        death.month,
        deathAge.age,
      ) ||
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

/**
 * 2028年改正後の継続給付で参照する所得年。
 * 法律上、1〜9月分は前々年、10〜12月分は前年の所得を参照する。
 */
export function resolveSurvivorContinuationIncomeReferenceYear(
  paymentYear: number,
  paymentMonth: number,
): number {
  return paymentYear - (paymentMonth <= 9 ? 2 : 1);
}

export type SurvivorContinuationIncomeBasisResolution =
  | 'q7_reference_year'
  | 'prior_year_override'
  | 'unavailable';

export interface SurvivorContinuationIncomeBasis {
  incomeReferenceYear: number;
  /** 税務上の合計所得金額ベース（円）。自動推計できない場合はnull。 */
  totalIncomeYen: number | null;
  resolution: SurvivorContinuationIncomeBasisResolution;
  /**
   * Q7や「前年度の収入」から組み立てるため、税務署・自治体の確定所得そのものではない。
   * 継続給付の最終判定では公式所得情報による確認が必要。
   */
  isEstimate: true;
}

/**
 * 継続給付の「前年所得」の概算元を解決する。
 *
 * residentTax用の resolveMemberPriorYearIncome は、試算初年度に現年収proxyを使うことが
 * あるため、そのまま流用しない。法律で指定された参照暦年を直接Q7から組み立てる。
 * Q7「前年度の収入」上書きは、試算開始年の前年を参照する場合だけ利用する。
 */
export function resolveSurvivorContinuationIncomeBasis(input: {
  recipient: FamilyMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  paymentYear: number;
  paymentMonth: number;
}): SurvivorContinuationIncomeBasis {
  const incomeReferenceYear = resolveSurvivorContinuationIncomeReferenceYear(
    input.paymentYear,
    input.paymentMonth,
  );
  const simulationStartYear = input.referenceDate.getFullYear();
  const priorOverride = input.priorYearIncomeByMember?.[input.recipient.id];

  if (
    incomeReferenceYear === simulationStartYear - 1 &&
    priorOverride?.differsFromCurrentYear
  ) {
    const profile = buildMemberYearIncomeProfileFromOverride(priorOverride);
    return {
      incomeReferenceYear,
      totalIncomeYen: Math.round(profile.totalIncomeMan * 10_000),
      resolution: 'prior_year_override',
      isEstimate: true,
    };
  }

  const entries = input.incomeByMember[input.recipient.id] ?? [];
  if (entries.length === 0) {
    return {
      incomeReferenceYear,
      totalIncomeYen: null,
      resolution: 'unavailable',
      isEstimate: true,
    };
  }

  const profile = resolveMemberYearIncomeProfile(
    input.recipient,
    entries,
    input.referenceDate,
    incomeReferenceYear,
    1,
    12,
  );
  return {
    incomeReferenceYear,
    totalIncomeYen: Math.round(profile.totalIncomeMan * 10_000),
    resolution: 'q7_reference_year',
    isEstimate: true,
  };
}

export interface SurvivorContinuationIncomeThresholdsYen {
  first: number;
  second: number;
}

/**
 * 2028年改正後の継続給付の所得による年額支給停止額。
 *
 * 厚生年金保険法65条2項の確定式のみを実装する。
 * - 第一所得基準額超〜第二所得基準額以下: 超過額の1/3
 * - 第二所得基準額超: 第一〜第二の1/3 + 第二超過分の1/2
 * - 支給停止額は年金年額を上限とする
 *
 * 第一・第二所得基準額そのものは政令事項のため、呼び出し側が公式確定値を
 * 渡せる場合に限って使用する。目安値をここへ固定しない。
 */
export function calcSurvivorContinuationSuspensionYen(input: {
  priorIncomeYen: number;
  annualPensionYen: number;
  thresholds: SurvivorContinuationIncomeThresholdsYen;
}): number {
  const income = Math.max(0, input.priorIncomeYen);
  const pension = Math.max(0, input.annualPensionYen);
  const first = Math.max(0, input.thresholds.first);
  const second = Math.max(first, input.thresholds.second);

  let suspension = 0;
  if (income > second) {
    suspension =
      (second - first) / 3 +
      (income - second) / 2;
  } else if (income > first) {
    suspension = (income - first) / 3;
  }

  return Math.min(pension, Math.max(0, suspension));
}

function isOnOrAfterAge(
  ageMonth: { age: number; month: number },
  minAge: number,
): boolean {
  return ageMonth.age > minAge || ageMonth.age === minAge;
}

function isOnOrAfterSurvivorReform(death: CalendarYearMonth): boolean {
  return (
    death.year > 2028 ||
    (death.year === 2028 && death.month >= 4)
  );
}

function survivorReformWifeFiniteMaxAge(death: CalendarYearMonth): number {
  if (!isOnOrAfterSurvivorReform(death)) return CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE;
  // 2028年度は40歳未満から開始し、対象生年月日を固定することで
  // その後は毎年度1歳ずつ上限年齢が上がり、2048年度に60歳未満へ到達する。
  const fiscalYear = death.month >= 4 ? death.year : death.year - 1;
  return Math.min(60, 40 + Math.max(0, fiscalYear - 2028));
}

function isSpouseFiniteSurvivorEmployeesBenefit(
  spouse: FamilyMember,
  hadEligibleChildrenAtDeath: boolean,
  referenceDate: Date,
  death: CalendarYearMonth,
  receivesSurvivorBasicNow: boolean,
  survivorBasicLoss: CalendarYearMonth | null,
): boolean {
  if (receivesSurvivorBasicNow) return false;
  const start =
    hadEligibleChildrenAtDeath && survivorBasicLoss ? survivorBasicLoss : death;
  const startAge = getMemberAgeMonth(
    spouse,
    referenceDate,
    start.year,
    start.month,
  );
  if (!startAge) return false;

  if (isOnOrAfterSurvivorReform(death)) {
    // 改正後、子を養育していた配偶者は遺族基礎年金の失権後さらに5年間、
    // 増額された有期給付の対象となる。
    if (hadEligibleChildrenAtDeath && survivorBasicLoss) return true;
    if (spouse.gender === 'male') return startAge.age < 60;
    return startAge.age < survivorReformWifeFiniteMaxAge(death);
  }
  return spouse.gender === 'female' &&
    startAge.age < CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE;
}

export function isSurvivingSpouseEligibleForEmployees(
  spouse: FamilyMember,
  hadEligibleChildrenAtDeath: boolean,
  referenceDate: Date,
  death: CalendarYearMonth,
  now: CalendarYearMonth,
  receivesSurvivorBasicNow: boolean,
  survivorBasicLoss: CalendarYearMonth | null = null,
): boolean {
  const deathAge = getMemberAgeMonth(spouse, referenceDate, death.year, death.month);
  const nowAge = getMemberAgeMonth(spouse, referenceDate, now.year, now.month);
  if (!deathAge || !nowAge) return false;
  if (calendarIndex(now.year, now.month) < calendarIndex(death.year, death.month)) {
    return false;
  }

  // 子がいる間は現行どおり受給。子の資格終了後に有期給付となる場合は、
  // 「死亡から5年」ではなく遺族基礎年金の失権時から5年を数える。
  if (hadEligibleChildrenAtDeath && receivesSurvivorBasicNow) return true;
  const fiveYearStart =
    hadEligibleChildrenAtDeath && survivorBasicLoss ? survivorBasicLoss : death;

  if (
    isOnOrAfterSurvivorReform(death) &&
    hadEligibleChildrenAtDeath &&
    survivorBasicLoss
  ) {
    const end = fiveYearEnd(survivorBasicLoss);
    return calendarIndex(now.year, now.month) <= calendarIndex(end.year, end.month);
  }

  if (spouse.gender === 'female') {
    const fiveYearStartAge = getMemberAgeMonth(
      spouse,
      referenceDate,
      fiveYearStart.year,
      fiveYearStart.month,
    );
    if (
      fiveYearStartAge &&
      fiveYearStartAge.age < survivorReformWifeFiniteMaxAge(death)
    ) {
      const end = fiveYearEnd(fiveYearStart);
      return calendarIndex(now.year, now.month) <= calendarIndex(end.year, end.month);
    }
    return true;
  }

  if (isOnOrAfterSurvivorReform(death) && deathAge.age < 60) {
    const end = fiveYearEnd(fiveYearStart);
    return calendarIndex(now.year, now.month) <= calendarIndex(end.year, end.month);
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
  let survivorBasicLoss: CalendarYearMonth | null = null;
  if (spouse && childrenAtDeath.length > 0) {
    // 最後の対象児が遺族基礎年金の対象外となる最初の月を求める。
    // 障害児は20歳未満まで対象となり得るため、死亡月から25年を上限に走査する。
    const start = calendarIndex(death.year, death.month);
    for (let offset = 1; offset <= 25 * 12; offset++) {
      const serial = start + offset;
      const year = Math.floor((serial - 1) / 12);
      const month = ((serial - 1) % 12) + 1;
      const eligible = listEligibleSurvivorBasicChildren(
        remaining,
        referenceDate,
        year,
        month,
      );
      if (eligible.length === 0) {
        survivorBasicLoss = { year, month };
        break;
      }
    }
  }

  if (
    spouse &&
    isSurvivingSpouseEligibleForEmployees(
      spouse,
      childrenAtDeath.length > 0,
      referenceDate,
      death,
      now,
      receivesSurvivorBasicNow,
      survivorBasicLoss,
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

function middleAgedWidowAddPhaseRatio(death: CalendarYearMonth): number {
  if (!isOnOrAfterSurvivorReform(death)) return 1;
  const fiscalYear = death.month >= 4 ? death.year : death.year - 1;
  // 2028年度以降の新規裁定は25年かけて段階的に縮小し、
  // 2052年度の新規裁定で終了する。受給開始後の額は固定する。
  // 2028年度を25/25、2052年度を1/25、2053年度以降を0とする。
  if (fiscalYear >= 2053) return 0;
  return Math.max(0, Math.min(1, (2053 - fiscalYear) / 25));
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
      return (
    MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR *
    middleAgedWidowAddPhaseRatio(input.death)
  );
    }
    return 0;
  }

  if (deathAge >= MIDDLE_AGED_WIDOW_MIN_AGE) {
    return (
      MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR *
      middleAgedWidowAddPhaseRatio(input.death)
    );
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
  return hadChildrenAtForty
    ? MIDDLE_AGED_WIDOW_ADD_YEN_PER_YEAR *
        middleAgedWidowAddPhaseRatio(input.death)
    : 0;
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
  // 2028年4月以降の5年間の有期給付には、死亡者の老齢厚生年金
  // 報酬比例部分の1/4相当を上乗せし、合計4/4相当とする。
  if (recipient.kind === 'spouse' && isOnOrAfterSurvivorReform(input.death)) {
    const survivorRole = input.subject === 'head' ? 'spouse' : 'head';
    const spouse = remaining.find((member) => member.role === survivorRole);
    const receivesSurvivorBasicNow =
      childrenNow.length > 0 && Boolean(spouse);
    let survivorBasicLoss: CalendarYearMonth | null = null;
    if (childrenAtDeath.length > 0) {
      const start = calendarIndex(input.death.year, input.death.month);
      for (let offset = 1; offset <= 25 * 12; offset++) {
        const serial = start + offset;
        const year = Math.floor((serial - 1) / 12);
        const month = ((serial - 1) % 12) + 1;
        if (
          listEligibleSurvivorBasicChildren(
            remaining,
            input.referenceDate,
            year,
            month,
          ).length === 0
        ) {
          survivorBasicLoss = { year, month };
          break;
        }
      }
    }
    if (
      isSpouseFiniteSurvivorEmployeesBenefit(
        recipient.member,
        childrenAtDeath.length > 0,
        input.referenceDate,
        input.death,
        receivesSurvivorBasicNow,
        survivorBasicLoss,
      )
    ) {
      basicMan += toMonthlyMan(
        baseYen / SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE * 0.25,
      );
    }
  }

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
