import type { OwnedPropertyLoanSettings } from './housing';
import type { FamilyMember } from './family';

export type LoanCategory = 'housing' | 'vehicle' | 'education' | 'free';

/**
 * ローン返済の入力方法。
 * loanSettings = 借入額・金利・期間などから返済額を試算 /
 * monthlyRepayment = 月々の返済額を直接入力（償却試算はしない）
 */
export type LoanPaymentMode = 'loanSettings' | 'monthlyRepayment';

/** 住宅ローンの借入形態（Q9 追加時に選択） */
export type LoanStructureType =
  | 'sole'
  | 'pair'
  | 'joint_debt'
  | 'income_combined';

export interface HousingLoanLink {
  targetId: string;
  propertyId: string;
}

/** Q6 乗り物に紐づく自動車ローンのリンク */
export interface VehicleLoanLink {
  memberId: string;
  vehicleId: string;
}

export interface LoanEntry {
  id: string;
  category: LoanCategory;
  name: string;
  settings: OwnedPropertyLoanSettings;
  note: string;
  /** 既定は 'loanSettings' */
  paymentMode: LoanPaymentMode;
  /** paymentMode === 'monthlyRepayment' のときの月々返済額（万円） */
  monthlyRepaymentMan: number;
  /** paymentMode === 'monthlyRepayment' のときの返済開始年（西暦）。0 なら設定値・基準日から解決 */
  repaymentStartYear: number;
  /** paymentMode === 'monthlyRepayment' のときの返済開始月。0 なら設定値・基準日から解決 */
  repaymentStartMonth: number;
  /** paymentMode === 'monthlyRepayment' のときの返済終了年（西暦）。0 なら期間から推定 */
  repaymentEndYear: number;
  /** paymentMode === 'monthlyRepayment' のときの返済終了月。0 なら期間から推定 */
  repaymentEndMonth: number;
  housingLink?: HousingLoanLink;
  vehicleLink?: VehicleLoanLink;
  /** 住宅ローンの借入形態（未設定時は単独ローン扱い） */
  structureType?: LoanStructureType;
  /** ペアローンで夫婦2本を紐づける ID */
  pairGroupId?: string;
  /** ペアローン時の借入分担割合（%）。連帯債務時は控除按分（主契約者側%）。未設定時は 50 */
  pairSharePct?: number;
  /** Q9 でローン条件を入力済みか（未入力時は一覧に「未登録」と表示） */
  settingsConfigured?: boolean;
}

export type LoanByMember = Record<string, LoanEntry[]>;

export interface LoanState {
  byMember: LoanByMember;
}

/** Q5 所有物件に紐づくローンの表示用 */
export interface HousingLinkedLoanView {
  entry: LoanEntry;
  contractorLabel: string;
  contractorRole?: FamilyMember['role'];
  contractorId?: string;
}

/** Q6 乗り物に紐づくローンの表示用 */
export type VehicleLinkedLoanView = HousingLinkedLoanView;

