/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LICENSE_API_BASE?: string;
  /** 開発時のみ。'0' でライセンス解除をオフにする */
  readonly VITE_LICENSE_DEV_UNLOCK?: string;
  /** PR Preview の空データ領域へ検証用プランを1回だけ投入する */
  readonly VITE_PREVIEW_SEED_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
