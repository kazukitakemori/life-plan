import { isCloudflarePreviewHost } from '../previewEnvironment';

/**
 * ローカル開発時、またはPR / branch / commit Preview時だけライセンス確認をスキップする。
 * `npm run dev` では有効。本番ホストでは無効。
 * 本物のライセンス動作を試したいとき: .env に VITE_LICENSE_DEV_UNLOCK=0
 * Previewはビルド時フラグ、またはCloudflareのPreviewホスト名で判定する。
 */
export function isLicenseDevUnlock(): boolean {
  if (import.meta.env.VITE_LICENSE_PREVIEW_UNLOCK === '1') return true;
  if (isCloudflarePreviewHost()) return true;
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_LICENSE_DEV_UNLOCK !== '0';
}
