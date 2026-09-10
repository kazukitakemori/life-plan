import { useMemo } from 'react';

import { buildLifetimeBalanceChartData } from '../../lib/lifetimeBalanceChartData';
import type { CashFlowTableData } from '../../types/cashFlow';
import { AssetAnnualBalanceChart } from './AssetAnnualBalanceChart';
import { AssetBalanceChart } from './AssetBalanceChart';
import type { AssetChartAggregation } from './assetBuildingChartShared';
import { AssetExpenseChart } from './AssetExpenseChart';
import { AssetIncomeChart } from './AssetIncomeChart';

export type AssetBuildingChartsGroup = 'income-expense' | 'savings-assets';

interface AssetBuildingChartsPanelProps {
  cashFlowData: CashFlowTableData;
  group: AssetBuildingChartsGroup;
  aggregation?: AssetChartAggregation;
}

export function AssetBuildingChartsPanel({
  cashFlowData,
  group,
  aggregation = 'year',
}: AssetBuildingChartsPanelProps) {
  const chartData = useMemo(
    () => buildLifetimeBalanceChartData(cashFlowData),
    [cashFlowData],
  );
  const hasSpouse = chartData.spouseAxisLabel != null;
  const { points } = chartData;

  if (group === 'income-expense') {
    return (
      <div
        className="asset-building-charts-panel"
        aria-label="収入・支出グラフ"
      >
        <AssetIncomeChart
          cashFlowData={cashFlowData}
          hasSpouse={hasSpouse}
          aggregation={aggregation}
        />
        <AssetExpenseChart
          points={points}
          hasSpouse={hasSpouse}
          aggregation={aggregation}
        />
      </div>
    );
  }

  return (
    <div
      className="asset-building-charts-panel"
      aria-label="貯蓄・資産グラフ"
    >
      <AssetAnnualBalanceChart points={points} hasSpouse={hasSpouse} />
      <AssetBalanceChart points={points} hasSpouse={hasSpouse} />
    </div>
  );
}
