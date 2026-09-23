import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import {
  calcBirthYear,
  calcYearAtAge,
  calendarYearFromAgeCalendarMonth,
  isAgeCalendarMonthInRange,
} from './birthDate';
import {
  careerAnnualIncomeToMonthlyMan,
  getCareerStartAnnualYen,
  interpolateCareerAnnualIncomeYen,
  resolveCurrentWorkProfile,
  type CurrentWorkProfile,
} from './pensionIncomeProjection';
import {
  addEmployeesEnrollmentMonth,
  calcProportionalPartAnnualYen,
  createEmptyProportionalAccumulation,
  type ProportionalPartAccumulation,
} from './pensionProportionalPart';
import {
  ASSUMED_EMPLOYMENT_START_AGE,
  ASSUMED_EMPLOYMENT_START_MONTH,
  EMPLOYEES_PENSION_MAX_INSURED_AGE,
  FULL_BASIC_PENSION_MONTHS,
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  FULL_BASIC_PENSION_YEN_PER_YEAR_LEGACY,
  NATIONAL_PENSION_MANDATORY_END_AGE,
  PENSION_ENROLLMENT_START_AGE,
  STANDARD_OLD_AGE_START,
  UNIVERSITY_EXEMPTION_END_AGE,
  UNIVERSITY_EXEMPTION_END_MONTH,
  UNIVERSITY_EXEMPTION_MONTHS,
  UNIVERSITY_EXEMPTION_START_AGE,
  UNIVERSITY_EXEMPTION_START_MONTH,
} from './pensionConstants';
import { isEmployeesPensionLiableAtAgeMonth } from './employeesPensionPremium';
import type { FamilyMember } from '../types/family';
import type { IncomeCategory, IncomeEntry, IncomeStreamType } from '../types/income';

export interface EstimatedOldAgeAmountsYen {
  basicYenPerYear: number;
  /** 一般厚生の報酬比例部分（年額・円）→ CF表「基本」 */
  generalEmployeesYenPerYear: number;
  /** 公務員厚生の報酬比例部分（年額・円）→ CF表「基本」 */
  publicServantYenPerYear: number;
  /** 一般厚生の経過的加算（年額・円）→ CF表「経過」 */
  generalTransitionalYenPerYear: number;
  /** 公務員厚生の経過的加算（年額・円）→ CF表「経過」 */
  publicTransitionalYenPerYear: number;
}

export interface EmployeesEnrollmentMonthCounts {
  generalMonths: number;
  publicServantMonths: number;
}

type EmployeesEnrollmentKind = 'general' | 'publicServant';

interface ActiveIncome {
  category: IncomeCategory;
  streamType: IncomeStreamType;
  monthlyAmountMan: number;
  standardBonusYen: number;
}

interface AgeMonth {
  age: number;
  month: number;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isOnOrBeforeAgeMonth(
  age: number,
  month: number,
  endAge: number,
  endMonth: number,
): boolean {
  return ageMonthIndex(age, month) <= ageMonthIndex(endAge, endMonth);
}

function isAssumedEmploymentStarted(age: number, month: number): boolean {
  if (age < ASSUMED_EMPLOYMENT_START_AGE) return false;
  if (
    age === ASSUMED_EMPLOYMENT_START_AGE &&
    month < ASSUMED_EMPLOYMENT_START_MONTH
  ) {
    return false;
  }
  return true;
}

function classifyEmployeesEnrollmentFromIncome(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): EmployeesEnrollmentKind | null {
  switch (category) {
    case 'employee':
    case 'part_time':
      if (streamType === 'salary_social_insurance') {
        return 'general';
      }
      if (streamType === 'salary_civil_mutual') {
        return 'publicServant';
      }
      return null;
    case 'civil_servant':
      return streamType === 'salary_civil_mutual' ? 'publicServant' : null;
    default:
      return null;
  }
}

/** 厚生年金に加入せず国民年金のみの収入区分か */
function isNationalPensionOnlyIncome(
  category: IncomeCategory,
  streamType: IncomeStreamType,
): boolean {
  if (streamType === 'business_national_insurance') {
    return category === 'self_employed';
  }
  if (streamType === 'salary_national_insurance') {
    return (
      category === 'employee' ||
      category === 'part_time' ||
      category === 'civil_servant' ||
      category === 'self_employed'
    );
  }
  return false;
}

function classifyEmployeesEnrollment(
  active: ActiveIncome | null,
): EmployeesEnrollmentKind | null {
  if (!active) return null;
  return classifyEmployeesEnrollmentFromIncome(
    active.category,
    active.streamType,
  );
}

function findActiveIncomeAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  birthYear: number,
  birthMonth: number,
): ActiveIncome | null {
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
          standardBonusYen: (period.bonuses ?? [])
            .filter((bonus) => bonus.paymentMonth === month)
            .reduce(
              (sum, bonus) =>
                sum + resolvePensionStandardBonusYen(bonus.amountMan * 10_000),
              0,
            ),
        };
      }
    }
  }
  return null;
}

