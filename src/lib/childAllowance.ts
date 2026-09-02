/**
 * 児童手当（令和6年10月改正後）の月次計算。
 *
 * 入力項目は持たず、Q1 の子供メンバーから自動算出する。
 * 所得制限は撤廃済みのため、世帯所得は見ない。
 *
 * - 支給対象: 出生月 〜 18歳到達後最初の3月31日（高校生年代）
 * - 月額: 3歳未満 1.5万円 / 3歳〜高校生 1.0万円 / 第3子以降 3.0万円
 * - 第3子のカウント: 22歳到達後最初の3月31日までの子を、年上から数える
 * - 支払: 偶数月に前月分・前々月分の2か月分（公的年金と同じ現金ベース）
 */
import { calcBirthYear } from './birthDate';
import type { FamilyMember } from '../types/family';

/** 3歳未満（3歳到達月まで） */
const UNDER_3_MAN = 1.5;
/** 3歳以上〜高校生年代（第1子・第2子） */
const FROM_3_MAN = 1.0;
/** 第3子以降（年齢を問わず） */
const THIRD_PLUS_MAN = 3.0;

const ELIGIBLE_UNTIL_AGE = 18;
const COUNTABLE_UNTIL_AGE = 22;

interface YearMonth {
  year: number;
  month: number;
}

function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function isOnOrAfter(target: YearMonth, origin: YearMonth): boolean {
  return compareYearMonth(target, origin) >= 0;
}

function isOnOrBefore(target: YearMonth, limit: YearMonth): boolean {
  return compareYearMonth(target, limit) <= 0;
}

/**
 * 「N歳に達する日以後の最初の3月31日」の年月。
 * その月まで inclusive で対象。
 */
function fiscalYearEndAfterAge(
  birthYear: number,
  birthMonth: number,
  ageYears: number,
): YearMonth {
  const reachYear = birthYear + ageYears;
  if (birthMonth <= 3) {
    return { year: reachYear, month: 3 };
  }
  return { year: reachYear + 1, month: 3 };
}

function getChildBirthYearMonth(
  member: FamilyMember,
  referenceDate: Date,
): YearMonth | null {
  if (member.role !== 'child') return null;
  if (member.age == null || member.birthMonth == null) return null;
  return {
    year: calcBirthYear(member.age, member.birthMonth, referenceDate),
    month: member.birthMonth,
  };
}

function isChildInWindow(
  birth: YearMonth,
  calendar: YearMonth,
  untilAge: number,
): boolean {
  if (!isOnOrAfter(calendar, birth)) return false;
  return isOnOrBefore(calendar, fiscalYearEndAfterAge(birth.year, birth.month, untilAge));
}

function compareBirthOrder(
  a: FamilyMember,
  b: FamilyMember,
  referenceDate: Date,
): number {
  const aBirth = getChildBirthYearMonth(a, referenceDate);
  const bBirth = getChildBirthYearMonth(b, referenceDate);
  if (!aBirth || !bBirth) return 0;
  const byMonth = compareYearMonth(aBirth, bBirth);
  if (byMonth !== 0) return byMonth;
  const dayDiff = (a.birthDay ?? 1) - (b.birthDay ?? 1);
  if (dayDiff !== 0) return dayDiff;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/** 3歳到達月まで 1.5万円。誕生月に満3歳になる月を含む。 */
function isUnder3Inclusive(calendar: YearMonth, birth: YearMonth): boolean {
  const turn3: YearMonth = { year: birth.year + 3, month: birth.month };
  return isOnOrBefore(calendar, turn3);
}

function monthlyAmountMan(calendar: YearMonth, birth: YearMonth, rank: number): number {
  if (rank >= 3) return THIRD_PLUS_MAN;
  return isUnder3Inclusive(calendar, birth) ? UNDER_3_MAN : FROM_3_MAN;
}

/**
 * 当該暦月の受給資格に基づく1か月分（万円）。
 * 未出生・生年月未入力の子供は 0。
 */
export function calcHouseholdMonthlyChildAllowanceEntitlementMan(
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const calendar: YearMonth = { year: calendarYear, month: calendarMonth };
  const children = familyMembers.filter(
    (member) => getChildBirthYearMonth(member, referenceDate) != null,
  );
  if (children.length === 0) return 0;

  const countable = children
    .filter((member) => {
      const birth = getChildBirthYearMonth(member, referenceDate);
      return birth != null && isChildInWindow(birth, calendar, COUNTABLE_UNTIL_AGE);
    })
    .sort((a, b) => compareBirthOrder(a, b, referenceDate));

  if (countable.length === 0) return 0;

  let total = 0;
  for (let index = 0; index < countable.length; index++) {
    const birth = getChildBirthYearMonth(countable[index], referenceDate);
    if (!birth) continue;
    if (!isChildInWindow(birth, calendar, ELIGIBLE_UNTIL_AGE)) continue;
    total += monthlyAmountMan(calendar, birth, index + 1);
  }
  return total;
}

/**
 * 支給月の入金額（万円）。
 * 偶数月に前月分・前々月分を合計し、奇数月は 0。
 */
export function calcChildAllowancePaymentFromEntitlements(
  paymentCalendarMonth: number,
  entitlementOneMonthAgo: number,
  entitlementTwoMonthsAgo: number,
): number {
  if (paymentCalendarMonth % 2 !== 0) return 0;
  return entitlementOneMonthAgo + entitlementTwoMonthsAgo;
}

/** 当該暦月に口座へ入る児童手当（万円）。 */
export function calcHouseholdMonthlyChildAllowanceMan(
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const oneMonthAgoMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
  const oneMonthAgoYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
  const twoMonthsAgoMonth = calendarMonth <= 2 ? calendarMonth + 10 : calendarMonth - 2;
  const twoMonthsAgoYear = calendarMonth <= 2 ? calendarYear - 1 : calendarYear;

  return calcChildAllowancePaymentFromEntitlements(
    calendarMonth,
    calcHouseholdMonthlyChildAllowanceEntitlementMan(
      familyMembers,
      referenceDate,
      oneMonthAgoYear,
      oneMonthAgoMonth,
    ),
    calcHouseholdMonthlyChildAllowanceEntitlementMan(
      familyMembers,
      referenceDate,
      twoMonthsAgoYear,
      twoMonthsAgoMonth,
    ),
  );
}
