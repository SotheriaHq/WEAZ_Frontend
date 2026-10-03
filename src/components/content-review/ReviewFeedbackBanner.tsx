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
 * Authoritative by design: driven entirely by the server-side review history,
 * never by a URL flag — stale or shared links cannot fabricate feedback.
 *
 * Renders once the content has EVER had a changes-requested cycle, in one of
 * two tones:
 *  - outstanding (amber) — the current state is CHANGES_REQUESTED, act on it;
 *  - answered (muted)    — the owner has resubmitted, kept visible for
 *                          reference.
 *
 * The second case exists because the gate used to be "current state is
 * CHANGES_REQUESTED or render nothing", which erased the request the moment it
 * was answered: the owner held a notification saying changes were needed and
 * the page showed nothing about what they were.
 *
 * Multiple review cycles on the same content are preserved: the relevant
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

  // The most recent request the review team actually made, whatever the
  // CURRENT state is.
  const lastChangeRequest = useMemo(
    () => (cycles ?? []).find((cycle) => cycle.status === 'CHANGES_REQUESTED') ?? null,
    [cycles],
  );

  // Two states, not one.
  //
  // The gate used to be `latest.status !== 'CHANGES_REQUESTED' -> render
  // nothing`, so the instant an owner resubmitted, the request they were
  // answering vanished from the screen. They were left editing content with a
  // notification saying changes were needed and nothing on the page saying
  // WHAT. Once there has been a request, it stays visible — active while it is
  // outstanding, muted and past-tense once it has been answered.
  if (!latest || !lastChangeRequest) return null;
  const isOutstanding = latest.status === 'CHANGES_REQUESTED';
  const shown = isOutstanding ? latest : lastChangeRequest;

  const latestFeedback =
    [shown.reasonLabel, shown.reasonNote].filter(Boolean).join(' — ') ||
    fallbackNote?.trim() ||
    (isOutstanding
      ? 'Review the feedback in your notification, make the updates below, and save — it goes back into review automatically.'
      : 'No note was attached to that request.');

  const tone = isOutstanding
    ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
    : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5';

  return (
    <div className={`mb-4 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          {isOutstanding ? '🛠️' : '🗒️'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-sm font-bold ${
                isOutstanding
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              {isOutstanding
                ? 'Changes requested by the review team'
                : latest.status === 'IN_REVIEW'
                  ? 'You answered this request — back with the review team'
                  : 'Previously requested by the review team'}
            </p>
            {changeRequestCount > 1 ? (
              <span className="rounded-full border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                request #{changeRequestCount}
              </span>
            ) : null}
            <span className={`text-[11px] font-medium ${isOutstanding ? 'text-amber-700/80 dark:text-amber-200/70' : 'text-gray-500 dark:text-gray-400'}`}>
              {formatWhen(shown.reviewedAt ?? shown.submittedAt)}
            </span>
          </div>
          <p className={`mt-1 text-sm leading-6 ${isOutstanding ? 'text-amber-800/90 dark:text-amber-100/90' : 'text-gray-600 dark:text-gray-300'}`}>
            {latestFeedback}
          </p>

          {history.length > 1 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className={`text-xs font-semibold underline underline-offset-2 hover:opacity-80 ${isOutstanding ? 'text-amber-800 dark:text-amber-200' : 'text-gray-600 dark:text-gray-300'}`}
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
