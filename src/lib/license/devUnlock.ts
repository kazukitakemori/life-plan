/**
 * ローカル開発時だけライセンス確認をスキップする。
 * `npm run dev` では有効。本番ビルドでは必ず無効。
 * 本物のライセンス動作を試したいとき: .env に VITE_LICENSE_DEV_UNLOCK=0
 */
export function isLicenseDevUnlock(): boolean {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_LICENSE_DEV_UNLOCK !== '0';
}
