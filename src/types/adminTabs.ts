export type AdminTabId = 'plans' | 'license';

export const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: 'plans', label: 'プラン管理' },
  { id: 'license', label: 'ライセンス' },
];
