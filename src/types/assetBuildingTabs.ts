export type AssetBuildingTabId = 'simulation' | 'cashflow';

export const ASSET_BUILDING_TABS: { id: AssetBuildingTabId; label: string }[] = [
  { id: 'simulation', label: '生涯収支シミュレーション' },
  { id: 'cashflow', label: 'キャッシュフロー表' },
];
