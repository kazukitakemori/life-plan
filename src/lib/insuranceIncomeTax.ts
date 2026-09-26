import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcMiscellaneousIncomeYen,
  calcTemporaryIncomeYen,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN,
} from './incomeTaxDeductions';
import {
  calcCalendarYearGiftTaxForGiftsYen,
  GIFT_TAX_BASIC_EXEMPTION_YEN,
} from './giftTax';
import { getAnnuityRemainingLifeYears } from './annuityRemainingLife';
import { calcEntryAnnualInsuranceBenefitMan } from './insuranceCashFlow';
import { sumInsuranceIncomeBreakdown } from '../types/cashFlow';
import { calcMemberAnnualLifeInsurancePremiumManByKind } from './lifeInsuranceDeduction';
import {
  hasReturnValueInput,
  resolveEducationAnnuityYears,
  resolveInsuranceBenefitPayoutMode,
  resolveInsurancePremiumPaymentMode,
  resolvePersonalPensionAnnuityKind,
  resolvePersonalPensionAnnuityYears,
} from './insuranceLabels';
import {
  resolveInsuranceBenefitPaymentMonth,
  resolveInsurancePremiumPeriod,
} from './insurancePeriod';
import { calcBirthYear, calcYearAtAge, getMemberAgeMonth, isAgeCalendarMonthInRange, isSamePeriodAgeMonth } from './birthDate';
import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type { InsuranceEntry, InsuranceState } from '../types/insurance';
import type { VehicleState } from '../types/vehicle';

const MAN_TO_YEN = 10_000;

function getMemberAgeAtCalendarYearStart(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
): number | null {
  if (
    member.age == null ||
    member.birthMonth == null ||
    member.birthDay == null
  ) {
    return null;
  }
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
    member.birthDay,
  );
  const birthdayAfterJan1 =
    member.birthMonth > 1 ||
    (member.birthMonth === 1 && member.birthDay > 1);
  return calendarYear - birthYear - (birthdayAfterJan1 ? 1 : 0);
}

export type InsuranceBenefitIncomeKind =
  | 'temporary_income'
  | 'miscellaneous_income'
  | 'gift_tax'
  | 'annuity_right_tax_manual'
  | 'financial_like_product_manual';

/** @deprecated Use InsuranceBenefitIncomeKind */
export type InsuranceBenefitTaxKind = InsuranceBenefitIncomeKind;

export interface InsuranceIncomeTaxDetail {
  /** 一時所得の収入金額（円・税引前の受取額） */
  temporaryIncomeRevenueYen: number;
  /** 一時所得の合計所得算入額（円） */
  temporaryIncomeTaxableYen: number;
  /** 雑所得の収入金額（円） */
  miscellaneousIncomeRevenueYen: number;
  /** 雑所得の所得金額（円） */
  miscellaneousIncomeTaxableYen: number;
  /** 贈与の財産価額（円） */
  giftAmountYen: number;
  /** 贈与税額（円） */
  giftTaxYen: number;
  /** 商品要件等の確認が必要で自動税額計算から除外した受取額（円） */
  manualReviewRevenueYen: number;
}

export function createEmptyInsuranceIncomeTaxDetail(): InsuranceIncomeTaxDetail {
  return {
    temporaryIncomeRevenueYen: 0,
    temporaryIncomeTaxableYen: 0,
    miscellaneousIncomeRevenueYen: 0,
    miscellaneousIncomeTaxableYen: 0,
    giftAmountYen: 0,
    giftTaxYen: 0,
    manualReviewRevenueYen: 0,
  };
}

export function sumInsuranceIncomeTaxableYen(
  detail: InsuranceIncomeTaxDetail,
): number {
  return (
    detail.temporaryIncomeTaxableYen + detail.miscellaneousIncomeTaxableYen
  );
}

