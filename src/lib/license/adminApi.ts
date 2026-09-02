import type {
  LicenseAdminGenerateResponse,
  LicenseAdminListResponse,
  LicenseAdminRevokeResponse,
} from '../../types/license';

const API_BASE = import.meta.env.VITE_LICENSE_API_BASE ?? '';

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function authHeaders(adminSecret: string): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminSecret}`,
  };
}

export async function verifyAdminSecret(adminSecret: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/admin/keys`, {
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
  const response = await fetch(`${API_BASE}/api/admin/keys/generate`, {
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
  const response = await fetch(`${API_BASE}/api/admin/keys`, {
    method: 'GET',
    headers: authHeaders(adminSecret),
  });
  return parseJson<LicenseAdminListResponse>(response);
}

export async function revokeLicenseKey(
  adminSecret: string,
  licenseId: string,
): Promise<LicenseAdminRevokeResponse> {
  const response = await fetch(`${API_BASE}/api/admin/keys/${licenseId}/revoke`, {
    method: 'POST',
    headers: authHeaders(adminSecret),
  });
  return parseJson<LicenseAdminRevokeResponse>(response);
}
