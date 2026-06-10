import React, { lazy, Suspense } from 'react';
import { isAxiosError } from 'axios';
import { Sidebar } from '../SideBar';
import { Navbar } from '../Navbar';
import ProfileHeaderSkeleton from '../profile/ProfileHeaderSkeleton';
import CollectionsSkeleton from '../profile/CollectionsSkeleton';
import { EndUserProfile } from '../../pages/profile/EndUserProfile';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/context/AuthContext';
import { closeSidebar, selectIsMobile, setSidebarMode } from '@/features/uiSlice';
import type { AppDispatch, RootState } from '@/store';
import {
  useLocation,
  Navigate,
  Outlet,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import { ISLAND_BOTTOM_NAV_CLEARANCE_CLASS } from '@/components/navigation/IslandBottomNav';
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import { setUser } from '@/features/userSlice';
import { unwrapApiResponse } from '@/types/auth';
import type { AuthProfileResponse, AuthUserDto } from '@/types/auth';
import { getPublicProfileUserType, usePublicUserProfileQuery } from '@/query/queries';
import { AuthApi } from '@/api/AuthApi';
import EmailVerificationBanner from '@/components/auth/EmailVerificationBanner';

const Profile = lazy(() => import('../../pages/catalog/Catalog'));
const PROFILE_MAIN_CLASS = `min-h-screen pt-16 transition-[margin] duration-300 ease-out ${ISLAND_BOTTOM_NAV_CLEARANCE_CLASS}`;

export const ProfileContentLoadingFallback: React.FC<{
  brandSetupPrompt?: boolean;
}> = ({ brandSetupPrompt = false }) => (
  <div className="p-4 sm:p-6" role="status" aria-live="polite">
    <div className="mx-auto max-w-screen-xl space-y-6">
      <div className="rounded-2xl border border-theme bg-[color:var(--surface-secondary)] p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-48 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded-full bg-gray-100 dark:bg-gray-900" />
          </div>
        </div>
        <p className="text-sm font-semibold text-theme">
          {brandSetupPrompt ? 'Preparing brand setup...' : 'Loading profile...'}
        </p>
        <p className="mt-1 text-xs text-theme-secondary">
          {brandSetupPrompt
            ? 'Your profile is loading. The setup form will open automatically.'
            : 'Your profile content is loading.'}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900/40" />
        </div>
        <div className="lg:col-span-9">
          <CollectionsSkeleton />
        </div>
      </div>
    </div>
  </div>
);

const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  if (isMobile) return 'HIDDEN' as const;
  const isProfileRoute = pathname === '/profile' || pathname.startsWith('/profile/');
  if (isProfileRoute && !pathname.startsWith('/profile/settings')) return 'RAIL' as const;
  if (pathname.startsWith('/settings') || pathname.startsWith('/profile/settings')) return 'HIDDEN' as const;
  if (pathname.startsWith('/studio')) return 'HIDDEN' as const;
  return 'RAIL' as const;
};

const maskEmailForPrompt = (email?: string | null): string => {
  const normalized = (email ?? '').trim();
  if (!normalized || !normalized.includes('@')) {
    return 'your inbox';
  }

  const [local, domain] = normalized.split('@');
  if (!domain) {
    return 'your inbox';
  }

  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const tld = domainParts.slice(1).join('.');

  const maskedLocal =
    local.length <= 2
      ? `${local.slice(0, 1)}*`
      : `${local.slice(0, 2)}***`;
  const maskedDomain =
    domainName.length <= 2
      ? `${domainName.slice(0, 1)}*`
      : `${domainName.slice(0, 2)}***`;

  return `${maskedLocal}@${maskedDomain}${tld ? `.${tld}` : ''}`;
};