/** 就労期間の終了（Q7 収入の最終月） */
function findCareerEnd(entries: IncomeEntry[]): AgeMonth | null {
  let end: (AgeMonth & { endIndex: number }) | null = null;

  for (const entry of entries) {
    for (const period of entry.periods) {
      const endIndex = ageMonthIndex(period.endAge, period.endMonth);
      if (!end || endIndex > end.endIndex) {
        end = {
          age: period.endAge,
          month: period.endMonth,
          endIndex,
        };
      }
    }
  }

  if (!end) return null;
  return { age: end.age, month: end.month };
}

import {
  resolvePensionStandardBonusYen,
  standardRemunerationYenFromMonthlyManAt,
} from './standardRemuneration';

function resolveEmployeesEnrollmentAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  member: FamilyMember,
  workProfile: CurrentWorkProfile,
  careerEnd: AgeMonth | null,
  birthYear: number,
): { kind: EmployeesEnrollmentKind; monthlyAmountMan: number; standardBonusYen: number } | null {
  if (!isEmployeesPensionLiableAtAgeMonth(age, month, resolveMemberBirthMonth(member))) {
    return null;
  }

  if (!isAssumedEmploymentStarted(age, month)) {
    return null;
  }

  if (!careerEnd || !isOnOrBeforeAgeMonth(age, month, careerEnd.age, careerEnd.month)) {
    return null;
  }

  const active = findActiveIncomeAtAgeMonth(
    entries,
    age,
    month,
    birthYear,
    resolveMemberBirthMonth(member),
  );
  const explicitKind = classifyEmployeesEnrollment(active);

  if (explicitKind) {
    return {
      kind: explicitKind,
      monthlyAmountMan: active?.monthlyAmountMan ?? 0,
      standardBonusYen: active?.standardBonusYen ?? 0,
    };
  }

  if (active) {
    return null;
  }

  // 現時点が非就労でも、上記までで Q7 の加入期間は反映済み。以降は現職ベースの補間のみ。
  if (workProfile.situation === 'not_working') {
    return null;
  }

  if (!workProfile.hasEmployeesPension || !workProfile.employeesKind) {
    return null;
  }

  const startAnnualYen = getCareerStartAnnualYen(workProfile.situation);
  const annualYen = interpolateCareerAnnualIncomeYen(
    age,
    resolveMemberAge(member),
    startAnnualYen,
    workProfile.currentAnnualYen,
  );

  return {
    kind: workProfile.employeesKind,
    monthlyAmountMan: careerAnnualIncomeToMonthlyMan(annualYen),
    standardBonusYen: 0,
  };
}

/**
 * Q7 収入と現時点の働き方から厚生年金加入月を集計する。
 *
 * - 現時点で働いていない → 厚生年金加入なし（国民年金のみ想定）
 * - 会社員・公務員・自営業 → 22歳年収240万円から現年収まで線形補間
 * - アルバイト・パート → 22歳年収180万円から現年収まで線形補間
 * - Q7に入力がある月は入力を優先
 * - 就労終了は Q7 収入の最終月まで
 */
function accumulateEmployeesEnrollmentFromIncome(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  untilAgeMonth?: AgeMonth,
): {
  general: ProportionalPartAccumulation;
  publicServant: ProportionalPartAccumulation;
} {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const general = createEmptyProportionalAccumulation();
  const publicServant = createEmptyProportionalAccumulation();
  const workProfile = resolveCurrentWorkProfile(member, entries, referenceDate);
  const careerEnd = findCareerEnd(entries);
  const untilIndex = untilAgeMonth
    ? ageMonthIndex(untilAgeMonth.age, untilAgeMonth.month)
    : null;

  for (let age = PENSION_ENROLLMENT_START_AGE; age <= EMPLOYEES_PENSION_MAX_INSURED_AGE; age++) {
    for (let month = 1; month <= 12; month++) {
      if (untilIndex != null && ageMonthIndex(age, month) > untilIndex) {
        continue;
      }
      const enrollment = resolveEmployeesEnrollmentAtAgeMonth(
        entries,
        age,
        month,
        member,
        workProfile,
        careerEnd,
        birthYear,
      );
      if (!enrollment) continue;

      const calendarYear = calcYearAtAge(birthYear, resolveMemberBirthMonth(member), age, month);
      const remunerationYen = standardRemunerationYenFromMonthlyManAt(
        enrollment.monthlyAmountMan,
        calendarYear,
        month,
      );
      const target =
        enrollment.kind === 'general' ? general : publicServant;

      addEmployeesEnrollmentMonth(
        target,
        calendarYear,
        month,
        remunerationYen,
        enrollment.standardBonusYen,
      );
    }
  }

  return { general, publicServant };
}

