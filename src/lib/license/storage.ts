export function getDefaultDeviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = 'ブラウザ';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  if (/Windows/i.test(ua)) return `${browser}（Windows）`;
  if (/Macintosh|Mac OS X/i.test(ua)) return `${browser}（Mac）`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `${browser}（iPhone / iPad）`;
  if (/Android/i.test(ua)) return `${browser}（Android）`;
  return browser;
}

/**
 * 既存の利用コード形式を入力しやすく整形する。
 * ブラウザ端末IDやライセンス状態はここでは保持しない。
 */
export function formatLicenseKeyInput(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = normalized.startsWith('LP') ? normalized.slice(2) : normalized;
  const chunks = ['LP', body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)].filter(
    (chunk, index) => index === 0 || chunk.length > 0,
  );
  return chunks.join('-');
}
