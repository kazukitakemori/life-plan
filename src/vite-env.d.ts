/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LICENSE_API_BASE?: string;
  /** 開発時のみ。'0' でライセンス解除をオフにする */
  readonly VITE_LICENSE_DEV_UNLOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