/** 指定した年齢月までの厚生年金加入（報酬比例の累計つき） */
export function accumulateEmployeesEnrollmentUntilAgeMonth(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  untilAge: number,
  untilMonth: number,
): {
  general: ProportionalPartAccumulation;
  publicServant: ProportionalPartAccumulation;
} {
  return accumulateEmployeesEnrollmentFromIncome(member, entries, referenceDate, {
    age: untilAge,
    month: untilMonth,
  });
}

function isUniversityExemptionMonth(age: number, month: number): boolean {
  const currentIndex = ageMonthIndex(age, month);
  const startIndex = ageMonthIndex(
    UNIVERSITY_EXEMPTION_START_AGE,
    UNIVERSITY_EXEMPTION_START_MONTH,
  );
  const endIndex = ageMonthIndex(
    UNIVERSITY_EXEMPTION_END_AGE,
    UNIVERSITY_EXEMPTION_END_MONTH,
  );
  return currentIndex >= startIndex && currentIndex <= endIndex;
}

/**
 * ねんきん定期便なし推計の算定基礎月数を確定する。
 * 加入月数が満額480に達する場合でも、大学在学猶予24か月分は控除する。
 */
function finalizeNationalPensionCreditedMonths(coveredMonths: number): number {
  const capped = Math.min(coveredMonths, FULL_BASIC_PENSION_MONTHS);
  if (coveredMonths >= FULL_BASIC_PENSION_MONTHS) {
    return Math.max(0, capped - UNIVERSITY_EXEMPTION_MONTHS);
  }
  return capped;
}

function hasNationalPensionCoverageAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  member: FamilyMember,
  workProfile: CurrentWorkProfile,
  careerEnd: AgeMonth | null,
  birthYear: number,
): boolean {
  // 大学在学想定の期間でも、Q7に厚生年金加入が明示されていれば実績を優先する。
  if (resolveEmployeesEnrollmentAtAgeMonth(
    entries,
    age,
    month,
    member,
    workProfile,
    careerEnd,
    birthYear,
  )) {
    return true;
  }

  // Q7に加入実績がない場合のみ、20歳4月〜22歳3月を学生納付特例の既定値として扱う。
  if (isUniversityExemptionMonth(age, month)) {
    return false;
  }

  if (!isAssumedEmploymentStarted(age, month)) {
    return false;
  }

  if (!careerEnd || !isOnOrBeforeAgeMonth(age, month, careerEnd.age, careerEnd.month)) {
    return false;
  }

  const active = findActiveIncomeAtAgeMonth(
    entries,
    age,
    month,
    birthYear,
    resolveMemberBirthMonth(member),
  );
  if (active) {
    return isNationalPensionOnlyIncome(active.category, active.streamType);
  }

  if (workProfile.situation === 'not_working') {
    return false;
  }

  // Q7 未入力月は現職プロファイルから就労中とみなす（国民年金のみ加入も含む）
  return true;
}

/**
 * ねんきん定期便なし推計用の国民年金加入月数（満額480か月で上限）。
 * 大学在学猶予24か月は既定では算入しないが、Q7に加入実績があれば実績を優先する。
 */
export function getNationalPensionCreditedMonthCount(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  untilAgeMonth?: { age: number; month: number },
): number {
  const workProfile = resolveCurrentWorkProfile(member, entries, referenceDate);
  const careerEnd = findCareerEnd(entries);
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const untilIndex = untilAgeMonth
    ? ageMonthIndex(untilAgeMonth.age, untilAgeMonth.month)
    : ageMonthIndex(NATIONAL_PENSION_MANDATORY_END_AGE - 1, 12);
  let count = 0;

  for (
    let age = PENSION_ENROLLMENT_START_AGE;
    age < NATIONAL_PENSION_MANDATORY_END_AGE;
    age++
  ) {
    for (let month = 1; month <= 12; month++) {
      if (ageMonthIndex(age, month) > untilIndex) continue;
      if (
        hasNationalPensionCoverageAtAgeMonth(
          entries,
          age,
          month,
          member,
          workProfile,
          careerEnd,
          birthYear,
        )
      ) {
        count++;
      }
    }
  }

  return finalizeNationalPensionCreditedMonths(count);
}

export function calcBasicPensionYenFromCreditedMonths(
  creditedMonths: number,
  fullBasicPensionYenPerYear = FULL_BASIC_PENSION_YEN_PER_YEAR,
): number {
  const months = Math.max(0, Math.min(creditedMonths, FULL_BASIC_PENSION_MONTHS));
  return (months / FULL_BASIC_PENSION_MONTHS) * fullBasicPensionYenPerYear;
}

