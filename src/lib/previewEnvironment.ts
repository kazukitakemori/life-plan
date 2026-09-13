const PRODUCTION_HOSTNAME = 'life-plan.kazuki-takemori-sub.workers.dev';
const PREVIEW_HOST_SUFFIX = '-life-plan.kazuki-takemori-sub.workers.dev';

/**
 * Cloudflare Workers がPR / branch / commitごとに発行する確認用ホストか判定する。
 * 本番ホストは明示的に除外し、Preview専用機能が本番で有効にならないようにする。
 */
export function isCloudflarePreviewHost(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname !== PRODUCTION_HOSTNAME &&
    hostname.endsWith(PREVIEW_HOST_SUFFIX)
  );
}

/**
 * Preview向けの補助機能を有効にしてよい環境か。
 * ビルド時フラグに加え、Cloudflareの自動Preview URLも実行時に判定する。
 */
export function isPreviewEnvironment(): boolean {
  return (
    import.meta.env.VITE_PREVIEW_SEED_DATA === '1' ||
    import.meta.env.VITE_LICENSE_PREVIEW_UNLOCK === '1' ||
    isCloudflarePreviewHost()
  );
}
