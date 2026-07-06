import React from 'react';
import MediaRenderer, { type MediaKind } from './MediaRenderer';
import { cn } from '@/lib/utils';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';
import { isPreviewUnavailableDataUrl } from '@/utils/imagePreview';

type LocalMediaPreviewProps = {
  kind: MediaKind;
  src?: string | null;
  file?: File;
  alt?: string;
  className?: string;
  mediaClassName?: string;
  maxHeightClassName?: string;
  maxWidthClassName?: string;
  allowScroll?: boolean;
  controls?: boolean;
  muted?: boolean;
  loadingLabel?: string;
  unavailableLabel?: string;
  diagnosticScope?: string;
};

const PROBE_TIMEOUT_MS = 5_000;

const probeImage = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Image probe timed out'));
    }, PROBE_TIMEOUT_MS);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback();
    };

    image.onload = () => {
      finish(() => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          resolve();
        } else {
          reject(new Error('Image decoded with empty dimensions'));
        }
      });
    };
    image.onerror = () => {
      finish(() => reject(new Error('Image probe failed')));
    };
    image.src = src;
  });

const PreviewFallback: React.FC<{
  className?: string;
  maxHeightClassName?: string;
  maxWidthClassName?: string;
  label: string;
  loading?: boolean;
}> = ({ className, maxHeightClassName, maxWidthClassName, label, loading }) => (
  <div className={className}>
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 text-center text-sm font-medium text-theme-secondary',
        'min-h-[6rem] bg-gray-100 dark:bg-white/5',
        maxHeightClassName,
        maxWidthClassName,
      )}
      role="img"
      aria-label={label}
    >
      {loading && (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      )}
      <span className="px-4">{label}</span>
    </div>
  </div>
);

const LocalMediaPreview: React.FC<LocalMediaPreviewProps> = ({
  kind,
  src,
  file,
  alt,
  className,
  mediaClassName,
  maxHeightClassName = 'max-h-[70vh]',
  maxWidthClassName = 'max-w-full',
  allowScroll,
  controls,
  muted,
  loadingLabel = 'Preparing preview...',
  unavailableLabel = 'Preview unavailable on this device',
  diagnosticScope = 'local-preview',
}) => {
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const [objectUrl, setObjectUrl] = React.useState<string>('');
  const [resolvedSrc, setResolvedSrc] = React.useState<string>('');
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'failed'>(
    kind === 'video' && normalizedSrc ? 'ready' : 'loading',
  );

  React.useEffect(() => {
    if (kind !== 'image' || !file) {
      setObjectUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, kind]);

  React.useEffect(() => {
    if (kind === 'video') {
      setResolvedSrc(normalizedSrc);
      setStatus(normalizedSrc ? 'ready' : 'loading');
      return;
    }

    let cancelled = false;
    const candidates = Array.from(
      new Set(
        [normalizedSrc, objectUrl].filter(
          (value) =>
            value &&
            !isPreviewUnavailableDataUrl(value) &&
            !value.startsWith('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wB'),
        ),
      ),
    );

    setResolvedSrc('');
    setStatus(candidates.length > 0 ? 'loading' : 'failed');

    void (async () => {
      for (const candidate of candidates) {
        try {
          addClientDiagnostic('info', diagnosticScope, 'Probing local preview candidate', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            fileName: file?.name,
            fileType: file?.type,
            fileSize: file?.size,
          });
          await probeImage(candidate);
          if (cancelled) return;
          setResolvedSrc(candidate);
          setStatus('ready');
          addClientDiagnostic('info', diagnosticScope, 'Local preview candidate decoded', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            fileName: file?.name,
            fileType: file?.type,
            fileSize: file?.size,
          });
          return;
        } catch (error) {
          addClientDiagnostic('warn', diagnosticScope, 'Local preview candidate failed', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            fileName: file?.name,
            fileType: file?.type,
            fileSize: file?.size,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (!cancelled) {
        setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [diagnosticScope, file, kind, normalizedSrc, objectUrl]);

  if (status !== 'ready' || !resolvedSrc) {
    return (
      <PreviewFallback
        className={className}
        maxHeightClassName={maxHeightClassName}
        maxWidthClassName={maxWidthClassName}
        label={status === 'loading' ? loadingLabel : unavailableLabel}
        loading={status === 'loading'}
      />
    );
  }

  return (
    <MediaRenderer
      kind={kind}
      src={resolvedSrc}
      alt={alt}
      className={className}
      mediaClassName={mediaClassName}
      maxHeightClassName={maxHeightClassName}
      maxWidthClassName={maxWidthClassName}
      allowScroll={allowScroll}
      controls={controls}
      muted={muted}
      onError={() => {
        setStatus('failed');
        addClientDiagnostic('warn', diagnosticScope, 'Verified local preview failed during render', {
          fileName: file?.name,
          fileType: file?.type,
          fileSize: file?.size,
        });
      }}
    />
  );
};

export default LocalMediaPreview;
