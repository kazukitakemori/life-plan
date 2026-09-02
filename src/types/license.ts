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
  devices?: LicenseDevice[];
  maxDevices?: number;
}

export interface LicenseActivateResponse {
  ok: boolean;
  error?: string;
  message?: string;
  keyHint?: string;
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
