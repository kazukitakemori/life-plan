export interface NationalPensionViewConfig {
  fiscalYearLabel: string;
  monthlyPremiumYen: number;
  annualPremiumYen: number;
  memberPremiumYen: number;
  isLiable: boolean;
  statusLabel: string;
  statusNote: string | null;
  memberAge: number | null;
  notes: string[];
}
