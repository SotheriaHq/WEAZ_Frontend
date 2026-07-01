import { useEffect, useState } from 'react';
import {
  getLegalVersions,
  LEGAL_SIGNUP_DOCUMENT_KEYS,
  type LegalDocumentDefinition,
} from '@/api/LegalApi';

type Props = {
  open: boolean;
  /** True while the parent completes googleAuth after the user accepts. */
  loading?: boolean;
  onCancel: () => void;
  /** Called when the user affirmatively accepts the current terms. */
  onAccept: () => void;
};

/**
 * Shown when a brand-new user signs in with Google from the Login page. Google
 * account creation requires affirmative acceptance of the current Terms & Privacy
 * (see backend `assertRequiredCurrentAcceptances`), which the Login page does not
 * collect up front. This modal captures that consent, then the parent retries
 * googleAuth with the built `legalAcceptances`.
 */
export default function GoogleConsentModal({ open, loading = false, onCancel, onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentDefinition[]>([]);

  useEffect(() => {
    if (!open) {
      setAgreed(false);
      return;
    }
    let active = true;
    void getLegalVersions()
      .then((versions) => {
        if (!active) return;
        const byKey = new Map(versions.documents.map((doc) => [doc.key, doc]));
        setDocuments(
          LEGAL_SIGNUP_DOCUMENT_KEYS.map((key) => byKey.get(key)).filter(
            (doc): doc is LegalDocumentDefinition => Boolean(doc),
          ),
        );
      })
      .catch(() => {
        if (active) setDocuments([]);
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-consent-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[color:var(--surface-primary)] p-6 shadow-2xl">
        <div className="mb-4 text-3xl" aria-hidden="true">
          📜
        </div>
        <h2
          id="google-consent-title"
          className="text-xl font-bold text-gray-900 dark:text-white"
        >
          One quick thing
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          To create your account with Google, please review and accept our current terms.
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-gray-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
          <input
            type="checkbox"
            checked={agreed}
            disabled={loading}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-purple-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">
            I agree to the{' '}
            {documents.length > 0 ? (
              documents.map((doc, index) => (
                <span key={doc.key}>
                  <a
                    href={doc.route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-purple-600 underline hover:text-purple-500 dark:text-purple-400"
                  >
                    {doc.title}
                  </a>
                  {index < documents.length - 1 ? ' and ' : ''}
                </span>
              ))
            ) : (
              <span className="font-semibold">Terms of Service and Privacy Policy</span>
            )}
            .
          </span>
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-full border border-gray-200/70 bg-white/70 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-white disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!agreed || loading}
            className="flex-1 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Agree & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
