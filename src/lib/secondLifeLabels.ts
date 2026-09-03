import type {
  SecondLifeHometownOption,
  SecondLifeHousingScenario,
  SecondLifeLivingLevel,
  SecondLifeNewAreaOption,
  SecondLifeState,
  SecondLifeStayOption,
} from '../types/secondLife';

export const SECOND_LIFE_SKIP_LABEL = '現在の入力内容から変更はしない';

export const SECOND_LIFE_HEAD_AGE_TIMING_LABEL = '時期（世帯主年齢）';

export const SECOND_LIFE_HOUSING_SCENARIO_LABELS: Record<
  SecondLifeHousingScenario,
  string
> = {
  stay: '今の場所に住み続けたい',
  hometown: '地元に帰りたい',
  new_area: '新しい土地で暮らしたい',
};

export const SECOND_LIFE_LIVING_LEVEL_LABELS: Record<
  SecondLifeLivingLevel,
  string
> = {
  same: '現在と同水準の生活費',
  seventy_percent: '現在の7割の生活費',
  pension_based: '年金収入に応じた生活費',
};

export function getSecondLifeHousingOptionLabel(
  state: Pick<
    SecondLifeState,
    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'
  >,
): string {
  switch (state.housingScenario) {
    case 'stay':
      return state.stayOption === 'renovate'
        ? '現在の住宅をリフォーム'
        : '住宅購入・建て替え';
    case 'hometown':
      return state.hometownOption === 'renovate_parents'
        ? '実家をリフォーム'
        : '住宅購入・建て替え';
    case 'new_area':
      return state.newAreaOption === 'rent' ? '賃貸住宅' : '住宅購入・建て替え';
  }
}

export function getSecondLifeHousingDesignSummary(
  state: Pick<
    SecondLifeState,
    | 'housingSkip'
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
  >,
): string {
  if (state.housingSkip) {
    return '住まいの変更なし（現在の入力を継続）';
  }
  return `${SECOND_LIFE_HOUSING_SCENARIO_LABELS[state.housingScenario]}（${getSecondLifeHousingOptionLabel(state)}）`;
}

export function getSecondLifeLivingDesignSummary(
  state: Pick<SecondLifeState, 'livingSkip' | 'livingLevel'>,
): string {
  if (state.livingSkip) {
    return '生活費の変更なし（現在の入力を継続）';
  }
  return SECOND_LIFE_LIVING_LEVEL_LABELS[state.livingLevel];
}

export function isSecondLifeRentalHousingDesign(
  state: Pick<
    SecondLifeState,
    'housingSkip' | 'housingScenario' | 'newAreaOption'
  >,
): boolean {
  return (
    !state.housingSkip &&
    state.housingScenario === 'new_area' &&
    state.newAreaOption === 'rent'
  );
}

export type SecondLifeHousingTemplateKind =
  | 'skip'
  | 'rent'
  | 'renovate'
  | 'purchase';

export function getSecondLifeHousingTemplateKind(
  state: Pick<
    SecondLifeState,
    | 'housingSkip'
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
  >,
): SecondLifeHousingTemplateKind {
  if (state.housingSkip) return 'skip';
  if (isSecondLifeRentalHousingDesign(state)) return 'rent';

  if (
    (state.housingScenario === 'stay' && state.stayOption === 'renovate') ||
    (state.housingScenario === 'hometown' &&
      state.hometownOption === 'renovate_parents')
  ) {
    return 'renovate';
  }

  return 'purchase';
}

export function getSecondLifeStayOptionLabel(
  option: SecondLifeStayOption,
): string {
  return option === 'renovate'
    ? '現在の住宅をリフォーム'
    : '住宅購入・建て替え';
}

export function getSecondLifeHometownOptionLabel(
  option: SecondLifeHometownOption,
): string {
  return option === 'renovate_parents'
    ? '実家をリフォーム'
    : '住宅購入・建て替え';
}

export function getSecondLifeNewAreaOptionLabel(
  option: SecondLifeNewAreaOption,
): string {
  return option === 'rent' ? '賃貸住宅' : '住宅購入・建て替え';
}
