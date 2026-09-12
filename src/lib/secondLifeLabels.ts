import type {
  SecondLifeHometownOption,
  SecondLifeHousingScenario,
  SecondLifeLivingLevel,
  SecondLifeNewAreaOption,
  SecondLifeRenovationScope,
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

export const SECOND_LIFE_RENOVATION_SCOPE_LABELS: Record<
  SecondLifeRenovationScope,
  string
> = {
  repair_equipment: '設備交換・修繕中心',
  partial_room: '一部の部屋をまとめて改修',
  performance: '断熱・省エネ・耐震など性能向上',
  full: '複数箇所・全面改修',
};

export const SECOND_LIFE_LIVING_LEVEL_LABELS: Record<
  SecondLifeLivingLevel,
  string
> = {
  same: '現在と同じ生活費（100%）',
  eighty_percent: '現在の80%の生活費',
  seventy_percent: '現在の70%の生活費',
  pension_based: '年金収入を目安にした生活費',
};

export function getSecondLifeHousingOptionLabel(
  state: Pick<
    SecondLifeState,
    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'
  >,
): string {
  switch (state.housingScenario) {
    case 'stay':
      if (state.stayOption === 'continue') return '現在の住まいをそのまま継続';
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
    | 'renovationScope'
  >,
): string {
  if (state.housingSkip) {
    return '住まいの変更なし（現在の入力を継続）';
  }
  const base = `${SECOND_LIFE_HOUSING_SCENARIO_LABELS[state.housingScenario]}（${getSecondLifeHousingOptionLabel(state)}）`;
  const isRenovation =
    (state.housingScenario === 'stay' && state.stayOption === 'renovate') ||
    (state.housingScenario === 'hometown' &&
      state.hometownOption === 'renovate_parents');
  return isRenovation
    ? `${base}・${SECOND_LIFE_RENOVATION_SCOPE_LABELS[state.renovationScope]}`
    : base;
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
  | 'stay'
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
  if (state.housingScenario === 'stay' && state.stayOption === 'continue') {
    return 'stay';
  }
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
  if (option === 'continue') return '現在の住まいをそのまま継続';
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
