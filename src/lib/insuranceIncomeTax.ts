import { resolveMemberAge, resolveMemberBirthMonth } from './familyDefaults';
import { getMemberAgeAtYearEnd } from './memberYearIncome';
import {
  calcMiscellaneousIncomeYen,
  calcTemporaryIncomeYen,
  MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION_YEN,
} from './incomeTaxDeductions';
import {
  calcCalendarYearGiftTaxYen,
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

export type InsuranceBenefitIncomeKind =
  | 'temporary_income'
  | 'miscellaneous_income'
  | 'gift_tax';

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
}

export function createEmptyInsuranceIncomeTaxDetail(): InsuranceIncomeTaxDetail {
  return {
    temporaryIncomeRevenueYen: 0,
    temporaryIncomeTaxableYen: 0,
    miscellaneousIncomeRevenueYen: 0,
    miscellaneousIncomeTaxableYen: 0,
    giftAmountYen: 0,
    giftTaxYen: 0,
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
  lifeMember: FamilyMember,
): number {
  if (
    !entry.benefitReceiveMemberId ||
    entry.benefitReceiveMemberId === lifeMember.id
  ) {
    return entry.benefitReceiveAge;
  }
  return entry.benefitReceiveAge;
}

/**
 * 保険金の所得区分。
 * - 契約者≠受取人 … 贈与税
 * - 年金形式の学資・個人年金 … 雑所得
 * - 一括受取・返戻金 … 一時所得
 */
export function classifyInsuranceBenefitIncomeKind(
  entry: InsuranceEntry,
  contractorId: string,
  recipientId: string,
): InsuranceBenefitIncomeKind {
  if (contractorId !== recipientId) {
    return 'gift_tax';
  }
  if (
    (entry.category === 'personal_pension' || entry.category === 'education') &&
    resolveInsuranceBenefitPayoutMode(entry.benefitPayoutMode) === 'annuity'
  ) {
    return 'miscellaneous_income';
  }
  return 'temporary_income';
}

export function classifyInsuranceBenefitTax(
  entry: InsuranceEntry,
  contractorId: string,
  recipientId: string,
): InsuranceBenefitIncomeKind {
  return classifyInsuranceBenefitIncomeKind(entry, contractorId, recipientId);
}

function applyMiscIncomeFilingExemption(
  revenueYen: number,
  taxableYen: number,
  hasSalaryIncome: boolean,
): number {
  if (
    hasSalaryIncome &&
    revenueYen > 0 &&
    revenueYen <= MISC_INCOME_FILING_EXEMPTION_REVENUE_YEN
  ) {
    return 0;
  }
  return taxableYen;
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
  revenueYen: number,
  cumulativePremiumYen: number,
): number {
  const lifeMember = resolveLifeContingentMember(
    entry,
    contractor,
    familyMembers,
  );
  const remainingLifeYears = getAnnuityRemainingLifeYears(
    resolveAnnuityStartAge(entry, lifeMember),
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
  hasSalaryIncome?: boolean;
}): InsuranceIncomeTaxDetail {
  const detail = createEmptyInsuranceIncomeTaxDetail();
  const recipient = input.familyMembers.find((m) => m.id === input.recipientId);
  if (!recipient) return detail;

  const giftAmountByDonorYen = new Map<string, number>();
  const hasSalaryIncome = input.hasSalaryIncome ?? false;

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
      const incomeKind = classifyInsuranceBenefitIncomeKind(
        entry,
        contractorId,
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
        detail.temporaryIncomeTaxableYen += calcTemporaryIncomeYen(
          revenueYen,
          cumulativePremiumYen,
        );
      } else if (incomeKind === 'miscellaneous_income') {
        const expenseYen = calcEntryAnnuityMiscExpenseYen(
          entry,
          contractor,
          input.familyMembers,
          revenueYen,
          cumulativePremiumYen,
        );
        detail.miscellaneousIncomeRevenueYen += revenueYen;
        detail.miscellaneousIncomeTaxableYen += applyMiscIncomeFilingExemption(
          revenueYen,
          calcMiscellaneousIncomeYen(revenueYen, expenseYen),
          hasSalaryIncome,
        );
      } else {
        giftAmountByDonorYen.set(
          contractorId,
          (giftAmountByDonorYen.get(contractorId) ?? 0) + revenueYen,
        );
      }
    }
  }

  const doneeAge =
    getMemberAgeAtYearEnd(
      recipient,
      input.referenceDate,
      input.calendarYear,
    ) ?? resolveMemberAge(recipient);

  for (const [donorId, giftAmountYen] of giftAmountByDonorYen) {
    const donor = input.familyMembers.find((m) => m.id === donorId);
    if (!donor) continue;
    detail.giftAmountYen += giftAmountYen;
    detail.giftTaxYen += calcCalendarYearGiftTaxYen({
      giftAmountYen,
      donor,
      donee: recipient,
      doneeAgeAtYearEnd: doneeAge,
    });
  }

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

  const isAnnual =
    (input.entry.category === 'education' ||
      input.entry.category === 'personal_pension') &&
    resolveInsuranceBenefitPayoutMode(input.entry.benefitPayoutMode) ===
      'annuity';

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
      summary: `一時所得：${yen(preview.incomeYen)}`,
      formula: `（収入${yen(preview.revenueYen)} − 払込保険料${yen(preview.expenseYen)} − 特別控除${yen(preview.specialDeductionYen)}）× 1/2`,
      expenseMissing: preview.expenseYen <= 0,
    };
  }
  return {
    kind: 'gift_tax',
    summary: `贈与税：${yen(preview.giftTaxYen)}`,
    formula: `贈与財産${yen(preview.revenueYen)}（累計払込保険料${yen(preview.expenseYen)}は控除対象外）`,
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
