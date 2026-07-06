import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CLIENT_DIAGNOSTICS_EVENT,
  addClientDiagnostic,
  clearClientDiagnostics,
  enableClientDiagnostics,
  formatClientDiagnostics,
  getClientDiagnostics,
} from '@/utils/clientDiagnostics';

const DiagnosticsPage: React.FC = () => {
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const entries = useMemo(() => getClientDiagnostics(), [revision]);
  const text = useMemo(() => formatClientDiagnostics(), [revision]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    enableClientDiagnostics();
    addClientDiagnostic('info', 'diagnostics', 'Diagnostics page opened', {
      href: window.location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
    refresh();

    const onUpdate = () => refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 1000);

    window.addEventListener(CLIENT_DIAGNOSTICS_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(CLIENT_DIAGNOSTICS_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const handleEnable = () => {
    enableClientDiagnostics();
    addClientDiagnostic('info', 'diagnostics', 'Diagnostics enabled from page', {
      href: window.location.href,
    });
    refresh();
  };

  const handleCopy = async () => {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: 'WIEZ diagnostics',
        text,
      });
    } catch {
      // Share cancellation is not an error for this page.
    }
  };

  const handleClear = () => {
    clearClientDiagnostics();
    setCopied(false);
    refresh();
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-gray-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
            Diagnostics
          </p>
          <h1 className="text-2xl font-bold">Frontend logs</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Open this page on the same phone before reproducing a mobile browser issue.
            It enables logging for this browser and refreshes automatically.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-white/20"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-white/20"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-white/20"
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:border-red-500/40"
          >
            Clear
          </button>
        </div>

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Entries</h2>
            <span className="text-xs text-gray-500">{entries.length}</span>
          </div>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs leading-5 text-gray-800 dark:bg-black dark:text-gray-100">
            {text}
          </pre>
        </section>
      </div>
    </main>
  );
};

export default DiagnosticsPage;
