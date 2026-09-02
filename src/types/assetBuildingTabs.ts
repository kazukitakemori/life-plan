export type AssetBuildingTabId =
  | 'simulation'
  | 'income-expense'
  | 'savings-assets'
  | 'cashflow';

export const ASSET_BUILDING_TABS: { id: AssetBuildingTabId; label: string }[] = [
  { id: 'simulation', label: '生涯収支シミュレーション' },
  { id: 'income-expense', label: '収入・支出グラフ' },
  { id: 'savings-assets', label: '貯蓄・資産グラフ' },
  { id: 'cashflow', label: 'キャッシュフロー表' },
];
