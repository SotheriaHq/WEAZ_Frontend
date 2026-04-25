import { brandApi } from '@/api/BrandApi';

export interface QrLogoSource {
  url?: string | null;
  fileId?: string | null;
}

export interface ResolvedQrLogo {
  url: string | null;
  status: 'ready' | 'skipped' | 'failed';
  message?: string;
}

const exportSafeCache = new Map<string, string>();

const isSameOriginUrl = (value: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
};

const isExportSafeWithoutFetch = (value: string): boolean => {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('/') ||
    isSameOriginUrl(value)
  );
};

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const fetchAsDataUrl = async (url: string): Promise<string> => {
  const cached = exportSafeCache.get(url);
  if (cached) {
    return cached;
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    mode: 'cors',
  });
  if (!response.ok) {
    throw new Error(`Unable to load logo (${response.status})`);
  }

  const blob = await response.blob();
  const dataUrl = await readBlobAsDataUrl(blob);
  exportSafeCache.set(url, dataUrl);
  return dataUrl;
};

const resolveCandidateUrl = async (source: QrLogoSource): Promise<string | null> => {
  const initialUrl = source.url?.trim() || null;

  if (source.fileId) {
    const signed = await brandApi.getSignedFileUrl(source.fileId);
    return signed ?? initialUrl;
  }

  if (initialUrl && initialUrl.includes('.s3.') && !initialUrl.includes('?')) {
    const signed = await brandApi.getSignedS3Url(initialUrl);
    return signed ?? initialUrl;
  }

  return initialUrl;
};

export const resolveQrLogo = async (
  source?: QrLogoSource | null,
): Promise<ResolvedQrLogo> => {
  if (!source) {
    return { url: null, status: 'skipped' };
  }

  const candidate = await resolveCandidateUrl(source);
  if (!candidate) {
    return { url: null, status: 'skipped' };
  }

  if (isExportSafeWithoutFetch(candidate)) {
    return { url: candidate, status: 'ready' };
  }

  try {
    return {
      url: await fetchAsDataUrl(candidate),
      status: 'ready',
    };
  } catch {
    return {
      url: null,
      status: 'failed',
      message: 'Logo preview was skipped to keep this QR export-safe.',
    };
  }
};
