/**
 * ローカル開発時、または明示的なPRプレビュー時だけライセンス確認をスキップする。
 * `npm run dev` では有効。本番ビルドでは通常無効。
 * 本物のライセンス動作を試したいとき: .env に VITE_LICENSE_DEV_UNLOCK=0
 * PRプレビューでは VITE_LICENSE_PREVIEW_UNLOCK=1 をビルド時だけ指定する。
 */
export function isLicenseDevUnlock(): boolean {
  if (import.meta.env.VITE_LICENSE_PREVIEW_UNLOCK === '1') return true;
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_LICENSE_DEV_UNLOCK !== '0';
}