function isPremiumDueMonth(
  entry: InsuranceEntry,
  member: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
  calendarYear: number,
  calendarMonth: number,
  referenceDate: Date,
): boolean {
  const period = resolveInsurancePremiumPeriod(
    entry,
    member,
    housingState,
    vehicleState,
  );
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return false;
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  if (
    !isAgeCalendarMonthInRange(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      period.endAge,
      period.endMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    )
  ) {
    return false;
  }

  const paymentMode = resolveInsurancePremiumPaymentMode(
    entry.premiumPaymentMode,
  );
  if (paymentMode === 'monthly') return true;
  if (paymentMode === 'lump_sum') {
    return isSamePeriodAgeMonth(
      ageMonth.age,
      ageMonth.month,
      period.startAge,
      period.startMonth,
      birthYear,
      resolveMemberBirthMonth(member),
    );
  }
  return calendarMonth === period.startMonth;
}

function calcMonthlyPremiumMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (
    !isPremiumDueMonth(
      entry,
      contractor,
      housingState,
      vehicleState,
      calendarYear,
      calendarMonth,
      referenceDate,
    )
  ) {
    return 0;
  }
  return Math.max(0, Number(entry.premiumMan) || 0);
}

/** 契約開始年から指定年までの累計払込保険料（万円） */
export function calcEntryCumulativePremiumManUpToYear(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  throughCalendarYear: number,
): number {
  const period = resolveInsurancePremiumPeriod(
    entry,
    contractor,
    housingState,
    vehicleState,
  );
  const birthYear = calcBirthYear(
    contractor.age,
    contractor.birthMonth,
    referenceDate,
  );
  const startYear = calcYearAtAge(
    birthYear,
    resolveMemberBirthMonth(contractor),
    period.startAge,
    period.startMonth,
  );

  let total = 0;
  for (let year = startYear; year <= throughCalendarYear; year += 1) {
    const monthStart = year === startYear ? period.startMonth : 1;
    const monthEnd = 12;
    for (let month = monthStart; month <= monthEnd; month += 1) {
      total += calcMonthlyPremiumMan(
        entry,
        contractor,
        housingState,
        vehicleState,
        referenceDate,
        year,
        month,
      );
    }
  }
  return total;
}

/**
 * 保険金の受取人を返す。
 * - 学資・個人年金 … beneficiaryMemberId
 * - 返戻金ありの死亡・医療・がん … beneficiaryMemberId（返戻金の受取人）
 * - それ以外 … 契約者
 */
export function resolveInsuranceBenefitRecipientId(
  entry: InsuranceEntry,
  contractorId: string,
): string {
  const usesBeneficiary =
    entry.category === 'education' ||
    entry.category === 'personal_pension' ||
    (entry.hasReturnValue && hasReturnValueInput(entry.category));
  if (usesBeneficiary && entry.beneficiaryMemberId) {
    return entry.beneficiaryMemberId;
  }
  return contractorId;
}

/**
 * 実際の保険料負担者を返す。
 * lifeDeductionPayerMemberId は生命保険料控除だけでなく、
 * 満期・解約等の受取時課税判定でも共通利用する。
 * 未設定・家族削除等で参照切れの場合は契約者へフォールバックする。
 */
export function resolveInsurancePremiumPayerId(
  entry: InsuranceEntry,
  contractorId: string,
  familyMembers?: FamilyMember[],
): string {
  const payerId = entry.lifeDeductionPayerMemberId;
  if (!payerId) return contractorId;
  if (
    familyMembers &&
    !familyMembers.some((member) => member.id === payerId)
  ) {
    return contractorId;
  }
  return payerId;
}

/**
 * 年金の総支給見込の基礎年数。
 * - 確定年金: 支給期間
 * - 終身年金: 余命年数
 * - 有期年金: min(支給期間, 余命年数)
 * @see https://www.jili.or.jp/knows_learns/q_a/tax/568.html
 */
