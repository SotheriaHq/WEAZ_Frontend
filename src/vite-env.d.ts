/// <reference types="vite/client" />

/** Build id stamped by vite.config.ts (define) — matches /version.json buildId. */
declare const __WIEZ_BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_LEGAL_EMAIL?: string;
  readonly VITE_TOKEN_STORAGE_KEY?: string;
  readonly VITE_USER_STORAGE_KEY?: string;
  readonly VITE_ENABLE_BRAND_DETAIL_ENDPOINTS?: string;
  readonly VITE_API_WITH_CREDENTIALS?: string;
  /** Server-composed Market. Proposed name, owner confirmation required. Off by default. */
  readonly VITE_MARKET_V2?: string;
  readonly VITE_WIEZ_NETWORK_TRACE?: string;
  readonly VITE_PAYSTACK_CARDHOLDER_NAME_MATCH_MODE?: 'strict' | 'soft' | 'off';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
