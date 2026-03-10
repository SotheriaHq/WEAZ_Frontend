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
    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(135deg,_#f8fcff,_#ffffff_48%,_#eef8ff)] p-6 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.45)]">
      <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.16),_transparent_70%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
            {description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <VerificationBadgeExplanation />
            {actions}
          </div>
        </div>
        {statusLabel ? (
          <div
            className={`inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusTone ?? 'border-gray-200 bg-white text-gray-700'}`}
          >
            {statusLabel}
          </div>
        ) : null}
      </div>
    </section>
  );
}
