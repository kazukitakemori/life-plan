export const HOUSEHOLD_HOUSING_KEY = '__household__';

export type OwnedPropertyType = 'condominium' | 'detached_house' | 'land';

export type RentalEndMode = 'lifetime' | 'until';

/** 居住中 = 初期費用は試算に含めない / これから入居 = 入居月に初期費用を計上 */
export type RentalOccupancy = 'current' | 'upcoming';

export interface RentalProperty {
  id: string;
  name: string;
  occupancy: RentalOccupancy;
  startAge: number;
  startMonth: number;
  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  monthlyRentMan: number;
  securityDepositMan: number;
  keyMoneyMan: number;
  brokerageFeeMan: number;
  /** 入居予定時の引越し費用（万円）。入居月に計上 */
  movingCostMan: number;
  /** 居住中の退去・引越し費用（万円）。契約終了月に計上 */
  moveOutCostMan: number;
  /** 敷金返金（万円）。契約終了月に収入(その他)として計上 */
  securityDepositRefundMan: number;
  renewalFeeMan: number;
  renewalNextYear: number;
  renewalNextMonth: number;
  /** 0 = なし、1〜10 = N年おき */
  renewalIntervalYears: number;
}

/** 居住中 = 既に住んでいる / 入居予定 = これから入居する */
export type OwnedPropertyUsage = 'current' | 'upcoming';

/**
 * 居住中のみ有効: analysis = ローン・控除等を詳細に試算 / simple = 月々の住居費を一括入力し
 * ローン返済・住宅ローン控除等の詳細計算は行わずCF表に反映する
 */
export type OwnedPropertyCurrentExpenseMode = 'analysis' | 'simple';

export type OwnedPropertyLoanPaymentType = 'loan' | 'cash';

/**
 * 中古建物の建築時期（不動産取得税の建物控除額を決定）
 * 未設定時は after_1997_apr（1,200万円控除）を前提とする
 */
export type UsedBuildingConstructionEra =
  | 'after_1997_apr'
  | '1989_apr_to_1997_mar'
  | '1985_jul_to_1989_mar'
  | '1981_jul_to_1985_jun'
  | 'before_1981_jul';

/**
 * 住宅ローン控除の住宅区分（借入限度額・控除期間を決定）
 * none = 対象外（土地のみ購入・控除不要など）
 */
export type HousingLoanDeductionCategory =
  | 'certified_long_term' // 認定長期優良住宅・低炭素住宅
  | 'zeh'                 // ZEH水準省エネ住宅
  | 'energy_standard'     // 省エネ基準適合住宅
  | 'general'             // 一般住宅
  | 'none';               // 対象外

/** 住宅ローン諸手数料の支払いタイミング */
export type HousingLoanBankFeePaymentTiming = 'initial' | 'loan';

/** ローン金利の種別 */
export type LoanInterestRateType = 'fixed' | 'variable';

/** 住宅ローンの返済方式 */
export type HousingLoanRepaymentMethod = 'equal_payment' | 'equal_principal';

/** 繰上げ返済の方式（期間短縮 / 返済額軽減） */
export type HousingLoanPrepaymentType = 'period_shortening' | 'payment_reduction';

/** 繰上げ返済の1件分 */
export interface HousingLoanPrepaymentEntry {
  id: string;
  type: HousingLoanPrepaymentType;
  /** 返済開始からの経過年数。0=当初 */
  offsetYears: number;
  /** 繰上げ返済額（万円） */
  amountMan: number;
}

export type {
  GroupCreditLifePlan,
  IndividualGroupCreditLifePlan,
  JointDebtGroupCreditLifePlan,
} from '../lib/groupCreditLife';

import type { GroupCreditLifePlan } from '../lib/groupCreditLife';

export interface LoanInterestRatePeriod {
  id: string;
  rateType: LoanInterestRateType;
  /** 金利（%） */
  interestRatePct: number;
  /** 適用開始（暦年）。0 のときは返済開始月 */
  startYear: number;
  /** 適用開始（月 1–12）。0 のときは返済開始月 */
  startMonth: number;
  /** 適用終了（暦年）。0 のときは完済月 */
  endYear: number;
  /** 適用終了（月 1–12）。0 のときは完済月 */
  endMonth: number;
}