export function resolveAnnuityPayoutEstimateYears(
  entry: InsuranceEntry,
  remainingLifeYears: number,
): number {
  if (entry.category === 'education') {
    return Math.max(1, resolveEducationAnnuityYears(entry.educationAnnuityYears));
  }
  if (entry.category === 'personal_pension') {
    const kind = resolvePersonalPensionAnnuityKind(
      entry.personalPensionAnnuityKind,
    );
    const periodYears = resolvePersonalPensionAnnuityYears(
      entry.personalPensionAnnuityYears,
    );
    if (kind === 'certain') return Math.max(1, periodYears);
    if (kind === 'term') {
      return Math.max(1, Math.min(periodYears, remainingLifeYears));
    }
    return Math.max(1, remainingLifeYears);
  }
  return 1;
}

/**
 * 必要経費の割合 = 払込保険料総額 ÷ 年金の総支給見込額。
 * 小数点以下2位まで算出し、3位以下切り上げ（所得税法施行令）。
 */
export function calcAnnuityExpenseRatio(
  cumulativePremiumYen: number,
  totalPayoutEstimateYen: number,
): number {
  if (cumulativePremiumYen <= 0 || totalPayoutEstimateYen <= 0) return 0;
  const raw = cumulativePremiumYen / totalPayoutEstimateYen;
  if (raw >= 1) return 1;
  return Math.ceil(raw * 100 - Number.EPSILON) / 100;
}

/**
 * 個人年金等の必要経費（円）=
 * その年の年金額 × (払込保険料総額 ÷ 年金の総支給見込額)
 */
export function calcAnnuityNecessaryExpenseYen(
  annualRevenueYen: number,
  cumulativePremiumYen: number,
  totalPayoutEstimateYen: number,
): number {
  if (annualRevenueYen <= 0) return 0;
  const ratio = calcAnnuityExpenseRatio(
    cumulativePremiumYen,
    totalPayoutEstimateYen,
  );
  return Math.floor(annualRevenueYen * ratio);
}

function resolveLifeContingentMember(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
): FamilyMember {
  if (entry.category === 'personal_pension' && entry.beneficiaryMemberId) {
    return (
      familyMembers.find((m) => m.id === entry.beneficiaryMemberId) ??
      contractor
    );
  }
  return contractor;
}

function resolveAnnuityStartAge(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  lifeMember: FamilyMember,
): number {
  const receiveMember =
    familyMembers.find((member) => member.id === entry.benefitReceiveMemberId) ??
    contractor;
  const receiveBirthMonth = resolveMemberBirthMonth(receiveMember);
  const receiveBirthYear = calcBirthYear(
    receiveMember.age,
    receiveBirthMonth,
    referenceDate,
    receiveMember.birthDay,
  );
  const startYear = calcYearAtAge(
    receiveBirthYear,
    receiveBirthMonth,
    entry.benefitReceiveAge,
    receiveBirthMonth,
  );
  const ageMonth = getMemberAgeMonth(
    lifeMember,
    referenceDate,
    startYear,
    receiveBirthMonth,
  );
  return ageMonth?.age ?? entry.benefitReceiveAge;
}

/**
 * 一時払かつ契約開始から5年以内の返戻金は、商品性によって
 * 金融類似商品の源泉分離課税となる可能性がある。
 * Q10の入力だけでは「一時払養老保険等」の法定要件を確定できないため、
 * 候補契約は通常の一時所得へ自動分類せず要確認とする。
 */
export function isPotentialFinancialLikeInsuranceProduct(
  entry: InsuranceEntry,
  contractor: FamilyMember,
): boolean {
  if (
    !entry.hasReturnValue ||
    !hasReturnValueInput(entry.category) ||
    entry.returnValueMan <= 0 ||
    resolveInsurancePremiumPaymentMode(entry.premiumPaymentMode) !== 'lump_sum'
  ) {
    return false;
  }
  const startIndex = entry.startAge * 12 + entry.startMonth;
  const returnIndex =
    entry.returnValueAge * 12 + resolveInsuranceBenefitPaymentMonth(contractor);
  const durationMonths = returnIndex - startIndex;
  return durationMonths >= 0 && durationMonths <= 60;
}

