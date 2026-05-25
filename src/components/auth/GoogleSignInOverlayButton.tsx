import { useEffect, useRef } from 'react';
import GoogleSignInButton from './GoogleSignInButton';
import { mountGoogleSignInButton } from '@/auth/googleIdentity';
import { env } from '@/config/env';

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

  useEffect(() => {
    if (!env.google.configured || !overlayRef.current || loading) return;
    const container = overlayRef.current;

    mountGoogleSignInButton(
      container,
      env.google.clientId,
      context,
      (token) => onTokenRef.current(token),
      (err) => onErrorRef.current(err),
    )
      .then((cleanup) => { cleanupRef.current = cleanup; })
      .catch((err) => onErrorRef.current(err instanceof Error ? err : new Error(String(err))));

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [context, loading]);

  return (
    <div className="relative">
      <GoogleSignInButton
        label={label}
        loading={loading}
        disabled={!env.google.configured || loading}
        onClick={() => {}}
        testId={testId}
      />
      {env.google.configured && !loading && (
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-hidden z-10 cursor-pointer"
          style={{ opacity: 0.001 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
