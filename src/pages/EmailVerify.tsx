import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { AuthProfileResponse, AuthUserDto } from '@/types/auth';
import { useDispatch } from 'react-redux';
import { setUser } from '@/features/userSlice';
import BrandWordmark from '@/components/brand/BrandWordmark';

type VerifyStatus = 'verifying' | 'success' | 'error' | 'pending';

const sanitizeNextPath = (path: string): string => {
  if (!path) return '/';
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  return path;
};

const HOME_REDIRECT_PATH = '/?emailVerified=1';
const SUCCESS_REDIRECT_SECONDS = 4;

const EmailVerifyPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>('verifying');
  const [message, setMessage] = useState('Preparing email verification...');
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);
  const verificationStartedRef = useRef(false);

  const token = useMemo(
    () => searchParams.get('token')?.trim() ?? '',
    [searchParams],
  );

  const pendingMode = useMemo(
    () => searchParams.get('pending') === '1',
    [searchParams],
  );

  const emailHint = useMemo(
    () => searchParams.get('email')?.trim() ?? '',
    [searchParams],
  );

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get('next')?.trim() ?? '/'),
    [searchParams],
  );

  const refreshLocalProfile = useCallback(async (): Promise<AuthUserDto | null> => {
    try {
      const profileResponse = await apiClient.get('/auth/profile');
      const profilePayload = unwrapApiResponse<AuthProfileResponse | AuthUserDto>(
        profileResponse.data,
      );
      const refreshedUser =
        'user' in profilePayload
          ? (profilePayload as AuthProfileResponse).user
          : (profilePayload as AuthUserDto);

      if (refreshedUser?.id) {
        dispatch(setUser(refreshedUser));
        return refreshedUser;
      }
    } catch {
      // best-effort profile refresh only
    }

    return null;
  }, [dispatch]);

  const goHome = useCallback(() => {
    navigate(HOME_REDIRECT_PATH, { replace: true });
  }, [navigate]);

  const verifyTokenNow = useCallback(async () => {
    if (!token) return;

    setStatus('verifying');
    setMessage('Verifying your email...');
    setRedirectSeconds(null);

    try {
      const response = await apiClient.get('/auth/verify-email', {
        params: { token },
      });

      const payload = response.data as
        | { message?: string; data?: { message?: string } }
        | undefined;
      const resolvedMessage =
        payload?.message ??
        payload?.data?.message ??
        'Your email has been verified successfully.';

      await refreshLocalProfile();

      setStatus('success');
      setMessage(resolvedMessage);
      setRedirectSeconds(SUCCESS_REDIRECT_SECONDS);
    } catch (error: unknown) {
      let errorMessage =
        'Verification failed. Please request a new verification email link.';
      if (isAxiosError(error) && error.response) {
        const data = error.response.data as
          | { message?: string; data?: { message?: string } }
          | undefined;
        errorMessage = data?.message ?? data?.data?.message ?? errorMessage;
      }

      const refreshedUser = await refreshLocalProfile();
      if (refreshedUser?.isEmailVerified) {
        setStatus('success');
        setMessage('Your email is already verified. Redirecting you to home.');
        setRedirectSeconds(SUCCESS_REDIRECT_SECONDS);
        return;
      }

      setStatus('error');
      setMessage(
        errorMessage.includes('Invalid or expired')
          ? 'This verification link is invalid, expired, or already used. If you already verified, open home or sign in.'
          : errorMessage,
      );
    }
  }, [refreshLocalProfile, token]);

  useEffect(() => {
    if (!token) {
      verificationStartedRef.current = false;
      if (pendingMode) {
        setStatus('pending');
        setMessage(
          emailHint
            ? `We sent a verification link to ${emailHint}. Open your inbox and click the link to verify your account.`
            : 'We sent you a verification email. Open your inbox and click the link to verify your account.',
        );
        return;
      }

      setStatus('error');
      setMessage('Verification link is missing a token. Please request a new verification email.');
      return;
    }

    if (verificationStartedRef.current) {
      return;
    }

    verificationStartedRef.current = true;
    void verifyTokenNow();
  }, [emailHint, pendingMode, token, verifyTokenNow]);

  useEffect(() => {
    if (status !== 'success') return;
    if (redirectSeconds == null) return;

    if (redirectSeconds <= 0) {
      goHome();
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirectSeconds((current) => {
        if (current == null) return null;
        return current - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [goHome, redirectSeconds, status]);

  const heading =
    status === 'success'
      ? 'Email Verified'
      : status === 'pending'
        ? 'Verify Your Email'
      : status === 'error'
        ? 'Verification Unavailable'
        : 'Verifying Your Email';

  const headingColor =
    status === 'success'
      ? 'text-emerald-700'
      : status === 'pending'
        ? 'text-[var(--brand-primary-strong)]'
      : status === 'error'
        ? 'text-rose-700'
        : 'text-[var(--brand-primary-strong)]';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#7C3AED] via-[#A78BFA] to-[#F3E8FF]">
      <div className="w-full max-w-md bg-white/95 rounded-3xl shadow-2xl p-10 flex flex-col items-center text-center">
        <div className="mb-4">
          <BrandWordmark
            logoSize={48}
            showName={false}
            logoClassName="drop-shadow-[0_0_16px_rgba(212,175,55,0.35)]"
          />
        </div>
        <h1 className={`text-2xl font-bold mb-3 ${headingColor}`}>{heading}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>

        {status === 'verifying' && (
          <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-purple-100">
            <div className="h-full w-1/2 animate-pulse bg-[var(--brand-primary)]" />
          </div>
        )}

        {status === 'success' && redirectSeconds != null && (
          <p className="mt-4 text-xs text-emerald-700">
            Redirecting to home in {Math.max(0, redirectSeconds)}s...
          </p>
        )}

        {status === 'success' && (
          <div className="mt-8 flex w-full gap-3">
            <button
              type="button"
              onClick={goHome}
              className="flex-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-strong)] transition-colors"
            >
              Go to Home
            </button>
            <Link
              to={nextPath}
              className="flex-1 rounded-xl border border-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-[var(--brand-primary)] hover:bg-purple-50 transition-colors"
            >
              Continue
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8 flex w-full gap-3">
            <button
              type="button"
              onClick={verifyTokenNow}
              className="flex-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-strong)] transition-colors"
            >
              Retry Verification
            </button>
            <Link
              to="/"
              className="flex-1 rounded-xl border border-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-[var(--brand-primary)] hover:bg-purple-50 transition-colors"
            >
              Open Home
            </Link>
          </div>
        )}

        {status === 'pending' && (
          <div className="mt-8 flex w-full gap-3">
            <Link
              to={nextPath}
              className="flex-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-strong)] transition-colors"
            >
              I Have Verified
            </Link>
            <Link
              to="/login"
              className="flex-1 rounded-xl border border-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-[var(--brand-primary)] hover:bg-purple-50 transition-colors"
            >
              Open Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerifyPage;