/**
 * 満期・解約等の受取時課税区分。
 * - 保険料負担者＝受取人 + 年金形式 … 雑所得
 * - 保険料負担者＝受取人 + 一括受取・返戻金 … 一時所得
 * - 保険料負担者≠受取人 + 一括受取 … 贈与税
 * - 保険料負担者≠受取人 + 年金形式 … 年金受給権の評価が必要なため自動計算しない
 */
export function classifyInsuranceBenefitIncomeKind(
  entry: InsuranceEntry,
  premiumPayerId: string,
  recipientId: string,
): InsuranceBenefitIncomeKind {
  const isAnnuity =
    (entry.category === 'personal_pension' || entry.category === 'education') &&
    resolveInsuranceBenefitPayoutMode(entry.benefitPayoutMode) === 'annuity';

  if (premiumPayerId !== recipientId) {
    return isAnnuity ? 'annuity_right_tax_manual' : 'gift_tax';
  }
  if (isAnnuity) {
    return 'miscellaneous_income';
  }
  return 'temporary_income';
}

export function classifyInsuranceBenefitTax(
  entry: InsuranceEntry,
  premiumPayerId: string,
  recipientId: string,
): InsuranceBenefitIncomeKind {
  return classifyInsuranceBenefitIncomeKind(entry, premiumPayerId, recipientId);
}

function calcEntryBenefitRevenueMan(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
): number {
  const benefit = calcEntryAnnualInsuranceBenefitMan(
    entry,
    contractor,
    familyMembers,
    referenceDate,
    calendarYear,
    monthStart,
    monthEnd,
  );
  return sumInsuranceIncomeBreakdown(benefit);
}

function calcEntryAnnuityMiscExpenseYen(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
  revenueYen: number,
  cumulativePremiumYen: number,
): number {
  const lifeMember = resolveLifeContingentMember(
    entry,
    contractor,
    familyMembers,
  );
  const remainingLifeYears = getAnnuityRemainingLifeYears(
    resolveAnnuityStartAge(
      entry,
      contractor,
      familyMembers,
      referenceDate,
      lifeMember,
    ),
    lifeMember.gender,
  );
  const estimateYears = resolveAnnuityPayoutEstimateYears(
    entry,
    remainingLifeYears,
  );
  const contractedAnnualYen = Math.round(
    Math.max(0, entry.benefitAmountMan) * MAN_TO_YEN,
  );
  const totalPayoutEstimateYen = contractedAnnualYen * estimateYears;
  return calcAnnuityNecessaryExpenseYen(
    revenueYen,
    cumulativePremiumYen,
    totalPayoutEstimateYen,
  );
}

