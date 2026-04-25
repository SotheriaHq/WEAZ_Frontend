import React, { createContext, useContext, useEffect, useState } from 'react';
import { configApi, type UploadLimits } from '@/api/ConfigApi';

/** Hardcoded fallbacks matching the backend defaults (2 MB). */
const FALLBACK_LIMITS: UploadLimits = {
  'upload.maxSize.profileImage': 2 * 1024 * 1024,
  'upload.maxSize.bannerImage': 2 * 1024 * 1024,
  'upload.maxSize.postImage': 2 * 1024 * 1024,
  'upload.maxSize.postVideo': 100 * 1024 * 1024,
  'upload.maxSize.reviewImage': 2 * 1024 * 1024,
  'upload.maxSize.reviewVideo': 40 * 1024 * 1024,
  'upload.maxSize.document': 2 * 1024 * 1024,
  'upload.maxSize.brandVerification': 2 * 1024 * 1024,
  'upload.maxSize.messageImage': 2 * 1024 * 1024,
  'upload.maxSize.messageDocument': 2 * 1024 * 1024,
  'upload.maxSize.productMedia': 2 * 1024 * 1024,
  'upload.maxSize.collectionBulk': 2 * 1024 * 1024,
};

interface UploadLimitsContextValue {
  limits: UploadLimits;
  /** Get a human-readable MB string for a config key. */
  getLimitMB: (key: string) => string;
  /** Get raw bytes for a config key. */
  getLimitBytes: (key: string) => number;
  /** Force-refresh from server. */
  refresh: () => Promise<void>;
}

const UploadLimitsContext = createContext<UploadLimitsContextValue>({
  limits: FALLBACK_LIMITS,
  getLimitMB: () => '2',
  getLimitBytes: () => 2 * 1024 * 1024,
  refresh: async () => {},
});

const CACHE_KEY = 'threadly_upload_limits';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const UploadLimitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [limits, setLimits] = useState<UploadLimits>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._ts && Date.now() - parsed._ts < CACHE_TTL) {
          const { _ts, ...rest } = parsed;
          return rest as UploadLimits;
        }
      }
    } catch { /* ignore */ }
    return FALLBACK_LIMITS;
  });

  const fetchLimits = async () => {
    try {
      const data = await configApi.getUploadLimits();
      setLimits(data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }));
    } catch {
      // Use fallback/cached values
    }
  };

  useEffect(() => {
    void fetchLimits();
  }, []);

  const getLimitBytes = (key: string): number => {
    const val = limits[key];
    return typeof val === 'number' && val > 0 ? val : FALLBACK_LIMITS[key] ?? 2 * 1024 * 1024;
  };

  const getLimitMB = (key: string): string => {
    const bytes = getLimitBytes(key);
    const mb = bytes / (1024 * 1024);
    return mb % 1 === 0 ? String(mb) : mb.toFixed(1);
  };

  return (
    <UploadLimitsContext.Provider value={{ limits, getLimitMB, getLimitBytes, refresh: fetchLimits }}>
      {children}
    </UploadLimitsContext.Provider>
  );
};

export const useUploadLimits = () => useContext(UploadLimitsContext);
