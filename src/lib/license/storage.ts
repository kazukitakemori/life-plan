const DEVICE_ID_KEY = 'life-plan-device-id';
const LICENSE_KEY_STORAGE = 'life-plan-license-key';
const LICENSE_CACHE_KEY = 'life-plan-license-cache';

import type { LicenseEdition } from '../../types/licenseEdition';

interface LicenseCache {
  keyHint: string;
  deviceId: string;
  verifiedAt: string;
  edition?: LicenseEdition;
}

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
  clearLicenseCache();
}

export function saveLicenseCache(cache: LicenseCache): void {
  localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(cache));
}

export function getLicenseCache(): LicenseCache | null {
  try {
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LicenseCache;
    if (!parsed.keyHint || !parsed.deviceId || !parsed.verifiedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLicenseCache(): void {
  localStorage.removeItem(LICENSE_CACHE_KEY);
}

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

export function formatLicenseKeyInput(value: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = normalized.startsWith('LP') ? normalized.slice(2) : normalized;
  const chunks = ['LP', body.slice(0, 4), body.slice(4, 8), body.slice(8, 12)].filter(
    (chunk, index) => index === 0 || chunk.length > 0,
  );
  return chunks.join('-');
}
