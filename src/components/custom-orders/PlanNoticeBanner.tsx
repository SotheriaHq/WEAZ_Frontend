import type { ReactNode } from 'react';
import type { PlanNotice } from '@/lib/subscriptionPlanNotice';

/**
 * A plan that is ending, has lapsed, or is about to shrink — see
 * `planNotice`. The caller supplies the actions as children: a link to
 * billing in Studio, a jump to the plans on the billing page.
 */
export function PlanNoticeBanner({
  notice,
  children,
}: {
  notice: PlanNotice;
  children?: ReactNode;
}) {
  const warning = notice.tone === 'warning';
  return (
    <div
      role={warning ? 'alert' : 'status'}
      className={`rounded-2xl border-2 p-4 sm:p-5 ${
        warning
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
          : 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950/30'
      }`}
    >
      <p className="text-sm font-bold text-gray-900 dark:text-white">
        {notice.title}
      </p>
      <p className="mt-1 text-sm font-medium leading-6 text-gray-700 dark:text-gray-300">
        {notice.body}
      </p>
      {children ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
