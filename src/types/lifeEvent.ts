export type LifeEventPresetId =
  | 'travel'
  | 'appliance'
  | 'medical'
  | 'nursing'
  | 'hometown_tax'
  | 'celebration_gift'
  | 'other';

export type LifeEventType =
  | 'event'
  | 'medical'
  | 'nursing'
  | 'travel'
  | 'appliance'
  | 'hometown_tax'
  | 'celebration_gift'
  | 'other';

export type LifeEventCycleUnit = 'month' | 'year';

export type LifeEventEndMode = 'lifetime' | 'until' | 'once';

/** 通常入力では未設定。別設計から生成された計算用イベントだけ source を持つ。 */
export type LifeEventSource =
  | 'second_life_housing'
  | 'second_life_nursing';

export type LifeEventGiftTaxTreatment =
  | 'unknown'
  | 'taxable'
  | 'non_taxable';

/** 子・孫の祝い金の受取者（1人あたり） */
export interface LifeEventCelebrationBeneficiary {
  memberId: string;
  targetAge: number;
  amountMan: number;
  /**
   * 贈与税の扱い。
   * unknown: 税額へ自動反映しない
   * taxable: 暦年贈与として合算
   * non_taxable: 社会通念上相当な祝物・通常必要な生活教育費等として非課税扱い
   */
  giftTaxTreatment?: LifeEventGiftTaxTreatment;
}

export interface LifeEventEntry {
  id: string;
  label: string;
  type: LifeEventType;
  startAge: number;
  startMonth: number;
  endMode: LifeEventEndMode;
  endAge: number;
  endMonth: number;
  cycleInterval: number;
  cycleUnit: LifeEventCycleUnit;
  amountMan: number;
  /** 物価上昇率（%/年）。null のときは上昇なし */
  increaseRate: number | null;
  /** セカンドライフ等、別設計を本体として自動生成された場合の出所 */
  source?: LifeEventSource;
  /** type が celebration_gift のとき、子どもごとの祝い金設定 */
  celebrationBeneficiaries?: LifeEventCelebrationBeneficiary[];
}

export type LifeEventByMember = Record<string, LifeEventEntry[]>;

export interface LifeEventState {
  byMember: LifeEventByMember;
}
