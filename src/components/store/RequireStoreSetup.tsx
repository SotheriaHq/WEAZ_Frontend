import React, { useEffect, useMemo, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useStoreStatusQuery } from '@/query/queries';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import type { RootState } from '@/store';
import {
  clearStoreOpenPending,
  isBrandProfileComplete,
  resolveBrandProfileSetupDestination,
  resolveStoreSetupDestination,
} from '@/utils/storeSetup';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { getActiveBrandId, hasActiveBrandMembership, isBrandAccount } from '@/lib/brandAccess';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

/**
 * `/store/status` has always returned `profileMissingFields` — the server
 * computes exactly which of the three checks failed — and no client has ever
 * read it. Both the web card and the native toast said only that setup was
 * required, so someone who believed they had filled the form in had no way to
 * find out which field the server disagreed about, or that it disagreed at all.
 *
 * The server's vocabulary is 'description' | 'tags' | 'location'; these say the
 * same thing in the terms the form uses, including the 20-character minimum,
 * which is the one rule a filled-in-looking description can still fail.
 */
const PROFILE_FIELD_LABELS: Record<string, string> = {
  description: 'a description of at least 20 characters',
  tags: 'at least one tag',
  location: 'a country or state',
};

export const describeMissingProfileFields = (
  fields?: string[] | null,
): string | null => {
  const labels = (fields ?? [])
    .map((field) => PROFILE_FIELD_LABELS[field] ?? field)
    .filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

/** Keep mutation callers on the same cache used by every Studio screen. */
export function invalidateRequireStoreSetupCache(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.store.status() });
}

const RequireStoreSetup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';
  const statusQuery = useStoreStatusQuery({ enabled: isBrandAccount(user) });
  const status = statusQuery.data ?? null;
  const loading = statusQuery.isPending;
  const hadError = statusQuery.isError;

  const isSetupRoute = useMemo(() => {
    return (
      location.pathname.startsWith('/studio/store/essentials') ||
      location.pathname.startsWith('/studio/store/setup')
    );
  }, [location.pathname]);

  const verificationPromptDestination = useMemo(() => {
    const params = new URLSearchParams();
    params.set('verifyEmailPrompt', 'store-setup');
    return `/profile?${params.toString()}`;
  }, []);

  const brandProfileSetupDestination = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    return resolveBrandProfileSetupDestination(nextPath);
  }, [location.pathname, location.search]);

  const effectiveEmailVerified =
    status?.isEmailVerified ?? user?.isEmailVerified ?? true;
  const effectiveProfileComplete =
    status?.isProfileComplete ?? isBrandProfileComplete(user);
  const hasBrandAccess = hasActiveBrandMembership(user);
  const requiresEmailVerification =
    hasBrandAccess && effectiveEmailVerified === false;
  const requiresProfileCompletion =
    hasBrandAccess && effectiveProfileComplete === false;
  const missingProfileFieldsLabel = describeMissingProfileFields(
    status?.profileMissingFields,
  );

  const notifiedGate = useRef<string | null>(null);
  const workspaceId = getActiveBrandId(user);
  useEffect(() => {
    if (!isEmbeddedMobile || (!isSetupRoute && !status)) return;
    const reason = requiresEmailVerification ? 'email-verification'
      : requiresProfileCompletion ? 'brand-profile' : null;
    if (!reason) { notifiedGate.current = null; return; }
    const path = reason === 'email-verification' ? verificationPromptDestination : brandProfileSetupDestination;
    const signature = JSON.stringify([user?.id, workspaceId, reason, path, status?.profileMissingFields]);
    if (notifiedGate.current === signature) return;
    notifiedGate.current = signature;
    postStudioNativeEvent({ type: 'PROFILE_SETUP_REQUIRED', reason, path,
      ...(reason === 'brand-profile' && status?.profileMissingFields ? { missingFields: status.profileMissingFields } : {}) });
  }, [isEmbeddedMobile, isSetupRoute, status, requiresEmailVerification, requiresProfileCompletion,
    verificationPromptDestination, brandProfileSetupDestination, user?.id, workspaceId]);

  if (!isSetupRoute && !status) {
    if (loading && !hadError) return <div role="status" className="p-6">Checking store setup…</div>;
    return <div role="alert" className="space-y-4 p-6">
      <p>We could not check your store setup. Your work has been preserved.</p>
      <button type="button" onClick={() => { void statusQuery.refetch(); }}
        className="rounded-xl bg-primary px-4 py-3 text-white">Retry setup check</button>
    </div>;
  }

  if (requiresEmailVerification) {
    if (isEmbeddedMobile) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm p-5 text-center">
            <div className="text-base font-semibold">Email verification required</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Return to the app to complete verification before opening Studio.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to={verificationPromptDestination} replace />;
  }

  if (requiresProfileCompletion) {
    if (isEmbeddedMobile) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm p-5 text-center">
            <div className="text-base font-semibold">Finish your brand profile</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {missingProfileFieldsLabel
                ? `Studio opens once your profile has ${missingProfileFieldsLabel}.`
                : 'Studio opens once your brand profile is complete.'}
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to={brandProfileSetupDestination} replace />;
  }

  if (isSetupRoute) {
    return <>{children}</>;
  }


  // Business Hours hard gate, for ALREADY-PUBLISHED stores only.
  //
  // Hours are part of `isSetupComplete` now, so an unpublished brand missing
  // them is handled below by the normal setup redirect — the wizard collects
  // hours as a step. A brand that published BEFORE hours were required has no
  // such path: sending it to the wizard would bounce off `ShopSetupWizardPage`,
  // which redirects any open store back to `/studio/store`, and this guard would
  // send it to the wizard again — an infinite loop. Route those brands straight
  // at the hours settings instead, which lives outside this guard.
  //
  // Gated on `isPublished` for the other direction too: a brand that has not
  // started setup must land in the wizard, not in a working-hours form for a
  // store that does not exist yet. Only acts on a cleanly loaded status so a
  // failed request never gates anyone.
  if (
    status &&
    status.isPublished === true &&
    status.workingHoursRequired === true &&
    status.businessHoursConfigured === false
  ) {
    return <Navigate to="/settings?tab=store-hours" replace />;
  }

  // Setup complete → allow Studio regardless of open/paused, so a paused store is
  // never redirected back into the setup flow. Clear pending only once truly open.
  if (status?.isSetupComplete === true) {
    if (status.isStoreOpen) clearStoreOpenPending(user?.id);
    return <>{children}</>;
  }


  const destination = resolveStoreSetupDestination(user?.id);
  if (isEmbeddedMobile) {
    const params = new URLSearchParams(location.search);
    const embeddedTheme = params.get('theme');
    const embeddedDestinationParams = new URLSearchParams();
    embeddedDestinationParams.set('surface', 'mobile-app');
    if (embeddedTheme === 'light' || embeddedTheme === 'dark') {
      embeddedDestinationParams.set('theme', embeddedTheme);
    }
    const embeddedDestination = `${destination}${destination.includes('?') ? '&' : '?'}${embeddedDestinationParams.toString()}`;
    return <Navigate to={embeddedDestination} replace />;
  }

  return <Navigate to={destination} replace />;
};

export default RequireStoreSetup;
