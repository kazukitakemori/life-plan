export type LongTermCareVariant =
  | 'none'
  | 'employee_second_class'
  | 'employee_first_class'
  | 'nhi_segment'
  | 'late_elderly'
  | 'first_class';

export interface LongTermCareViewConfig {
  fiscalYearLabel: string;
  memberAge: number | null;
  isApplicable: boolean;
  variant: LongTermCareVariant;
  memberPremiumYen: number;
  monthlyPremiumYen: number | null;
  rate: number | null;
  viaNhi: boolean;
  statusLabel: string;
  statusNote: string | null;
  notes: string[];
}
