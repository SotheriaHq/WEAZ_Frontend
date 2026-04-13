type HostedPopupOptions = {
  authorizationUrl: string;
  returnUrl: string;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  onReturn?: (returnUrl: URL) => void;
};

let activeHostedPopup: Window | null = null;
let activeHostedPopupPoller: number | null = null;

const clearHostedPopupState = () => {
  if (activeHostedPopupPoller != null) {
    window.clearInterval(activeHostedPopupPoller);
    activeHostedPopupPoller = null;
  }
  activeHostedPopup = null;
};

const buildHostedPaymentUrl = (authorizationUrl: string, returnUrl: string): string => {
  const url = new URL(authorizationUrl, window.location.origin);
  url.searchParams.set('whitelabel', '1');
  url.searchParams.set('redirect_to', returnUrl);
  return url.toString();
};

export const openHostedPaymentPopup = async ({
  authorizationUrl,
  returnUrl,
  onCancel,
  onError,
  onReturn,
}: HostedPopupOptions) => {
  const popupUrl = buildHostedPaymentUrl(authorizationUrl, returnUrl);
  const width = 480;
  const height = 760;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));

  if (activeHostedPopup && !activeHostedPopup.closed) {
    activeHostedPopup.close();
    clearHostedPopupState();
  }

  const popup = window.open(
    popupUrl,
    'threadly-paystack-auth',
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );

  if (!popup) {
    const error = new Error('Unable to open the secure payment window.');
    onError?.(error);
    throw error;
  }

  activeHostedPopup = popup;
  popup.focus();

  const popupRef = popup;
  const expectedReturn = new URL(returnUrl, window.location.origin);

  await new Promise<void>((resolve, reject) => {
    activeHostedPopupPoller = window.setInterval(() => {
      if (!activeHostedPopup || activeHostedPopup.closed) {
        clearHostedPopupState();
        onCancel?.();
        resolve();
        return;
      }

      try {
        const currentUrl = new URL(activeHostedPopup.location.href);
        if (
          currentUrl.origin === expectedReturn.origin &&
          currentUrl.pathname === expectedReturn.pathname
        ) {
          activeHostedPopup.close();
          clearHostedPopupState();
          onReturn?.(currentUrl);
          resolve();
        }
      } catch {
        // Cross-origin while the provider page is active. Keep polling.
      }
    }, 400);

    popupRef.addEventListener?.('error', () => {
      const error = new Error('The secure payment window could not be loaded.');
      clearHostedPopupState();
      onError?.(error);
      reject(error);
    });
  });
};

export const closeActiveHostedPaymentPopup = async () => {
  if (!activeHostedPopup || activeHostedPopup.closed) {
    clearHostedPopupState();
    return;
  }

  activeHostedPopup.close();
  clearHostedPopupState();
};
