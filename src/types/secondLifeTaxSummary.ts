export interface SecondLifeTaxSummaryRow {
  label: string;
  value: string;
  note?: string;
  variant?: 'normal' | 'subtotal' | 'result';
}

export interface SecondLifeTaxSummarySection {
  title: string;
  rows: SecondLifeTaxSummaryRow[];
}

export interface SecondLifeTaxSummaryConfig {
  fiscalYearLabel: string;
  memberAge: number;
  sections: SecondLifeTaxSummarySection[];
  notes: string[];
  isTaxIndependent: boolean;
}
