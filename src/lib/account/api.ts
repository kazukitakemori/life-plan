import type { LicenseEdition } from '../../types/licenseEdition';

export interface AccountMeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    pictureUrl: string | null;
  };
  workspace?: {
    id: string;
    name: string;
    kind: 'personal' | 'advisor';
  };
  entitlement?: {
    edition: LicenseEdition;
    status: 'trial' | 'active' | 'inactive';
    trialAnalysisUsed: boolean;
    expiresAt: string | null;
  };
}

interface RedeemLicenseResponse {
  ok: boolean;
  error?: string;
  message?: string;
  edition?: LicenseEdition;
  status?: 'active';
}

export interface EmailAuthResponse {
  ok: boolean;
  error?: string;
  message?: string;
  expiresInSeconds?: number;
  authenticated?: boolean;
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (body == null) {
    throw new Error('サーバーから正しい応答を受け取れませんでした。');
  }
  return body;
}

export async function fetchAccountMe(): Promise<AccountMeResponse> {
  const response = await fetch('/api/account/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('アカウント情報を確認できませんでした。');
  }
  return parseJson<AccountMeResponse>(response);
}

export function startGoogleLogin(): void {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(
    `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function requestEmailLoginCode(
  email: string,
): Promise<EmailAuthResponse> {
  const response = await fetch('/api/auth/email/request', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await parseJson<EmailAuthResponse>(response);
  if (!response.ok && !body.message) {
    throw new Error('認証コードを送信できませんでした。');
  }
  return body;
}

export async function verifyEmailLoginCode(
  email: string,
  code: string,
): Promise<EmailAuthResponse> {
  const response = await fetch('/api/auth/email/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const body = await parseJson<EmailAuthResponse>(response);
  if (!response.ok && !body.message) {
    throw new Error('認証コードを確認できませんでした。');
  }
  return body;
}

export async function logoutAccount(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error('ログアウトに失敗しました。');
  }
}

export async function redeemAccountLicense(
  key: string,
): Promise<RedeemLicenseResponse> {
  const response = await fetch('/api/account/redeem-license', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  const body = await parseJson<RedeemLicenseResponse>(response);
  if (!response.ok && !body.message) {
    throw new Error('利用コードの登録に失敗しました。');
  }
  return body;
}

export async function markAccountTrialAnalysisUsed(): Promise<void> {
  const response = await fetch('/api/account/trial-analysis/use', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error('体験利用の状態を保存できませんでした。');
  }
}