export function calcRecipientInsuranceIncomeTaxDetail(input: {
  recipientId: string;
  familyMembers: FamilyMember[];
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  calendarYear: number;
  monthStart: number;
  monthEnd: number;
  /** 保険以外で同じ暦年課税へ合算する贈与額（贈与者ID→円） */
  additionalTaxableGiftsByDonorYen?: Record<string, number>;
}): InsuranceIncomeTaxDetail {
  const detail = createEmptyInsuranceIncomeTaxDetail();
  const recipient = input.familyMembers.find((m) => m.id === input.recipientId);
  if (!recipient) return detail;

  const giftAmountByDonorYen = new Map<string, number>();
  for (const [donorId, amountYen] of Object.entries(
    input.additionalTaxableGiftsByDonorYen ?? {},
  )) {
    if (amountYen > 0) {
      giftAmountByDonorYen.set(donorId, amountYen);
    }
  }
  let temporaryIncomeExpenseYen = 0;

  for (const [contractorId, entries] of Object.entries(
    input.insuranceState.byMember,
  )) {
    const contractor = input.familyMembers.find((m) => m.id === contractorId);
    if (!contractor) continue;

    for (const entry of entries) {
      const revenueMan = calcEntryBenefitRevenueMan(
        entry,
        contractor,
        input.familyMembers,
        input.referenceDate,
        input.calendarYear,
        input.monthStart,
        input.monthEnd,
      );
      if (revenueMan <= 0) continue;

      const recipientId = resolveInsuranceBenefitRecipientId(
        entry,
        contractorId,
      );
      if (recipientId !== input.recipientId) continue;

      const revenueYen = Math.round(revenueMan * MAN_TO_YEN);
      const premiumPayerId = resolveInsurancePremiumPayerId(
        entry,
        contractorId,
        input.familyMembers,
      );
      const incomeKind =
        isPotentialFinancialLikeInsuranceProduct(entry, contractor) &&
        premiumPayerId === recipientId
          ? 'financial_like_product_manual'
          : classifyInsuranceBenefitIncomeKind(
              entry,
              premiumPayerId,
              recipientId,
            );
      const cumulativePremiumYen = Math.round(
        calcEntryCumulativePremiumManUpToYear(
          entry,
          contractor,
          input.housingState,
          input.vehicleState,
          input.referenceDate,
          input.calendarYear,
        ) * MAN_TO_YEN,
      );

      if (incomeKind === 'temporary_income') {
        detail.temporaryIncomeRevenueYen += revenueYen;
        temporaryIncomeExpenseYen += cumulativePremiumYen;
      } else if (incomeKind === 'miscellaneous_income') {
        const expenseYen = calcEntryAnnuityMiscExpenseYen(
          entry,
          contractor,
          input.familyMembers,
          input.referenceDate,
          revenueYen,
          cumulativePremiumYen,
        );
        detail.miscellaneousIncomeRevenueYen += revenueYen;
        detail.miscellaneousIncomeTaxableYen += calcMiscellaneousIncomeYen(
          revenueYen,
          expenseYen,
        );
      } else if (incomeKind === 'gift_tax') {
        giftAmountByDonorYen.set(
          premiumPayerId,
          (giftAmountByDonorYen.get(premiumPayerId) ?? 0) + revenueYen,
        );
      } else {
        detail.manualReviewRevenueYen += revenueYen;
      }
      // 年金形式で保険料負担者と受取人が異なる場合は、
      // 給付事由発生時の年金受給権評価と2年目以降の課税部分計算が必要。
      // 現在の入力情報だけでは正確に自動計算できないため税額へ加算しない。
    }
  }

  detail.temporaryIncomeTaxableYen = calcTemporaryIncomeYen(
    detail.temporaryIncomeRevenueYen,
    temporaryIncomeExpenseYen,
  );

  const gifts = Array.from(giftAmountByDonorYen.entries())
    .map(([donorId, giftAmountYen]) => {
      const donor = input.familyMembers.find((m) => m.id === donorId);
      return donor ? { donor, giftAmountYen } : null;
    })
    .filter(
      (gift): gift is { donor: FamilyMember; giftAmountYen: number } =>
        gift != null,
    );

  detail.giftAmountYen = gifts.reduce(
    (sum, gift) => sum + gift.giftAmountYen,
    0,
  );
  detail.giftTaxYen = calcCalendarYearGiftTaxForGiftsYen({
    gifts,
    donee: recipient,
    doneeAgeAtJan1: getMemberAgeAtCalendarYearStart(
      recipient,
      input.referenceDate,
      input.calendarYear,
    ),
  });

  return detail;
}

