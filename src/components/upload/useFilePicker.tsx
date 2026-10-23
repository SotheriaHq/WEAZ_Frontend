import { useRef, useState, useCallback, useEffect } from 'react';
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
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (resetTimer.current !== null) clearTimeout(resetTimer.current); };
  }, []);

  // accept checker
  const mapAccepted = useCallback((file: File, localAccept?: string[]) => {
    const list = localAccept ?? accept;
    if (!list || list.length === 0) return true;
    return list.some(a => {
      if (a.includes('/')) return a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a;
      return file.name.toLowerCase().endsWith(a.toLowerCase());
    });
  }, [accept]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (disabled || !files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const accepted: File[] = [];
    const errs: string[] = [];

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

    let limited = accepted;
    if (typeof maxFiles === 'number' && accepted.length > Math.max(0, maxFiles)) {
      limited = accepted.slice(0, Math.max(0, maxFiles));
      errs.push(maxFiles <= 0 ? 'Remove an existing file before adding another.' :
        `Only the first ${maxFiles} file(s) were added. Additional files were ignored.`);
    }

    setPendingCount(limited.length);

    if (limited.length > 0) {
      setErrors([]);
      try {
        onFiles?.(limited);
      } finally {
        if (resetTimer.current !== null) clearTimeout(resetTimer.current);
        if (mounted.current) resetTimer.current = setTimeout(() => {
          resetTimer.current = null;
          setPendingCount(0);
        }, 0);
      }
    } else {
      setPendingCount(0);
    }

    if (errs.length > 0) {
      setErrors(errs);
      toast.error(errs.join('\n'));
    }
  }, [accept, maxSizeBytes, onFiles, mapAccepted, disabled, maxFiles]);

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    try { handleFiles(e.target.files); }
    finally { e.target.value = ''; }
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
