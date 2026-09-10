/**
 * セカンドライフ住まい反映の副作用インベントリ（Phase 0）。
 * UI は後続 Phase でこの結果を表示する。ここでは型と副作用の列挙だけを固定する。
 */
export type SecondLifeHousingPropertyKind = 'rental' | 'owned';

export type SecondLifeHousingApplyChange =
  | {
      type: 'cleared';
      propertyKind: SecondLifeHousingPropertyKind;
      id: string;
      name: string;
    }
  | {
      type: 'ended';
      propertyKind: SecondLifeHousingPropertyKind;
      id: string;
      name: string;
      endAge: number;
      endMonth: number;
    }
  | {
      type: 'added';
      propertyKind: SecondLifeHousingPropertyKind;
      id: string;
      name: string;
      monthlyRentMan?: number;
      buildingMan?: number;
      landMan?: number;
    }
  | {
      type: 'life_event';
      action: 'upserted';
      label: string;
      amountMan: number;
      startAge: number;
    };