function resolveFullBasicPensionYenPerYearForMember(
  member: FamilyMember,
  referenceDate: Date,
): number {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const birthDay = member.birthDay ?? 1;
  const isLegacy =
    birthYear < 1956 ||
    (birthYear === 1956 &&
      (birthMonth < 4 || (birthMonth === 4 && birthDay <= 1)));
  return isLegacy
    ? FULL_BASIC_PENSION_YEN_PER_YEAR_LEGACY
    : FULL_BASIC_PENSION_YEN_PER_YEAR;
}

/**
 * 経過的加算（年額・円）を計算する。
 *
 * 経過的加算 = max(0, 定額部分相当額 − 老齢基礎年金額)
 *
 * 定額部分単価 ≈ 老齢基礎年金満額 / 480 として近似。
 *   定額部分相当額 = 満額 × min(厚生年金加入月数, 480) / 480
 *   老齢基礎年金額  = 満額 × 算定基礎月数 / 480
 * ∴ 経過的加算     = 満額 × (min(厚生月数, 480) − 算定基礎月数) / 480
 *
 * 主な発生要因（このアプリの推計モデルにおける）:
 *   大学在学猶予 24 か月（20歳4月〜22歳3月）が老齢基礎算定月数から除外されているが
 *   厚生年金加入月数には算入されているケース。
 */
export function calcTransitionalAdditionYenPerYear(
  totalEmployeesMonths: number,
  basicCreditedMonths: number,
  fullBasicPensionYenPerYear = FULL_BASIC_PENSION_YEN_PER_YEAR,
): number {
  const cappedMonths = Math.min(totalEmployeesMonths, FULL_BASIC_PENSION_MONTHS);
  const diff = Math.max(0, cappedMonths - basicCreditedMonths);
  return (diff / FULL_BASIC_PENSION_MONTHS) * fullBasicPensionYenPerYear;
}

/**
 * 指定した年齢・暦月に厚生年金（社会保険 or 公務員共済）で就労中の場合、
 * その月の標準報酬月額相当（万円）を返す。就労していない場合は 0。
 *
 * 在職老齢年金の総報酬月額相当額の算出に使用。
 * （簡易値: 賞与按分は含まず標準報酬月額のみ）
 */
export function getActiveEmployeesMonthlyRemunerationMan(
  entries: IncomeEntry[],
  age: number,
  calendarMonth: number,
  birthYear: number,
  birthMonth = 1,
): number {
  const active = findActiveIncomeAtAgeMonth(
    entries,
    age,
    calendarMonth,
    birthYear,
    birthMonth,
  );
  if (!active) return 0;
  const kind = classifyEmployeesEnrollmentFromIncome(active.category, active.streamType);
  if (!kind) return 0;
  return active.monthlyAmountMan;
}

/**
 * 在職老齢年金の「総報酬月額相当額」（万円）をQ7から算出する。
 *
 * 総報酬月額相当額 =
 *   当月の標準報酬月額 + 直近12か月の標準賞与額合計 / 12
 *
 * 標準賞与額は1,000円未満を切り捨て、厚生年金の1回150万円上限を適用する。
 * Q7の賞与は各収入期間の paymentMonth に毎年支給される前提。
 */
export function getActiveEmployeesTotalRemunerationMan(
  entries: IncomeEntry[],
  age: number,
  calendarMonth: number,
  birthYear: number,
  birthMonth = 1,
): number {
  const active = findActiveIncomeAtAgeMonth(
    entries,
    age,
    calendarMonth,
    birthYear,
    birthMonth,
  );
  if (!active) return 0;
  const activeKind = classifyEmployeesEnrollmentFromIncome(
    active.category,
    active.streamType,
  );
  if (!activeKind) return 0;

  const currentCalendarYear = calendarYearFromAgeCalendarMonth(
    birthYear,
    birthMonth,
    age,
    calendarMonth,
  );
  const standardMonthlyYen = standardRemunerationYenFromMonthlyManAt(
    active.monthlyAmountMan,
    currentCalendarYear,
    calendarMonth,
  );
  const currentSerial = currentCalendarYear * 12 + (calendarMonth - 1);
  let standardBonusTotalYen = 0;

  for (let offset = 0; offset < 12; offset++) {
    const serial = currentSerial - offset;
    const targetYear = Math.floor(serial / 12);
    const targetMonth = (serial % 12) + 1;

    for (const entry of entries) {
      for (const period of entry.periods) {
        const kind = classifyEmployeesEnrollmentFromIncome(
          entry.category,
          period.streamType,
        );
        if (!kind) continue;

        for (const bonus of period.bonuses ?? []) {
          if (bonus.paymentMonth !== targetMonth) continue;

          const targetAgeMonthIndex =
            (targetYear - birthYear) * 12 +
            targetMonth -
            birthMonth;
          const targetAge = Math.floor(targetAgeMonthIndex / 12);
          const monthSinceBirthday =
            ((targetAgeMonthIndex % 12) + 12) % 12;
          const targetAgeCalendarMonth = monthSinceBirthday + 1;

          if (
            !isAgeCalendarMonthInRange(
              targetAge,
              targetAgeCalendarMonth,
              period.startAge,
              period.startMonth,
              period.endAge,
              period.endMonth,
              birthYear,
              birthMonth,
            )
          ) {
            continue;
          }

          standardBonusTotalYen += resolvePensionStandardBonusYen(
            bonus.amountMan * 10_000,
          );
        }
      }
    }
  }

  return (standardMonthlyYen + standardBonusTotalYen / 12) / 10_000;
}

