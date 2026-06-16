import {
  AVAILABLE_PREFECTURES,
  DEFAULT_PREFECTURE_CODE,
  type Prefecture,
} from '../data/fukuokaMunicipalities';

export function getPrefectureByCode(code: string): Prefecture | undefined {
  return AVAILABLE_PREFECTURES.find((prefecture) => prefecture.code === code);
}

export function normalizePrefectureCode(prefectureCode: string): string {
  return getPrefectureByCode(prefectureCode)?.code ?? DEFAULT_PREFECTURE_CODE;
}
