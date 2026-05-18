import type { ReviewSummaryDto } from '@/api/ReviewApi';
import { SATISFACTION_OPTIONS } from './reviewDisplay';

type ReviewSummaryProps = {
  summary: ReviewSummaryDto;
};

export default function ReviewSummary({ summary }: ReviewSummaryProps) {
  const total = summary.reviewCount;
  const ratingRows = [5, 4, 3, 2, 1].map((rating) => {
    const count = summary.ratingBreakdown[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
    return {
      rating,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    };
  });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">
            {summary.averageRating.toFixed(1)}
          </div>
          <div className="mt-1 text-sm font-semibold text-amber-500" aria-label={`${summary.averageRating.toFixed(1)} stars`}>
            {'★'.repeat(Math.round(summary.averageRating || 0)).padEnd(5, '☆')}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} verified review{total === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {ratingRows.map((row) => (
              <div key={row.rating} className="flex items-center gap-3">
                <span className="w-12 text-xs font-semibold text-gray-600 dark:text-gray-300">{row.rating} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-gray-500 dark:text-gray-400">{row.count}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {SATISFACTION_OPTIONS.map((option) => {
              const count = summary.satisfactionDistribution[option.value] ?? 0;
              return (
                <span key={option.value} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${option.toneClass}`}>
                  <span aria-hidden="true">{option.emoji}</span>
                  {option.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
