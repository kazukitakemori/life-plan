import type { TaxBreakdownReferenceDetail } from './taxBreakdownReference';

export interface BreakdownDataItem {
  id: number;
  /** 表示用の番号（例: "2'"）。未指定時は id を使用 */
  refId?: string;
  /** サイドバー上のグループ見出し（同一文字列で項目をまとめる） */
  section?: string;
  label: string;
  value: string;
  /** モーダル内ドリルダウンで表示する参照表 */
  referenceDetail?: TaxBreakdownReferenceDetail;
}

export type BreakdownOperator = '=' | '−' | '×' | '+' | '÷';

export interface BreakdownFormulaSegment {
  type: 'text' | 'group';
  text?: string;
  groupTitle?: string;
  groupItemIds?: number[];
}

export interface BreakdownCompoundPart {
  text: string;
  note?: string;
}

export interface BreakdownFormulaRow {
  layout?: 'default' | 'compound-sum' | 'supplemental';
  rowTitle?: string;
  compoundParts?: BreakdownCompoundPart[];
  compoundNote?: string;
  segments: BreakdownFormulaSegment[];
  operators: BreakdownOperator[];
  resultId: number;
  resultLabel: string;
  highlight?: boolean;
}

export interface BreakdownProrationCallout {
  /** 年間算定額（円） */
  annualAmountYen: number;
  annualAmountLabel: string;
  /** キャッシュフロー表への反映額（円） */
  proratedAmountYen: number;
  proratedAmountLabel: string;
  prorationLabel: string;
  explanation: string;
}

export interface CalculationBreakdownConfig {
  id: string;
  title: string;
  /** 見出しに表示する試算対象年（例: "2051年"） */
  fiscalYearLabel?: string;
  headerVariant?: 'default' | 'pension' | 'health' | 'resident';
  /** 試算初年度の按分（年間算定→表への反映） */
  prorationCallout?: BreakdownProrationCallout;
  items: BreakdownDataItem[];
  rows: BreakdownFormulaRow[];
  notes: string[];
}
