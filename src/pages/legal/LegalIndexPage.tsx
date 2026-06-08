import { Link } from 'react-router-dom';
import { APP_NAME } from '@/config/productIdentity';
import { LEGAL_PAGES } from './legalDocuments';

export default function LegalIndexPage() {
  return (
    <main className="threadly-shell-bg min-h-screen px-4 py-12 text-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-500 dark:text-fuchsia-300">
            Legal center
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{APP_NAME} Legal</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            These documents are versioned for product enforcement and acceptance tracking.
            Current draft copy is marked for counsel review before public launch.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {LEGAL_PAGES.map((document) => (
            <Link
              key={document.key}
              to={`/${document.slug}`}
              className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 shadow-sm transition hover:border-fuchsia-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
            >
              <p className="text-lg font-bold">{document.title}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {document.summary}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Version {document.version}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
