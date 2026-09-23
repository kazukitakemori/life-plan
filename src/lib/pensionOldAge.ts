import {
  DEFERRAL_INCREASE_PER_MONTH,
  EARLY_CLAIM_REDUCTION_PER_MONTH,
  EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY,
  STANDARD_OLD_AGE_START,
} from './pensionConstants';
import {
  createEmptyOldAgePensionBreakdown,
  type GeneralEmployeesDetail,
  type OldAgeBasicDetail,
  type OldAgePensionBreakdown,
  type PublicServantDetail,
} from '../types/cashFlow';

export const OLD_AGE_EARLIEST_START_AGE = 60;
export const OLD_AGE_DEFERRAL_FIRST_AGE = 66;
export const OLD_AGE_DEFERRAL_MAX_AGE = 75;
export const OLD_AGE_DEFERRAL_MAX_AGE_LEGACY = 70;

/**
 * 繰下げ上限年齢を生年月日から返す。
 * 昭和27年4月1日以前生まれは70歳、それ以後は75歳。
 * 境界月で日が未入力の場合は、制度上限を過大に見積もらないよう70歳とする。
 */
export function getMaxOldAgeDeferralAgeByBirth(
  birthYear: number,
  birthMonth: number,
  birthDay?: number | null,
): number {
  if (birthYear < 1952) return OLD_AGE_DEFERRAL_MAX_AGE_LEGACY;
  if (birthYear > 1952) return OLD_AGE_DEFERRAL_MAX_AGE;
  if (birthMonth < 4) return OLD_AGE_DEFERRAL_MAX_AGE_LEGACY;
  if (birthMonth > 4) return OLD_AGE_DEFERRAL_MAX_AGE;
  if (birthDay == null) return OLD_AGE_DEFERRAL_MAX_AGE_LEGACY;
  return birthDay <= 1
    ? OLD_AGE_DEFERRAL_MAX_AGE_LEGACY
    : OLD_AGE_DEFERRAL_MAX_AGE;
}

/**
 * Q8の受取開始年月を制度上選択可能な範囲へ正規化する。
 * - 繰上げ: 60歳0か月〜64歳11か月
 * - 原則受給: 65歳0か月
 * - 繰下げ: 66歳0か月〜上限年齢0か月
 */
export function normalizeOldAgeBenefitStart(
  startAge: number,
  startMonth = 0,
  maxDeferralAge = OLD_AGE_DEFERRAL_MAX_AGE,
): { startAge: number; startMonth: number } {
  const age = Math.round(startAge);
  const month = Math.min(11, Math.max(0, Math.round(startMonth) || 0));
  const maxAge =
    maxDeferralAge <= OLD_AGE_DEFERRAL_MAX_AGE_LEGACY
      ? OLD_AGE_DEFERRAL_MAX_AGE_LEGACY
      : OLD_AGE_DEFERRAL_MAX_AGE;

  if (age <= OLD_AGE_EARLIEST_START_AGE) {
    return { startAge: OLD_AGE_EARLIEST_START_AGE, startMonth: age < OLD_AGE_EARLIEST_START_AGE ? 0 : month };
  }
  if (age < STANDARD_OLD_AGE_START) {
    return { startAge: age, startMonth: month };
  }
  if (age === STANDARD_OLD_AGE_START) {
    return { startAge: STANDARD_OLD_AGE_START, startMonth: 0 };
  }
  if (age < OLD_AGE_DEFERRAL_FIRST_AGE) {
    return { startAge: STANDARD_OLD_AGE_START, startMonth: 0 };
  }
  if (age >= maxAge) {
    return { startAge: maxAge, startMonth: 0 };
  }
  return { startAge: age, startMonth: month };
}

/**
 * 受給開始年齢（年＋月オフセット）に対する増減率（65歳0ヶ月満額を1とする）。
 * startMonth: 0〜11 の月数オフセット（0 = startAge の誕生月と同月）。
 */
export function getOldAgeAmountFactor(
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
  maxDeferralAge: number = OLD_AGE_DEFERRAL_MAX_AGE,
): number {
  const normalized = normalizeOldAgeBenefitStart(
    startAge,
    startMonth,
    maxDeferralAge,
  );
  const startAgeMonths =
    normalized.startAge * 12 + normalized.startMonth;
  const standardMonths = STANDARD_OLD_AGE_START * 12;
  if (startAgeMonths === standardMonths) return 1;
  if (startAgeMonths < standardMonths) {
    const monthsEarly = standardMonths - startAgeMonths;
    return Math.max(0, 1 - monthsEarly * earlyReductionPerMonth);
  }
  const monthsDeferred = startAgeMonths - standardMonths;
  return 1 + monthsDeferred * DEFERRAL_INCREASE_PER_MONTH;
}

/**
 * 生年月日から繰上げ減額率を返す。
 * 昭和37年4月2日以後生まれは1月あたり0.4%、同年4月1日以前生まれは0.5%。
 * 生年月日の日が未入力の1962年4月だけは、過大な減額を避けるため現行率0.4%で概算する。
 */
export function getEarlyClaimReductionPerMonthByBirth(
  birthYear: number,
  birthMonth: number,
  birthDay?: number | null,
): number {
  if (birthYear < 1962) return EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY;
  if (birthYear > 1962) return EARLY_CLAIM_REDUCTION_PER_MONTH;
  if (birthMonth < 4) return EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY;
  if (birthMonth > 4) return EARLY_CLAIM_REDUCTION_PER_MONTH;
  if (birthDay === 1) return EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY;
  return EARLY_CLAIM_REDUCTION_PER_MONTH;
}

