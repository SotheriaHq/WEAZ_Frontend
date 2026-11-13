import type { ComponentPropsWithoutRef } from 'react';

type SettingsSectionHeadingProps = ComponentPropsWithoutRef<'h2'> & { as?: 'h2' | 'h3' };

/** One wrapping label followed by a decorative rule; controls keep their own boundaries. */
export function SettingsSectionHeading({ children, as: Heading = 'h2', className = '', style, ...props }: SettingsSectionHeadingProps) {
  return <Heading {...props} data-settings-heading className={`flex min-w-0 flex-1 items-center text-lg font-medium ${className}`} style={{ ...style, columnGap: 12 }}>
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2 break-words" style={{ overflowWrap: 'anywhere' }}>{children}</span>
    <span aria-hidden="true" className="min-w-4 flex-1 bg-[color:var(--wiez-border-default)]" style={{ height: 2 }} />
  </Heading>;
}
