import { Link, Navigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { LEGAL_PAGE_BY_SLUG } from './legalDocuments';

export default function LegalDocumentPage() {
  const location = useLocation();
  const slug = location.pathname.split('/').filter(Boolean)[0];
  const document = slug ? LEGAL_PAGE_BY_SLUG.get(slug) : null;

  if (!document) {
    return <Navigate to="/legal" replace />;
  }

  return (
    <main className="wiez-shell-bg min-h-screen px-4 py-12 text-slate-950 dark:text-white sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
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
            Effective Date: {document.effectiveDate}
          </p>
          <p className="mt-4 text-base text-slate-700 dark:text-slate-200">
            {document.summary}
          </p>
        </header>

        <div className="mt-8 legal-markdown-content text-slate-800 dark:text-slate-200 leading-relaxed">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-black mt-8 mb-4 text-slate-950 dark:text-white">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold mt-8 mb-3 text-slate-950 dark:text-white border-b border-slate-200/80 dark:border-white/10 pb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-bold mt-6 mb-2 text-slate-900 dark:text-slate-100">{children}</h3>,
              h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2 text-slate-900 dark:text-slate-100">{children}</h4>,
              p: ({ children }) => <p className="mt-3 mb-3 leading-7 text-slate-700 dark:text-slate-300">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-outside pl-6 my-3 space-y-1.5 text-slate-700 dark:text-slate-300">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-outside pl-6 my-3 space-y-1.5 text-slate-700 dark:text-slate-300">{children}</ol>,
              li: ({ children }) => <li className="leading-7">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-fuchsia-500 pl-4 py-1.5 my-4 bg-fuchsia-500/5 dark:bg-fuchsia-500/10 text-slate-700 dark:text-slate-300 rounded-r-lg">{children}</blockquote>,
              table: ({ children }) => <div className="my-6 overflow-x-auto"><table className="min-w-full border-collapse border border-slate-200 dark:border-white/10 text-sm">{children}</table></div>,
              th: ({ children }) => <th className="border border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-white/[0.06] p-3 text-left font-bold text-slate-900 dark:text-white">{children}</th>,
              td: ({ children }) => <td className="border border-slate-200 dark:border-white/10 p-3 text-slate-700 dark:text-slate-300">{children}</td>,
              hr: () => <hr className="my-8 border-slate-200 dark:border-white/10" />,
              pre: ({ children }) => <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono my-4">{children}</pre>,
              code: ({ children }) => <code className="bg-slate-100 dark:bg-white/10 text-fuchsia-600 dark:text-fuchsia-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
              a: ({ href, children }) => <a href={href} className="text-fuchsia-600 dark:text-fuchsia-400 underline underline-offset-2 hover:text-fuchsia-500">{children}</a>,
              strong: ({ children }) => <strong className="font-bold text-slate-950 dark:text-white">{children}</strong>,
            }}
          >
            {document.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
