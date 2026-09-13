const PRODUCTION_HOSTNAME = 'life-plan.kazuki-takemori-sub.workers.dev';
const PREVIEW_HOST_SUFFIX = '-life-plan.kazuki-takemori-sub.workers.dev';

function currentHostname(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.hostname.toLowerCase();
}

/** 本番URLではPreview用の補助機能を必ず無効にする。 */
export function isProductionHost(): boolean {
  return currentHostname() === PRODUCTION_HOSTNAME;
}

/**
 * Cloudflare Workers がPR / branch / commitごとに発行する確認用ホストか判定する。
 * 本番ホストは明示的に除外し、Preview専用機能が本番で有効にならないようにする。
 */
export function isCloudflarePreviewHost(): boolean {
  const hostname = currentHostname();
  if (!hostname || hostname === PRODUCTION_HOSTNAME) return false;
  return hostname.endsWith(PREVIEW_HOST_SUFFIX);
}

/**
 * Preview向けの補助機能を有効にしてよい環境か。
 * 本番ホストを最優先で除外したうえで、ビルド時フラグまたはCloudflareのPreview URLを使う。
 */
export function isPreviewEnvironment(): boolean {
  if (isProductionHost()) return false;

  return (
    import.meta.env.VITE_PREVIEW_SEED_DATA === '1' ||
    import.meta.env.VITE_LICENSE_PREVIEW_UNLOCK === '1' ||
    isCloudflarePreviewHost()
  );
}
