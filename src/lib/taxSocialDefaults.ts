import { DEFAULT_PREFECTURE_CODE } from '../data/fukuokaMunicipalities';
import { normalizePrefectureCode } from './taxSocialRegions';
import type { ResidencePeriod, TaxSocialState } from '../types/taxSocial';

function createId(): string {
  return crypto.randomUUID();
}

export function createResidencePeriod(
  headAge: number,
  referenceMonth: number,
  overrides: Partial<ResidencePeriod> = {},
): ResidencePeriod {
  const prefectureCode = normalizePrefectureCode(
    overrides.prefectureCode ?? DEFAULT_PREFECTURE_CODE,
  );

  return {
    id: overrides.id ?? createId(),
    startAge: overrides.startAge ?? headAge,
    startMonth: overrides.startMonth ?? referenceMonth,
    prefectureCode,
  };
}

export function createDefaultTaxSocialState(
  headAge: number,
  referenceMonth: number,
): TaxSocialState {
  return {
    residencePeriods: [createResidencePeriod(headAge, referenceMonth)],
  };
}

export function createFollowUpResidencePeriod(
  previous: ResidencePeriod,
  headAge: number,
  referenceMonth: number,
): ResidencePeriod {
  return createResidencePeriod(headAge, referenceMonth, {
    startAge: Math.min(previous.startAge + 5, 100),
    startMonth: previous.startMonth,
    prefectureCode: previous.prefectureCode,
  });
}

export function getResidenceAgeOptions(headAge: number): number[] {
  return Array.from({ length: 101 - headAge }, (_, index) => headAge + index);
}
