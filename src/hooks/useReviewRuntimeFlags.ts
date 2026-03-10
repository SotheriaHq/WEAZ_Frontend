import { useEffect, useState } from 'react';
import { reviewsApi, type ReviewRuntimeFlags } from '@/api/ReviewsApi';

export const DEFAULT_REVIEW_RUNTIME_FLAGS: ReviewRuntimeFlags = {
  readEnabled: false,
  writeEnabled: false,
  brandRepliesEnabled: false,
};

let cachedFlags: ReviewRuntimeFlags | null = null;
let pendingFlagsRequest: Promise<ReviewRuntimeFlags> | null = null;

const loadReviewRuntimeFlags = async (): Promise<ReviewRuntimeFlags> => {
  if (cachedFlags) {
    return cachedFlags;
  }

  if (!pendingFlagsRequest) {
    pendingFlagsRequest = reviewsApi
      .getRuntimeFlags()
      .then((flags) => {
        cachedFlags = flags;
        return flags;
      })
      .finally(() => {
        pendingFlagsRequest = null;
      });
  }

  return pendingFlagsRequest;
};

export const clearReviewRuntimeFlagsCache = () => {
  cachedFlags = null;
  pendingFlagsRequest = null;
};

export const useReviewRuntimeFlags = () => {
  const [flags, setFlags] = useState<ReviewRuntimeFlags | null>(cachedFlags);
  const [isLoading, setIsLoading] = useState(!cachedFlags);

  useEffect(() => {
    if (cachedFlags) {
      setFlags(cachedFlags);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    void loadReviewRuntimeFlags()
      .then((nextFlags) => {
        if (!active) {
          return;
        }
        setFlags(nextFlags);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setFlags(DEFAULT_REVIEW_RUNTIME_FLAGS);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    flags: flags ?? DEFAULT_REVIEW_RUNTIME_FLAGS,
    isLoading,
  };
};