export function getEmployeesEnrollmentMonthCounts(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): EmployeesEnrollmentMonthCounts {
  const { general, publicServant } = accumulateEmployeesEnrollmentFromIncome(
    member,
    entries,
    referenceDate,
  );

  return {
    generalMonths: general.preMonths + general.postMonths,
    publicServantMonths: publicServant.preMonths + publicServant.postMonths,
  };
}

/**
 * Q7 に厚生年金加入期間（一般厚生 or 公務員厚生）が含まれるかを確認する。
 */
function hasAnyEmployeesPensionInQ7(entries: IncomeEntry[]): {
  hasGeneral: boolean;
  hasPublicServant: boolean;
} {
  let hasGeneral = false;
  let hasPublicServant = false;
  for (const entry of entries) {
    for (const period of entry.periods) {
      const kind = classifyEmployeesEnrollmentFromIncome(
        entry.category,
        period.streamType,
      );
      if (kind === 'general') hasGeneral = true;
      if (kind === 'publicServant') hasPublicServant = true;
    }
  }
  return { hasGeneral, hasPublicServant };
}

/**
 * 加給年金の 20 年要件チェック専用の推計加入月数。
 *
 * 通常の `getEmployeesEnrollmentMonthCounts` と異なり、**Q7 に厚生年金加入期間が
 * 存在する場合は 22 歳 4 月からキャリア終了まで全期間加入とみなす寛大推計**を使う。
 *
 * 背景: Q7 に将来の就労期間しか入力していない人（例: 現在 50 歳・非就労で
 * 51〜60 歳の就労予定だけ入力）は `workProfile = not_working` となり、
 * 通常推計では 10 年分しか計上されない。しかし 20 代から就労していた場合は
 * 加給年金の支給対象になるため、より寛大な推計を用いる。
 *
 * Q7 に厚生年金期間が全くない場合は、通常推計にフォールバックする。
 */
/**
 * 指定した暦年月（exclusive: その月は含まない）以降の
 * Q7 厚生年金加入月数を集計する。
 *
 * 定期便ありの場合、定期便の記録最終月の翌月以降の Q7 収入期間を加算し、
 * 定期便の実績月数との二重計上を避けるために使用する。
 */
export interface FuturePensionAdditionsYen {
  basicYenPerYear: number;
  generalEmployeesYenPerYear: number;
  publicServantYenPerYear: number;
}

/**
 * ねんきん定期便の記録最終月より後にQ7へ明示されている就労期間だけを使い、
 * 65歳までの将来加入分を年金額へ換算する。
 * 50歳未満の定期便は「これまでの加入実績額」なので、将来分を二重計上せず足す用途。
 */
export function estimateQ7FuturePensionAdditionsAfterDate(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  afterYear: number,
  afterMonth: number,
): FuturePensionAdditionsYen {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const general = createEmptyProportionalAccumulation();
  const publicServant = createEmptyProportionalAccumulation();
  let basicMonths = 0;

  for (let age = PENSION_ENROLLMENT_START_AGE; age < STANDARD_OLD_AGE_START; age++) {
    for (let month = 1; month <= 12; month++) {
      const calendarYear = calcYearAtAge(birthYear, birthMonth, age, month);
      const isAfter =
        calendarYear > afterYear ||
        (calendarYear === afterYear && month > afterMonth);
      if (!isAfter) continue;

      const active = findActiveIncomeAtAgeMonth(
        entries,
        age,
        month,
        birthYear,
        birthMonth,
      );
      if (!active) continue;

      const employeesKind = classifyEmployeesEnrollmentFromIncome(
        active.category,
        active.streamType,
      );
      if (employeesKind) {
        if (!isEmployeesPensionLiableAtAgeMonth(age, month, birthMonth)) continue;
        if (age < NATIONAL_PENSION_MANDATORY_END_AGE) basicMonths += 1;
        const remunerationYen = standardRemunerationYenFromMonthlyManAt(
          active.monthlyAmountMan,
          calendarYear,
          month,
        );
        addEmployeesEnrollmentMonth(
          employeesKind === 'general' ? general : publicServant,
          calendarYear,
          month,
          remunerationYen,
          active.standardBonusYen,
        );
        continue;
      }

      if (
        age < NATIONAL_PENSION_MANDATORY_END_AGE &&
        isNationalPensionOnlyIncome(active.category, active.streamType)
      ) {
        basicMonths += 1;
      }
    }
  }

  return {
    basicYenPerYear:
      (Math.min(basicMonths, FULL_BASIC_PENSION_MONTHS) / FULL_BASIC_PENSION_MONTHS) *
      FULL_BASIC_PENSION_YEN_PER_YEAR,
    generalEmployeesYenPerYear: calcProportionalPartAnnualYen(general),
    publicServantYenPerYear: calcProportionalPartAnnualYen(publicServant),
  };
}