/**
 * 誕生月・月オフセットを考慮した受給開始判定。
 * startMonth: 0〜11（0 = startAge ちょうどの誕生月、1 = 1ヶ月後 ...）。
 */
export function isOnOrAfterBenefitStart(
  age: number,
  calendarMonth: number,
  startAge: number,
  birthMonth: number,
  startMonth: number = 0,
): boolean {
  const monthsSinceBirthday = (calendarMonth - birthMonth + 12) % 12;
  const ageInMonths = age * 12 + monthsSinceBirthday;
  return ageInMonths >= startAge * 12 + startMonth;
}

function scaleDetailFields(
  detail: Record<string, number>,
  factor: number,
  earlyPaymentKey: string,
): void {
  let totalBefore = 0;
  for (const key of Object.keys(detail)) {
    if (key === earlyPaymentKey) continue;
    totalBefore += detail[key];
  }
  if (totalBefore <= 0) return;

  const totalAfter = totalBefore * factor;
  for (const key of Object.keys(detail)) {
    if (key === earlyPaymentKey) continue;
    detail[key] *= factor;
  }
  detail[earlyPaymentKey] = totalAfter - totalBefore;
}

/** 65歳満額ベースの内訳に繰上げ・繰下げを反映（earlyPayment に差分を格納） */
export function applyOldAgeStartAgeAdjustment(
  breakdown: OldAgePensionBreakdown,
  startAge: number,
): OldAgePensionBreakdown {
  const factor = getOldAgeAmountFactor(startAge);
  if (factor === 1) return breakdown;

  const result = createEmptyOldAgePensionBreakdown();
  result.basic = { ...breakdown.basic };
  result.generalEmployees = { ...breakdown.generalEmployees };
  result.publicServant = { ...breakdown.publicServant };

  scaleDetailFields(
    result.basic as unknown as Record<string, number>,
    factor,
    'earlyPayment',
  );
  scaleDetailFields(
    result.generalEmployees as unknown as Record<string, number>,
    factor,
    'earlyPayment',
  );
  scaleDetailFields(
    result.publicServant as unknown as Record<string, number>,
    factor,
    'earlyPayment',
  );

  return result;
}

export function yenPerYearToMonthlyMan(yenPerYear: number): number {
  if (yenPerYear <= 0) return 0;
  return yenPerYear / 12 / 10000;
}

export function toMonthlyMan(yenPerYear: number | null | undefined): number {
  return yenPerYearToMonthlyMan(yenPerYear ?? 0);
}

export function buildBasicDetailFromYen(yenPerYear: number): OldAgeBasicDetail {
  return {
    basic: toMonthlyMan(yenPerYear),
    additional: 0,
    transfer: 0,
    earlyPayment: 0,
    fund: 0,
  };
}

export function buildGeneralDetailFromYen(
  yenPerYear: number,
): GeneralEmployeesDetail {
  return {
    basic: toMonthlyMan(yenPerYear),
    transitional: 0,
    dependent: 0,
    payment: 0,
    earlyPayment: 0,
  };
}

export function buildPublicServantDetailFromYen(
  yenPerYear: number,
): PublicServantDetail {
  return {
    basic: toMonthlyMan(yenPerYear),
    transitional: 0,
    dependent: 0,
    occupational: 0,
    payment: 0,
    earlyPayment: 0,
  };
}

function applyDetailScale(
  detail: Record<string, number>,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
  maxDeferralAge: number = OLD_AGE_DEFERRAL_MAX_AGE,
): void {
  const factor = getOldAgeAmountFactor(
    startAge,
    startMonth,
    earlyReductionPerMonth,
    maxDeferralAge,
  );
  if (factor === 1) return;
  scaleDetailFields(detail, factor, 'earlyPayment');
}

/** 老齢基礎年金内訳に繰上げ・繰下げを反映する */
export function applyBasicDetailAdjustment(
  detail: OldAgeBasicDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
  maxDeferralAge: number = OLD_AGE_DEFERRAL_MAX_AGE,
): OldAgeBasicDetail {
  const result = { ...detail };
  applyDetailScale(
    result as unknown as Record<string, number>,
    startAge,
    startMonth,
    earlyReductionPerMonth,
    maxDeferralAge,
  );
  return result;
}

/** 一般厚生年金内訳に繰上げ・繰下げを反映する */
export function applyGeneralDetailAdjustment(
  detail: GeneralEmployeesDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
  maxDeferralAge: number = OLD_AGE_DEFERRAL_MAX_AGE,
): GeneralEmployeesDetail {
  const result = { ...detail };
  applyDetailScale(
    result as unknown as Record<string, number>,
    startAge,
    startMonth,
    earlyReductionPerMonth,
    maxDeferralAge,
  );
  return result;
}

/** 公務員厚生・私学共済年金内訳に繰上げ・繰下げを反映する */
export function applyPublicDetailAdjustment(
  detail: PublicServantDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
  maxDeferralAge: number = OLD_AGE_DEFERRAL_MAX_AGE,
): PublicServantDetail {
  const result = { ...detail };
  applyDetailScale(
    result as unknown as Record<string, number>,
    startAge,
    startMonth,
    earlyReductionPerMonth,
    maxDeferralAge,
  );
  return result;
}

