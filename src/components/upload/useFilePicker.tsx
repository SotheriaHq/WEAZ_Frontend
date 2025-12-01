import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

export type UseFilePickerOptions = {
  accept?: string[];
  maxSizeBytes?: number;
  maxFiles?: number;
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
};

/**
 * useFilePicker - lightweight centralized file picker + drag handlers
 */
export const useFilePicker = ({
  accept,
  maxSizeBytes,
  maxFiles,
  onFiles,
  disabled = false,
}: UseFilePickerOptions = {}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // accept checker
  const mapAccepted = useCallback((file: File, localAccept?: string[]) => {
    const list = localAccept ?? accept;
    if (!list || list.length === 0) return true;
    return list.some(a => {
      if (a.includes('/')) return file.type.startsWith(a.split('/')[0]);
      return file.name.toLowerCase().endsWith(a.toLowerCase());
    });
  }, [accept]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (disabled || !files) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    const errs: string[] = [];

    for (const f of incoming) {
      if (!mapAccepted(f, accept)) {
        errs.push(`${f.name}: unsupported file type`);
        continue;
      }
      if (maxSizeBytes && f.size > maxSizeBytes) {
        errs.push(`${f.name}: exceeds maximum size of ${Math.round(maxSizeBytes / 1024)} KB`);
        continue;
      }
      accepted.push(f);
    }

    let limited = accepted;
    if (typeof maxFiles === 'number' && maxFiles > 0 && accepted.length > maxFiles) {
      limited = accepted.slice(0, maxFiles);
      errs.push(`Only the first ${maxFiles} file(s) were added. Additional files were ignored.`);
    }

    setPendingCount(limited.length);

    if (limited.length > 0) {
      setErrors([]);
      onFiles?.(limited);
    }

    if (errs.length > 0) {
      setErrors(errs);
      toast.error(errs.join('\n'));
    }
  }, [accept, maxSizeBytes, onFiles, mapAccepted, disabled, maxFiles]);

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (disabled) return;
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const open = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return {
    inputRef,
    isDragActive,
    setIsDragActive,
    errors,
    pendingCount,
    handlers: {
      onInputChange,
      onDrop,
      onDragOver: (e: React.DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragActive(true);
      },
      onDragLeave: () => {
        if (disabled) return;
        setIsDragActive(false);
      },
    },
    open,
    disabled,
  } as const;
};

export default useFilePicker;
