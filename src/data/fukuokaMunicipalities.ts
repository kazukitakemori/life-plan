export interface Prefecture {
  code: string;
  name: string;
}

export const FUKUOKA_PREFECTURE: Prefecture = {
  code: '40',
  name: '福岡県',
};

/** 現時点で選択可能な都道府県 */
export const AVAILABLE_PREFECTURES: Prefecture[] = [FUKUOKA_PREFECTURE];

export const DEFAULT_PREFECTURE_CODE = FUKUOKA_PREFECTURE.code;

export const NATIONAL_HEALTH_DATA_VERSION = '2023';
