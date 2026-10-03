import React, { useEffect, useState } from 'react';

/**
 * What a route guard shows while it works out whether you are signed in.
 *
 * Two things were wrong with the old version, and only one of them was the
 * words.
 *
 * It said "Verifying your session...", which names an internal step the reader
 * did not ask about and cannot act on, and it looked like nothing else in the
 * app. It is a skeleton now, matching the route-chunk fallback, so a slow load
 * looks like every other slow load.
 *
 * The real problem was that it rendered AT ALL on the fast path. Auth
 * hydration reads a token from storage and usually settles in well under a
 * frame or two, but the guard rendered its fallback the instant `loading` was
 * true — so every refresh, on every protected route, flashed a line of grey
 * text and then replaced it. That flash is why it seemed to be everywhere: it
 * was, and almost always for a moment too short to read.
 *
 * So nothing renders for the first {@link FALLBACK_DELAY_MS}. If auth settles
 * inside that window — the overwhelmingly common case — the reader goes
 * straight to the page and never sees a loading state, which is the correct
 * outcome for something that was never slow. Past it, the wait is real and
 * worth acknowledging.
 */

/**
 * Long enough to cover a normal hydration, short enough that a genuinely slow
 * one still gets feedback before it feels broken.
 */
export const FALLBACK_DELAY_MS = 400;

export const AuthGateFallback: React.FC<{ fullScreen?: boolean }> = ({
  fullScreen = false,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center px-4'
          : 'px-4 pb-8 pt-20 sm:px-6 lg:px-8'
      }
      // Announced rather than described: a screen reader gets "loading" from
      // the role, and there is no text to read out.
      role="status"
      aria-label="Loading"
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="h-10 w-44 animate-pulse rounded-full bg-gray-200/90 dark:bg-gray-800/85" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-2xl bg-gray-200/90 dark:bg-gray-800/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuthGateFallback;