export function countQ7EmployeesMonthsAfterDate(
  entries: IncomeEntry[],
  member: FamilyMember,
  referenceDate: Date,
  afterYear: number,
  afterMonth: number,
): { general: number; publicServant: number } {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let general = 0;
  let publicServant = 0;

  for (const entry of entries) {
    for (const period of entry.periods) {
      const kind = classifyEmployeesEnrollmentFromIncome(
        entry.category,
        period.streamType,
      );
      if (!kind) continue;

      for (
        let age = period.startAge;
        age <= period.endAge;
        age++
      ) {
        const mStart = age === period.startAge ? period.startMonth : 1;
        const mEnd = age === period.endAge ? period.endMonth : 12;
        for (let month = mStart; month <= mEnd; month++) {
          const calYear = calcYearAtAge(
            birthYear,
            resolveMemberBirthMonth(member),
            age,
            month,
          );
          const isAfter =
            calYear > afterYear ||
            (calYear === afterYear && month > afterMonth);
          if (!isAfter) continue;
          if (!isEmployeesPensionLiableAtAgeMonth(age, month, resolveMemberBirthMonth(member))) {
            continue;
          }

          if (kind === 'general') general++;
          else publicServant++;
        }
      }
    }
  }

  return { general, publicServant };
}

export function estimateEmployeesMonthsForDependentQualification(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): { general: number; publicServant: number } {
  const careerEnd = findCareerEnd(entries);
  const q7Employees = hasAnyEmployeesPensionInQ7(entries);

  if (!careerEnd || (!q7Employees.hasGeneral && !q7Employees.hasPublicServant)) {
    // Q7 に厚生年金期間なし → 通常推計にフォールバック
    const counts = getEmployeesEnrollmentMonthCounts(member, entries, referenceDate);
    return { general: counts.generalMonths, publicServant: counts.publicServantMonths };
  }

  // 22 歳 4 月からキャリア終了（Q7 の最終月）までの月数を寛大に推計
  const startIndex = ageMonthIndex(
    ASSUMED_EMPLOYMENT_START_AGE,
    ASSUMED_EMPLOYMENT_START_MONTH,
  );
  const maxEmployeesEndIndex = EMPLOYEES_PENSION_MAX_INSURED_AGE * 12;
  const endIndex = Math.min(
    ageMonthIndex(careerEnd.age, careerEnd.month),
    maxEmployeesEndIndex,
  );
  const totalMonths = Math.max(0, endIndex - startIndex + 1);

  // 一般と公務員の内訳は通常推計の比率で按分（両方なければ一方に全量）
  const normal = getEmployeesEnrollmentMonthCounts(member, entries, referenceDate);
  const normalTotal = normal.generalMonths + normal.publicServantMonths;

  if (normalTotal === 0) {
    // 通常推計が 0（過去の就労期間が未入力）の場合は Q7 の種別で按分
    if (q7Employees.hasGeneral && q7Employees.hasPublicServant) {
      return {
        general: Math.round(totalMonths / 2),
        publicServant: Math.floor(totalMonths / 2),
      };
    }
    return {
      general: q7Employees.hasGeneral ? totalMonths : 0,
      publicServant: q7Employees.hasPublicServant ? totalMonths : 0,
    };
  }

  return {
    general: Math.round(totalMonths * (normal.generalMonths / normalTotal)),
    publicServant: Math.round(totalMonths * (normal.publicServantMonths / normalTotal)),
  };
}

/**
 * Q7 収入設定から老齢年金額（65歳満額ベース）を推定する。
 * - 老齢基礎: 加入月数に応じて減額（20歳4月〜22歳3月の大学猶予24か月は不算入）
 * - 老齢厚生: 報酬比例部分のみ（A+B）→ CF表「基本」
 * - 定額部分（特別支給の老齢厚生年金）は含めない
 */
