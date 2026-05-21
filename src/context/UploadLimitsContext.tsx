import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { configApi, type UploadLimits } from '@/api/ConfigApi';
import { useUploadLimitsQuery } from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';

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

export const UploadLimitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const limitsQuery = useUploadLimitsQuery();
  const limits = limitsQuery.data ?? FALLBACK_LIMITS;

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
    <UploadLimitsContext.Provider
      value={{
        limits,
        getLimitMB,
        getLimitBytes,
        refresh: async () => {
          queryClient.removeQueries({ queryKey: queryKeys.config.uploadLimits(), exact: true });
          await queryClient.fetchQuery({
            queryKey: queryKeys.config.uploadLimits(),
            queryFn: () => configApi.getUploadLimits({ forceRefresh: true }),
          });
        },
      }}
    >
      {children}
    </UploadLimitsContext.Provider>
  );
};

export const useUploadLimits = () => useContext(UploadLimitsContext);
