import type { ReactNode } from 'react';
import VerificationBadgeExplanation from './VerificationBadgeExplanation';

interface VerificationHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: string;
  actions?: ReactNode;
}

export default function VerificationHero({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone,
  actions,
}: VerificationHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:p-8 shadow-[0_8px_32px_rgba(109,35,249,0.04)]">
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-highest text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            {eyebrow}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-on-surface-variant">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <VerificationBadgeExplanation />
            {actions}
          </div>
        </div>
        {statusLabel ? (
          <div
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm ${statusTone ?? 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'}`}
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            {statusLabel}
          </div>
        ) : null}
      </div>
    </section>
  );
}
