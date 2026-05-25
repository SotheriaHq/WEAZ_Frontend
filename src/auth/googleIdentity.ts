type GoogleCredentialResponse = {
  credential?: string;
};

type GooglePromptMomentNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    login_hint?: string;
  }) => void;
  prompt: (callback?: (notification: GooglePromptMomentNotification) => void) => void;
  cancel?: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_PROMPT_TIMEOUT_MS = 90_000;
export const GOOGLE_CLIENT_CONFIGURATION_ERROR_MESSAGE =
  'Google sign-in could not start. Check that VITE_GOOGLE_CLIENT_ID matches the Google Console Web client and that this origin is authorized.';

let googleScriptPromise: Promise<void> | null = null;
let cancelActivePrompt: (() => void) | null = null;

const logGoogleClientDiagnostic = (reason: string) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  console.warn('[auth:google] Google sign-in could not start.', {
    reason,
    requiredEnvKey: 'VITE_GOOGLE_CLIENT_ID',
    origin: window.location.origin,
    guidance:
      'The configured client ID must be the Google Console Web client where this exact origin is authorized.',
  });
};

const loadGoogleIdentityScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in a browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Google sign-in.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Google sign-in.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

export const requestGoogleIdToken = async ({
  clientId,
  context,
  loginHint,
}: {
  clientId: string;
  context: 'signin' | 'signup';
  loginHint?: string;
}): Promise<string> => {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId || normalizedClientId.startsWith('<')) {
    throw new Error('Google sign-in is not configured for this environment.');
  }

  try {
    await loadGoogleIdentityScript();
  } catch {
    logGoogleClientDiagnostic('google-identity-script-load-failed');
    throw new Error(GOOGLE_CLIENT_CONFIGURATION_ERROR_MESSAGE);
  }

  const googleId = window.google?.accounts?.id;
  if (!googleId) {
    logGoogleClientDiagnostic('google-identity-unavailable');
    throw new Error(GOOGLE_CLIENT_CONFIGURATION_ERROR_MESSAGE);
  }

  cancelActivePrompt?.();
  googleId.cancel?.();

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cancelActivePrompt = null;
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      googleId.cancel?.();
      finish(() => reject(new Error('Google sign-in timed out. Try again.')));
    }, GOOGLE_PROMPT_TIMEOUT_MS);

    cancelActivePrompt = () => {
      googleId.cancel?.();
      finish(() => reject(new Error('Google sign-in was cancelled.')));
    };

    googleId.initialize({
      client_id: normalizedClientId,
      context,
      auto_select: false,
      cancel_on_tap_outside: true,
      ...(loginHint ? { login_hint: loginHint.trim() } : {}),
      callback: (response) => {
        const credential = response.credential?.trim();
        finish(() => {
          if (credential) {
            resolve(credential);
          } else {
            reject(new Error('Google did not return an ID token.'));
          }
        });
      },
    });

    googleId.prompt((notification) => {
      window.setTimeout(() => {
        if (settled) return;
        const unavailable =
          notification.isNotDisplayed?.() ||
          notification.isSkippedMoment?.() ||
          notification.isDismissedMoment?.();

        if (unavailable) {
          logGoogleClientDiagnostic('prompt-not-displayed-skipped-or-dismissed');
          finish(() => reject(new Error(GOOGLE_CLIENT_CONFIGURATION_ERROR_MESSAGE)));
        }
      }, 0);
    });
  });
};
