import type { VerificationAttemptHistoryItem } from '@/types/verification';
import { verificationStatusLabel, verificationStatusTone } from './verificationShared';

interface VerificationHistoryPanelProps {
  attempts: VerificationAttemptHistoryItem[];
}

export default function VerificationHistoryPanel({
  attempts,
}: VerificationHistoryPanelProps) {
  if (!attempts.length) {
    return (
      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Attempt history</h2>
        <p className="mt-3 text-sm text-gray-500">
          No submission history yet. Your first completed attempt will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Attempt history</h2>
      <div className="mt-5 space-y-4">
        {attempts.map((attempt) => (
          <article
            key={attempt.id}
            className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Attempt {attempt.attemptNumber}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Submitted:{' '}
                  {attempt.submittedAt
                    ? new Date(attempt.submittedAt).toLocaleString()
                    : 'Not submitted'}
                </p>
                {attempt.reviewedAt ? (
                  <p className="mt-1 text-sm text-gray-600">
                    Reviewed: {new Date(attempt.reviewedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${verificationStatusTone(attempt.status)}`}
              >
                {verificationStatusLabel(attempt.status)}
              </div>
            </div>
            {attempt.rejectionReasons && attempt.rejectionReasons.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-rose-700">
                {attempt.rejectionReasons.map((reason) => (
                  <li key={`${attempt.id}-${reason.code}-${reason.label}`}>
                    • {reason.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
