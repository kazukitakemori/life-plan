export interface ResidencePeriod {
  id: string;
  /** 世帯主の開始年齢 */
  startAge: number;
  /** 開始月（1-12） */
  startMonth: number;
  prefectureCode: string;
}

export interface TaxSocialState {
  residencePeriods: ResidencePeriod[];
}
