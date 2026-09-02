export type IncomeCategory =
  | 'employee'
  | 'civil_servant'
  | 'part_time'
  | 'self_employed'
  | 'benefit'
  | 'other';

export type IncomeStreamType =
  | 'salary_social_insurance'
  | 'salary_national_insurance'
  | 'salary_civil_mutual'
  | 'business_national_insurance'
  | 'benefit_tax_free'
  | 'miscellaneous_income'
  | 'temporary_income'
  | 'tax_free_income';

export type FilingType = 'white' | 'blue_65' | 'blue_55' | 'blue_10';

/** 税・社会保険の扶養区分（本人・配偶者の収入期間単位） */
export type DependentStatus = 'none' | 'dependent';

export interface IncomePeriod {
  id: string;
  startAge: number;
  startMonth: number;
  endAge: number;
  endMonth: number;
  streamType: IncomeStreamType;
  monthlyAmountMan: number;
  bonuses: IncomeBonus[];
  annualAmountMan: number;
  /** 扶養設定：独立 or 扶養に入る（本人・配偶者の期間のみ） */
  dependentStatus: DependentStatus;
  /** 扶養に入る場合：世帯主の税法上の扶養 */
  taxDependent: boolean;
  /** 扶養に入る場合：世帯主の社会保険の扶養 */
  socialInsuranceDependent: boolean;
  spouseContingencyRate: number | null;
  annualIncreaseRate: number | null;
  /** 一時金ON前の終了年齢（一時金OFF時に復元） */
  lumpSumRestoreEndAge: number | null;
  /** 一時金ON前の終了月（一時金OFF時に復元） */
  lumpSumRestoreEndMonth: number | null;
}

export interface IncomeBonus {
  id: string;
  amountMan: number;
  paymentMonth: number;
}

/** 会社等の退職金（当該収入カードに紐づく一時金） */
export type RetirementEnrollmentMode = 'years' | 'period';

export interface RetirementAllowanceEntry {
  id: string;
  /** 受取額（万円・額面） */
  amountMan: number;
  receiveAge: number;
  receiveMonth: number;
  /** 勤続年数の入力方法 */
  enrollmentMode: RetirementEnrollmentMode;
  /** enrollmentMode === 'years' のときの勤続年数 */
  enrollmentYears: number;
  /** enrollmentMode === 'period' の勤続開始 */
  enrollmentStartAge: number;
  enrollmentStartMonth: number;
  /** enrollmentMode === 'period' の勤続終了 */
  enrollmentEndAge: number;
  enrollmentEndMonth: number;
}

export interface IncomeEntry {
  id: string;
  memberId: string;
  category: IncomeCategory;
  /**
   * 副業カードから追加した事業収入。
   * 本業給与との組み合わせを想定した注記表示に使用（試算ロジックは category で判定）。
   */
  incomePurpose?: 'side_business';
  /**
   * 就職・開業など試算初年度に始まる新しい収入。
   * ON のとき初年度は実収入ベースで税計算し、前年度所得の年収読み替えを行わない。
   */
  isNewIncomeFromStart: boolean;
  periods: IncomePeriod[];
  /** 会社等の退職金（雇用系のみ・複数可）。CF「退職金」行・退職所得の対象 */
  retirementAllowances: RetirementAllowanceEntry[];
  expenseManPerMonth: number | null;
  filingType: FilingType | null;
}

export type IncomeByMember = Record<string, IncomeEntry[]>;

/** 前年度の収入（今年度と異なる場合のみ上書き） */
export interface PriorYearIncomeOverride {
  differsFromCurrentYear: boolean;
  category: IncomeCategory;
  /** 月額（万円） */
  monthlyAmountMan: number;
}

/** @deprecated PriorYearIncomeOverride を使用してください */
export type PriorYearIncomeForNursery = PriorYearIncomeOverride;

export type PriorYearIncomeByMember = Record<string, PriorYearIncomeOverride>;
