export type StudioNativeEvent =
  | { type: 'READY' }
  | { type: 'BOOT_FAILED' }
  | { type: 'ROUTE_CHANGED'; path: string }
  | { type: 'AUTH_REQUIRED'; reason?: string }
  | {
      type: 'HANDOFF_FAILED';
      reason?: string;
      stage?: string;
      status?: number;
      message?: string;
      apiBaseUrl?: string;
    }
  /**
   * Two different blocks post this: an unverified email and an incomplete
   * brand profile. They send the shell to different places, so `reason` is
   * what tells them apart — the native handler cannot infer it from `path`,
   * which is a web route with no native equivalent. Mirrors the union in
   * `threadly-mobile/app/(tabs)/studio/webview.tsx`; keep the two in step.
   */
  | {
      type: 'PROFILE_SETUP_REQUIRED';
      reason?: 'brand-profile' | 'email-verification';
      /** Server's own `profileMissingFields`: 'description' | 'tags' | 'location'. */
      missingFields?: string[];
      path?: string;
    }
  | { type: 'ACTION_COMPLETE'; action?: string; path?: string }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'OPEN_NATIVE_ROUTE'; path: string }
  | { type: 'CLOSE' }
  | {
      type: 'OPEN_BIO_MODAL';
      payload: {
        title: string;
        description?: string;
        handle?: string;
        location?: string;
        avatarUrl?: string | null;
        tags?: string[];
      };
    };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export function postStudioNativeEvent(event: StudioNativeEvent): void {
  try {
    // React effects from an earlier route can run after history has already
    // moved on. Reporting that old route makes the native host navigate back.
    if (event.type === 'ROUTE_CHANGED') {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (event.path !== current) return;
    }
    window.ReactNativeWebView?.postMessage(JSON.stringify(event));
  } catch {
    // Native bridge delivery is best-effort only.
  }
}
