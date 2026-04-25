import React from 'react';
import { motion } from 'framer-motion';

interface PickerShape {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragActive: boolean;
  setIsDragActive: (v: boolean) => void;
  errors: string[];
  pendingCount: number;
  handlers: {
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
  };
  open: () => void;
}

interface MediaUploadZoneProps {
  onFilesUpload: (files: File[]) => void;
  picker: PickerShape;
  disabled?: boolean;
  maxFiles?: number;
}

const MediaUploadZone: React.FC<MediaUploadZoneProps> = ({
  picker,
  disabled = false,
  maxFiles = 20,
}) => {
  const { isDragActive, handlers, inputRef } = picker;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      <div
        className={[
          'relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden group',
          isDragActive
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 scale-[1.01] shadow-xl shadow-purple-500/15'
            : 'border-gray-300 dark:border-white/15 bg-white dark:bg-white/[0.03] hover:border-purple-400/70 hover:bg-purple-50/60 dark:hover:bg-purple-500/5 hover:shadow-lg hover:shadow-purple-500/10',
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
        onDrop={disabled ? undefined : handlers.onDrop}
        onDragOver={disabled ? undefined : handlers.onDragOver}
        onDragLeave={disabled ? undefined : handlers.onDragLeave}
        onClick={() => { if (!disabled) picker.open(); }}
      >
        {/* Subtle gradient overlay — only on drag */}
        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
        )}

        <div className="relative py-14 px-8 text-center flex flex-col items-center justify-center min-h-[340px]">
          {/* Upload icon */}
          <motion.div
            animate={isDragActive ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={[
              'mb-6 w-20 h-20 rounded-2xl flex items-center justify-center border transition-colors duration-300',
              isDragActive
                ? 'bg-purple-100 dark:bg-purple-500/20 border-purple-300 dark:border-purple-500/40'
                : 'bg-gray-100 dark:bg-white/8 border-gray-200 dark:border-white/10 group-hover:bg-purple-50 dark:group-hover:bg-purple-500/10 group-hover:border-purple-200 dark:group-hover:border-purple-500/30',
            ].join(' ')}
          >
            <span className="text-3xl" aria-hidden="true">
              {isDragActive ? '⬇️' : '🖼️'}
            </span>
          </motion.div>

          {/* Heading */}
          <h3 className={[
            'text-xl font-bold mb-2 tracking-tight transition-colors duration-200',
            isDragActive
              ? 'text-purple-700 dark:text-purple-300'
              : 'text-gray-900 dark:text-white',
          ].join(' ')}>
            {isDragActive ? 'Release to add files' : 'Drag & drop your images here'}
          </h3>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
            or{' '}
            <span className="font-semibold text-purple-600 dark:text-purple-400 underline underline-offset-2">
              browse from your device
            </span>
          </p>

          {/* Format badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {[
              { label: 'JPG / PNG / WEBP', emoji: '🖼️' },
              { label: 'MP4 / MOV', emoji: '🎬' },
            ].map(({ label, emoji }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                <span>{emoji}</span>
                {label}
              </span>
            ))}
          </div>

          {/* Slot requirements */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Up to {maxFiles} files &nbsp;·&nbsp; Minimum 4 required to publish
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            Front, Left Side, Right Side, Back Side
          </p>

          {/* Mobile action buttons */}
          <div className="flex items-center justify-center gap-2 mt-6 sm:hidden">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              onClick={(e) => { e.stopPropagation(); picker.open(); }}
              disabled={disabled}
            >
              🖼️ Gallery
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm font-medium hover:border-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              onClick={(e) => { e.stopPropagation(); }}
              disabled={disabled}
            >
              📷 Camera
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handlers.onInputChange}
          className="hidden"
          accept="image/*,video/*"
          disabled={disabled}
        />
      </div>

      {/* Error messages */}
      {picker.errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 space-y-1"
        >
          {picker.errors.map((err, i) => (
            <p key={i} className="text-sm text-red-500 dark:text-red-400">
              {err}
            </p>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

export default MediaUploadZone;
