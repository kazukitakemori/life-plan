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

/**
 * 受給開始年齢（年＋月オフセット）に対する増減率（65歳0ヶ月満額を1とする）。
 * startMonth: 0〜11 の月数オフセット（0 = startAge の誕生月と同月）。
 */
export function getOldAgeAmountFactor(
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
): number {
  const startAgeMonths = startAge * 12 + startMonth;
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
 * 生年月から繰上げ減額率を返す。
 * 昭和37年4月2日が制度境界だが本アプリは日を保持しないため、1962年4月生まれは
 * 現行率0.4%として扱う。1962年3月以前は旧率0.5%、1962年5月以降は0.4%。
 */
export function getEarlyClaimReductionPerMonthByBirth(
  birthYear: number,
  birthMonth: number,
): number {
  if (birthYear < 1962 || (birthYear === 1962 && birthMonth < 4)) {
    return EARLY_CLAIM_REDUCTION_PER_MONTH_LEGACY;
  }
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
): void {
  const factor = getOldAgeAmountFactor(startAge, startMonth, earlyReductionPerMonth);
  if (factor === 1) return;
  scaleDetailFields(detail, factor, 'earlyPayment');
}

/** 老齢基礎年金内訳に繰上げ・繰下げを反映する */
export function applyBasicDetailAdjustment(
  detail: OldAgeBasicDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
): OldAgeBasicDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth, earlyReductionPerMonth);
  return result;
}

/** 一般厚生年金内訳に繰上げ・繰下げを反映する */
export function applyGeneralDetailAdjustment(
  detail: GeneralEmployeesDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
): GeneralEmployeesDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth, earlyReductionPerMonth);
  return result;
}

/** 公務員厚生・私学共済年金内訳に繰上げ・繰下げを反映する */
export function applyPublicDetailAdjustment(
  detail: PublicServantDetail,
  startAge: number,
  startMonth: number = 0,
  earlyReductionPerMonth: number = EARLY_CLAIM_REDUCTION_PER_MONTH,
): PublicServantDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth, earlyReductionPerMonth);
  return result;
}

