import {
  DEFERRAL_INCREASE_PER_MONTH,
  EARLY_CLAIM_REDUCTION_PER_MONTH,
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
export function getOldAgeAmountFactor(startAge: number, startMonth: number = 0): number {
  const startAgeMonths = startAge * 12 + startMonth;
  const standardMonths = STANDARD_OLD_AGE_START * 12;
  if (startAgeMonths === standardMonths) return 1;
  if (startAgeMonths < standardMonths) {
    const monthsEarly = standardMonths - startAgeMonths;
    return Math.max(0, 1 - monthsEarly * EARLY_CLAIM_REDUCTION_PER_MONTH);
  }
  const monthsDeferred = startAgeMonths - standardMonths;
  return 1 + monthsDeferred * DEFERRAL_INCREASE_PER_MONTH;
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
): void {
  const factor = getOldAgeAmountFactor(startAge, startMonth);
  if (factor === 1) return;
  scaleDetailFields(detail, factor, 'earlyPayment');
}

/** 老齢基礎年金内訳に繰上げ・繰下げを反映する */
export function applyBasicDetailAdjustment(
  detail: OldAgeBasicDetail,
  startAge: number,
  startMonth: number = 0,
): OldAgeBasicDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth);
  return result;
}

/** 一般厚生年金内訳に繰上げ・繰下げを反映する */
export function applyGeneralDetailAdjustment(
  detail: GeneralEmployeesDetail,
  startAge: number,
  startMonth: number = 0,
): GeneralEmployeesDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth);
  return result;
}

/** 公務員厚生・私学共済年金内訳に繰上げ・繰下げを反映する */
export function applyPublicDetailAdjustment(
  detail: PublicServantDetail,
  startAge: number,
  startMonth: number = 0,
): PublicServantDetail {
  const result = { ...detail };
  applyDetailScale(result as unknown as Record<string, number>, startAge, startMonth);
  return result;
}

