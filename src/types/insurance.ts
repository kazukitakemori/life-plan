/** 損保 / 生保の大分類（追加カードのグループ分け用） */
export type InsuranceSector = 'nonlife' | 'life';

/**
 * 保険カテゴリ。
 * - fire / auto / nonlife_other … 損害保険
 * - life / medical / cancer / education / personal_pension / life_other … 生命保険
 */
export type InsuranceCategory =
  | 'fire'
  | 'auto'
  | 'nonlife_other'
  | 'life'
  | 'medical'
  | 'cancer'
  | 'education'
  | 'personal_pension'
  | 'life_other';

/**
 * 生命保険料控除の区分（所得税・住民税・新制度）。
 */
export type LifeInsuranceDeductionKind =
  | 'general'
  | 'nursing'
  | 'pension'
  | 'none';

export type InsuranceEndMode = 'lifetime' | 'until';

/** 保険料の払込方法 */
export type InsurancePremiumPaymentMode = 'monthly' | 'annual' | 'lump_sum';

/**
 * 学資・個人年金などの受取形式。
 * lump_sum = 一括受取、annuity = 年金形式。
 */
export type InsuranceBenefitPayoutMode = 'lump_sum' | 'annuity';

/**
 * 個人年金を年金形式で受け取る場合の種類。
 * certain = 確定年金、term = 有期年金、lifetime = 終身年金。
 */
export type PersonalPensionAnnuityKind = 'certain' | 'term' | 'lifetime';

/**
 * 保険料払込期間の参照元。
 * linked = Q5 所有/契約期間 or Q6 利用期間に連動（解決時に参照）。
 * manual = このエントリで期間を直接指定。
 */
export type InsurancePeriodSource = 'linked' | 'manual';

/** Q5 住まい（所有・賃貸）への紐付け */
export interface HousingInsuranceLink {
  targetId: string;
  propertyId: string;
  propertyKind: 'owned' | 'rental';
}

/** Q6 乗り物への紐付け */
export interface VehicleInsuranceLink {
  memberId: string;
  vehicleId: string;
}

/** 保険契約1件（契約者メンバー配下） */
export interface InsuranceEntry {
  id: string;
  category: InsuranceCategory;
  name: string;
  /**
   * 保険料（万円）。
   * premiumPaymentMode に応じて月額 / 年額 / 一時払額として解釈する。
   */
  premiumMan: number;
  /** 保険料の払込方法（未設定時は年間） */
  premiumPaymentMode: InsurancePremiumPaymentMode;
  /**
   * 保険料払込期間の参照元。
   * 火災・自動車で住まい/乗り物に紐づく場合の既定は 'linked'。
   */
  periodSource: InsurancePeriodSource;
  /** 保険料払込期間の開始年齢（periodSource === 'manual' 時、またはリンク解除後の保持値） */
  startAge: number;
  startMonth: number;
  endMode: InsuranceEndMode;
  endAge: number;
  endMonth: number;
  /**
   * 生命保険料控除区分。
   * 死亡＝一般、医療・がん＝介護医療、学資＝一般、個人年金＝個人年金に固定。
   * その他生命のみ変更可。損保は 'none'。
   */
  lifeDeductionKind: LifeInsuranceDeductionKind;
  /**
   * 返戻金の有無（死亡・医療・がん・その他生命で入力。既定 false）。
   * 解約返戻金・満期金などをまとめて扱う。
   */
  hasReturnValue: boolean;
  /** 返戻金を受け取る年齢（hasReturnValue 時） */
  returnValueAge: number;
  /** 返戻金額（万円） */
  returnValueMan: number;
  /**
   * 受取形式（学資・個人年金で入力。既定は一括受取）。
   */
  benefitPayoutMode: InsuranceBenefitPayoutMode;
  /**
   * 個人年金を年金形式で受け取る場合の種類（既定は確定年金）。
   */
  personalPensionAnnuityKind: PersonalPensionAnnuityKind;
  /**
   * 確定年金・有期年金の受取期間（年）。終身年金では未使用。
   */
  personalPensionAnnuityYears: number;
  /**
   * 受取人の家族メンバー ID。
   * 学資・個人年金の受取人、または返戻金あり時の返戻金受取人。既定は契約者。
   */
  beneficiaryMemberId: string;
  /**
   * 受取時期の基準となる家族メンバー ID（世帯主・配偶者・子ども）。
   * 学資は子ども、個人年金は契約者を既定とする。
   */
  benefitReceiveMemberId: string;
  /**
   * 受取時期（学資・個人年金）。
   * benefitReceiveMemberId の年齢で指定する。
   */
  benefitReceiveAge: number;
  /**
   * 学資・個人年金などの受取額（万円）。
   * 一括受取時は一時金額、年金形式時は年間受取額。
   */
  benefitAmountMan: number;
  /**
   * 学資を年金形式で受け取る場合の受取期間（年）。2〜6。
   */
  educationAnnuityYears: number;
  housingLink?: HousingInsuranceLink;
  vehicleLink?: VehicleInsuranceLink;
  note: string;
}

export type InsuranceByMember = Record<string, InsuranceEntry[]>;

export interface InsuranceState {
  byMember: InsuranceByMember;
}
