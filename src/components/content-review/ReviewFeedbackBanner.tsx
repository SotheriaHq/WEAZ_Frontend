import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/httpClient';

type ReviewCycle = {
  id: string;
  entityType: string;
  status: string;
  reasonCode: string | null;
  reasonLabel: string | null;
  reasonNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  IN_REVIEW: 'Submitted for review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  CHANGES_REQUESTED: 'Changes requested',
};

const STATUS_MARKERS: Record<string, string> = {
  IN_REVIEW: '⏳',
  APPROVED: '✅',
  REJECTED: '❌',
  CHANGES_REQUESTED: '🛠️',
};

const formatWhen = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface ReviewFeedbackBannerProps {
  productId?: string | null;
  designId?: string | null;
  /** Reviewer note carried on the notification deep link — shown until the
   *  authoritative history loads, and as fallback when a cycle has no note. */
  fallbackNote?: string | null;
}

/**
 * Reviewer-feedback banner for content edit screens.
 *
 * Authoritative by design: renders ONLY when the content's LATEST review
 * cycle is CHANGES_REQUESTED (fetched server-side), never from a URL flag —
 * stale or shared links cannot show the banner on approved content.
 *
 * Multiple review cycles on the same content are preserved: the latest
 * request is shown prominently and the full timeline (every submit /
 * changes-requested / approval with its notes) expands below it.
 */
export default function ReviewFeedbackBanner({
  productId,
  designId,
  fallbackNote,
}: ReviewFeedbackBannerProps) {
  const [cycles, setCycles] = useState<ReviewCycle[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const targetProductId = productId?.trim() || null;
    const targetDesignId = designId?.trim() || null;
    if (!targetProductId && !targetDesignId) {
      setCycles(null);
      return;
    }
    let mounted = true;
    apiClient
      .get('/content-integrity/my-review-history', {
        params: {
          ...(targetProductId ? { productId: targetProductId } : {}),
          ...(targetDesignId ? { designId: targetDesignId } : {}),
        },
      })
      .then((response) => {
        if (!mounted) return;
        const payload = response.data?.data ?? response.data;
        setCycles(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {
        if (mounted) setCycles([]);
      });
    return () => {
      mounted = false;
    };
  }, [productId, designId]);

  const latest = cycles?.[0] ?? null;
  const history = useMemo(() => (cycles ?? []).slice(0, 10), [cycles]);
  const changeRequestCount = useMemo(
    () => (cycles ?? []).filter((cycle) => cycle.status === 'CHANGES_REQUESTED').length,
    [cycles],
  );

  // Authoritative gate: only content whose CURRENT review state is
  // changes-requested shows the banner.
  if (!latest || latest.status !== 'CHANGES_REQUESTED') return null;

  const latestFeedback =
    [latest.reasonLabel, latest.reasonNote].filter(Boolean).join(' — ') ||
    fallbackNote?.trim() ||
    'Review the feedback in your notification, make the updates below, and save — it goes back into review automatically.';

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">🛠️</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
              Changes requested by the review team
            </p>
            {changeRequestCount > 1 ? (
              <span className="rounded-full border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                request #{changeRequestCount}
              </span>
            ) : null}
            <span className="text-[11px] font-medium text-amber-700/80 dark:text-amber-200/70">
              {formatWhen(latest.reviewedAt ?? latest.submittedAt)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">
            {latestFeedback}
          </p>

          {history.length > 1 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:opacity-80 dark:text-amber-200"
              >
                {showHistory ? 'Hide review history' : `Review history (${history.length})`}
              </button>
              {showHistory && (
                <ol className="mt-2 space-y-1.5 border-l-2 border-amber-300/70 pl-3 dark:border-amber-500/30">
                  {history.map((cycle) => {
                    const outcomeWhen = formatWhen(cycle.reviewedAt ?? cycle.submittedAt);
                    const note = [cycle.reasonLabel, cycle.reasonNote]
                      .filter(Boolean)
                      .join(' — ');
                    return (
                      <li key={cycle.id} className="text-xs leading-5 text-amber-800/90 dark:text-amber-100/85">
                        <span aria-hidden="true" className="mr-1">
                          {STATUS_MARKERS[cycle.status] ?? '•'}
                        </span>
                        <span className="font-semibold">
                          {STATUS_LABELS[cycle.status] ?? cycle.status}
                        </span>
                        {outcomeWhen ? <span className="opacity-75"> · {outcomeWhen}</span> : null}
                        {note ? <span> — {note}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
