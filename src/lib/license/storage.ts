const DEVICE_ID_KEY = 'life-plan-device-id';
const LICENSE_KEY_STORAGE = 'life-plan-license-key';

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function getStoredLicenseKey(): string | null {
  const value = localStorage.getItem(LICENSE_KEY_STORAGE);
  return value?.trim() ? value : null;
}

export function setStoredLicenseKey(key: string): void {
  localStorage.setItem(LICENSE_KEY_STORAGE, key.trim());
}

export function clearStoredLicenseKey(): void {
  localStorage.removeItem(LICENSE_KEY_STORAGE);
}

export function getDefaultDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return 'ブラウザ';
}

export function formatLicenseKeyInput(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = normalized.startsWith('LP') ? normalized.slice(2) : normalized;
  const chunks = ['LP', body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)].filter(
    (chunk, index) => index === 0 || chunk.length > 0,
  );
  return chunks.join('-');
}
