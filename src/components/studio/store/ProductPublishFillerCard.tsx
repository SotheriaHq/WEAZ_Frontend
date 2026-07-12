import React from 'react';
import {
  getCompactPublishTaskStatusLabel,
  getPublishTaskRuntimePreview,
  type PublishTask,
} from '@/utils/publishTracker';

/**
 * Live status card shown in the store products grid while a just-submitted
 * product is being created/uploaded/published by the module-level
 * `productPublishJob` (parity with the design catalog's publish filler). On
 * failure it flips to a retry/remove state.
 */
export const ProductPublishFillerCard: React.FC<{
  task: PublishTask;
  onRetry: (task: PublishTask) => void;
  onRemove: (task: PublishTask) => void;
}> = ({ task, onRetry, onRemove }) => {
  const failed = task.status === 'failed';
  const preview = task.coverPreviewUrl || getPublishTaskRuntimePreview(task.id);
  const progress = Math.max(0, Math.min(100, Math.round(task.progress)));
  const isDraft = task.kind === 'draft';
  const label = getCompactPublishTaskStatusLabel({
    status: failed
      ? 'failed'
      : task.status === 'finalizing'
        ? 'finalizing'
        : task.status === 'published'
          ? 'published'
          : 'uploading',
    kind: task.kind,
    progress,
  });

  return (
    <div className="group relative aspect-[5/6] overflow-hidden rounded-xl border border-black/5 shadow-sm dark:border-white/10">
      {preview ? (
        <img
          src={preview}
          alt={task.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-100 dark:bg-white/5" />
      )}

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 px-4 text-center text-white backdrop-blur-sm">
        {failed ? (
          <>
            <span className="text-lg" aria-hidden="true">
              ⚠️
            </span>
            <div className="text-xs font-semibold">Upload didn’t finish</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onRetry(task)}
                className="rounded-lg border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/25"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => onRemove(task)}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold transition hover:bg-white/15"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <div className="w-32 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[color:var(--brand-primary,#a855f7)] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(6, progress)}%` }}
              />
            </div>
            <div className="text-center text-xs font-semibold tracking-wide">
              {label}
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/40 p-1.5 backdrop-blur-xl">
        <h3 className="line-clamp-1 text-xs font-semibold text-white drop-shadow-sm">
          {task.title}
        </h3>
        <p className="text-[10px] text-white/60">
          {isDraft ? 'Saving draft' : 'In review'}
        </p>
      </div>
    </div>
  );
};

export default ProductPublishFillerCard;
