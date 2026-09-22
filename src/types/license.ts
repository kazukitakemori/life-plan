import type { LicenseEdition } from './licenseEdition';

export type LicenseState =
  | 'checking'
  | 'inactive'
  | 'trial'
  | 'active'
  | 'error';

export interface LicenseAdminGeneratedKey {
  key: string;
  hint: string;
  note: string | null;
  cloudStorageEnabled: boolean;
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
  cloud_storage_enabled: 0 | 1;
  note: string | null;
  created_at: string;
  redeemed_workspace_id: string | null;
  redeemed_at: string | null;
  redeemed: 0 | 1;
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
