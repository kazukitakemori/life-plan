export const LIVING_ITEM_PRESET_LABELS = [
  '(自由入力)',
  '食費',
  '外食',
  '電気',
  'ガス',
  '水道',
  '小遣い',
  '通信費',
  '新聞',
  '趣味',
  '化粧品',
  '衣料',
  'NHK',
  '散髪・美容院',
  '交通費',
  '使途不明金',
] as const;

export type LivingItemPresetLabel = (typeof LIVING_ITEM_PRESET_LABELS)[number];

export function presetToItemLabel(preset: LivingItemPresetLabel): string {
  return preset === '(自由入力)' ? '' : preset;
}
