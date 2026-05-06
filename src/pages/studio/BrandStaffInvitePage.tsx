import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { brandStaffApi } from '@/api/BrandStaffApi';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { AuthProfileResponse, AuthUserDto } from '@/types/auth';
import { setUser } from '@/features/userSlice';
import type { RootState } from '@/store';
import { FrostedButton } from '@/components/ui/FrostedButton';

const BrandStaffInvitePage: React.FC = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.profile);
  const token = params.get('token')?.trim() ?? '';
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'accepted' | 'rejected' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const loginTarget = useMemo(
    () => `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    [location.pathname, location.search],
  );

  const refreshProfile = useCallback(async () => {
    const response = await apiClient.get('/auth/profile');
    const payload = unwrapApiResponse<AuthProfileResponse | AuthUserDto>(response.data);
    const nextUser = 'user' in payload ? payload.user : payload;
    if (nextUser?.id) {
      dispatch(setUser(nextUser));
    }
  }, [dispatch]);

  const completeInvite = useCallback(
    async (action: 'accept' | 'reject') => {
      if (!token) {
        setStatus('error');
        setMessage('This invite link is missing a token.');
        return;
      }
      if (!user?.id) {
        navigate(loginTarget, { replace: true });
        return;
      }

      setLoading(true);
      setMessage(null);
      try {
        if (action === 'accept') {
          await brandStaffApi.acceptInvite(token);
          await refreshProfile();
          setStatus('accepted');
          toast.success('Brand invite accepted.');
        } else {
          await brandStaffApi.rejectInvite(token);
          setStatus('rejected');
          toast.success('Brand invite rejected.');
        }
      } catch (error) {
        const fallback = action === 'accept' ? 'Unable to accept this invite.' : 'Unable to reject this invite.';
        setStatus('error');
        setMessage(
          isAxiosError(error) && typeof error.response?.data?.message === 'string'
            ? error.response.data.message
            : fallback,
        );
      } finally {
        setLoading(false);
      }
    },
    [loginTarget, navigate, refreshProfile, token, user?.id],
  );

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This invite link is missing a token.');
    }
  }, [token]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16 text-gray-900 dark:bg-black dark:text-white">
      <section className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Brand invite
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Join a Threadly brand workspace
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Accepting adds your account to the brand team. The brand owner controls your role and permissions.
          </p>
        </div>

        {!user?.id ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            Sign in with the invited email before accepting this invite.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
            {message}
          </div>
        ) : null}

        {status === 'accepted' ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
            Invite accepted. Your brand workspace access is ready.
          </div>
        ) : null}

        {status === 'rejected' ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
            Invite rejected.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!user?.id ? (
            <Link to={loginTarget}>
              <FrostedButton>Sign in to continue</FrostedButton>
            </Link>
          ) : (
            <>
              <FrostedButton
                type="button"
                onClick={() => completeInvite('accept')}
                disabled={loading || !token || status === 'accepted'}
              >
                {loading ? 'Working...' : 'Accept invite'}
              </FrostedButton>
              <button
                type="button"
                onClick={() => completeInvite('reject')}
                disabled={loading || !token || status === 'rejected'}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Reject
              </button>
            </>
          )}
          <Link
            to="/studio"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
          >
            Go to studio
          </Link>
        </div>
      </section>
    </main>
  );
};

export default BrandStaffInvitePage;
