import React, { lazy } from 'react';
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

const Profile = lazy(() => import('../../pages/catalog/Catalog'));

const computeSidebarMode = (pathname: string, isMobile: boolean) => {
  if (isMobile) return 'HIDDEN' as const;
  const isProfileRoute = pathname === '/profile' || pathname.startsWith('/profile/');
  if (isProfileRoute && !pathname.startsWith('/profile/settings')) return 'RAIL' as const;
  if (pathname.startsWith('/settings') || pathname.startsWith('/profile/settings')) return 'HIDDEN' as const;
  if (pathname.startsWith('/studio')) return 'HIDDEN' as const;
  return 'RAIL' as const;
};

const sanitizeNextPath = (path: string): string | null => {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
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
  const [visitorType, setVisitorType] = useState<'BRAND' | 'REGULAR' | null>(null);
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const verificationPromptContext = searchParams.get('verifyEmailPrompt') ?? '';
  const verificationNextPath = useMemo(
    () => sanitizeNextPath(searchParams.get('next')?.trim() ?? ''),
    [searchParams],
  );

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

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisitorRoute || !routeBrandId) return;
      try {
        setVisitorLoading(true);
        const res = await apiClient.get(`/users/${routeBrandId}/profile/public`);
        const payload = res.data?.data ?? res.data;
        const source = payload?.user ?? payload?.profile ?? payload;
        const rawType = source?.type as string | undefined;
        const type =
          rawType === 'BRAND' || rawType === 'REGULAR'
            ? rawType
            : source?.role === 'User'
              ? 'REGULAR'
              : null;
        if (mounted) {
          setVisitorType(type ?? null);
        }
      } catch {
        if (mounted) {
          setVisitorType(null);
        }
      } finally {
        if (mounted) {
          setVisitorLoading(false);
        }
      }
    };
    void run();
    return () => { mounted = false; };
  }, [isVisitorRoute, routeBrandId]);

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
        actionLabel: verificationNextPath ? "I've Verified - Continue" : "I've Verified",
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
        actionLabel: verificationNextPath ? "I've Verified - Continue" : "I've Verified",
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
        actionLabel: verificationNextPath ? "I've Verified - Continue" : "I've Verified",
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
      actionLabel: verificationNextPath ? "I've Verified - Continue" : "I've Verified",
    };
  }, [maskedVerificationEmail, verificationNextPath, verificationPromptContext]);

  useEffect(() => {
    if (!user) return;

    const emailVerifiedFlag = searchParams.get('emailVerified');
    const emailVerifiedMessage =
      searchParams.get('emailVerifiedMessage')?.trim() ||
      'Your email is verified successfully.';

    let shouldCleanQuery = false;

    if (emailVerifiedFlag === '1') {
      toast.success(emailVerifiedMessage);
      shouldCleanQuery = true;
    } else if (!user.isEmailVerified && verificationPromptContext) {
      toast.info(verificationPromptDetails.toastMessage);
      shouldCleanQuery = true;
    }

    if (!shouldCleanQuery) return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('emailVerified');
      next.delete('emailVerifiedMessage');
      next.delete('verifyEmailPrompt');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, user, verificationPromptContext, verificationPromptDetails.toastMessage]);

  const resendVerificationEmail = async () => {
    if (!user || isResendingVerification) return;

    setIsResendingVerification(true);
    try {
      const response = await apiClient.post('/auth/verify-email/resend');
      const payload =
        (response.data?.data as { message?: string } | undefined) ??
        (response.data as { message?: string } | undefined);

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

  if (!isVisitorRoute) {
    if (loading && !user) {
      return (
          <div className="min-h-screen bg-[color:var(--surface-primary)] text-gray-900 dark:text-white">
            {!isRouteSidebarHidden && (computedSidebarMode !== 'HIDDEN' || isSidebarOpen || isMobile) && <Sidebar />}
            <Navbar />
            <main
              className="min-h-screen pt-16 pb-20 transition-[margin] duration-300 ease-out md:pb-8"
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
          className="min-h-screen pt-16 pb-20 transition-[margin] duration-300 ease-out md:pb-8"
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
          className="min-h-screen pt-16 pb-20 transition-[margin] duration-300 ease-out md:pb-8"
          style={{ marginLeft: mainMarginLeft }}
        >
          {showEmailVerificationPrompt ? (
            <div className="px-4 sm:px-6 pt-4">
              <div className="mx-auto flex min-h-9 max-w-screen-xl items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                <p className="min-w-0 truncate font-medium">
                  {verificationPromptDetails.description}
                </p>
                <button
                  type="button"
                  onClick={resendVerificationEmail}
                  disabled={isResendingVerification}
                  className="shrink-0 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-100"
                >
                  {isResendingVerification ? 'Sending...' : 'Resend Email'}
                </button>
              </div>
            </div>
          ) : null}
          <div className="px-0 sm:px-2">
            {location.pathname === '/profile' ? (
              user?.type === 'BRAND' ? <Profile /> : <EndUserProfile />
            ) : isVisitorRoute && routeBrandId && location.pathname === `/profile/${routeBrandId}` ? (
              visitorType === 'BRAND' ? <Profile /> : <EndUserProfile />
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
