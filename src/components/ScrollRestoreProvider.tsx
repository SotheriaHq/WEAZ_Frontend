import React, { useCallback, useEffect, useRef } from 'react';

interface ScrollEntry {
  y: number;
  filterState?: Record<string, any>;
  selectedIndex?: number;
  savedAt: number;
}

interface ScrollRestoreContextType {
  saveScrollPosition: (key: string, y: number, filterState?: Record<string, any>, selectedIndex?: number) => void;
  getScrollPosition: (key: string) => ScrollEntry | undefined;
  clearScrollPosition: (key: string) => void;
}

const ScrollRestoreContext = React.createContext<ScrollRestoreContextType | null>(null);

/**
 * Provider to restore scroll position and filter state when navigating back.
 * Preserves position per route/key pair.
 */
export const ScrollRestoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scrollPositions = useRef<Map<string, ScrollEntry>>(new Map());

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  const saveScrollPosition = useCallback(
    (key: string, y: number, filterState?: Record<string, any>, selectedIndex?: number) => {
      scrollPositions.current.set(key, { y, filterState, selectedIndex, savedAt: Date.now() });
    },
    [],
  );

  const getScrollPosition = useCallback((key: string) => {
    return scrollPositions.current.get(key);
  }, []);

  const clearScrollPosition = useCallback((key: string) => {
    scrollPositions.current.delete(key);
  }, []);

  return (
    <ScrollRestoreContext.Provider value={{ saveScrollPosition, getScrollPosition, clearScrollPosition }}>
      {children}
    </ScrollRestoreContext.Provider>
  );
};

/**
 * Hook to manage scroll restoration for a screen.
 * Call this in useEffect with a stable key for each screen.
 */
export const useScrollRestore = (key: string, containerSelector?: string) => {
  const context = React.useContext(ScrollRestoreContext);
  const containerRef = useRef<HTMLElement | null>(null);

  if (!context) {
    throw new Error('useScrollRestore must be used within ScrollRestoreProvider');
  }

  const { saveScrollPosition, getScrollPosition } = context;

  // Restore scroll on mount
  useEffect(() => {
    const restore = () => {
      const container = containerSelector
        ? (document.querySelector(containerSelector) as HTMLElement | null)
        : null;

      const entry = getScrollPosition(key);
      if (entry) {
        if (container) {
          container.scrollTop = entry.y;
        } else {
          window.scrollTo(0, entry.y);
        }
      }
    };
    const timers = [0, 50, 150, 350, 750].map((delay) => window.setTimeout(restore, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [key, containerSelector, getScrollPosition]);

  // Save scroll on scroll event
  const handleScroll = useCallback(() => {
    const container = containerSelector ? (document.querySelector(containerSelector) as HTMLElement) : null;
    const y = container ? container.scrollTop : window.scrollY;
    const existing = getScrollPosition(key);

    if (y === 0 && existing && existing.y > 0 && Date.now() - existing.savedAt < 1200) {
      return;
    }

    if (containerRef.current) {
      saveScrollPosition(key, y);
    } else if (!containerSelector) {
      saveScrollPosition(key, y);
    }
  }, [key, containerSelector, getScrollPosition, saveScrollPosition]);

  useEffect(() => {
    const container = containerSelector ? (document.querySelector(containerSelector) as HTMLElement) : window;

    container?.addEventListener('scroll', handleScroll, { passive: true });
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [handleScroll, containerSelector]);

  return { saveScrollPosition, getScrollPosition };
};

export default ScrollRestoreProvider;
