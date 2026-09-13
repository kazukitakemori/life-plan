import type { SecondLifeRenovationScope, SecondLifeState } from '../types/secondLife';
import type { SecondLifeHousingFinancePlan } from '../types/housing';
import { getSecondLifeHousingTemplateKind } from './secondLifeLabels';

export const SECOND_LIFE_MOVING_COST_MAN = 50;
export const SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN = 300;

// 住宅リフォーム推進協議会 2025年度調査では、50代以上の実施費用は
// 中央値220万円・平均358.4万円。工事内容別相場ではないため、以下は
// 最新の消費者調査と住まいるダイヤル2026見積事例を踏まえた「試算開始用の参考額」。
// 実際の見積額が分かる場合は必ずユーザー入力を優先する。
export const SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN = 220;
export const SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN = 358.4;

export const SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN: Record<
  SecondLifeRenovationScope,
  number
> = {
  repair_equipment: 220,
  partial_room: 300,
  performance: 300,
  full: 1000,
};

export function getSecondLifeRenovationReferenceCostMan(
  scope: SecondLifeRenovationScope,
): number {
  return SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN[scope];
}

export const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN =
  SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN.repair_equipment;
export const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN =
  SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN.repair_equipment;

// 購入・建て替え、家賃は地域・物件差が大きいため全国一律額を自動入力しない。
export const SECOND_LIFE_PURCHASE_REBUILD_MAN = 0;
export const SECOND_LIFE_DEFAULT_RENT_MAN = 0;

export function getDefaultSecondLifeHousingBaseCostMan(
  state: Pick<
    SecondLifeState,
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
    | 'renovationScope'
  >,
): number {
  if (state.housingScenario === 'stay') {
    if (state.stayOption === 'continue') return 0;
    return state.stayOption === 'renovate'
      ? getSecondLifeRenovationReferenceCostMan(state.renovationScope)
      : SECOND_LIFE_PURCHASE_REBUILD_MAN;
  }
  if (state.housingScenario === 'hometown') {
    return state.hometownOption === 'renovate_parents'
      ? getSecondLifeRenovationReferenceCostMan(state.renovationScope)
      : SECOND_LIFE_PURCHASE_REBUILD_MAN;
  }
  return state.newAreaOption === 'rent' ? 0 : SECOND_LIFE_PURCHASE_REBUILD_MAN;
}

export function getSecondLifeHousingLoanPrincipalMan(
  state: Pick<
    SecondLifeState,
    'housingBaseCostMan' | 'housingLoanDownPaymentMan'
  >,
): number {
  const cost = Math.max(0, state.housingBaseCostMan);
  const down = Math.min(cost, Math.max(0, state.housingLoanDownPaymentMan));
  return Math.max(0, cost - down);
}

export function isSecondLifeHousingLoanConfigured(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): boolean {
  return (
    state.housingPaymentMethod === 'loan' &&
    getSecondLifeHousingLoanPrincipalMan(state) > 0 &&
    state.housingLoanInterestRatePct != null &&
    Number.isFinite(state.housingLoanInterestRatePct) &&
    state.housingLoanInterestRatePct >= 0 &&
    state.housingLoanYears != null &&
    Number.isFinite(state.housingLoanYears) &&
    state.housingLoanYears > 0
  );
}

/**
 * ローン未設定・支払方法未定の場合は、借入を勝手に作らず全額を一括支出として扱う。
 */
export function getSecondLifeHousingCashPaymentMan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): number {
  const cost = Math.max(0, state.housingBaseCostMan);
  if (!isSecondLifeHousingLoanConfigured(state)) return cost;
  return Math.min(cost, Math.max(0, state.housingLoanDownPaymentMan));
}

export function buildSecondLifeHousingFinancePlan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
  purpose: SecondLifeHousingFinancePlan['purpose'],
  startAge: number,
): SecondLifeHousingFinancePlan {
  const configured = isSecondLifeHousingLoanConfigured(state);
  return {
    purpose,
    paymentMethod: state.housingPaymentMethod,
    totalCostMan: Math.max(0, state.housingBaseCostMan),
    cashPaymentMan: getSecondLifeHousingCashPaymentMan(state),
    loanPrincipalMan: configured ? getSecondLifeHousingLoanPrincipalMan(state) : 0,
    interestRatePct: configured ? state.housingLoanInterestRatePct : null,
    years: configured ? state.housingLoanYears : null,
    startAge,
    startMonth: 1,
  };
}

/** Q12表示用。固定金利・元利均等・ボーナス返済なしの概算月額（万円）。 */
export function estimateSecondLifeHousingLoanMonthlyMan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): number | null {
  if (!isSecondLifeHousingLoanConfigured(state)) return null;
  const principal = getSecondLifeHousingLoanPrincipalMan(state);
  const months = Math.round((state.housingLoanYears ?? 0) * 12);
  if (principal <= 0 || months <= 0) return null;
  const monthlyRate = (state.housingLoanInterestRatePct ?? 0) / 100 / 12;
  const payment =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(payment * 10) / 10;
}

export function getSecondLifeHousingBaseCostLabel(
  state: Pick<
    SecondLifeState,
    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'
  >,
): string {
  const kind = getSecondLifeHousingTemplateKind({ ...state, housingSkip: false });
  return kind === 'renovate' ? 'リフォーム費の目安' : '住宅費の目安';
}
