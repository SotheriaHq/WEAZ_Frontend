/**
 * ProtectedRoute - Prevents unauthorized access to protected pages
 * 
 * SECURITY: Shows loading state during auth check to prevent any flash of content
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useAuth } from '@/context/AuthContext';
import VLoader from '@/components/loaders/VLoader';

const AUTH_STATUS_STEPS = [
  {
    afterMs: 0,
    progress: 36,
    title: 'Refreshing your session',
    description: 'We are checking your saved sign-in before reopening this page.',
  },
  {
    afterMs: 2400,
    progress: 68,
    title: 'Loading your profile',
    description: 'Your account is recognized. We are syncing your latest Threadly details.',
  },
  {
    afterMs: 5200,
    progress: 88,
    title: 'Almost ready',
    description: 'This is taking longer than usual, but we are still trying to finish cleanly.',
  },
] as const;

export const AuthGateFallback: React.FC = () => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  const currentStep = useMemo(
    () =>
      [...AUTH_STATUS_STEPS]
        .reverse()
        .find((step) => elapsedMs >= step.afterMs) ?? AUTH_STATUS_STEPS[0],
    [elapsedMs],
  );
  const isTakingLong = elapsedMs >= 9000;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface-primary)] px-6 text-gray-900 dark:text-white">
      <div className="flex max-w-sm flex-col items-center text-center">
        <VLoader
          size={58}
          phase={currentStep.progress >= 88 ? 'finishing' : 'loading'}
          progress={currentStep.progress}
          showLabel={false}
        />
        <div className="mt-5 space-y-2">
          <p className="text-base font-semibold text-[color:var(--text-primary)]">{currentStep.title}</p>
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{currentStep.description}</p>
        </div>
        {isTakingLong ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-[color:var(--surface-secondary)] px-4 py-2 font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-tertiary)]"
            >
              Try again
            </button>
            <a
              href="/login"
              className="rounded-full px-4 py-2 font-semibold text-purple-600 transition hover:bg-purple-50 dark:text-fuchsia-300 dark:hover:bg-white/5"
            >
              Sign in again
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const RequireAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  const { isAuthenticated, profile } = useSelector((state: RootState) => state.user);
  const location = useLocation();

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loading) {
    return <AuthGateFallback />;
  }

  return <>{children}</>;
};

const ProtectedRoute: React.FC = () => {
  // User is authenticated, render child routes
  // RequireAuthenticated handles loading, stale sessions, and redirect state.
  return (
    <RequireAuthenticated>
      <Outlet />
    </RequireAuthenticated>
  );
};

export default ProtectedRoute;
