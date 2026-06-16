import { calcBirthYear, calcYearAtAge } from './birthDate';
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
  FULL_BASIC_PENSION_MONTHS,
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  PENSION_ENROLLMENT_START_AGE,
  STANDARD_OLD_AGE_START,
  UNIVERSITY_EXEMPTION_MONTHS,
  UNIVERSITY_EXEMPTION_START_AGE,
} from './pensionConstants';
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
}

interface AgeMonth {
  age: number;
  month: number;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
}

function isInAgeMonthRange(
  age: number,
  month: number,
  startAge: number,
  startMonth: number,
  endAge: number,
  endMonth: number,
): boolean {
  const current = ageMonthIndex(age, month);
  const start = ageMonthIndex(startAge, startMonth);
  const end = ageMonthIndex(endAge, endMonth);
  return current >= start && current <= end;
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
      return 'publicServant';
    default:
      return null;
  }
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
): ActiveIncome | null {
  for (const entry of entries) {
    if (entry.spouseContingencyOnly) continue;
    for (const period of entry.periods) {
      if (
        isInAgeMonthRange(
          age,
          month,
          period.startAge,
          period.startMonth,
          period.endAge,
          period.endMonth,
        )
      ) {
        return {
          category: entry.category,
          streamType: period.streamType,
          monthlyAmountMan: period.monthlyAmountMan,
        };
      }
    }
  }
  return null;
}

