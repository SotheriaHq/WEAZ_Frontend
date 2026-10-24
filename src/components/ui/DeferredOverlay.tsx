import { Suspense, useEffect, useState, type ReactNode } from 'react';

/** Keep the original mounted lifecycle (including exit animation) after use. */
export function DeferredOverlay({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  if (!open && !opened) return null;
  return <Suspense fallback={open ? <div role="status" className="fixed inset-x-4 bottom-6 z-50 rounded-2xl bg-[color:var(--surface-primary)] p-4 text-theme shadow-lg">Loading…</div> : null}>
    {children}
  </Suspense>;
}
