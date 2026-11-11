import React, { useEffect, useRef, useState } from 'react';

/**
 * Floating scroll-assist FABs for long feeds (e.g. a brand with 200+ designs).
 *
 * - ⬆️ appears once the user has scrolled past ~one viewport and jumps back to
 *   the top (profile metadata) in one tap.
 * - ⬇️ appears while there is at least a viewport of content left below and
 *   jumps to the end of the page.
 * - Renders nothing at all on short pages (< ~2.5 viewports), so it never
 *   clutters small profiles.
 *
 * Emoji markers per Rule 5; rounded-full glass buttons; passive listeners with
 * rAF throttling so scroll tracking never causes jank.
 */
const ScrollAssist: React.FC = () => {
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    const evaluate = () => {
      tickingRef.current = false;
      const viewport = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollY = window.scrollY;

      const longEnough = docHeight > viewport * 2.5;
      setShowUp(longEnough && scrollY > viewport * 0.75);
      setShowDown(longEnough && scrollY + viewport < docHeight - viewport * 0.5);
    };

    const onScrollOrResize = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  if (!showUp && !showDown) return null;

  const buttonClass =
    'wiez-lg-surface wiez-lg-regular wiez-lg-interactive flex h-10 w-10 items-center justify-center rounded-full text-base focus:outline-none';

  return (
    <div className="fixed bottom-36 right-3 z-[55] flex flex-col gap-2">
      {showUp ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={buttonClass}
          aria-label="Scroll to top"
          title="Back to top"
        >
          <span aria-hidden="true">⬆️</span>
        </button>
      ) : null}
      {showDown ? (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: 'smooth',
            })
          }
          className={buttonClass}
          aria-label="Scroll to bottom"
          title="Jump to bottom"
        >
          <span aria-hidden="true">⬇️</span>
        </button>
      ) : null}
    </div>
  );
};

export default ScrollAssist;
