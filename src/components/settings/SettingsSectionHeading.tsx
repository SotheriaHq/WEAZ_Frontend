import type { ReactNode } from 'react';

export function SettingsSectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="flex items-center gap-3 text-lg font-medium">
    <span className="min-w-0 break-words">{children}</span>
    <span aria-hidden="true" className="h-0.5 min-w-4 flex-1 bg-[color:var(--wiez-border-default)]" />
  </h2>;
}
