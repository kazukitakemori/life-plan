/** セカンドライフ設計の優先度 */
export type SecondLifePriority = 'must' | 'want' | 'nice';

/** 将来のお住まい：3つのシナリオ */
export type SecondLifeHousingScenario = 'stay' | 'hometown' | 'new_area';

export type SecondLifeStayOption = 'continue' | 'renovate' | 'purchase_rebuild';
export type SecondLifeHometownOption = 'renovate_parents' | 'purchase_rebuild';
export type SecondLifeNewAreaOption = 'rent' | 'purchase';

/** Q12の住まい本体費用の支払い方法 */
export type SecondLifeHousingPaymentMethod = 'undecided' | 'cash' | 'loan';

/** リフォーム内容。金額とは独立して保持する */
export type SecondLifeRenovationScope =
  | 'repair_equipment'
  | 'partial_room'
  | 'performance'
  | 'full';

/** 生活水準の選択 */
export type SecondLifeLivingLevel =
  | 'same'
  | 'eighty_percent'
  | 'seventy_percent'
  | 'pension_based';

/** 介護の想定 */
export type SecondLifeNursingScenario = 'home' | 'day_service' | 'facility';

export type SecondLifeNursingTarget = 'head' | 'spouse';

export interface SecondLifeNursingDesign {
  skip: boolean;
  scenario: SecondLifeNursingScenario;
  startAge: number;
  annualCostMan: number;
}

export interface SecondLifeLivingBreakdownItem {
  label: string;
  amountMan: number;
}

export interface SecondLifeQ3ApplySnapshot {
  startAge: number;
  /** 住まいを実際に変更・リフォームする世帯主年齢 */
  housingActionAge: number;
  housingSkip: boolean;
  housingScenario: SecondLifeHousingScenario;
  stayOption: SecondLifeStayOption;
  hometownOption: SecondLifeHometownOption;
  newAreaOption: SecondLifeNewAreaOption;
  includeMovingCost: boolean;
  includePostPurchaseRenovation: boolean;
  nursingByTarget: Record<SecondLifeNursingTarget, SecondLifeNursingDesign>;
}

/** 反映状態の判定に使う設計内容 */
export interface SecondLifeDesignSnapshot {
  priority: SecondLifePriority;
  /** セカンドライフ全体の開始年齢。Q12でのみ編集する */
  startAge: number;
  /** 住まいを実際に変更・リフォームする世帯主年齢 */
  housingActionAge: number;
  housingSkip: boolean;
  housingScenario: SecondLifeHousingScenario;
  stayOption: SecondLifeStayOption;
  hometownOption: SecondLifeHometownOption;
  newAreaOption: SecondLifeNewAreaOption;
  includeMovingCost: boolean;
  includePostPurchaseRenovation: boolean;
  /** リフォームを選んだ場合の工事内容。金額とは連動させない */
  renovationScope: SecondLifeRenovationScope;
  /** リフォーム・購入など住まい本体の試算用目安額（万円） */
  housingBaseCostMan: number;
  /** 新しい土地で賃貸を選ぶ場合の月額家賃（万円） */
  housingRentMonthlyMan: number;
  housingPaymentMethod: SecondLifeHousingPaymentMethod;
  /** ローンを選ぶ場合の頭金（万円） */
  housingLoanDownPaymentMan: number;
  /** ローンを選ぶ場合の固定金利の試算値（%）。未入力は null */
  housingLoanInterestRatePct: number | null;
  /** ローンを選ぶ場合の返済期間（年）。未入力は null */
  housingLoanYears: number | null;
  livingSkip: boolean;
  livingLevel: SecondLifeLivingLevel;
  nursingByTarget: Record<SecondLifeNursingTarget, SecondLifeNursingDesign>;
}

export interface SecondLifeState extends SecondLifeDesignSnapshot {
  /** 最後に Q3 へ反映した設計（未設定＝一度も反映していない） */
  lastAppliedQ3Snapshot?: SecondLifeQ3ApplySnapshot | null;
}
