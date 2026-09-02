export type VehiclePresetId = 'car' | 'motorcycle' | 'bicycle' | 'other';

export type VehicleType = VehiclePresetId;

/** 新車・中古・既に保有の区分（自動車・バイク）。自転車・その他は new または owned */
export type VehicleCondition = 'new' | 'used' | 'owned';

/** 買い替え複製時の新車/中古（車検初回までの年数が変わる） */
export type VehicleReplacementCondition = 'new' | 'used';

/** 自動車の種類区分（新車 / 中古車 / 既に保有） */
export type CarVehicleKind = VehicleCondition;

/** バイク・原付の排気量区分 */
export type MotorcycleVehicleKind = 'over_250cc' | 'under_250cc';

export type VehicleKind = CarVehicleKind | MotorcycleVehicleKind;

export type VehicleEndMode = 'lifetime' | 'until';

/**
 * 支払いの入力方法。
 * purchaseAmount = 購入費用とローンを入力（ローン未追加なら一括計上、追加時は借入額の基準）/
 * monthlyRepayment = 月々の返済額をおおよその金額で直接入力（ローン試算はしない）/
 * alreadyOwned = 残債なし（購入費は計上しない。残債があればローン追加可）
 */
export type VehiclePaymentMode =
  | 'purchaseAmount'
  | 'monthlyRepayment'
  | 'alreadyOwned';

/** 乗り物に紐づく保険1件 */
export interface VehicleInsurance {
  id: string;
  label: string;
  /** 保険料（万円/年）。保有開始月と同月に毎年計上 */
  premiumMan: number;
}

/** 保有する乗り物1件 */
export interface VehicleEntry {
  id: string;
  label: string;
  type: VehicleType;
  /**
   * 詳細区分。
   * 自動車: 新車 / 中古車
   * バイク・原付: 250cc超 / 250cc以下
   */
  kind?: VehicleKind;
  /**
   * 購入区分。
   * 自動車: kind と同期（new / used / owned）
   * バイク・原付: 新車 / 中古 / 既に保有
   * 自転車・その他: new または owned
   */
  condition?: VehicleCondition;
  /** 既定は 'purchaseAmount' */
  paymentMode: VehiclePaymentMode;
  /** paymentMode === 'monthlyRepayment' のときの月々のローン返済額（万円） */
  monthlyRepaymentMan: number;
  /** paymentMode === 'monthlyRepayment' のときの返済終了年（西暦） */
  repaymentEndYear: number;
  /** paymentMode === 'monthlyRepayment' のときの返済終了月 */
  repaymentEndMonth: number;
  startAge: number;
  startMonth: number;
  /** この1台の利用期間の終了。lifetime = 亡くなるまで */
  endMode: VehicleEndMode;
  endAge: number;
  endMonth: number;
  /** 購入費用（万円）。ローン未追加時は保有開始月に計上。ローン追加時は借入額の基準 */
  purchaseAmountMan: number;
  /** 月次維持費（万円）— 自転車・その他 */
  monthlyCostMan: number;
  /** ガソリン代（万円/月）— 自動車・バイク・原付 */
  gasolineCostMan?: number;
  /** 駐車場代（万円/月）— 自動車・バイク・原付 */
  parkingCostMan?: number;
  /** 税金・メンテナンス費（万円）。周期ごとに保有開始月と同月に計上 */
  annualCostMan: number;
  /** 税金・メンテナンス費の計上周期（年）。1〜6、既定は1（毎年） */
  annualCostCycleYears?: number;
  /** 車検費用（万円）。次回車検月から初回、以後は2年ごと */
  inspectionCostMan: number;
  /** いまの車の次の車検（西暦年）。買い替え後の車両には使わない */
  nextInspectionYear?: number;
  /** いまの車の次の車検（月） */
  nextInspectionMonth?: number;
  /** 任意保険など */
  insurances: VehicleInsurance[];
}
export type VehicleByMember = Record<string, VehicleEntry[]>;

export interface VehicleState {
  byMember: VehicleByMember;
}
