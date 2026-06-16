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

export interface IncomeEntry {
  id: string;
  memberId: string;
  category: IncomeCategory;
  spouseContingencyOnly: boolean;
  periods: IncomePeriod[];
  kenpoContinuationYears: number | null;
  expenseManPerMonth: number | null;
  filingType: FilingType | null;
}

export type IncomeByMember = Record<string, IncomeEntry[]>;

/** 保育料参考値用：前年度の収入（今年度と異なる場合のみ上書き） */
export interface PriorYearIncomeForNursery {
  differsFromCurrentYear: boolean;
  category: IncomeCategory;
  /** 月額（万円） */
  monthlyAmountMan: number;
}

export type PriorYearIncomeByMember = Record<string, PriorYearIncomeForNursery>;
