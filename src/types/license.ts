import type { LicenseEdition } from './licenseEdition';

export interface LicenseDevice {
  deviceId: string;
  deviceLabel: string;
  activatedAt: string;
  lastSeenAt: string;
}

export interface LicenseStatusResponse {
  valid: boolean;
  error?: string;
  message?: string;
  keyHint?: string;
  edition?: LicenseEdition;
  devices?: LicenseDevice[];
  maxDevices?: number;
}

export interface LicenseActivateResponse {
  ok: boolean;
  error?: string;
  message?: string;
  keyHint?: string;
  edition?: LicenseEdition;
  devices?: LicenseDevice[];
  maxDevices?: number;
}

export interface LicenseDeactivateResponse {
  ok: boolean;
  error?: string;
  message?: string;
  devices?: LicenseDevice[];
  maxDevices?: number;
}

export type LicenseState =
  | 'checking'
  | 'inactive'
  | 'active'
  | 'error';

export interface LicenseAdminGeneratedKey {
  key: string;
  hint: string;
  note: string | null;
}

export interface LicenseAdminGenerateResponse {
  ok: boolean;
  error?: string;
  keys?: LicenseAdminGeneratedKey[];
}

export interface LicenseAdminKeySummary {
  id: string;
  key_hint: string;
  key_display: string | null;
  status: 'active' | 'revoked';
  edition: LicenseEdition;
  max_devices: number;
  note: string | null;
  created_at: string;
  device_count: number;
}

export interface LicenseAdminListResponse {
  ok: boolean;
  error?: string;
  keys?: LicenseAdminKeySummary[];
}

export interface LicenseAdminRevokeResponse {
  ok: boolean;
  error?: string;
  message?: string;
}