/** 契約者として払込済みの保険料（万円・年間） */
export function calcContractorAnnualPremiumMan(
  member: FamilyMember,
  entries: InsuranceEntry[],
  housingState: HousingState,
  vehicleState: VehicleState,
  referenceDate: Date,
  calendarYear: number,
  monthStart: number,
  monthEnd: number,
): number {
  const premiums = calcMemberAnnualLifeInsurancePremiumManByKind({
    member,
    entries,
    housingState,
    vehicleState,
    referenceDate,
    calendarYear,
    monthStart,
    monthEnd,
  });
  return premiums.general + premiums.nursing + premiums.pension;
}

export interface InsuranceEntryIncomeTaxPreview {
  kind: InsuranceBenefitIncomeKind | 'none';
  /** 収入金額・贈与財産価額（円） */
  revenueYen: number;
  /**
   * 必要経費（円）。
   * 一時所得＝累計払込保険料、雑所得＝その年の必要経費。
   */
  expenseYen: number;
  /** 一時所得の特別控除（円）。雑所得・贈与では 0 */
  specialDeductionYen: number;
  /** 所得金額（一時所得の合計所得算入額、または雑所得）（円） */
  incomeYen: number;
  /** 贈与税額（円） */
  giftTaxYen: number;
  /** 試算対象年（受取開始年） */
  calendarYear: number | null;
  /** 年金形式で毎年同額のとき true */
  isAnnual: boolean;
}

export function createEmptyInsuranceEntryIncomeTaxPreview(): InsuranceEntryIncomeTaxPreview {
  return {
    kind: 'none',
    revenueYen: 0,
    expenseYen: 0,
    specialDeductionYen: 0,
    incomeYen: 0,
    giftTaxYen: 0,
    calendarYear: null,
    isAnnual: false,
  };
}

/** 保険エントリの受取開始年（返戻金・学資・個人年金） */
export function resolveInsuranceEntryBenefitCalendarYear(
  entry: InsuranceEntry,
  contractor: FamilyMember,
  familyMembers: FamilyMember[],
  referenceDate: Date,
): number | null {
  if (
    (entry.category === 'education' || entry.category === 'personal_pension') &&
    entry.benefitAmountMan > 0
  ) {
    const receiveMember =
      familyMembers.find((m) => m.id === entry.benefitReceiveMemberId) ??
      contractor;
    const birthYear = calcBirthYear(
      receiveMember.age,
      receiveMember.birthMonth,
      referenceDate,
    );
    const paymentMonth = resolveInsuranceBenefitPaymentMonth(receiveMember);
    return calcYearAtAge(
      birthYear,
      resolveMemberBirthMonth(receiveMember),
      entry.benefitReceiveAge,
      paymentMonth,
    );
  }

  if (entry.hasReturnValue && entry.returnValueMan > 0) {
    const birthYear = calcBirthYear(
      contractor.age,
      contractor.birthMonth,
      referenceDate,
    );
    const paymentMonth = resolveInsuranceBenefitPaymentMonth(contractor);
    return calcYearAtAge(
      birthYear,
      resolveMemberBirthMonth(contractor),
      entry.returnValueAge,
      paymentMonth,
    );
  }

  return null;
}

/**
 * 1件の保険について、受取開始年の所得区分と所得金額を試算する。
 * UIの課税区分表示に使う。
 */
