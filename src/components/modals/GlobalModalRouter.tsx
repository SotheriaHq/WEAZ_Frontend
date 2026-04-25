import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import type { RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import type { BrandProfileDto } from '@/types/profile';
import { invalidateStoreSetupStatusCache } from '@/hooks/useStoreSetupStatus';

import EditProfileModal from '@/components/profile/EditProfileModal';

const BRAND_SETUP_DISMISS_KEY = 'threadly.brandProfileSetup.dismissedUntil';

function clearModalSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete('modal');
  next.delete('modalOrigin');
  next.delete('next');
  return next;
}

function sanitizeNextPath(path: string): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;

  const [pathAndQuery, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = pathAndQuery.split('?', 2);
  const params = new URLSearchParams(query);
  params.delete('modal');
  params.delete('modalOrigin');
  params.delete('next');
  const nextQuery = params.toString();
  const nextHash = hash ? `#${hash}` : '';

  return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${nextHash}`;
}

export const GlobalModalRouter: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get('modal');
  const modalOrigin = searchParams.get('modalOrigin');
  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get('next')?.trim() ?? ''),
    [searchParams],
  );

  const isBrandSetupOpen = modal === 'brand-setup';
  const showSkip = modalOrigin === 'prompt';

  const [brandProfile, setBrandProfile] = useState<BrandProfileDto | null>(null);

  const clearCurrentModalParams = useCallback(() => {
    setSearchParams((prev) => clearModalSearchParams(prev), { replace: true });
  }, [setSearchParams]);

  // Lazily fetch brand profile when the brand setup modal opens.
  useEffect(() => {
    if (!isBrandSetupOpen) return;
    if (!user || user.type !== 'BRAND') return;

    let cancelled = false;
    brandApi
      .getBrandProfile(user.id)
      .then((profile) => {
        if (!cancelled) setBrandProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setBrandProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isBrandSetupOpen, user]);

  useEffect(() => {
    if (!isBrandSetupOpen) {
      setBrandProfile(null);
    }
  }, [isBrandSetupOpen]);

  useEffect(() => {
    if (!modal) return;
    if (modal === 'brand-setup' && user?.type === 'BRAND') return;
    clearCurrentModalParams();
  }, [clearCurrentModalParams, modal, user?.type]);

  const closeModal = useCallback((opts?: { dismissPrompt?: boolean }) => {
    if (opts?.dismissPrompt && showSkip) {
      const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(BRAND_SETUP_DISMISS_KEY, String(until));
    }
    clearCurrentModalParams();
  }, [clearCurrentModalParams, showSkip]);

  if (!modal) return null;

  if (modal === 'brand-setup') {
    if (!user || user.type !== 'BRAND') {
      return null;
    }

    return (
      <EditProfileModal
        isOpen={true}
        user={user}
        brandProfile={brandProfile}
        showSkip={showSkip}
        onSkip={() => closeModal({ dismissPrompt: true })}
        onClose={() => closeModal({ dismissPrompt: true })}
        onSaved={async (updatedUser) => {
          dispatch(setUser(updatedUser));
          invalidateStoreSetupStatusCache();
          localStorage.removeItem(BRAND_SETUP_DISMISS_KEY);
          closeModal();
          if (nextPath) {
            navigate(nextPath, { replace: true });
            return;
          }
        }}
      />
    );
  }

  // Unknown modal key cleanup is handled by effect above.
  return null;
};
