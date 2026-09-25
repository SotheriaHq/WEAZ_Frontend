import React from 'react';
import MediaRenderer, { type MediaKind } from './MediaRenderer';
import { cn } from '@/lib/utils';
import { addClientDiagnostic } from '@/utils/clientDiagnostics';
import {
  isPreviewUnavailableDataUrl,
  isTrustedUpstreamImagePreview,
  probeImagePreviewUrl,
} from '@/utils/imagePreview';
import { uploadPreviewImage } from '@/api/UploadApi';
import {
  sniffImageFormat,
  isBrowserDisplayableSniff,
  isUnreadableSniff,
  type SniffedImageFormat,
} from '@/utils/imageByteSniff';

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

const canRequestServerPreview = (file?: File) => {
  if (!file) return false;
  if (file.type.trim().toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name);
};

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
  const [failureLabel, setFailureLabel] = React.useState<string>('');
  const [retryWithFullPipeline, setRetryWithFullPipeline] = React.useState(false);

  React.useEffect(() => {
    setRetryWithFullPipeline(false);
  }, [normalizedSrc, file?.name, file?.size, file?.lastModified]);

  React.useEffect(() => {
    if (kind !== 'image' || !file) {
      setObjectUrl('');
      return undefined;
    }

    if (isTrustedUpstreamImagePreview(normalizedSrc)) {
      setObjectUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, kind, normalizedSrc]);

  React.useEffect(() => {
    if (kind === 'video') {
      setResolvedSrc(normalizedSrc);
      setStatus(normalizedSrc ? 'ready' : 'loading');
      return;
    }

    let cancelled = false;
    let serverPreviewUrl = '';

    if (
      !retryWithFullPipeline &&
      normalizedSrc &&
      isTrustedUpstreamImagePreview(normalizedSrc)
    ) {
      setResolvedSrc(normalizedSrc);
      setFailureLabel('');
      setStatus('ready');
      addClientDiagnostic('info', diagnosticScope, 'Using trusted upstream preview', {
        candidateKind: normalizedSrc.startsWith('blob:') ? 'blob' : 'data',
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size,
      });
      return;
    }

    let candidates = Array.from(
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
    setFailureLabel('');
    setStatus(candidates.length > 0 || file ? 'loading' : 'failed');

    void (async () => {
      let sniffedFormat: SniffedImageFormat | undefined;
      if (file) {
        sniffedFormat = await sniffImageFormat(file);
        if (cancelled) return;
        addClientDiagnostic('info', diagnosticScope, 'Sniffed picked file bytes', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          sniffedFormat,
        });
        if (isUnreadableSniff(sniffedFormat)) {
          addClientDiagnostic('warn', diagnosticScope, 'Picked file bytes are unreadable', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            sniffedFormat,
          });
          setFailureLabel(
            "This photo couldn't be read from your gallery. Remove it, make sure it's downloaded to this device, then add it again.",
          );
          setStatus('failed');
          return;
        }

        if (!isBrowserDisplayableSniff(sniffedFormat)) {
          candidates = [];
        }
      }
      const fileDiag = {
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size,
        sniffedFormat,
      };
      for (const candidate of candidates) {
        try {
          addClientDiagnostic('info', diagnosticScope, 'Probing local preview candidate', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            ...fileDiag,
          });
          await probeImagePreviewUrl(candidate);
          if (cancelled) return;
          setResolvedSrc(candidate);
          setStatus('ready');
          addClientDiagnostic('info', diagnosticScope, 'Local preview candidate decoded', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            ...fileDiag,
          });
          return;
        } catch (error) {
          addClientDiagnostic('warn', diagnosticScope, 'Local preview candidate failed', {
            candidateKind: candidate.startsWith('blob:') ? 'blob' : candidate.startsWith('data:') ? 'data' : 'url',
            ...fileDiag,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (file && canRequestServerPreview(file)) {
        try {
          addClientDiagnostic('info', diagnosticScope, 'Requesting server preview fallback', fileDiag);
          serverPreviewUrl = await uploadPreviewImage(file);
          if (cancelled) {
            URL.revokeObjectURL(serverPreviewUrl);
            serverPreviewUrl = '';
            return;
          }
          await probeImagePreviewUrl(serverPreviewUrl);
          if (cancelled) {
            URL.revokeObjectURL(serverPreviewUrl);
            serverPreviewUrl = '';
            return;
          }
          setResolvedSrc(serverPreviewUrl);
          setStatus('ready');
          addClientDiagnostic('info', diagnosticScope, 'Server preview fallback decoded', fileDiag);
          return;
        } catch (error) {
          if (serverPreviewUrl) {
            URL.revokeObjectURL(serverPreviewUrl);
            serverPreviewUrl = '';
          }
          addClientDiagnostic('warn', diagnosticScope, 'Server preview fallback failed', {
            ...fileDiag,
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
      if (serverPreviewUrl) {
        URL.revokeObjectURL(serverPreviewUrl);
      }
    };
  }, [diagnosticScope, file, kind, normalizedSrc, objectUrl, retryWithFullPipeline]);

  if (status !== 'ready' || !resolvedSrc) {
    return (
      <PreviewFallback
        className={className}
        maxHeightClassName={maxHeightClassName}
        maxWidthClassName={maxWidthClassName}
        label={status === 'loading' ? loadingLabel : failureLabel || unavailableLabel}
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
        if (
          !retryWithFullPipeline &&
          normalizedSrc &&
          isTrustedUpstreamImagePreview(normalizedSrc)
        ) {
          addClientDiagnostic(
            'warn',
            diagnosticScope,
            'Trusted upstream preview failed during render; retrying full pipeline',
            {
              fileName: file?.name,
              fileType: file?.type,
              fileSize: file?.size,
            },
          );
          setRetryWithFullPipeline(true);
          setStatus('loading');
          setResolvedSrc('');
          return;
        }
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