export function calcInsuranceEntryIncomeTaxPreview(input: {
  entry: InsuranceEntry;
  contractor: FamilyMember;
  familyMembers: FamilyMember[];
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
}): InsuranceEntryIncomeTaxPreview {
  const empty = createEmptyInsuranceEntryIncomeTaxPreview();
  const calendarYear = resolveInsuranceEntryBenefitCalendarYear(
    input.entry,
    input.contractor,
    input.familyMembers,
    input.referenceDate,
  );
  if (calendarYear == null) return empty;

  const recipientId = resolveInsuranceBenefitRecipientId(
    input.entry,
    input.contractor.id,
  );
  const premiumPayerId = resolveInsurancePremiumPayerId(
    input.entry,
    input.contractor.id,
    input.familyMembers,
  );
  const preliminaryKind =
    isPotentialFinancialLikeInsuranceProduct(input.entry, input.contractor) &&
    premiumPayerId === recipientId
      ? 'financial_like_product_manual'
      : classifyInsuranceBenefitIncomeKind(
          input.entry,
          premiumPayerId,
          recipientId,
        );
  const isAnnual =
    (input.entry.category === 'education' ||
      input.entry.category === 'personal_pension') &&
    resolveInsuranceBenefitPayoutMode(input.entry.benefitPayoutMode) ===
      'annuity';

  if (preliminaryKind === 'financial_like_product_manual') {
    const revenueYen = Math.round(
      calcEntryBenefitRevenueMan(
        input.entry,
        input.contractor,
        input.familyMembers,
        input.referenceDate,
        calendarYear,
        1,
        12,
      ) * MAN_TO_YEN,
    );
    const expenseYen = Math.round(
      calcEntryCumulativePremiumManUpToYear(
        input.entry,
        input.contractor,
        input.housingState,
        input.vehicleState,
        input.referenceDate,
        calendarYear,
      ) * MAN_TO_YEN,
    );
    return {
      kind: 'financial_like_product_manual',
      revenueYen,
      expenseYen,
      specialDeductionYen: 0,
      incomeYen: 0,
      giftTaxYen: 0,
      calendarYear,
      isAnnual: false,
    };
  }

  if (preliminaryKind === 'annuity_right_tax_manual') {
    const revenueYen = Math.round(
      calcEntryBenefitRevenueMan(
        input.entry,
        input.contractor,
        input.familyMembers,
        input.referenceDate,
        calendarYear,
        1,
        12,
      ) * MAN_TO_YEN,
    );
    return {
      kind: 'annuity_right_tax_manual',
      revenueYen,
      expenseYen: 0,
      specialDeductionYen: 0,
      incomeYen: 0,
      giftTaxYen: 0,
      calendarYear,
      isAnnual: true,
    };
  }

  const detail = calcRecipientInsuranceIncomeTaxDetail({
    recipientId,
    familyMembers: input.familyMembers,
    insuranceState: {
      byMember: { [input.contractor.id]: [input.entry] },
    },
    housingState: input.housingState,
    vehicleState: input.vehicleState,
    referenceDate: input.referenceDate,
    calendarYear,
    monthStart: 1,
    monthEnd: 12,
  });

  const cumulativePremiumYen = Math.round(
    calcEntryCumulativePremiumManUpToYear(
      input.entry,
      input.contractor,
      input.housingState,
      input.vehicleState,
      input.referenceDate,
      calendarYear,
    ) * MAN_TO_YEN,
  );

  if (detail.miscellaneousIncomeRevenueYen > 0) {
    const revenueYen = detail.miscellaneousIncomeRevenueYen;
    const expenseYen = calcEntryAnnuityMiscExpenseYen(
      input.entry,
      input.contractor,
      input.familyMembers,
      input.referenceDate,
      revenueYen,
      cumulativePremiumYen,
    );
    return {
      kind: 'miscellaneous_income',
      revenueYen,
      expenseYen,
      specialDeductionYen: 0,
      incomeYen: detail.miscellaneousIncomeTaxableYen,
      giftTaxYen: 0,
      calendarYear,
      isAnnual,
    };
  }
  if (detail.temporaryIncomeRevenueYen > 0) {
    const revenueYen = detail.temporaryIncomeRevenueYen;
    const expenseYen = cumulativePremiumYen;
    const profitYen = Math.max(0, revenueYen - expenseYen);
    const specialDeductionYen = Math.min(
      profitYen,
      TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN,
    );
    return {
      kind: 'temporary_income',
      revenueYen,
      expenseYen,
      specialDeductionYen,
      incomeYen: detail.temporaryIncomeTaxableYen,
      giftTaxYen: 0,
      calendarYear,
      isAnnual: false,
    };
  }
  if (detail.giftAmountYen > 0) {
    return {
      kind: 'gift_tax',
      revenueYen: detail.giftAmountYen,
      /** 表示用：贈与税では控除しないが、累計払込は明示する */
      expenseYen: cumulativePremiumYen,
      specialDeductionYen: 0,
      incomeYen: 0,
      giftTaxYen: detail.giftTaxYen,
      calendarYear,
      isAnnual,
    };
  }

  return { ...empty, calendarYear, isAnnual };
}

