import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useAuth } from '@/context/AuthContext';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { hasActiveBrandMembership, isBrandAccount } from '@/lib/brandAccess';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

interface RequireBrandProps {
  children?: React.ReactNode;
  /**
   * 'store' (default): the account must be able to manage a store right now
   * (an active membership, or a brand whose store exists).
   * 'brand': the account must BE a brand (or brand staff), store or not. The
   * Studio shell uses this: a brand that has just signed up has no store yet,
   * and store setup itself lives inside Studio — gating Studio on having a
   * store sent every new brand away with "session expired". Store-dependent
   * Studio screens are still guarded by RequireStoreSetup, which routes a
   * brand without a store to setup.
   */
  access?: 'store' | 'brand';
}

const RequireBrand: React.FC<RequireBrandProps> = ({ children, access = 'store' }) => {
  const { profile: user } = useSelector((state: RootState) => state.user);
  const { loading } = useAuth();
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';

  if (!user) {
    /*
      Still restoring the session (cookie refresh + /auth/profile). The Studio
      WebView often opens on an existing document without a fresh handoff code,
      so the user arrives a few seconds after first paint. Declaring "no user"
      before restoration finished posted AUTH_REQUIRED and the app showed
      "Studio session expired" to a brand that was signed in all along.
    */
    if (loading) {
      return (
        <div className="flex min-h-[240px] items-center justify-center">
          <div className="text-sm text-gray-500">Opening Studio...</div>
        </div>
      );
    }
    if (isEmbeddedMobile) {
      postStudioNativeEvent({ type: 'AUTH_REQUIRED', reason: 'missing_user' });
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="text-base font-semibold">Sign in required</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Return to the app and sign in again to open Studio.
            </p>
          </div>
        </div>
      );
    }
    // If not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // If persisted user is stale/partial, wait for AuthProvider hydration
  // to avoid incorrect redirects.
  const allowed = access === 'brand' ? isBrandAccount(user) : hasActiveBrandMembership(user);
  if (!allowed) {
    if (loading && (user.type as any) == null) {
      return (
        <div className="flex items-center justify-center min-h-[240px]">
          <div className="text-sm text-gray-500">Loading your brand dashboard...</div>
        </div>
      );
    }

    if (isEmbeddedMobile) {
      postStudioNativeEvent({ type: 'AUTH_REQUIRED', reason: 'brand_required' });
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="text-base font-semibold">Brand access required</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Ask the brand owner for access to this workspace.
            </p>
          </div>
        </div>
      );
    }

    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireBrand;