export function estimateOldAgeAmountsFromIncome(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): EstimatedOldAgeAmountsYen {
  const { general, publicServant } = accumulateEmployeesEnrollmentFromIncome(
    member,
    entries,
    referenceDate,
  );
  const creditedMonths = getNationalPensionCreditedMonthCount(
    member,
    entries,
    referenceDate,
  );

  const generalMonths = general.preMonths + general.postMonths;
  const publicMonths = publicServant.preMonths + publicServant.postMonths;
  const totalEmployeesMonths = generalMonths + publicMonths;

  const fullBasicPensionYenPerYear =
    resolveFullBasicPensionYenPerYearForMember(member, referenceDate);
  const totalTransitional = calcTransitionalAdditionYenPerYear(
    totalEmployeesMonths,
    creditedMonths,
    fullBasicPensionYenPerYear,
  );

  // 経過的加算を厚生年金加入月数の比率で一般・公務員に按分
  const generalTransitionalYenPerYear =
    totalEmployeesMonths > 0
      ? totalTransitional * (generalMonths / totalEmployeesMonths)
      : 0;

  return {
    basicYenPerYear: calcBasicPensionYenFromCreditedMonths(
      creditedMonths,
      fullBasicPensionYenPerYear,
    ),
    generalEmployeesYenPerYear: calcProportionalPartAnnualYen(general),
    publicServantYenPerYear: calcProportionalPartAnnualYen(publicServant),
    generalTransitionalYenPerYear,
    publicTransitionalYenPerYear: totalTransitional - generalTransitionalYenPerYear,
  };
}

/**
 * 暦年月を比較用の連続月番号へ変換する。
 */