/** 就労期間の終了（Q2 収入の最終月） */
function findCareerEnd(entries: IncomeEntry[]): AgeMonth | null {
  let end: (AgeMonth & { endIndex: number }) | null = null;

  for (const entry of entries) {
    if (entry.spouseContingencyOnly) continue;
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

function standardRemunerationYen(monthlyAmountMan: number): number {
  return Math.max(0, monthlyAmountMan) * 10000;
}

function resolveEmployeesEnrollmentAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  member: FamilyMember,
  workProfile: CurrentWorkProfile,
  careerEnd: AgeMonth | null,
): { kind: EmployeesEnrollmentKind; monthlyAmountMan: number } | null {
  if (workProfile.situation === 'not_working') {
    return null;
  }

  if (!isAssumedEmploymentStarted(age, month)) {
    return null;
  }

  if (!careerEnd || !isOnOrBeforeAgeMonth(age, month, careerEnd.age, careerEnd.month)) {
    return null;
  }

  const active = findActiveIncomeAtAgeMonth(entries, age, month);
  const explicitKind = classifyEmployeesEnrollment(active);

  if (explicitKind) {
    return {
      kind: explicitKind,
      monthlyAmountMan: active?.monthlyAmountMan ?? 0,
    };
  }

  if (active) {
    return null;
  }

  if (!workProfile.hasEmployeesPension || !workProfile.employeesKind) {
    return null;
  }

  const startAnnualYen = getCareerStartAnnualYen(workProfile.situation);
  const annualYen = interpolateCareerAnnualIncomeYen(
    age,
    member.age,
    startAnnualYen,
    workProfile.currentAnnualYen,
  );

  return {
    kind: workProfile.employeesKind,
    monthlyAmountMan: careerAnnualIncomeToMonthlyMan(annualYen),
  };
}

/**
 * Q2 収入と現時点の働き方から厚生年金加入月を集計する。
 *
 * - 現時点で働いていない → 厚生年金加入なし（国民年金のみ想定）
 * - 会社員・公務員・自営業 → 22歳年収240万円から現年収まで線形補間
 * - アルバイト・パート → 22歳年収180万円から現年収まで線形補間
 * - Q2に入力がある月は入力を優先
 * - 就労終了は Q2 収入の最終月まで
 */
function accumulateEmployeesEnrollmentFromIncome(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): {
  general: ProportionalPartAccumulation;
  publicServant: ProportionalPartAccumulation;
} {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const general = createEmptyProportionalAccumulation();
  const publicServant = createEmptyProportionalAccumulation();
  const workProfile = resolveCurrentWorkProfile(member, entries, referenceDate);
  const careerEnd = findCareerEnd(entries);

  for (let age = PENSION_ENROLLMENT_START_AGE; age < STANDARD_OLD_AGE_START; age++) {
    for (let month = 1; month <= 12; month++) {
      const enrollment = resolveEmployeesEnrollmentAtAgeMonth(
        entries,
        age,
        month,
        member,
        workProfile,
        careerEnd,
      );
      if (!enrollment) continue;

      const calendarYear = calcYearAtAge(birthYear, member.birthMonth, age, month);
      const remunerationYen = standardRemunerationYen(enrollment.monthlyAmountMan);
      const target =
        enrollment.kind === 'general' ? general : publicServant;

      addEmployeesEnrollmentMonth(target, calendarYear, month, remunerationYen);
    }
  }

  return { general, publicServant };
}

function isUniversityExemptionMonth(
  age: number,
  month: number,
  birthMonth: number,
): boolean {
  const startIndex = ageMonthIndex(
    UNIVERSITY_EXEMPTION_START_AGE,
    birthMonth,
  );
  const currentIndex = ageMonthIndex(age, month);
  return (
    currentIndex >= startIndex &&
    currentIndex < startIndex + UNIVERSITY_EXEMPTION_MONTHS
  );
}

function hasNationalPensionCoverageAtAgeMonth(
  entries: IncomeEntry[],
  age: number,
  month: number,
  member: FamilyMember,
  workProfile: CurrentWorkProfile,
  careerEnd: AgeMonth | null,
): boolean {
  if (resolveEmployeesEnrollmentAtAgeMonth(
    entries,
    age,
    month,
    member,
    workProfile,
    careerEnd,
  )) {
    return true;
  }

  if (workProfile.situation === 'not_working') {
    return false;
  }

  if (!isAssumedEmploymentStarted(age, month)) {
    return false;
  }

  if (!careerEnd || !isOnOrBeforeAgeMonth(age, month, careerEnd.age, careerEnd.month)) {
    return false;
  }

  const active = findActiveIncomeAtAgeMonth(entries, age, month);
  if (active) {
    return active.category === 'self_employed';
  }

  return workProfile.situation === 'self_employed';
}

/**
 * ねんきん定期便なし推計用の国民年金加入月数（満額480か月で上限）。
 * 大学在学猶予24か月は算入しない。
 */
export function getNationalPensionCreditedMonthCount(
  member: FamilyMember,
  entries: IncomeEntry[],
  referenceDate: Date,
): number {
  const workProfile = resolveCurrentWorkProfile(member, entries, referenceDate);
  const careerEnd = findCareerEnd(entries);
  let count = 0;

  for (let age = PENSION_ENROLLMENT_START_AGE; age < STANDARD_OLD_AGE_START; age++) {
    for (let month = 1; month <= 12; month++) {
      if (isUniversityExemptionMonth(age, month, member.birthMonth)) {
        continue;
      }
      if (
        hasNationalPensionCoverageAtAgeMonth(
          entries,
          age,
          month,
          member,
          workProfile,
          careerEnd,
        )
      ) {
        count++;
      }
    }
  }

  return Math.min(count, FULL_BASIC_PENSION_MONTHS);
}

export function calcBasicPensionYenFromCreditedMonths(
  creditedMonths: number,
): number {
  const months = Math.max(0, Math.min(creditedMonths, FULL_BASIC_PENSION_MONTHS));
  return (months / FULL_BASIC_PENSION_MONTHS) * FULL_BASIC_PENSION_YEN_PER_YEAR;
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
 *   大学在学猶予 24 か月（20〜21 歳）が老齢基礎算定月数から除外されているが
 *   厚生年金加入月数には算入されているケース。
 */
export function calcTransitionalAdditionYenPerYear(
  totalEmployeesMonths: number,
  basicCreditedMonths: number,
): number {
  const cappedMonths = Math.min(totalEmployeesMonths, FULL_BASIC_PENSION_MONTHS);
  const diff = Math.max(0, cappedMonths - basicCreditedMonths);
  return (diff / FULL_BASIC_PENSION_MONTHS) * FULL_BASIC_PENSION_YEN_PER_YEAR;
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
): number {
  const active = findActiveIncomeAtAgeMonth(entries, age, calendarMonth);
  if (!active) return 0;
  const kind = classifyEmployeesEnrollmentFromIncome(active.category, active.streamType);
  if (!kind) return 0;
  return active.monthlyAmountMan;
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
 * Q2 に厚生年金加入期間（一般厚生 or 公務員厚生）が含まれるかを確認する。
 */
function hasAnyEmployeesPensionInQ2(entries: IncomeEntry[]): {
  hasGeneral: boolean;
  hasPublicServant: boolean;
} {
  let hasGeneral = false;
  let hasPublicServant = false;
  for (const entry of entries) {
    if (entry.spouseContingencyOnly) continue;
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
 * 通常の `getEmployeesEnrollmentMonthCounts` と異なり、**Q2 に厚生年金加入期間が
 * 存在する場合は 22 歳 4 月からキャリア終了まで全期間加入とみなす寛大推計**を使う。
 *
 * 背景: Q2 に将来の就労期間しか入力していない人（例: 現在 50 歳・非就労で
 * 51〜60 歳の就労予定だけ入力）は `workProfile = not_working` となり、
 * 通常推計では 10 年分しか計上されない。しかし 20 代から就労していた場合は
 * 加給年金の支給対象になるため、より寛大な推計を用いる。
 *
 * Q2 に厚生年金期間が全くない場合は、通常推計にフォールバックする。
 */
/**
 * 指定した暦年月（exclusive: その月は含まない）以降の
 * Q2 厚生年金加入月数を集計する。
 *
 * 定期便ありの場合、定期便の記録最終月の翌月以降の Q2 収入期間を加算し、
 * 定期便の実績月数との二重計上を避けるために使用する。
 */
export function countQ2EmployeesMonthsAfterDate(
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
    if (entry.spouseContingencyOnly) continue;
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
            member.birthMonth,
            age,
            month,
          );
          const isAfter =
            calYear > afterYear ||
            (calYear === afterYear && month > afterMonth);
          if (!isAfter) continue;

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
  const q2Employees = hasAnyEmployeesPensionInQ2(entries);

  if (!careerEnd || (!q2Employees.hasGeneral && !q2Employees.hasPublicServant)) {
    // Q2 に厚生年金期間なし → 通常推計にフォールバック
    const counts = getEmployeesEnrollmentMonthCounts(member, entries, referenceDate);
    return { general: counts.generalMonths, publicServant: counts.publicServantMonths };
  }

  // 22 歳 4 月からキャリア終了（Q2 の最終月）までの月数を寛大に推計
  const startIndex = ageMonthIndex(
    ASSUMED_EMPLOYMENT_START_AGE,
    ASSUMED_EMPLOYMENT_START_MONTH,
  );
  const endIndex = ageMonthIndex(careerEnd.age, careerEnd.month);
  const totalMonths = Math.max(0, endIndex - startIndex + 1);

  // 一般と公務員の内訳は通常推計の比率で按分（両方なければ一方に全量）
  const normal = getEmployeesEnrollmentMonthCounts(member, entries, referenceDate);
  const normalTotal = normal.generalMonths + normal.publicServantMonths;

  if (normalTotal === 0) {
    // 通常推計が 0（過去の就労期間が未入力）の場合は Q2 の種別で按分
    if (q2Employees.hasGeneral && q2Employees.hasPublicServant) {
      return {
        general: Math.round(totalMonths / 2),
        publicServant: Math.floor(totalMonths / 2),
      };
    }
    return {
      general: q2Employees.hasGeneral ? totalMonths : 0,
      publicServant: q2Employees.hasPublicServant ? totalMonths : 0,
    };
  }

  return {
    general: Math.round(totalMonths * (normal.generalMonths / normalTotal)),
    publicServant: Math.round(totalMonths * (normal.publicServantMonths / normalTotal)),
  };
}

/**
 * Q2 収入設定から老齢年金額（65歳満額ベース）を推定する。
 * - 老齢基礎: 加入月数に応じて減額（20〜22歳の大学猶予24か月は不算入）
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

  const totalTransitional = calcTransitionalAdditionYenPerYear(
    totalEmployeesMonths,
    creditedMonths,
  );

  // 経過的加算を厚生年金加入月数の比率で一般・公務員に按分
  const generalTransitionalYenPerYear =
    totalEmployeesMonths > 0
      ? totalTransitional * (generalMonths / totalEmployeesMonths)
      : 0;

  return {
    basicYenPerYear: calcBasicPensionYenFromCreditedMonths(creditedMonths),
    generalEmployeesYenPerYear: calcProportionalPartAnnualYen(general),
    publicServantYenPerYear: calcProportionalPartAnnualYen(publicServant),
    generalTransitionalYenPerYear,
    publicTransitionalYenPerYear: totalTransitional - generalTransitionalYenPerYear,
  };
}
