import React from 'react';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

export interface MissingFieldItem {
  label: string;
  step?: number;
  onClick?: () => void;
}

export interface ValidationActionNoticeProps {
  title?: string;
  description?: string;
  missingFields?: Array<MissingFieldItem | string>;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export const ValidationActionNotice: React.FC<ValidationActionNoticeProps> = ({
  title = 'Action Required Before Publishing',
  description = 'Complete the required setup below to publish your item:',
  missingFields = [],
  primaryAction,
  onDismiss,
  className = '',
}) => {
  if (missingFields.length === 0 && !description) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`wiez-notice-card p-4 sm:p-5 relative overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {title}
            </h4>
            {description && (
              <p className="mt-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {description}
              </p>
            )}

            {missingFields.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {missingFields.map((item, idx) => {
                  const label = typeof item === 'string' ? item : item.label;
                  const onClick = typeof item === 'string' ? undefined : item.onClick;

                  return (
                    <button
                      key={`${label}-${idx}`}
                      type="button"
                      disabled={!onClick}
                      onClick={onClick}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        onClick
                          ? 'bg-white/90 text-purple-700 shadow-[0_2px_8px_rgba(168,85,247,0.12),inset_0_1px_0_rgba(255,255,255,1)] hover:scale-105 active:scale-95 hover:bg-white dark:bg-purple-900/40 dark:text-purple-200 cursor-pointer'
                          : 'bg-white/60 text-gray-700 dark:bg-white/10 dark:text-gray-300 cursor-default'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{label}</span>
                      {onClick && <ArrowRight className="h-3 w-3 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            )}

            {primaryAction && (
              <div className="mt-3.5 pt-1">
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all hover:scale-105 active:scale-95"
                >
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ValidationActionNotice;
