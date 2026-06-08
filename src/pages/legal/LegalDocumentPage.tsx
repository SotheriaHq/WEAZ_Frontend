import { Link, Navigate, useLocation } from 'react-router-dom';
import { LEGAL_PAGE_BY_SLUG } from './legalDocuments';

export default function LegalDocumentPage() {
  const location = useLocation();
  const slug = location.pathname.split('/').filter(Boolean)[0];
  const document = slug ? LEGAL_PAGE_BY_SLUG.get(slug) : null;

  if (!document) {
    return <Navigate to="/legal" replace />;
  }

  return (
    <main className="threadly-shell-bg min-h-screen px-4 py-12 text-slate-950 dark:text-white sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <Link
          to="/legal"
          className="text-sm font-semibold text-fuchsia-600 underline decoration-fuchsia-300 underline-offset-4 dark:text-fuchsia-300"
        >
          Back to legal center
        </Link>

        <header className="mt-6 border-b border-slate-200 pb-6 dark:border-white/10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-500 dark:text-fuchsia-300">
            Version {document.version}
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{document.title}</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Draft effective date: {document.effectiveDate}. Counsel review required before public launch.
          </p>
          <p className="mt-4 text-base text-slate-700 dark:text-slate-200">
            {document.summary}
          </p>
        </header>

        <div className="mt-8 space-y-7">
          {document.sections.map((section) => (
            <section key={section.heading} id={section.heading.toLowerCase().replace(/\s+/g, '-')}>
              <h2 className="text-xl font-bold">{section.heading}</h2>
              <p className="mt-2 leading-7 text-slate-700 dark:text-slate-300">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
