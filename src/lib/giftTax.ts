import type { FamilyMember } from '../types/family';

/** 暦年贈与の基礎控除（円） */
export const GIFT_TAX_BASIC_EXEMPTION_YEN = 1_100_000;

interface GiftTaxBracket {
  limitYen: number;
  rate: number;
  deductionYen: number;
}

/** 一般贈与の税率（暦年課税） */
const GENERAL_GIFT_TAX_BRACKETS: GiftTaxBracket[] = [
  { limitYen: 2_000_000, rate: 0.1, deductionYen: 0 },
  { limitYen: 3_000_000, rate: 0.15, deductionYen: 100_000 },
  { limitYen: 4_000_000, rate: 0.2, deductionYen: 250_000 },
  { limitYen: 6_000_000, rate: 0.3, deductionYen: 650_000 },
  { limitYen: 10_000_000, rate: 0.4, deductionYen: 1_250_000 },
  { limitYen: 15_000_000, rate: 0.45, deductionYen: 1_750_000 },
  { limitYen: 30_000_000, rate: 0.5, deductionYen: 2_500_000 },
  { limitYen: Number.POSITIVE_INFINITY, rate: 0.55, deductionYen: 4_000_000 },
];

/** 直系尊属からの贈与（受贈者18歳以上）の特例税率 */
const LINEAL_GIFT_TAX_BRACKETS: GiftTaxBracket[] = [
  { limitYen: 2_000_000, rate: 0.1, deductionYen: 0 },
  { limitYen: 4_000_000, rate: 0.15, deductionYen: 100_000 },
  { limitYen: 6_000_000, rate: 0.2, deductionYen: 300_000 },
  { limitYen: 10_000_000, rate: 0.3, deductionYen: 900_000 },
  { limitYen: 15_000_000, rate: 0.4, deductionYen: 1_900_000 },
  { limitYen: 30_000_000, rate: 0.45, deductionYen: 2_900_000 },
  { limitYen: 45_000_000, rate: 0.5, deductionYen: 4_400_000 },
  { limitYen: Number.POSITIVE_INFINITY, rate: 0.55, deductionYen: 6_700_000 },
];

function calcProgressiveGiftTaxYen(
  taxableGiftYen: number,
  brackets: GiftTaxBracket[],
): number {
  if (taxableGiftYen <= 0) return 0;
  for (const bracket of brackets) {
    if (taxableGiftYen <= bracket.limitYen) {
      return Math.max(
        0,
        Math.floor(taxableGiftYen * bracket.rate - bracket.deductionYen),
      );
    }
  }
  return 0;
}

/** 直系尊属（父母・祖父母）から子・孫への贈与か */
export function isLinealAscendantGift(
  donor: FamilyMember,
  donee: FamilyMember,
): boolean {
  if (donee.role !== 'child') return false;
  return donor.role === 'head' || donor.role === 'spouse';
}

export interface CalendarYearGift {
  giftAmountYen: number;
  donor: FamilyMember;
}

export interface CalendarYearGiftTaxInput {
  gifts: CalendarYearGift[];
  donee: FamilyMember;
  /**
   * 贈与年1月1日時点の年齢。
   * 生年月日が不足して判定できない場合は null とし、特例税率を自動適用しない。
   */
  doneeAgeAtJan1: number | null;
}

/**
 * 暦年課税の贈与税額。
 * 基礎控除110万円は受贈者ごとの年間贈与総額に対して1回だけ適用する。
 * 一般贈与財産と特例贈与財産が混在する場合は、国税庁の計算方法に合わせて
 * 共通の基礎控除後課税価格へ各税率を適用し、財産価額の割合で按分する。
 */
export function calcCalendarYearGiftTaxForGiftsYen(
  input: CalendarYearGiftTaxInput,
): number {
  const validGifts = input.gifts.filter((gift) => gift.giftAmountYen > 0);
  if (validGifts.length === 0) return 0;

  let generalGiftYen = 0;
  let linealGiftYen = 0;
  const canUseLinealRate =
    input.doneeAgeAtJan1 != null && input.doneeAgeAtJan1 >= 18;

  for (const gift of validGifts) {
    if (canUseLinealRate && isLinealAscendantGift(gift.donor, input.donee)) {
      linealGiftYen += gift.giftAmountYen;
    } else {
      generalGiftYen += gift.giftAmountYen;
    }
  }

  const totalGiftYen = generalGiftYen + linealGiftYen;
  const taxableGiftYen = Math.max(
    0,
    totalGiftYen - GIFT_TAX_BASIC_EXEMPTION_YEN,
  );
  if (taxableGiftYen <= 0) return 0;

  if (generalGiftYen <= 0) {
    return calcProgressiveGiftTaxYen(
      taxableGiftYen,
      LINEAL_GIFT_TAX_BRACKETS,
    );
  }
  if (linealGiftYen <= 0) {
    return calcProgressiveGiftTaxYen(
      taxableGiftYen,
      GENERAL_GIFT_TAX_BRACKETS,
    );
  }

  const linealWholeTaxYen = calcProgressiveGiftTaxYen(
    taxableGiftYen,
    LINEAL_GIFT_TAX_BRACKETS,
  );
  const generalWholeTaxYen = calcProgressiveGiftTaxYen(
    taxableGiftYen,
    GENERAL_GIFT_TAX_BRACKETS,
  );

  const linealTaxYen = Math.floor(
    (linealWholeTaxYen * linealGiftYen) / totalGiftYen,
  );
  const generalTaxYen = Math.floor(
    (generalWholeTaxYen * generalGiftYen) / totalGiftYen,
  );
  return linealTaxYen + generalTaxYen;
}

export interface GiftTaxInput {
  giftAmountYen: number;
  donor: FamilyMember;
  donee: FamilyMember;
  /** @deprecated doneeAgeAtJan1 を使用 */
  doneeAgeAtYearEnd?: number;
  doneeAgeAtJan1?: number | null;
}

/** 単一贈与向け互換API */
export function calcCalendarYearGiftTaxYen(input: GiftTaxInput): number {
  return calcCalendarYearGiftTaxForGiftsYen({
    gifts: [{ giftAmountYen: input.giftAmountYen, donor: input.donor }],
    donee: input.donee,
    doneeAgeAtJan1:
      input.doneeAgeAtJan1 ?? input.doneeAgeAtYearEnd ?? null,
  });
}
