import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import type { RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import type { BrandProfileDto } from '@/types/profile';

import EditProfileModal from '@/components/profile/EditProfileModal';

const BRAND_SETUP_DISMISS_KEY = 'threadly.brandProfileSetup.dismissedUntil';

function clearModalSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete('modal');
  next.delete('modalOrigin');
  return next;
}

export const GlobalModalRouter: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get('modal');
  const modalOrigin = searchParams.get('modalOrigin');

  const isBrandSetupOpen = modal === 'brand-setup';
  const showSkip = modalOrigin === 'prompt';

  const [brandProfile, setBrandProfile] = useState<BrandProfileDto | null>(null);

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

  const closeModal = useMemo(() => {
    return (opts?: { dismissPrompt?: boolean }) => {
      if (opts?.dismissPrompt && showSkip) {
        const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem(BRAND_SETUP_DISMISS_KEY, String(until));
      }
      setSearchParams((prev) => clearModalSearchParams(prev));
    };
  }, [setSearchParams, showSkip]);

  if (!modal) return null;

  if (modal === 'brand-setup') {
    if (!user || user.type !== 'BRAND') {
      // If the URL has a modal but we can't render it, clean up.
      setSearchParams((prev) => clearModalSearchParams(prev));
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
          localStorage.removeItem(BRAND_SETUP_DISMISS_KEY);
          closeModal();
        }}
      />
    );
  }

  // Unknown modal key: clean it up.
  setSearchParams((prev) => clearModalSearchParams(prev));
  return null;
};