export interface OwnedPropertyLoanSettings {
  /** 借入金額（万円）。住宅ローンは諸費用込みで自動計算 */
  amountMan: number;
  /** 金利期間（時系列順） */
  interestRatePeriods: LoanInterestRatePeriod[];
  /** 返済期間（年）。住宅ローン向け。非住宅は repaymentCount を優先 */
  years: number;
  /**
   * 返済回数（月次）。非住宅ローン向け。
   * 設定時は years より優先して総返済月数に使う（12〜120、12回刻み）
   */
  repaymentCount?: number;
  /** 借入時期（暦年）。0 のときは物件取得時（Q5 所有開始） */
  startYear: number;
  /** 借入時期（月 1–12）。0 のときは物件取得時 */
  startMonth: number;
  /** 住宅ローン控除の住宅区分 */
  deductionCategory: HousingLoanDeductionCategory;
  /** true = 新築、false = 中古 */
  isNewConstruction: boolean;
  /** 仲介手数料を借入に含める */
  includeBrokerageFeeInLoan: boolean;
  /** 登記手数料を借入に含める */
  includeRegistrationFeeInLoan: boolean;
  /** 仲介手数料分の上乗せ金利（%） */
  brokerageFeeSurchargeRatePct: number;
  /** 登記手数料分の上乗せ金利（%） */
  registrationFeeSurchargeRatePct: number;
  /** 融資手数料（万円） */
  financingFeeMan: number;
  /** 保証料（万円） */
  guaranteeFeeMan: number;
  /** 事務手数料（万円） */
  administrativeFeeMan: number;
  /** 諸手数料の支払いタイミング（初回支払 / ローンに組み込み） */
  bankFeePaymentTiming: HousingLoanBankFeePaymentTiming;
  /** 団信プラン（金利上乗せに反映） */
  groupCreditLifePlan?: GroupCreditLifePlan;
  /** 団信による金利上乗せ（%）。未設定時はプランの目安値 */
  groupCreditLifeSurchargeRatePct?: number;
  /** 返済方式（元利均等 / 元金均等） */
  repaymentMethod: HousingLoanRepaymentMethod;
  /** ボーナス返済を利用する */
  bonusRepaymentEnabled: boolean;
  /** ボーナス1回あたりの支払額（万円。ボーナス支払月は夏・冬の年2回を想定） */
  bonusRepaymentAmountMan: number;
  /** ボーナス返済の方式（期間短縮 / 返済額軽減） */
  bonusRepaymentType: HousingLoanPrepaymentType;
  /** 繰上げ返済を利用する */
  prepaymentEnabled: boolean;
  /** 繰上げ返済の一覧 */
  prepayments: HousingLoanPrepaymentEntry[];
  /** 一括返済を利用する */
  lumpSumRepaymentEnabled: boolean;
  /** 一括返済の実行時期（返済開始からの経過年数。0=当初） */
  lumpSumRepaymentOffsetYears: number;
}

export interface OwnedPropertyLoan {
  id: string;
  name: string;
  paymentType: OwnedPropertyLoanPaymentType;
  note: string;
}

/** 所有開始からの経過年数。0=当初、正の整数=N年後、-1=永年（終了境界のみ） */
export const OWNED_PERIOD_LIFETIME = -1;

export interface OwnedMonthlyFeeEntry {
  id: string;
  startOffsetYears: number;
  endOffsetYears: number;
  /** 月額（万円） */
  amountManPerMonth: number;
}

export interface OwnedSelfRepairSettings {
  costMan: number;
  nextYear: number;
  nextMonth: number;
  intervalYears: number;
}

export interface OwnedImprovementEntry {
  id: string;
  year: number;
  month: number;
  /** 改良費（万円） */
  amountMan: number;
}

export interface OwnedAnnualTaxEntry {
  id: string;
  /** null = 当初（所有開始から） */
  startYear: number | null;
  fixedAssetTaxMan: number;
  cityPlanningTaxMan: number;
}

export interface OwnedPropertyMaintenance {
  managementFees: OwnedMonthlyFeeEntry[];
  repairReserveFees: OwnedMonthlyFeeEntry[];
  selfRepair: OwnedSelfRepairSettings;
  improvements: OwnedImprovementEntry[];
  landTaxes: OwnedAnnualTaxEntry[];
  buildingTaxes: OwnedAnnualTaxEntry[];
}

export interface OwnedProperty {
  id: string;
  type: OwnedPropertyType;
  name: string;
  usage: OwnedPropertyUsage;
  /** usage === 'current' のときのみ参照。既定は 'simple' */
  currentExpenseMode: OwnedPropertyCurrentExpenseMode;
  /** currentExpenseMode === 'simple' のときの月々の住居費（万円） */
  simpleMonthlyExpenseMan: number;
  startAge: number;
  startMonth: number;
  endMode: RentalEndMode;
  endAge: number;
  endMonth: number;
  buildingMan: number;
  landMan: number;
  brokerageFeeMan: number;
  registrationFeeMan: number;
  acquisitionTaxMan: number;
  acquisitionTaxYear: number;
  acquisitionTaxMonth: number;
  /** false のとき面積入力欄は非表示で標準面積を試算に使用 */
  isManualArea: boolean;
  /** 土地面積（㎡）。isManualArea が true のときのみ有効 */
  landAreaSqm: number;
  /** 建物延床面積（㎡）。isManualArea が true のときのみ有効 */
  buildingAreaSqm: number;
  /** 中古建物の建築時期（不動産取得税の建物控除用） */
  usedBuildingConstructionEra: UsedBuildingConstructionEra;
  paymentMethod: OwnedPropertyLoanPaymentType;
  /** paymentMethod === 'loan' のときのローン詳細。cash の場合は undefined でも可 */
  loan: OwnedPropertyLoanSettings;
  maintenance: OwnedPropertyMaintenance;
}

export interface HousingTargetData {
  rentals: RentalProperty[];
  owned: OwnedProperty[];
}

export type HousingByTarget = Record<string, HousingTargetData>;

export interface HousingState {
  byTarget: HousingByTarget;
}

export function createEmptyHousingTargetData(): HousingTargetData {
  return { rentals: [], owned: [] };
}
