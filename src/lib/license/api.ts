import type {
  LicenseActivateResponse,
  LicenseDeactivateResponse,
  LicenseStatusResponse,
} from '../../types/license';

const API_BASE = import.meta.env.VITE_LICENSE_API_BASE ?? '';

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchLicenseStatus(
  key: string,
  deviceId: string,
): Promise<LicenseStatusResponse> {
  const params = new URLSearchParams({ key, deviceId });
  const response = await fetch(`${API_BASE}/api/license/status?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJson<LicenseStatusResponse>(response);
}

export async function activateLicense(input: {
  key: string;
  deviceId: string;
  deviceLabel: string;
  replaceDeviceId?: string;
}): Promise<LicenseActivateResponse> {
  const response = await fetch(`${API_BASE}/api/license/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseJson<LicenseActivateResponse>(response);
}

export async function deactivateLicense(input: {
  key: string;
  deviceId: string;
  targetDeviceId: string;
}): Promise<LicenseDeactivateResponse> {
  const response = await fetch(`${API_BASE}/api/license/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseJson<LicenseDeactivateResponse>(response);
}