export interface InsuranceEntryIncomeTaxPreviewParts {
  kind: InsuranceBenefitIncomeKind;
  /** 区分と課税対象額（例: 一時所得：75,000円） */
  summary: string;
  /** 算式の内訳 */
  formula: string | null;
  /** 保険料未入力などで累計払込が 0 のとき true */
  expenseMissing: boolean;
}

/** 課税区分表示用の文言パーツ */
export function formatInsuranceEntryIncomeTaxPreviewParts(
  preview: InsuranceEntryIncomeTaxPreview,
): InsuranceEntryIncomeTaxPreviewParts | null {
  if (preview.kind === 'none') return null;
  const yen = (value: number) => `${value.toLocaleString('ja-JP')}円`;
  if (preview.kind === 'miscellaneous_income') {
    return {
      kind: 'miscellaneous_income',
      summary: `雑所得：${yen(preview.incomeYen)}`,
      formula: `（収入${yen(preview.revenueYen)} − 必要経費${yen(preview.expenseYen)}）`,
      expenseMissing: preview.expenseYen <= 0,
    };
  }
  if (preview.kind === 'temporary_income') {
    return {
      kind: 'temporary_income',
      summary: `一時所得（この契約のみの目安）：${yen(preview.incomeYen)}`,
      formula: `（収入${yen(preview.revenueYen)} − 払込保険料${yen(preview.expenseYen)} − 特別控除${yen(preview.specialDeductionYen)}）× 1/2 ※同じ年の他の一時所得がある場合は合算して計算`,
      expenseMissing: preview.expenseYen <= 0,
    };
  }
  if (preview.kind === 'financial_like_product_manual') {
    return {
      kind: 'financial_like_product_manual',
      summary: '要確認：金融類似商品の源泉分離課税',
      formula:
        '一時払で5年以内に返戻金を受け取る契約は、商品要件によって差益に源泉分離課税が適用される場合があります。Q10の入力だけでは法定要件を確定できないため、この契約の税額は自動計算しません。',
      expenseMissing: false,
    };
  }
  if (preview.kind === 'annuity_right_tax_manual') {
    return {
      kind: 'annuity_right_tax_manual',
      summary: '要確認：年金受給権の課税',
      formula:
        '保険料負担者と年金受取人が異なるため、受給開始時の贈与税と、2年目以降の年金の非課税部分・課税部分を個別に確認します。この画面では税額を自動計算しません。',
      expenseMissing: false,
    };
  }
  return {
    kind: 'gift_tax',
    summary: `贈与税（この契約のみの目安）：${yen(preview.giftTaxYen)}`,
    formula: `贈与財産${yen(preview.revenueYen)}（累計払込保険料${yen(preview.expenseYen)}は控除対象外）※実際の暦年課税は同じ年に受けた他の贈与と合算`,
    expenseMissing: preview.expenseYen <= 0,
  };
}

/** 課税区分と課税対象額の文言（例: 雑所得：75,000円） */
export function formatInsuranceEntryIncomeTaxPreview(
  preview: InsuranceEntryIncomeTaxPreview,
): string | null {
  const parts = formatInsuranceEntryIncomeTaxPreviewParts(preview);
  if (!parts) return null;
  return parts.formula ? `${parts.summary} ${parts.formula}` : parts.summary;
}

export { GIFT_TAX_BASIC_EXEMPTION_YEN };
