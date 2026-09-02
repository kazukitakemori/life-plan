import type {
  LicenseAdminGenerateResponse,
  LicenseAdminListResponse,
  LicenseAdminRevokeResponse,
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

function authHeaders(adminSecret: string): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminSecret}`,
  };
}

export async function verifyAdminSecret(adminSecret: string): Promise<boolean> {
  const response = await fetch(apiUrl('/api/admin/keys'), {
    method: 'GET',
    headers: authHeaders(adminSecret),
  });
  const body = await parseJson<LicenseAdminListResponse>(response);
  return response.ok && body.ok === true;
}

export async function generateLicenseKeys(
  adminSecret: string,
  input: { count?: number; note?: string },
): Promise<LicenseAdminGenerateResponse> {
  const response = await fetch(apiUrl('/api/admin/keys/generate'), {
    method: 'POST',
    headers: authHeaders(adminSecret),
    body: JSON.stringify({
      count: input.count ?? 1,
      note: input.note?.trim() || null,
    }),
  });
  return parseJson<LicenseAdminGenerateResponse>(response);
}

export async function listLicenseKeys(
  adminSecret: string,
): Promise<LicenseAdminListResponse> {
  const response = await fetch(apiUrl('/api/admin/keys'), {
    method: 'GET',
    headers: authHeaders(adminSecret),
  });
  return parseJson<LicenseAdminListResponse>(response);
}

export async function revokeLicenseKey(
  adminSecret: string,
  licenseId: string,
): Promise<LicenseAdminRevokeResponse> {
  const response = await fetch(apiUrl(`/api/admin/keys/${licenseId}/revoke`), {
    method: 'POST',
    headers: authHeaders(adminSecret),
  });
  return parseJson<LicenseAdminRevokeResponse>(response);
}
