export interface TaxBreakdownReferenceKeyValue {
  label: string;
  value: string;
}

export interface TaxBreakdownReferenceTableRow {
  cells: string[];
  highlight?: boolean;
}

export interface TaxBreakdownReferenceTable {
  caption?: string;
  columns: string[];
  rows: TaxBreakdownReferenceTableRow[];
}

export interface TaxBreakdownReferenceSection {
  title: string;
  description?: string;
  keyValues?: TaxBreakdownReferenceKeyValue[];
  table?: TaxBreakdownReferenceTable;
}

export interface TaxBreakdownReferenceSource {
  label: string;
  detail?: string;
}

export interface TaxBreakdownReferenceDetail {
  title: string;
  summary: string;
  sections: TaxBreakdownReferenceSection[];
  sources: TaxBreakdownReferenceSource[];
}
