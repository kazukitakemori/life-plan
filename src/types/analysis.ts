import type { CashFlowInput } from '../lib/cashFlow';
import type { CashFlowTableData } from '../types/cashFlow';

/** 「ライフプラン分析」実行時点の試算結果（入力変更では更新しない） */
export interface AnalysisSnapshot {
  cashFlowInput: CashFlowInput;
  cashFlowData: CashFlowTableData;
}
