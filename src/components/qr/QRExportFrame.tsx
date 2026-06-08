import React from 'react';

interface QRExportFrameProps {
  title: string;
  subtitle?: string;
  note?: string | null;
  children: React.ReactNode;
}

export const QRExportFrame: React.FC<QRExportFrameProps> = ({
  title,
  subtitle,
  note,
  children,
}) => {
  return (
    <div className="rounded-[1.75rem] border border-gray-200/80 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/50 p-4 shadow-sm dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-purple-950/20">
      <div className="mb-3 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          WEAZ QR
        </p>
        <h4 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="grid place-items-center rounded-[1.5rem] bg-white p-4 shadow-inner">
        {children}
      </div>
      {note ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{note}</p>
      ) : null}
    </div>
  );
};

export default QRExportFrame;
