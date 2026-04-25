import React, { useCallback, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { MediaItem } from '../../types/media';
import createMediaItems from './createMediaItems';
import { FiUpload } from 'react-icons/fi';
import Button from '../Button';

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

interface FileUploaderProps {
  onFilesUpload: (files: File[]) => void;
  variant?: 'large' | 'small';
  accept?: string[];
  maxFiles?: number;
  maxSizeBytes?: number; // optional max size per file in bytes
  onError?: (errors: string[]) => void;
  className?: string;
  picker?: PickerShape;
  onMediaItems?: (items: MediaItem[]) => void;
  disabled?: boolean;
}

const mapAccepted = (file: File, accept?: string[]) => {
  if (!accept || accept.length === 0) return true;
  return accept.some(a => {
    if (a.includes('/')) return file.type.startsWith(a.split('/')[0]);
    return file.name.toLowerCase().endsWith(a.toLowerCase());
  });
};

type FileUploaderHandle = { open: () => void };

/**
 * FileUploader
 * A small, reusable uploader UI that supports drag-and-drop and an optional
 * external picker (returned from `useFilePicker`) so multiple uploader instances
 * can share a single hidden input and validation logic.
 *
 * Props:
 * - onFilesUpload(files): called with validated File[] when files are selected/dropped
 * - picker: optional external picker object (see useFilePicker)
 */
const baseContainerClasses =
  'rounded-lg border-2 border-dashed transition-colors duration-200 ease-out';
const variantPadding: Record<NonNullable<FileUploaderProps['variant']>, string> = {
  large: 'p-10 sm:p-12 lg:p-16',
  small: 'p-4 sm:p-5 lg:p-6',
};
const idleSurfaceClasses =
  'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const activeSurfaceClasses =
  'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/70 dark:bg-blue-500/10 dark:text-blue-100';
const disabledClasses = 'opacity-60 pointer-events-none select-none';

const FileUploader = forwardRef<FileUploaderHandle, FileUploaderProps>((
  {
    onFilesUpload,
    variant = 'large',
    accept,
    maxFiles,
    maxSizeBytes,
    onError,
    className = '',
    picker,
    onMediaItems,
    disabled = false,
  },
  ref,
) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const internalInputRef = inputRef;
  const [isDragActive, setIsDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (disabled || !files) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    const errs: string[] = [];

    // Validate each incoming file against the accepted patterns and size.
    for (const f of incoming) {
      if (!mapAccepted(f, accept)) {
        errs.push(`${f.name}: unsupported file type`);
        continue;
      }
      if (maxSizeBytes && f.size > maxSizeBytes) {
        const sizeMB = (maxSizeBytes / (1024 * 1024));
        errs.push(`${f.name}: exceeds maximum size of ${sizeMB % 1 === 0 ? sizeMB : sizeMB.toFixed(1)} MB`);
        continue;
      }
      accepted.push(f);
    }

    if (accepted.length === 0 && errs.length > 0) {
      setErrors(errs);
      onError?.(errs);
      return;
    }

    let sliced = accepted;
    if (maxFiles && accepted.length > maxFiles) sliced = accepted.slice(0, maxFiles);

    if (sliced.length > 0) {
      setErrors([]);
      onError?.([]);
      onFilesUpload(sliced);
      // Also produce MediaItem wrappers and call the optional handler so
      // callers can work with MediaItem objects (ids, types, previewUrl)
      try {
        const items = createMediaItems(sliced);
        // allow consumers to receive MediaItem[] for integration with stores
        // or context-managed flows.
        (onMediaItems as ((items: MediaItem[]) => void) | undefined)?.(items);
      } catch {
        // non-fatal: if createMediaItems fails, we still call onFilesUpload
      }
    } else if (errs.length > 0) {
      setErrors(errs);
      onError?.(errs);
    }
  // onFilesUpload and onMediaItems are expected to be stable callbacks from callers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept, maxFiles, maxSizeBytes, disabled]);

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    // User selected files via native dialog
    handleFiles(e.target.files);
    // Clear the native input value so the same file can be selected again later
    const ref = picker ? picker.inputRef : internalInputRef;
    if (ref && ref.current) ref.current.value = '';
  };

  // Programmatically open the file dialog. If a shared picker is provided,
  // delegate to it so a single input is reused across components.
  const openDialog = () => {
    if (disabled) return;
    if (picker) picker.open();
    else internalInputRef.current?.click();
  };

  // picker.open is expected to be stable. Avoid listing picker in deps to reduce re-creations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({ open: openDialog }), []);

  // Handle native drop events when not using an external picker
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const isActive = picker ? picker.isDragActive : isDragActive;
  const highlight = isActive && !disabled;
  const containerClasses = [
    baseContainerClasses,
    variantPadding[variant],
    highlight ? activeSurfaceClasses : idleSurfaceClasses,
    disabled ? disabledClasses : '',
    className,
  ].join(' ').trim();

  return (
    <div
      className={containerClasses}
      {...(picker ? {
        onDragOver: picker.handlers.onDragOver,
        onDragLeave: picker.handlers.onDragLeave,
        onDrop: picker.handlers.onDrop,
      } : {
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true); },
        onDragLeave: () => setIsDragActive(false),
        onDrop: onDrop,
      })}
    >
      <input ref={picker ? picker.inputRef : internalInputRef} type="file" multiple onChange={picker ? picker.handlers.onInputChange : onInputChange} className="hidden" accept={accept?.join(',')} disabled={disabled} />

      <div className="flex flex-col items-center justify-center text-center text-gray-600 dark:text-gray-300">
        <FiUpload className="mb-4 h-10 w-10 text-gray-400 dark:text-gray-500" />
        <div className="font-semibold">Drag and drop or click to upload</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">{variant === 'large' ? 'Upload images or videos that represent your collection. You can add multiple items.' : 'Add more files to your collection.'}</div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => { openDialog(); }} disabled={disabled}>
            <FiUpload className="mr-2" /> Upload Files
          </Button>
        </div>
        {((picker ? picker.errors : errors) || []).length > 0 && (
          <div className="mt-3 text-sm text-red-600 text-left w-full max-w-lg">
            {(picker ? picker.errors : errors).map((err, i) => (
              <div key={i}>- {err}</div>
            ))}
          </div>
        )}
        {picker && picker.pendingCount > 0 && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{picker.pendingCount} file(s) ready</div>
        )}
      </div>
    </div>
  );
});

export default FileUploader;






