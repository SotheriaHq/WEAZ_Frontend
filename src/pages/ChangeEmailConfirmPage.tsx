import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, LoaderCircle, MailCheck } from 'lucide-react';
import { AuthApi } from '@/api/AuthApi';
import BrandWordmark from '@/components/brand/BrandWordmark';
import '../styles/auth.css';

type ConfirmationStatus = 'checking' | 'success' | 'error';

const extractEmailChangeErrorMessage = (error: unknown): string => {
  const responseData = (error as any)?.response?.data;
  const candidates = [
    responseData?.message,
    responseData?.data?.message,
    responseData?.error,
    (error as any)?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'This email change link is invalid, expired, or already used.';
};

const ChangeEmailConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const startedRef = useRef(false);

  const [status, setStatus] = useState<ConfirmationStatus>('checking');
  const [message, setMessage] = useState('Confirming your new email address...');

  const removeTokenFromUrl = useCallback(() => {
    window.history.replaceState({}, document.title, '/change-email/confirm');
  }, []);

  useEffect(() => {
    if (!token) {
      startedRef.current = false;
      setStatus('error');
      setMessage('Email change link is missing a token. Request a new email change link from account security.');
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    const confirmEmailChange = async () => {
      setStatus('checking');
      setMessage('Confirming your new email address...');

      try {
        const response = await AuthApi.confirmEmailChange(token);
        setStatus('success');
        setMessage(response.message || 'Your email address has been updated.');
      } catch (error) {
        setStatus('error');
        setMessage(extractEmailChangeErrorMessage(error));
      } finally {
        removeTokenFromUrl();
      }
    };

    void confirmEmailChange();
  }, [removeTokenFromUrl, token]);

  const heading =
    status === 'success'
      ? 'Email updated'
      : status === 'error'
        ? 'Email change unavailable'
        : 'Confirming email change';

  const statusTone =
    status === 'success'
      ? 'text-emerald-300'
      : status === 'error'
        ? 'text-red-300'
        : 'text-[#D4AF37]';

  return (
    <div className="min-h-screen w-full bg-[var(--surface-primary)] text-[var(--text-primary)] font-sans antialiased overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(var(--brand-primary-rgb),0.25), var(--surface-primary))',
          }}
        />
        <div className="auth-particle w-96 h-96 top-[-10%] right-[-5%] opacity-30 animate-pulse-slow absolute" />
        <div
          className="auth-particle w-64 h-64 bottom-[10%] left-[40%] opacity-20 animate-float absolute"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <div className="flex flex-col min-h-screen items-center justify-center px-6 relative z-10">
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 group">
          <BrandWordmark
            logoSize={32}
            logoClassName="drop-shadow-[0_0_12px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_18px_rgba(212,175,55,0.6)] transition-[filter]"
            textClassName="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
          />
        </Link>

        <div className="w-full max-w-md">
          <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full relative overflow-hidden text-center">
            <div
              className="auth-top-gradient"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '1rem 1rem 0 0' }}
            />
            <div className="w-14 h-14 rounded-full bg-[var(--brand-accent)]/15 flex items-center justify-center mx-auto mb-5">
              {status === 'success' ? (
                <MailCheck className="h-7 w-7 text-emerald-300" aria-hidden="true" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-7 w-7 text-red-300" aria-hidden="true" />
              ) : (
                <LoaderCircle className="h-7 w-7 animate-spin text-[#D4AF37]" aria-hidden="true" />
              )}
            </div>
            <h1 className={`text-xl sm:text-2xl font-serif font-bold mb-3 ${statusTone}`}>
              {heading}
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">{message}</p>

            {status === 'checking' && (
              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse bg-[#D4AF37]" />
              </div>
            )}

            <div className="mt-8 flex w-full flex-col sm:flex-row gap-3">
              {status === 'success' ? (
                <Link
                  to="/login"
                  className="auth-btn-primary inline-block flex-1 px-6 py-3 rounded-xl text-sm font-medium tracking-wide"
                >
                  Sign In
                </Link>
              ) : null}
              <Link
                to="/settings?tab=account-security"
                className="inline-block flex-1 rounded-xl border border-[#D4AF37]/60 px-6 py-3 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
              >
                Account Security
              </Link>
              {status === 'error' ? (
                <Link
                  to="/login"
                  className="inline-block flex-1 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Sign In
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeEmailConfirmPage;
