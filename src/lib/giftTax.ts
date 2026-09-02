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

export interface GiftTaxInput {
  giftAmountYen: number;
  donor: FamilyMember;
  donee: FamilyMember;
  doneeAgeAtYearEnd: number;
}

export function calcCalendarYearGiftTaxYen(input: GiftTaxInput): number {
  const { giftAmountYen, donor, donee, doneeAgeAtYearEnd } = input;
  if (giftAmountYen <= 0) return 0;

  const taxableGiftYen = Math.max(
    0,
    giftAmountYen - GIFT_TAX_BASIC_EXEMPTION_YEN,
  );
  if (taxableGiftYen <= 0) return 0;

  const donorAge = donor.age ?? 0;
  const useLinealRate =
    isLinealAscendantGift(donor, donee) &&
    donorAge >= 18 &&
    doneeAgeAtYearEnd >= 18;

  return calcProgressiveGiftTaxYen(
    taxableGiftYen,
    useLinealRate ? LINEAL_GIFT_TAX_BRACKETS : GENERAL_GIFT_TAX_BRACKETS,
  );
}
