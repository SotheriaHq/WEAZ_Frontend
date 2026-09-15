export type StudioNativeEvent =
  | { type: 'READY' }
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
      path?: string;
    }
  | { type: 'ACTION_COMPLETE'; action?: string; path?: string }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'OPEN_NATIVE_ROUTE'; path: string }
  | { type: 'CLOSE' };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

export function postStudioNativeEvent(event: StudioNativeEvent): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(event));
  } catch {
    // Native bridge delivery is best-effort only.
  }
}
