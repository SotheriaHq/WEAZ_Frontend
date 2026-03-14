import { Link, useLocation, useNavigate } from 'react-router-dom';
import VerificationBadgeMeaningContent from '@/components/studio/verification/VerificationBadgeMeaningContent';

export default function VerifiedBadgeMeaningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const returnTo =
    typeof fromState === 'string' && fromState.startsWith('/')
      ? fromState
      : '/studio/store';

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="transition hover:text-slate-700"
        >
          Back
        </button>
        <span>/</span>
        <span className="text-slate-800">Verified badge meaning</span>
      </nav>

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(135deg,_#f8fcff,_#ffffff_48%,_#eef8ff)] p-8 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
          Seller trust
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
          Verified badge meaning
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
          This page explains what Threadly&apos;s verified badge represents on
          store, catalog, and profile surfaces, and why that signal may change
          over time.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={returnTo}
            className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            Return to previous page
          </Link>
          <Link
            to="/studio/store"
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-50"
          >
            Back to studio store
          </Link>
          <Link
            to="/studio/verification"
            className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Open verification workspace
          </Link>
        </div>
      </section>

      <div className="mt-6">
        <VerificationBadgeMeaningContent />
      </div>
    </div>
  );
}
