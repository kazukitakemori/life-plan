const CIRCLED_NUMBERS = [
  '①',
  '②',
  '③',
  '④',
  '⑤',
  '⑥',
  '⑦',
  '⑧',
  '⑨',
  '⑩',
  '⑪',
  '⑫',
  '⑬',
  '⑭',
  '⑮',
  '⑯',
  '⑰',
  '⑱',
  '⑲',
  '⑳',
  '㉑',
  '㉒',
  '㉓',
  '㉔',
  '㉕',
  '㉖',
  '㉗',
  '㉘',
  '㉙',
  '㉚',
  '㉛',
  '㉜',
  '㉝',
  '㉞',
  '㉟',
  '㊱',
  '㊲',
  '㊳',
  '㊴',
  '㊵',
  '㊶',
  '㊷',
  '㊸',
  '㊹',
  '㊺',
  '㊻',
  '㊼',
  '㊽',
  '㊾',
  '㊿',
] as const;

/** (1) / (2') 形式の参照番号を ① / ②′ 形式に変換する */
export function formatBreakdownRefLabel(refId: string | number): string {
  const raw = String(refId).trim();
  const primeMatch = raw.match(/^(\d+)('|\u2032)?$/);
  if (!primeMatch) {
    return raw;
  }

  const num = Number(primeMatch[1]);
  if (num < 1 || num > CIRCLED_NUMBERS.length) {
    return raw;
  }

  const circled = CIRCLED_NUMBERS[num - 1];
  return primeMatch[2] ? `${circled}′` : circled;
}

/** ①年収 のように、参照番号とラベルを連結する */
export function breakdownLabeledRef(
  refId: string | number,
  label: string,
): string {
  return `${formatBreakdownRefLabel(refId)}${label}`;
}

/** 項目 id または refId から ①年収 形式のラベルを作る */
export function breakdownItemLabeledRef(
  itemId: number,
  label: string,
  refId?: string,
): string {
  return breakdownLabeledRef(refId ?? itemId, label);
}

/** テキスト中の (1) / (2') 参照を ① / ②′ に一括置換する */
export function replaceBreakdownParenRefs(text: string): string {
  return text.replace(/\((\d+)('|\u2032)?\)/g, (_match, num, prime) =>
    formatBreakdownRefLabel(`${num}${prime ?? ''}`),
  );
}
