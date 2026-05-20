/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_TOKEN_STORAGE_KEY?: string;
  readonly VITE_USER_STORAGE_KEY?: string;
  readonly VITE_ENABLE_BRAND_DETAIL_ENDPOINTS?: string;
  readonly VITE_API_WITH_CREDENTIALS?: string;
  readonly VITE_THREADLY_NETWORK_TRACE?: string;
  readonly VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE?: 'strict' | 'soft' | 'off';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
