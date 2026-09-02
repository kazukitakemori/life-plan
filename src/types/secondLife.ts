/** セカンドライフ設計の優先度 */
export type SecondLifePriority = 'must' | 'want' | 'nice';

/** 将来のお住まい：3つのシナリオ */
export type SecondLifeHousingScenario = 'stay' | 'hometown' | 'new_area';

export type SecondLifeStayOption = 'renovate' | 'purchase_rebuild';
export type SecondLifeHometownOption = 'renovate_parents' | 'purchase_rebuild';
export type SecondLifeNewAreaOption = 'rent' | 'purchase';

/** 生活水準の選択 */
export type SecondLifeLivingLevel = 'same' | 'seventy_percent' | 'pension_based';

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
  startAge: number;
  housingSkip: boolean;
  housingScenario: SecondLifeHousingScenario;
  stayOption: SecondLifeStayOption;
  hometownOption: SecondLifeHometownOption;
  newAreaOption: SecondLifeNewAreaOption;
  includeMovingCost: boolean;
  includePostPurchaseRenovation: boolean;
  livingSkip: boolean;
  livingLevel: SecondLifeLivingLevel;
  nursingByTarget: Record<SecondLifeNursingTarget, SecondLifeNursingDesign>;
}

export interface SecondLifeState extends SecondLifeDesignSnapshot {
  /** 最後に Q3 へ反映した設計（未設定＝一度も反映していない） */
  lastAppliedQ3Snapshot?: SecondLifeQ3ApplySnapshot | null;
}
