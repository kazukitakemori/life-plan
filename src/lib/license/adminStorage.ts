const ADMIN_SECRET_KEY = 'life-plan-license-admin-secret';

export function loadAdminSecret(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_SECRET_KEY);
  } catch {
    return null;
  }
}

export function saveAdminSecret(secret: string): void {
  sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
}

export function clearAdminSecret(): void {
  sessionStorage.removeItem(ADMIN_SECRET_KEY);
}
