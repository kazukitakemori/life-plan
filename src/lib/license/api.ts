import type {
  LicenseActivateResponse,
  LicenseDeactivateResponse,
  LicenseStatusResponse,
} from '../../types/license';
import { resolveLicenseApiBase } from './apiBase';

async function parseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('LICENSE_API_NON_JSON');
  }
  return (await response.json()) as T;
}

function apiUrl(path: string): string {
  const base = resolveLicenseApiBase();
  return `${base}${path}`;
}

export async function fetchLicenseStatus(
  key: string,
  deviceId: string,
): Promise<LicenseStatusResponse> {
  const params = new URLSearchParams({ key, deviceId });
  const response = await fetch(`${apiUrl('/api/license/status')}?${params.toString()}`, {
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
  const response = await fetch(apiUrl('/api/license/activate'), {
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
  const response = await fetch(apiUrl('/api/license/deactivate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseJson<LicenseDeactivateResponse>(response);
}