export const ProfileLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const isMobile = useSelector(selectIsMobile);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeBrandId } = useParams<{ id?: string }>();

  const isVisitorRoute = Boolean(routeBrandId);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const visitorProfileQuery = usePublicUserProfileQuery(routeBrandId, {
    enabled: Boolean(isVisitorRoute && routeBrandId),
  });
  const visitorType = useMemo(
    () => getPublicProfileUserType(visitorProfileQuery.data),
    [visitorProfileQuery.data],
  );
  const visitorLoading = Boolean(
    isVisitorRoute &&
      !visitorProfileQuery.data &&
      !visitorProfileQuery.error,
  );

  const verificationPromptContext = searchParams.get('verifyEmailPrompt') ?? '';
  const isBrandSetupPrompt = searchParams.get('modal') === 'brand-setup';

  const computedSidebarMode = useMemo(
    () => computeSidebarMode(location.pathname, isMobile),
    [location.pathname, isMobile]
  );
  const isRouteSidebarHidden = location.pathname.startsWith('/studio');

  useEffect(() => {
    if (computedSidebarMode !== sidebarMode) {
      dispatch(setSidebarMode(computedSidebarMode));
    }
  }, [computedSidebarMode, sidebarMode, dispatch]);

  useEffect(() => {
    dispatch(closeSidebar());
  }, [dispatch, location.pathname]);

  const isRail = computedSidebarMode === 'RAIL';
  const mainMarginLeft = isRail ? '72px' : '0px';
  const showEmailVerificationPrompt = useMemo(() => {
    if (isVisitorRoute) return false;
    if (!user) return false;
    if (user.isEmailVerified) return false;
    return location.pathname === '/profile';
  }, [isVisitorRoute, user, location.pathname]);

  const maskedVerificationEmail = useMemo(
    () => maskEmailForPrompt(user?.email),
    [user?.email],
  );

  const verificationPromptDetails = useMemo(() => {
    if (verificationPromptContext === 'design-create') {
      return {
        title: 'Verify email to create designs',
        description: (
          <>
            Design creation is locked until verification is complete. Open the link sent to <span className="font-semibold">{maskedVerificationEmail}</span> and return.
          </>
        ),
        toastMessage:
          'Verify your email before creating designs. Check your inbox and click the verification link, then come back here.',
        actionLabel: 'Check status',
      };
    }

    if (verificationPromptContext === 'catalog-create') {
      return {
        title: 'Verify email to create catalog products',
        description: (
          <>
            Catalog product creation is locked until verification is complete. Open the link sent to <span className="font-semibold">{maskedVerificationEmail}</span> and return.
          </>
        ),
        toastMessage:
          'Verify your email before creating catalog products. Check your inbox and click the verification link, then come back here.',
        actionLabel: 'Check status',
      };
    }

    if (verificationPromptContext === 'store-setup') {
      return {
        title: 'Verify email to continue store setup',
        description: (
          <>
            Store setup is locked until verification is complete. Open the link sent to <span className="font-semibold">{maskedVerificationEmail}</span> and return.
          </>
        ),
        toastMessage:
          'Verify your email before starting store setup. Check your inbox for the verification link.',
        actionLabel: 'Check status',
      };
    }

    return {
      title: 'Verify your email to secure this account',
      description: (
        <>
          We sent a verification link to <span className="font-semibold">{maskedVerificationEmail}</span>. Open it, then confirm below.
        </>
      ),
      toastMessage:
        'Verify your email before continuing. Check your inbox and click the verification link, or use the resend button on your profile if you have not received it.',
      actionLabel: 'Check status',
    };
  }, [maskedVerificationEmail, verificationPromptContext]);

  useEffect(() => {
    if (!user) return;

    const emailVerifiedFlag = searchParams.get('emailVerified');
    const emailVerifiedMessage =
      searchParams.get('emailVerifiedMessage')?.trim() ||
      'Your email is verified successfully.';

    let shouldCleanQuery = false;
    const staleProfileNext = location.pathname === '/profile' && searchParams.has('next');

    if (emailVerifiedFlag === '1') {
      toast.success(emailVerifiedMessage);
      shouldCleanQuery = true;
    } else if (!user.isEmailVerified && verificationPromptContext) {
      toast.info(verificationPromptDetails.toastMessage);
      shouldCleanQuery = true;
    } else if (staleProfileNext) {
      shouldCleanQuery = true;
    }

    if (!shouldCleanQuery) return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('emailVerified');
      next.delete('emailVerifiedMessage');
      next.delete('verifyEmailPrompt');
      next.delete('next');
      return next;
    }, { replace: true });
  }, [location.pathname, searchParams, setSearchParams, user, verificationPromptContext, verificationPromptDetails.toastMessage]);

  const resendVerificationEmail = async () => {
    if (!user || isResendingVerification) return;

    setIsResendingVerification(true);
    try {
      const payload = await AuthApi.resendVerificationEmail();

      toast.success(
        payload?.message ||
          'Verification email sent. Please check your inbox and spam folder.',
      );
    } catch (error: unknown) {
      let message =
        'Unable to resend verification email right now. Please try again shortly.';
      if (isAxiosError(error)) {
        const data = error.response?.data as
          | { message?: string; data?: { message?: string } }
          | undefined;
        message = data?.message || data?.data?.message || message;
      }
      toast.error(message);
    } finally {
      setIsResendingVerification(false);
    }
  };

  const refreshVerificationStatus = async () => {
    if (!user || isCheckingVerification) return;

    setIsCheckingVerification(true);
    try {
      const response = await apiClient.get('/auth/profile');
      const profilePayload = unwrapApiResponse<AuthProfileResponse | AuthUserDto>(
        response.data,
      );
      const refreshedUser =
        'user' in profilePayload
          ? (profilePayload as AuthProfileResponse).user
          : (profilePayload as AuthUserDto);

      if (refreshedUser?.id) {
        dispatch(setUser(refreshedUser));
      }

      if (refreshedUser?.isEmailVerified) {
        toast.success('Your email is verified.');
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete('verifyEmailPrompt');
          next.delete('next');
          return next;
        }, { replace: true });
      } else {
        toast.info('Still waiting for verification. Open the email link, then check again.');
      }
    } catch {
      toast.error('Unable to check verification right now. Please try again shortly.');
    } finally {
      setIsCheckingVerification(false);
    }
  };

  if (!isVisitorRoute) {
    if (loading && !user) {
      return (
          <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
            {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
            <Navbar />
            <main
              className={PROFILE_MAIN_CLASS}
              style={{ marginLeft: mainMarginLeft }}
            >
              <div className="p-4 sm:p-6">
                <div className="max-w-screen-xl mx-auto space-y-6">
                  <ProfileHeaderSkeleton />
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-3">
                      <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
                    </div>
                    <div className="lg:col-span-9">
                      <CollectionsSkeleton />
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
      );
    }

    if (!user) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    // Store onboarding is encouraged/deferrable (no hard redirect).
  }

  if (isVisitorRoute && visitorLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
        {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
        <Navbar />
        <main
          className={PROFILE_MAIN_CLASS}
          style={{ marginLeft: mainMarginLeft }}
        >
          <div className="p-4 sm:p-6">
            <div className="max-w-screen-xl mx-auto space-y-6">
              <ProfileHeaderSkeleton />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3">
                  <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
                </div>
                <div className="lg:col-span-9">
                  <CollectionsSkeleton />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
        {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
        <Navbar />
        <main
          className={PROFILE_MAIN_CLASS}
          style={{ marginLeft: mainMarginLeft }}
        >
          {showEmailVerificationPrompt ? (
            <div className="pointer-events-none fixed left-3 right-3 top-20 z-40 sm:left-auto sm:right-6 sm:w-[360px]">
              <div className="pointer-events-auto">
                <EmailVerificationBanner
                  title={verificationPromptDetails.title}
                  description={verificationPromptDetails.description}
                  statusLabel={verificationPromptDetails.actionLabel}
                  isResending={isResendingVerification}
                  isChecking={isCheckingVerification}
                  onResend={resendVerificationEmail}
                  onCheckStatus={refreshVerificationStatus}
                />
              </div>
            </div>
          ) : null}
          <div className="px-0 sm:px-2">
            {location.pathname === '/profile' ? (
              hasActiveBrandMembership(user) ? (
                <Suspense fallback={<ProfileContentLoadingFallback brandSetupPrompt={isBrandSetupPrompt} />}>
                  <Profile />
                </Suspense>
              ) : (
                <EndUserProfile />
              )
            ) : isVisitorRoute && routeBrandId && location.pathname === `/profile/${routeBrandId}` ? (
              visitorType === 'BRAND' ? (
                <Suspense fallback={<ProfileContentLoadingFallback />}>
                  <Profile />
                </Suspense>
              ) : (
                <EndUserProfile />
              )
            ) : (
              <Outlet />
            )}
          </div>
        </main>

        {/* Backdrop for OVERLAY mode */}
        {isSidebarOpen && !isRouteSidebarHidden && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            onClick={() => dispatch(closeSidebar())}
            aria-hidden="true"
          />
        )}
      </div>
  );
};
