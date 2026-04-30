export type StudioNativeEvent =
  | { type: 'READY' }
  | { type: 'ROUTE_CHANGED'; path: string }
  | { type: 'AUTH_REQUIRED'; reason?: string }
  | { type: 'HANDOFF_FAILED'; reason?: string }
  | { type: 'PROFILE_SETUP_REQUIRED'; path?: string }
  | { type: 'ACTION_COMPLETE'; action?: string; path?: string }
  | { type: 'OPEN_EXTERNAL'; url: string }
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
