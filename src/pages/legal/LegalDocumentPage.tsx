import { useMemo } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { LEGAL_PAGE_BY_SLUG } from './legalDocuments';

/**
 * One legal document, set as a document.
 *
 * ## What was wrong
 *
 * Two things, and only one of them was styling.
 *
 * 1. **No GFM plugin.** `react-markdown` parses CommonMark, which has no
 *    tables. The `table`/`th`/`td` overrides below existed and had never once
 *    been reached: every pipe table in these documents rendered as a paragraph
 *    of `|` characters. That is why the source had taken to DRAWING its tables
 *    with box characters inside fenced blocks — and a fenced block is a code
 *    block, so the renderer did the only thing it could and gave a schedule of
 *    retention periods a black terminal panel in a monospace face. The tables
 *    are real tables now (see `docs/legal/user-facing/`) and `remarkGfm` is
 *    what makes them parse.
 *
 * 2. **Nothing to navigate with.** The privacy policy is thirty thousand
 *    characters and cites its own clauses — "as per §11.1" — with no way to
 *    reach one. The contents rail is the fix, and it is built from the H2s the
 *    document already has rather than a second list that can drift.
 *
 * ## The rules the styling follows
 *
 * Rules, not boxes. A cell grid draws three lines to separate two rows; one
 * hairline does it, and the columns then line up down the page because nothing
 * else is competing for the eye. Same reason the contents rail is a list with
 * an active mark rather than a panel of buttons.
 *
 * Nothing here observes the scroll. A reading position that re-renders the page
 * as it passes each heading is how a long document starts to shudder under the
 * finger; anchors do the whole job with no listener at all.
 */

/** The body measure. Legal prose is read in long runs, not scanned. */
const MEASURE = 'max-w-[72ch]';

/** Hairline, at the one opacity every rule on this page uses. */
const RULE = 'border-black/[0.08] dark:border-white/[0.08]';

