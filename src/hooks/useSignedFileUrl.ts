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
          setUrl(initial ?? null);
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
