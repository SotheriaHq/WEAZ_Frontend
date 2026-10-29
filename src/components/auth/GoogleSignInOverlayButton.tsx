import { useEffect, useRef, useState } from 'react';
import GoogleSignInButton from './GoogleSignInButton';
import { mountGoogleSignInButton } from '@/auth/googleIdentity';
import { env } from '@/config/env';
import { useConsent } from '@/privacy/consent';

type Props = {
  label?: string;
  loading?: boolean;
  context: 'signin' | 'signup';
  onToken: (idToken: string) => void;
  onError: (err: Error) => void;
  testId?: string;
};

export default function GoogleSignInOverlayButton({
  label,
  loading = false,
  context,
  onToken,
  onError,
  testId,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  /*
    Google's script is a third party. It loads when the page opens only if the
    visitor allowed that in the cookie choice; otherwise it loads when they
    choose this button, and Google's own button replaces ours for the next tap.
  */
  const { record } = useConsent();
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const armed = record?.thirdPartySignIn === true || requested;

  useEffect(() => {
    if (!armed || !env.google.configured || !overlayRef.current || loading) return;
    const container = overlayRef.current;
    let active = true;

    mountGoogleSignInButton(
      container,
      env.google.clientId,
      context,
      (token) => onTokenRef.current(token),
      (err) => onErrorRef.current(err),
    )
      .then((cleanup) => {
        cleanupRef.current = cleanup;
        if (active) setReady(true);
      })
      .catch((err) => onErrorRef.current(err instanceof Error ? err : new Error(String(err))));

    return () => {
      active = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [armed, context, loading]);

  return (
    /*
      `group` and `auth-social-overlay-host` both exist because Google's real
      button is mounted as a transparent iframe pinned over ours. The pointer
      therefore never reaches the styled <button>, so `.auth-social-btn:hover`
      and the label's `group-hover:` never fired and Google was the only social
      button with no hover state. Hover is driven from this wrapper instead,
      which covers the overlay as well as the button.
    */
    <div>
      <div className="auth-social-overlay-host group relative">
        <GoogleSignInButton
          label={label}
          loading={loading}
          disabled={!env.google.configured || loading}
          onClick={() => {
            if (!armed) setRequested(true);
          }}
          testId={testId}
        />
        {env.google.configured && !loading && armed && (
          <div
            ref={overlayRef}
            className="absolute inset-0 overflow-hidden z-10 cursor-pointer"
            style={{ opacity: 0.001 }}
            aria-hidden="true"
          />
        )}
      </div>
      <p aria-live="polite" className="mt-2 text-center text-xs text-[var(--text-secondary)]">
        {requested && ready && !loading ? 'Google is ready. Choose “Continue with Google” again.' : ''}
      </p>
    </div>
  );
}
