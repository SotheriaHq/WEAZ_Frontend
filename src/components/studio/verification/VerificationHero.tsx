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
    <section className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 sm:text-base">
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