const toText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (typeof node === 'object' && 'props' in (node as never)) {
    return toText((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
};

/**
 * "## 11. Retention and Deletion Schedules" -> "11-retention-and-deletion-schedules".
 *
 * The section number is kept in the slug deliberately: these documents cite
 * each other by number, so a URL that carries it can be pasted into a dispute.
 */
const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type Section = { id: string; label: string };

/**
 * The H2s, in order. Read off the markdown rather than off the DOM, so the
 * rail is right on the first paint and never moves afterwards.
 */
const readSections = (markdown: string): Section[] => {
  const found: Section[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^##\s+(.*\S)\s*$/.exec(line);
    if (!match) continue;
    const label = match[1].replace(/[*`]/g, '');
    found.push({ id: slugify(label), label });
  }
  return found;
};

/** Anchored, and offset so a jump does not land under the app's header. */
const heading = (level: 2 | 3 | 4, className: string) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
    return (
      <Tag id={slugify(toText(children))} className={`scroll-mt-24 ${className}`}>
        {children}
      </Tag>
    );
  };

export default function LegalDocumentPage() {
  const location = useLocation();
  const slug = location.pathname.split('/').filter(Boolean)[0];
  const document = slug ? LEGAL_PAGE_BY_SLUG.get(slug) : null;

  const sections = useMemo(
    () => (document ? readSections(document.content) : []),
    [document],
  );

  const components = useMemo(
    () => ({
      h1: ({ children }: { children?: React.ReactNode }) => (
        // The document's own H1 repeats the title in the page header above it.
        <span className="sr-only">{children}</span>
      ),
      h2: heading(
        2,
        `mt-14 border-t ${RULE} pt-8 text-[1.375rem] font-bold leading-snug tracking-[-0.01em] text-[color:var(--text-primary)] first:mt-0 first:border-0 first:pt-0 sm:text-2xl`,
      ),
      h3: heading(
        3,
        'mt-8 text-base font-bold tracking-[-0.005em] text-[color:var(--text-primary)] sm:text-lg',
      ),
      h4: heading(
        4,
        'mt-6 text-[0.9375rem] font-semibold text-[color:var(--text-primary)]',
      ),
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mt-4 text-[0.9375rem] leading-[1.75] text-[color:var(--text-secondary)]">
          {children}
        </p>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="mt-4 space-y-2 pl-5 text-[0.9375rem] leading-[1.75] text-[color:var(--text-secondary)] [&>li]:list-disc [&>li]:marker:text-[color:var(--wiez-ring)]">
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="mt-4 space-y-2 pl-5 text-[0.9375rem] leading-[1.75] text-[color:var(--text-secondary)] [&>li]:list-decimal [&>li]:marker:font-semibold [&>li]:marker:text-[color:var(--wiez-ring)]">
          {children}
        </ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="pl-1.5 [&>ol]:mt-2 [&>ol]:mb-1 [&>ul]:mt-2 [&>ul]:mb-1">{children}</li>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="mt-5 rounded-r-xl border-l-2 border-[color:var(--wiez-ring)] bg-[color:var(--wiez-ring-soft)] py-1 pl-4 pr-4 text-[0.9375rem] leading-[1.75] text-[color:var(--text-secondary)]">
          {children}
        </blockquote>
      ),
      /*
        Rules between rows, and nothing else. A bordered cell grid puts a line
        on all four sides of every cell, so a six-row schedule draws about
        forty lines to convey five separations, and the content stops being the
        loudest thing in it.
      */
      table: ({ children }: { children?: React.ReactNode }) => (
        <div
          className={`mt-6 overflow-x-auto rounded-2xl border ${RULE} bg-[color:var(--surface-primary)]`}
        >
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className={`border-b ${RULE} bg-black/[0.02] dark:bg-white/[0.03]`}>
          {children}
        </thead>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="px-4 py-3 align-bottom text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-primary)]">
          {children}
        </th>
      ),
      tr: ({ children }: { children?: React.ReactNode }) => (
        <tr className={`border-b ${RULE} last:border-0`}>{children}</tr>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="px-4 py-3 align-top leading-relaxed text-[color:var(--text-secondary)]">
          {children}
        </td>
      ),
      hr: () => <hr className={`mt-10 border-t ${RULE}`} />,
      /*
        A quiet panel, never a terminal. Nothing in these documents is code —
        the last fenced blocks were tables and flow charts, and they are now a
        table and an ordered list — but a policy could one day quote a payload,
        and when it does it should look like a quotation.
      */
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre
          className={`mt-5 overflow-x-auto rounded-2xl border ${RULE} bg-black/[0.02] p-4 text-[0.8125rem] leading-relaxed text-[color:var(--text-secondary)] dark:bg-white/[0.03]`}
        >
          {children}
        </pre>
      ),
      code: ({ children }: { children?: React.ReactNode }) => (
        <code className="rounded-md bg-[color:var(--wiez-ring-soft)] px-1.5 py-0.5 text-[0.8125em] text-[color:var(--wiez-ring)]">
          {children}
        </code>
      ),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          className="font-medium text-[color:var(--wiez-ring)] underline decoration-[color:var(--wiez-ring)] decoration-1 underline-offset-[3px] transition hover:decoration-2"
        >
          {children}
        </a>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold text-[color:var(--text-primary)]">{children}</strong>
      ),
    }),
    [],
  );

  if (!document) {
    return <Navigate to="/legal" replace />;
  }

  const contents = (
    <ol className="space-y-1">
      {sections.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="group flex gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] leading-snug text-[color:var(--text-secondary)] transition hover:bg-black/[0.03] hover:text-[color:var(--wiez-ring)] dark:hover:bg-white/[0.04]"
          >
            <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-[color:var(--text-tertiary,var(--text-secondary))] opacity-60">
              {index + 1}
            </span>
            <span className="min-w-0">{section.label.replace(/^\d+\.\s*/, '')}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <main className="wiez-shell-bg min-h-screen px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/legal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--wiez-ring)]"
        >
          <span aria-hidden="true">👈</span> Legal center
        </Link>

        <header className={`mt-6 border-b ${RULE} pb-8`}>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[color:var(--wiez-ring)]">
            Version {document.version} · Effective {document.effectiveDate}
          </p>
          <h1 className="mt-3 text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[2.5rem]">
            {document.title}
          </h1>
          <p
            className={`mt-4 ${MEASURE} text-[0.9375rem] leading-[1.7] text-[color:var(--text-secondary)]`}
          >
            {document.summary}
          </p>
        </header>

        <div className="lg:flex lg:gap-12">
          {/*
            On a phone the contents collapse, because a 15-item index above a
            document is a wall the reader has to scroll past to reach the thing
            they opened. On a wide screen it is a rail and costs nothing.
          */}
          <nav aria-label="Sections" className="mt-6 lg:hidden">
            <details className={`rounded-2xl border ${RULE} px-4 py-3`}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-primary)]">
                Contents · {sections.length} sections
              </summary>
              <div className="mt-2">{contents}</div>
            </details>
          </nav>

          <nav
            aria-label="Sections"
            className="hidden lg:sticky lg:top-24 lg:order-2 lg:block lg:h-[calc(100vh-8rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:pt-10"
          >
            <p className="px-2 pb-2 text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[color:var(--text-secondary)] opacity-70">
              Contents
            </p>
            {contents}
          </nav>

          <article className={`mt-10 min-w-0 flex-1 ${MEASURE}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {document.content}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </main>
  );
}
