const WORKER_API_ORIGIN = 'https://life-plan.kazuki-takemori-sub.workers.dev';

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * ライセンス API の接続先。
 * - 本番（workers.dev）: 同じオリジン
 * - Cursor / Vite のローカル開発: 本番 API を使う（npm run dev だけでキー入力可能）
 * - pages.dev: 本番 API を使う
 */
export function resolveLicenseApiBase(): string {
  const configured = import.meta.env.VITE_LICENSE_API_BASE;
  if (configured) {
    return String(configured).replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return WORKER_API_ORIGIN;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (/\.pages\.dev$/i.test(hostname) || isLocalDevHost(hostname)) {
      return WORKER_API_ORIGIN;
    }
  }

  return '';
}
