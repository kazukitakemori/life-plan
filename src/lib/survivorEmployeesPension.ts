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
  STANDARD_OLD_AGE_START,
  SURVIVOR_EMPLOYEES_DEEMED_MONTHS,
  SURVIVOR_EMPLOYEES_OLD_AGE_QUALIFYING_MONTHS,
  SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE,
  SURVIVOR_PARENT_MIN_AGE_AT_DEATH,
  SURVIVOR_PARENT_PAYMENT_START_AGE,
  SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_MONTH,
  SURVIVOR_PREMIUM_ONE_YEAR_RULE_END_YEAR,
} from './pensionConstants';
import { createDefaultPensionMemberState, migrateTeikibinOver50Form } from './pensionDefaults';
import {
  accumulateEmployeesEnrollmentUntilAgeMonth,
  getActiveEmployeesMonthlyRemunerationMan,
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
import type {
  NenkinTeikibinMonthlyRow,
  PensionByMember,
  PensionMemberState,
} from '../types/pension';
import {
  addCalendarMonths,
  type CalendarYearMonth,
} from './housingLoanAmortization';
import type { RequiredCoverageSubject } from '../types/requiredCoverage';

function calendarIndex(year: number, month: number): number {
  return year * 12 + month;
}

function ageMonthIndex(age: number, month: number): number {
  return age * 12 + month;
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

function isUnpaidNationalPensionStatus(status: string): boolean {
  return (
    status === 'unpaid' ||
    status === 'half-unpaid' ||
    status === 'three-quarter-unpaid' ||
    status === 'quarter-unpaid'
  );
}

function isConfirmedCoveredMonthlyRow(
  row: NenkinTeikibinMonthlyRow,
): boolean {
  // 厚生年金加入月は国民年金欄が空欄でも納付要件上の加入期間になる。
  if (row.employeesPensionCategory) return true;
  if (!row.nationalPensionStatus || row.nationalPensionStatus === 'pending') {
    return false;
  }
  return !isUnpaidNationalPensionStatus(row.nationalPensionStatus);
}

function listRecordedMonthlyRows(
  memberState: PensionMemberState,
): Array<{ serial: number; row: NenkinTeikibinMonthlyRow }> {
  if (memberState.pastEnrollment === 'none') return [];

  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-over50'
      ? migrateTeikibinOver50Form(memberState.teikibinOver50)
      : memberState.teikibinUnder50;
  const latestSerial =
    form.recentMonthlyYear * 12 + (form.recentMonthlyMonth - 1);
  const rows = form.monthlyRows.slice(0, 12).map((row, index) => ({
    serial: latestSerial - 12 + index,
    row,
  }));

  if (memberState.pastEnrollment === 'nenkin-teikibin-over50') {
    rows.push({
      serial: latestSerial,
      row: migrateTeikibinOver50Form(memberState.teikibinOver50)
        .recentMonthlyInputRow,
    });
  }
  return rows;
}

export function hasConfirmedNoUnpaidInRecentYear(
  memberState: PensionMemberState,
  deathYear: number,
  deathMonth: number,
): boolean {
  const requiredEndSerial = deathYear * 12 + (deathMonth - 1) - 2;
  const requiredStartSerial = requiredEndSerial - 11;
  const selected = listRecordedMonthlyRows(memberState).filter(
    ({ serial }) =>
      serial >= requiredStartSerial && serial <= requiredEndSerial,
  );
  if (selected.length !== 12) return false;
  return selected.every(({ row }) => isConfirmedCoveredMonthlyRow(row));
}

function recordedPremiumEligibleMonths(memberState: PensionMemberState): number {
  if (memberState.pastEnrollment === 'none') return 0;
  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-over50'
      ? migrateTeikibinOver50Form(memberState.teikibinOver50)
      : memberState.teikibinUnder50;
  // 「これまでの年金加入期間」の第1号は未納月を除き、
  // 納付済・免除（学生納付特例等を含む）を計上する。第3号・厚生年金も
  // 納付要件上の期間に含められる。合算対象期間は3分の2要件には含めない。
  return [
    form.nationalPensionType1Months,
    form.nationalPensionType3Months,
    form.seamenInsuranceMonths,
    form.employeesPensionGeneralMonths,
    form.employeesPensionPublicServantMonths,
    form.employeesPensionPrivateSchoolMonths,
  ].reduce<number>((sum, value) => sum + Math.max(0, value ?? 0), 0);
}

function recordedLongTermQualifyingMonths(memberState: PensionMemberState): number {
  if (memberState.pastEnrollment === 'none') return 0;
  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-over50'
      ? migrateTeikibinOver50Form(memberState.teikibinOver50)
      : memberState.teikibinUnder50;
  return (
    recordedPremiumEligibleMonths(memberState) +
    Math.max(0, form.consolidationPeriodMonths ?? 0)
  );
}

export function hasConfirmedLongTermSurvivorQualification(
  memberState: PensionMemberState,
): boolean {
  // 第1号の前納は最大24か月まで将来月が混在し得るため安全側に控除する。
  const recordedLongTermMonths = Math.max(
    0,
    recordedLongTermQualifyingMonths(memberState) - 24,
  );
  return recordedLongTermMonths >= SURVIVOR_EMPLOYEES_OLD_AGE_QUALIFYING_MONTHS;
}

function maximumNationalPensionInsuredMonthsUntil(
  member: FamilyMember,
  referenceDate: Date,
  cutoff: CalendarYearMonth,
): number {
  const cutoffAge = getMemberAgeMonth(
    member,
    referenceDate,
    cutoff.year,
    cutoff.month,
  );
  if (!cutoffAge || cutoffAge.age < 20) return 0;
  const start = ageMonthIndex(20, 1);
  const end = Math.min(
    ageMonthIndex(cutoffAge.age, cutoffAge.month),
    ageMonthIndex(59, 12),
  );
  return Math.max(0, end - start + 1);
}

/**
 * ねんきん定期便の累計加入期間だけで3分の2要件を確実に満たすといえるか。
 *
 * 第1号欄は未納月数を除くが、前納期間が将来月まで含まれる場合があるため、
 * 最大2年（24月）を安全側に差し引いた下限値で判定する。
 * 判定できない場合はfalseであり、「要件を満たさない」と断定する意味ではない。
 */
export function hasConfirmedTwoThirdsPremiumRequirement(
  member: FamilyMember,
  memberState: PensionMemberState,
  referenceDate: Date,
  death: CalendarYearMonth,
): boolean {
  if (memberState.pastEnrollment === 'none') return false;
  const cutoff = addCalendarMonths(death, -2);
  const possible = maximumNationalPensionInsuredMonthsUntil(
    member,
    referenceDate,
    cutoff,
  );
  if (possible <= 0) return true;
  const conservativeRecorded = Math.max(
    0,
    recordedPremiumEligibleMonths(memberState) - 24,
  );
  return conservativeRecorded * 3 >= possible * 2;
}

export type SurvivorPremiumRequirementAssessment =
  | {
      status: 'met';
      basis: 'manual' | 'one_year_no_unpaid' | 'two_thirds_recorded';
    }
  | {
      status: 'not_met';
      basis: 'manual';
    }
  | {
      status: 'unconfirmed';
      basis: 'insufficient_record';
    };

export function resolveSurvivorPremiumRequirementAssessment(
  deceased: FamilyMember,
  memberState: PensionMemberState,
  referenceDate: Date,
  death: CalendarYearMonth,
): SurvivorPremiumRequirementAssessment {
  const setting =
    memberState.benefitSettings.survivorPremiumRequirement ?? 'auto';
  if (setting === 'met') return { status: 'met', basis: 'manual' };
  if (setting === 'not_met') {
    return { status: 'not_met', basis: 'manual' };
  }

  const deathAge = getMemberAgeMonth(
    deceased,
    referenceDate,
    death.year,
    death.month,
  );
  if (!deathAge) {
    return { status: 'unconfirmed', basis: 'insufficient_record' };
  }

  if (
    isWithinOneYearPremiumException(
      memberState,
      death.year,
      death.month,
      deathAge.age,
    )
  ) {
    return { status: 'met', basis: 'one_year_no_unpaid' };
  }
  if (
    hasConfirmedTwoThirdsPremiumRequirement(
      deceased,
      memberState,
      referenceDate,
      death,
    )
  ) {
    return { status: 'met', basis: 'two_thirds_recorded' };
  }
  return { status: 'unconfirmed', basis: 'insufficient_record' };
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

  // 1級・2級の障害厚生年金受給権者の死亡は、保険料納付要件を別途求めず
  // 短期要件と同じ300月みなしの対象となる。
  const disabilityEmployeesQualification =
    deceased.disability === 'has' &&
    (deceased.disabilityPension === 'employees_grade1' ||
      deceased.disabilityPension === 'employees_grade2');
  if (disabilityEmployeesQualification) {
    return 'short_term';
  }

  if (insured) {
    const premiumAssessment = resolveSurvivorPremiumRequirementAssessment(
      deceased,
      memberState,
      referenceDate,
      death,
    );
    if (premiumAssessment.status === 'met') {
      return 'short_term';
    }
  }

  // 現在の被保険者かどうかにかかわらず、25年以上の長期要件を
  // ねんきん定期便の記録で確認できる場合は長期要件を優先できる。
  if (hasConfirmedLongTermSurvivorQualification(memberState)) {
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

export type SurvivorContinuationAnnualPensionResolution =
  | 'qualifying_disability'
  | 'income_adjusted'
  | 'thresholds_unavailable'
  | 'income_unavailable';

export interface SurvivorContinuationAnnualPensionResult {
  annualPensionYen: number | null;
  suspensionYen: number | null;
  resolution: SurvivorContinuationAnnualPensionResolution;
  incomeBasis: SurvivorContinuationIncomeBasis | null;
}

/**
 * 5年有期給付終了後の継続給付年額を解決する。
 *
 * 障害要件は「障害状態」だけでは足りず、法令上の障害年金受給権等の要件を
 * 満たすことを呼び出し側が確認できた場合だけ true を渡す。
 * 所得基準額は政令の公式確定値を外部から渡す。未確定の目安値は使用しない。
 */
export function resolveSurvivorContinuationAnnualPensionYen(input: {
  recipient: FamilyMember;
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember?: PriorYearIncomeByMember;
  referenceDate: Date;
  paymentYear: number;
  paymentMonth: number;
  enhancedAnnualPensionYen: number;
  thresholds?: SurvivorContinuationIncomeThresholdsYen;
  hasQualifyingDisabilityPensionEntitlement: boolean;
}): SurvivorContinuationAnnualPensionResult {
  const pension = Math.max(0, input.enhancedAnnualPensionYen);

  if (input.hasQualifyingDisabilityPensionEntitlement) {
    return {
      annualPensionYen: pension,
      suspensionYen: 0,
      resolution: 'qualifying_disability',
      incomeBasis: null,
    };
  }

  if (!input.thresholds) {
    return {
      annualPensionYen: null,
      suspensionYen: null,
      resolution: 'thresholds_unavailable',
      incomeBasis: null,
    };
  }

  const incomeBasis = resolveSurvivorContinuationIncomeBasis({
    recipient: input.recipient,
    incomeByMember: input.incomeByMember,
    priorYearIncomeByMember: input.priorYearIncomeByMember,
    referenceDate: input.referenceDate,
    paymentYear: input.paymentYear,
    paymentMonth: input.paymentMonth,
  });
  if (incomeBasis.totalIncomeYen == null) {
    return {
      annualPensionYen: null,
      suspensionYen: null,
      resolution: 'income_unavailable',
      incomeBasis,
    };
  }

  const suspensionYen = calcSurvivorContinuationSuspensionYen({
    priorIncomeYen: incomeBasis.totalIncomeYen,
    annualPensionYen: pension,
    thresholds: input.thresholds,
  });
  return {
    annualPensionYen: Math.max(0, pension - suspensionYen),
    suspensionYen,
    resolution: 'income_adjusted',
    incomeBasis,
  };
}

/**
 * 所得判定を免除して継続給付を全額支給できる障害年金の受給状況か。
 *
 * 2028年改正後の厚生年金保険法65条4項は、
 * - 障害基礎年金: 1級・2級
 * - 障害厚生年金: 1級・2級・3級
 * の受給権者で、現に障害等級に該当する状態にある場合を対象とする。
 * 「障害あり」だけでは受給権を推測しない。
 */
export function hasQualifyingSurvivorContinuationDisabilityPension(
  member: FamilyMember,
): boolean {
  if (member.disability !== 'has') return false;
  switch (member.disabilityPension ?? 'none') {
    case 'basic_grade1':
    case 'basic_grade2':
    case 'employees_grade1':
    case 'employees_grade2':
    case 'employees_grade3':
      return true;
    default:
      return false;
  }
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

function survivorReformWifeFiniteMaxAge(start: CalendarYearMonth): number {
  if (!isOnOrAfterSurvivorReform(start)) return CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE;
  // 2028年度は40歳未満から開始し、その後は毎年度1歳ずつ対象上限を引き上げ、
  // 2048年度に60歳未満へ到達する。子の失権後に有期給付へ移る場合は
  // 死亡時ではなく、その有期給付の開始時点で判定する。
  const fiscalYear = start.month >= 4 ? start.year : start.year - 1;
  return Math.min(60, 40 + Math.max(0, fiscalYear - 2028));
}

function resolveReformSpouseFiniteStart(
  spouse: FamilyMember,
  hadEligibleChildrenAtDeath: boolean,
  referenceDate: Date,
  death: CalendarYearMonth,
  survivorBasicLoss: CalendarYearMonth | null,
): CalendarYearMonth | null {
  if (!isOnOrAfterSurvivorReform(death)) return null;
  const start =
    hadEligibleChildrenAtDeath && survivorBasicLoss ? survivorBasicLoss : death;
  const startAge = getMemberAgeMonth(
    spouse,
    referenceDate,
    start.year,
    start.month,
  );
  if (!startAge || startAge.age >= 60) return null;
  if (spouse.gender === 'male') return start;
  return startAge.age < survivorReformWifeFiniteMaxAge(start) ? start : null;
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
  if (isOnOrAfterSurvivorReform(death)) {
    return Boolean(
      resolveReformSpouseFiniteStart(
        spouse,
        hadEligibleChildrenAtDeath,
        referenceDate,
        death,
        survivorBasicLoss,
      ),
    );
  }

  const start =
    hadEligibleChildrenAtDeath && survivorBasicLoss ? survivorBasicLoss : death;
  const startAge = getMemberAgeMonth(
    spouse,
    referenceDate,
    start.year,
    start.month,
  );
  return Boolean(
    startAge &&
      spouse.gender === 'female' &&
      startAge.age < CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE,
  );
}

export interface SurvivorContinuationAssessmentTarget {
  member: FamilyMember;
  finiteBenefitStart: CalendarYearMonth;
  finiteBenefitEnd: CalendarYearMonth;
  assessmentEndAge: number;
  /**
   * 現行保存データだけでは所得基準額・障害年金受給権を確定できないため、
   * この段階では支給可否ではなく「継続給付の判定対象」であることだけを示す。
   */
  reason: 'income_or_disability';
}

/**
 * 2028年改正の5年有期給付が終了した後、最長65歳までの継続給付を
 * 判定する必要がある配偶者を特定する。
 *
 * ここでは所得基準額や障害年金受給権を推測せず、判定対象の時間軸だけを確定する。
 */
export function resolveSurvivorContinuationAssessmentTarget(
  familyMembers: FamilyMember[],
  subject: RequiredCoverageSubject,
  referenceDate: Date,
  death: CalendarYearMonth,
  now: CalendarYearMonth,
): SurvivorContinuationAssessmentTarget | null {
  if (!isOnOrAfterSurvivorReform(death)) return null;

  const deceased = familyMembers.find((member) => member.role === subject);
  if (!deceased) return null;
  const remaining = familyMembers.filter(
    (member) => member.role !== 'pet' && member.id !== deceased.id,
  );
  const survivorRole = subject === 'head' ? 'spouse' : 'head';
  const spouse = remaining.find((member) => member.role === survivorRole);
  if (!spouse) return null;

  const childrenAtDeath = listEligibleSurvivorBasicChildren(
    remaining,
    referenceDate,
    death.year,
    death.month,
  );
  const childrenNow = listEligibleSurvivorBasicChildren(
    remaining,
    referenceDate,
    now.year,
    now.month,
  );
  const receivesSurvivorBasicNow = childrenNow.length > 0;

  let survivorBasicLoss: CalendarYearMonth | null = null;
  if (childrenAtDeath.length > 0) {
    const start = calendarIndex(death.year, death.month);
    for (let offset = 1; offset <= 25 * 12; offset++) {
      const serial = start + offset;
      const year = Math.floor((serial - 1) / 12);
      const month = ((serial - 1) % 12) + 1;
      if (
        listEligibleSurvivorBasicChildren(
          remaining,
          referenceDate,
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
    !isSpouseFiniteSurvivorEmployeesBenefit(
      spouse,
      childrenAtDeath.length > 0,
      referenceDate,
      death,
      receivesSurvivorBasicNow,
      survivorBasicLoss,
    )
  ) {
    return null;
  }

  const finiteBenefitStart =
    childrenAtDeath.length > 0 && survivorBasicLoss
      ? survivorBasicLoss
      : death;
  const finiteBenefitEnd = fiveYearEnd(finiteBenefitStart);
  if (
    calendarIndex(now.year, now.month) <=
    calendarIndex(finiteBenefitEnd.year, finiteBenefitEnd.month)
  ) {
    return null;
  }

  const nowAge = getMemberAgeMonth(
    spouse,
    referenceDate,
    now.year,
    now.month,
  );
  if (!nowAge || nowAge.age >= STANDARD_OLD_AGE_START) return null;

  return {
    member: spouse,
    finiteBenefitStart,
    finiteBenefitEnd,
    assessmentEndAge: STANDARD_OLD_AGE_START,
    reason: 'income_or_disability',
  };
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

  if (isOnOrAfterSurvivorReform(death)) {
    const reformFiniteStart = resolveReformSpouseFiniteStart(
      spouse,
      hadEligibleChildrenAtDeath,
      referenceDate,
      death,
      survivorBasicLoss,
    );
    if (reformFiniteStart) {
      const end = fiveYearEnd(reformFiniteStart);
      return calendarIndex(now.year, now.month) <= calendarIndex(end.year, end.month);
    }

    // 子の遺族基礎年金が60歳以後に失権した場合や、女性の段階移行で
    // 有期給付の対象外となる場合は5年で打ち切らず、従来どおりの期間判定へ進む。
    if (hadEligibleChildrenAtDeath && survivorBasicLoss) return true;
    if (spouse.gender === 'female') return true;
    if (deathAge.age < 60) return false;
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
      fiveYearStartAge.age < CHILDLESS_WIFE_FIVE_YEAR_MAX_AGE
    ) {
      const end = fiveYearEnd(fiveYearStart);
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

function isEligibleSurvivorEmployeesGrandchild(
  member: FamilyMember,
  referenceDate: Date,
  year: number,
  month: number,
): boolean {
  if (
    member.role !== 'other' ||
    member.otherRelationship !== 'grandchild'
  ) {
    return false;
  }
  const ageMonth = getMemberAgeMonth(member, referenceDate, year, month);
  if (!ageMonth) return false;

  const ordinaryEnd = survivorChildOrdinaryEnd(member, referenceDate);
  if (
    ordinaryEnd &&
    calendarIndex(year, month) <=
      calendarIndex(ordinaryEnd.year, ordinaryEnd.month)
  ) {
    return true;
  }

  return (
    member.disability === 'has' &&
    (member.disabilityGrade === 'grade1' ||
      member.disabilityGrade === 'grade2') &&
    ageMonth.age < 20
  );
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
  kind: 'spouse' | 'child' | 'parent' | 'grandchild' | 'grandparent';
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

  const grandchild = remaining.find((member) =>
    isEligibleSurvivorEmployeesGrandchild(
      member,
      referenceDate,
      now.year,
      now.month,
    ),
  );
  if (grandchild) {
    return { member: grandchild, kind: 'grandchild' };
  }

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
}): {
  detail: SurvivorEmployeesDetail;
  recipientId: string | null;
  continuationAssessment: SurvivorContinuationAssessmentTarget | null;
} {
  const empty = {
    detail: createEmptySurvivorEmployeesDetail(),
    recipientId: null,
    continuationAssessment: null,
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
  const continuationAssessment =
    resolveSurvivorContinuationAssessmentTarget(
      input.familyMembers,
      input.subject,
      input.referenceDate,
      input.death,
      now,
    );

  // 継続給付の判定期間中は、後順位の遺族へ受給者を移さない。
  // 障害年金の受給権を確認できる場合だけ、この後で全額継続へ解決する。
  const recipient = continuationAssessment
    ? null
    : resolveSurvivorEmployeesRecipient(
        input.familyMembers,
        input.subject,
        input.referenceDate,
        input.death,
        now,
      );
  if (!continuationAssessment && !recipient) return empty;

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

  if (continuationAssessment) {
    const continuation = resolveSurvivorContinuationAnnualPensionYen({
      recipient: continuationAssessment.member,
      incomeByMember: input.coverageIncomeByMember,
      referenceDate: input.referenceDate,
      paymentYear: input.year,
      paymentMonth: input.month,
      enhancedAnnualPensionYen:
        baseYen / SURVIVOR_EMPLOYEES_PROPORTIONAL_RATE,
      hasQualifyingDisabilityPensionEntitlement:
        hasQualifyingSurvivorContinuationDisabilityPension(
          continuationAssessment.member,
        ),
    });

    // 障害年金受給権を確認できれば所得に関係なく全額継続。
    // それ以外は政令の所得基準額が公式確定するまで推測額を計上しない。
    if (continuation.annualPensionYen == null) {
      return { ...empty, continuationAssessment };
    }
    return {
      detail: {
        ...createEmptySurvivorEmployeesDetail(),
        basic: toMonthlyMan(continuation.annualPensionYen),
      },
      recipientId: continuationAssessment.member.id,
      continuationAssessment: null,
    };
  }

  if (!recipient) return empty;

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
    continuationAssessment: null,
  };
}

export function calcCoverageSurvivorEmployeesMonthlyMan(
  input: Parameters<typeof calcCoverageSurvivorEmployeesDetail>[0],
): number {
  const { detail } = calcCoverageSurvivorEmployeesDetail(input);
  return detail.basic + detail.middleAged + detail.occupational + detail.transitional + detail.payment;
}
