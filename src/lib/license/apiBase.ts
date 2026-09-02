const WORKER_API_ORIGIN = 'https://life-plan.kazuki-takemori-sub.workers.dev';

export function resolveLicenseApiBase(): string {
  const configured = import.meta.env.VITE_LICENSE_API_BASE;
  if (configured) {
    return String(configured).replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && /\.pages\.dev$/i.test(window.location.hostname)) {
    return WORKER_API_ORIGIN;
  }

  return '';
}