function pensionCalendarSerial(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function pensionCalendarFromSerial(serial: number): {
  year: number;
  month: number;
} {
  return {
    year: Math.floor(serial / 12),
    month: (serial % 12) + 1,
  };
}

function pensionAgeAtCalendarMonth(
  birthYear: number,
  birthMonth: number,
  year: number,
  month: number,
): number {
  let age = year - birthYear;
  if (month < birthMonth) age -= 1;
  return age;
}

/**
 * 70歳到達に伴う厚生年金被保険者期間の最終月と、
 * 70歳到達改定が年金額へ反映される最初の月を返す。
 *
 * 年齢は誕生日の前日に到達するため、1日生まれだけ月境界が1か月前へずれる。
 * birthDay が未入力の場合は、2日以後生まれと同じ月単位の概算とする。
 */
function getAge70RevisionBoundarySerials(
  member: FamilyMember,
  birthYear: number,
  birthMonth: number,
): {
  lastInsuredSerial: number;
  revisionStartSerial: number;
} {
  const birthdayMonthSerial = pensionCalendarSerial(
    birthYear + EMPLOYEES_PENSION_MAX_INSURED_AGE,
    birthMonth,
  );
  const age70ReachedMonthSerial =
    member.birthDay === 1 ? birthdayMonthSerial - 1 : birthdayMonthSerial;

  return {
    // 70歳到達日（厚生年金資格喪失日）が属する月は被保険者期間へ算入しない。
    lastInsuredSerial: age70ReachedMonthSerial - 1,
    // 70歳到達時の再計算は、70歳に到達した月の翌月分から反映。
    revisionStartSerial: age70ReachedMonthSerial + 1,
  };
}

function hasEmployeesPensionAtSerial(
  entries: IncomeEntry[],
  birthYear: number,
  birthMonth: number,
  serial: number,
  lastInsuredSerial: number,
): boolean {
  if (serial > lastInsuredSerial) return false;

  const { year, month } = pensionCalendarFromSerial(serial);
  const age = pensionAgeAtCalendarMonth(
    birthYear,
    birthMonth,
    year,
    month,
  );

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
        ) &&
        classifyEmployeesEnrollmentFromIncome(
          entry.category,
          period.streamType,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 65〜69歳の退職改定で年金額へ反映済みとなる、直近の被保険者最終月。
 *
 * Q7は月単位の就労期間なので「終了月の月末退職」として扱う。
 * 翌月も厚生年金加入が続く場合は、1か月以内の再就職相当として退職改定を発生させない。
 * 70歳到達による資格喪失は退職改定とは分け、70歳到達改定の境界で処理する。
 */
function findLatestRetirementRevisionThroughSerial(
  entries: IncomeEntry[],
  birthYear: number,
  birthMonth: number,
  currentSerial: number,
  lastInsuredSerial: number,
): number | null {
  const startSerial = pensionCalendarSerial(
    birthYear + STANDARD_OLD_AGE_START,
    birthMonth,
  );
  const scanEnd = Math.min(currentSerial - 1, lastInsuredSerial);
  let latest: number | null = null;

  for (let serial = startSerial; serial <= scanEnd; serial++) {
    if (
      !hasEmployeesPensionAtSerial(
        entries,
        birthYear,
        birthMonth,
        serial,
        lastInsuredSerial,
      )
    ) {
      continue;
    }

    // 最終被保険者月の次月が70歳到達による資格喪失月なら、
    // 退職改定ではなく70歳到達改定として扱う。
    if (serial === lastInsuredSerial) {
      continue;
    }

    const nextSerial = serial + 1;
    if (nextSerial > currentSerial) continue;

    if (
      !hasEmployeesPensionAtSerial(
        entries,
        birthYear,
        birthMonth,
        nextSerial,
        lastInsuredSerial,
      )
    ) {
      latest = serial;
    }
  }

  return latest;
}

/**
 * 65歳以降の厚生年金加入分のうち、指定月までに
 * 在職定時改定・退職改定・70歳到達時の改定で年金額へ反映済みとなる
 * 報酬比例部分（年額・円）を返す。
 *
 * - 65〜69歳の在職中: 毎年10月に前年9月〜当年8月分を追加
 * - 65〜69歳で退職: 1か月以内に再加入しない場合、退職翌月分から未反映期間を追加
 * - 70歳到達: 70歳到達月の翌月分から、被保険者最終月までの未反映期間を追加
 * - Q7の給与・賞与から標準報酬月額・標準賞与額を用いて推計
 */
export function estimatePost65EmployeesPensionIncreaseMan(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
  currentAge: number,
  currentMonth: number,
): { generalEmployeesYenPerYear: number; publicServantYenPerYear: number } {
  if (currentAge < STANDARD_OLD_AGE_START) {
    return {
      generalEmployeesYenPerYear: 0,
      publicServantYenPerYear: 0,
    };
  }

  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = member.birthMonth ?? 1;
  const currentYear = calendarYearFromAgeCalendarMonth(
    birthYear,
    birthMonth,
    currentAge,
    currentMonth,
  );
  const currentSerial = pensionCalendarSerial(currentYear, currentMonth);

  const age70Boundary = getAge70RevisionBoundarySerials(
    member,
    birthYear,
    birthMonth,
  );

  // 在職定時改定:
  // 10月分から当年8月まで、それ以前は前年8月までを反映済みとする。
  const annualRevisionThroughSerial =
    currentMonth >= 10
      ? pensionCalendarSerial(currentYear, 8)
      : pensionCalendarSerial(currentYear - 1, 8);

  let reflectedThroughSerial = annualRevisionThroughSerial;

  // 退職改定:
  // Q7上で厚生年金加入が終了し、翌月も再加入していない場合は、
  // その終了月までを退職翌月分から反映する。
  const retirementThroughSerial = findLatestRetirementRevisionThroughSerial(
    entries,
    birthYear,
    birthMonth,
    currentSerial,
    age70Boundary.lastInsuredSerial,
  );
  if (retirementThroughSerial != null) {
    reflectedThroughSerial = Math.max(
      reflectedThroughSerial,
      retirementThroughSerial,
    );
  }

  // 70歳到達時の改定:
  // 誕生日の前日に70歳へ到達し、その「翌月分」から最終被保険者月までを反映する。
  if (currentSerial >= age70Boundary.revisionStartSerial) {
    reflectedThroughSerial = Math.max(
      reflectedThroughSerial,
      age70Boundary.lastInsuredSerial,
    );
  }

  const firstPost65Serial = pensionCalendarSerial(
    birthYear + STANDARD_OLD_AGE_START,
    birthMonth,
  );
  const accumulationEndSerial = Math.min(
    reflectedThroughSerial,
    age70Boundary.lastInsuredSerial,
  );

  const general = createEmptyProportionalAccumulation();
  const publicServant = createEmptyProportionalAccumulation();

  for (
    let serial = firstPost65Serial;
    serial <= accumulationEndSerial;
    serial++
  ) {
    const { year: calendarYear, month } = pensionCalendarFromSerial(serial);
    const age = pensionAgeAtCalendarMonth(
      birthYear,
      birthMonth,
      calendarYear,
      month,
    );

    const active = findActiveIncomeAtAgeMonth(
      entries,
      age,
      month,
      birthYear,
      birthMonth,
    );
    if (!active) continue;
    const kind = classifyEmployeesEnrollmentFromIncome(
      active.category,
      active.streamType,
    );
    if (!kind) continue;

    const remunerationYen = standardRemunerationYenFromMonthlyManAt(
      active.monthlyAmountMan,
      calendarYear,
      month,
    );
    addEmployeesEnrollmentMonth(
      kind === 'publicServant' ? publicServant : general,
      calendarYear,
      month,
      remunerationYen,
      active.standardBonusYen,
    );
  }

  return {
    generalEmployeesYenPerYear: calcProportionalPartAnnualYen(general),
    publicServantYenPerYear: calcProportionalPartAnnualYen(publicServant),
  };
}
