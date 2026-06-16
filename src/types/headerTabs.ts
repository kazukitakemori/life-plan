export type HeaderTabId =
  | 'input'
  | 'summary'
  | 'life-plan'
  | 'asset-building'
  | 'required-coverage';

export const HEADER_TABS: { id: HeaderTabId; label: string }[] = [
  { id: 'input', label: '入力' },
  { id: 'summary', label: 'サマリー' },
  { id: 'life-plan', label: 'ライフプラン' },
  { id: 'asset-building', label: '資産形成' },
  { id: 'required-coverage', label: '必要保障額' },
];
