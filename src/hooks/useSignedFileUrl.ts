import { useEffect, useState } from 'react';
import { brandApi } from '@/api/BrandApi';

/**
 * Resolve a signed URL for a given fileId with an optional initial fallback URL.
 * Guarantees a stable url string or null, plus loading/error states.
 */
export function useSignedFileUrl(fileId?: string | null, initial?: string | null) {
  const [url, setUrl] = useState<string | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(Boolean(fileId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    // Optimization: If initial is already a signed URL (has query params) or non-S3, use it.
    if (initial && (initial.includes('?') || !initial.includes('s3'))) {
        setUrl(initial);
        setLoading(false);
        return;
    }

    // Handle unsigned S3 URLs (contain '.s3.' but no '?' query params) – sign via raw URL
    if (initial && initial.includes('.s3.') && !initial.includes('?')) {
      setLoading(true);
      (async () => {
        try {
          const signed = await brandApi.getSignedS3Url(initial);
          if (!cancelled) {
            setUrl(signed ?? initial);
          }
        } catch {
          if (!cancelled) setUrl(initial);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return;
    }

    if (!fileId) {
      // No fileId, just use initial and mark as not loading
      setUrl(initial ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const signed = await brandApi.getSignedFileUrl(fileId);
        if (!cancelled) {
          setUrl(signed ?? initial ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
          // Fallback: try raw S3 URL signing if initial looks like S3
          if (initial && initial.includes('s3')) {
            try {
              const s3Signed = await brandApi.getSignedS3Url(initial);
              if (!cancelled) setUrl(s3Signed ?? initial ?? null);
            } catch {
              if (!cancelled) setUrl(initial ?? null);
            }
          } else {
            setUrl(initial ?? null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, initial]);

  return { url, loading, error } as const;
}

export default useSignedFileUrl;
