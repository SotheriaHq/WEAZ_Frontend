/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_TOKEN_STORAGE_KEY?: string;
  readonly VITE_USER_STORAGE_KEY?: string;
  readonly VITE_ENABLE_BRAND_DETAIL_ENDPOINTS?: string;
  readonly VITE_API_WITH_CREDENTIALS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
