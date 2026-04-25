import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

interface OverlayPortalProps {
  children: React.ReactNode;
  rootId?: string;
}

export const OverlayPortal: React.FC<OverlayPortalProps> = ({ children, rootId = 'overlay-root' }) => {
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);

  const containerEl = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return document.createElement('div');
  }, []);

  useEffect(() => {
    if (!containerEl) return;

    const root = document.getElementById(rootId) ?? document.body;
    root.appendChild(containerEl);
    setRootEl(root);

    return () => {
      try {
        root.removeChild(containerEl);
      } catch {
        // ignore
      }
    };
  }, [containerEl, rootId]);

  if (!containerEl || !rootEl) return null;

  return createPortal(children, containerEl);
};
