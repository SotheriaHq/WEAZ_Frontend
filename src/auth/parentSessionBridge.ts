import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

/** A bridge acknowledgement is only a retry hint. The API rechecks the parent
 * and child; no credential, MFA proof or access grant crosses this bridge. */
export function requestPhoneSessionVerification(parentSessionId: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.ReactNativeWebView) { reject(new Error('Open WIEZ on the flagged phone, verify its session, then retry here.')); return; }
    if (signal.aborted) { reject(new Error('Verification cancelled.')); return; }
    const requestId = crypto.randomUUID();
    const finish = (error?: Error) => {
      clearTimeout(timer); window.removeEventListener('wiez:phone-session-verification', receive);
      signal.removeEventListener('abort', abort);
      if (error) {
        postStudioNativeEvent({ type: 'CANCEL_PHONE_SESSION_VERIFICATION', requestId, parentSessionId });
        reject(error);
      } else resolve();
    };
    const abort = () => finish(new Error('Verification cancelled.'));
    const receive = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (data?.requestId !== requestId || data?.parentSessionId !== parentSessionId) return;
      finish(data?.verified === true ? undefined : new Error('Phone verification did not finish. Retry or open Password & security on that phone.'));
    };
    const timer = setTimeout(() => finish(new Error('Phone verification timed out. Retry when ready.')), 300_000);
    window.addEventListener('wiez:phone-session-verification', receive);
    signal.addEventListener('abort', abort, { once: true });
    postStudioNativeEvent({ type: 'VERIFY_PHONE_SESSION', requestId, parentSessionId });
  });
}
