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

/** 子・孫の祝い金の受取者（1人あたり） */
export interface LifeEventCelebrationBeneficiary {
  memberId: string;
  targetAge: number;
  amountMan: number;
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
  /** type が celebration_gift のとき、子どもごとの祝い金設定 */
  celebrationBeneficiaries?: LifeEventCelebrationBeneficiary[];
}

export type LifeEventByMember = Record<string, LifeEventEntry[]>;

export interface LifeEventState {
  byMember: LifeEventByMember;
}
