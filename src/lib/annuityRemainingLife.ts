import type { Gender } from '../types/family';

/**
 * 所得税法施行令別表（第82条の3・第185条関係）の余命年数。
 * 年金の支給開始日における満年齢で参照する。
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/pdf/1622_02.pdf
 * @see https://www.jili.or.jp/knows_learns/q_a/tax/568.html
 */
const REMAINING_LIFE_YEARS_MALE: readonly number[] = [
  74, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60, 59, 58, 57,
  56, 55, 54, 53, 52, 51, 50, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39,
  38, 37, 36, 35, 34, 33, 32, 32, 31, 30, 29, 28, 27, 26, 25, 25, 24, 23, 22,
  21, 20, 20, 19, 18, 17, 17, 16, 15, 14, 14, 13, 12, 12, 11, 10, 10, 9, 8, 8,
  7, 7, 6, 6, 6, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2,
];

const REMAINING_LIFE_YEARS_FEMALE: readonly number[] = [
  80, 79, 78, 77, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63,
  62, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44,
  43, 42, 41, 40, 39, 38, 37, 36, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26,
  25, 25, 24, 23, 22, 21, 20, 19, 18, 18, 17, 16, 15, 14, 14, 13, 12, 11, 11,
  10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2,
];

/** 97歳以上は男女とも1年 */
const REMAINING_LIFE_YEARS_AGE_97_OR_OVER = 1;

/**
 * 年金支給開始年齢における余命年数（所得税法施行令別表）。
 */
export function getAnnuityRemainingLifeYears(
  ageAtAnnuityStart: number,
  gender: Gender,
): number {
  const age = Math.max(0, Math.floor(ageAtAnnuityStart));
  if (age >= 97) return REMAINING_LIFE_YEARS_AGE_97_OR_OVER;
  const table =
    gender === 'female'
      ? REMAINING_LIFE_YEARS_FEMALE
      : REMAINING_LIFE_YEARS_MALE;
  return table[age] ?? REMAINING_LIFE_YEARS_AGE_97_OR_OVER;
}
