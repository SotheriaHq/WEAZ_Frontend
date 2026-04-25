import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AuthApi } from '@/api/AuthApi';
import BrandWordmark from '@/components/brand/BrandWordmark';
import { COMPANY_NAME } from '@/lib/brand';
import '../styles/auth.css';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      await AuthApi.requestPasswordReset(trimmed);
      setSubmitted(true);
    } catch (err: unknown) {
      if (isAxiosError(err) && !err.response) {
        setError('Unable to reach the server. Please check your connection and try again.');
      } else {
        setError('Unable to send reset link right now. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--surface-primary)] text-[var(--text-primary)] font-sans antialiased overflow-x-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(var(--brand-primary-rgb),0.25), var(--surface-primary))',
          }}
        />
        <div className="auth-particle w-96 h-96 top-[-10%] right-[-5%] opacity-30 animate-pulse-slow absolute" />
        <div className="auth-particle w-64 h-64 bottom-[10%] left-[40%] opacity-20 animate-float absolute" style={{ animationDelay: '1s' }} />
      </div>

      <div className="flex flex-col min-h-screen items-center justify-center px-6 relative z-10">
        {/* Mobile Logo */}
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 group">
          <BrandWordmark
            logoSize={32}
            logoClassName="drop-shadow-[0_0_12px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_18px_rgba(212,175,55,0.6)] transition-[filter]"
            textClassName="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
          />
        </Link>

        <div className="w-full max-w-md">
          <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full">
            {/* Top Gradient Accent */}
            <div className="auth-top-gradient rounded-t-2xl" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '1rem 1rem 0 0' }} />

            {!submitted ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-full bg-[var(--brand-accent)]/15 flex items-center justify-center mx-auto mb-5">
                    <span className="text-2xl">🔑</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
                    Forgot your password?
                  </h1>
                  <p className="text-sm text-gray-400">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-300 uppercase tracking-wider ml-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="auth-input w-full rounded-xl py-3.5 px-4 text-sm"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                      <p className="text-xs text-red-300">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl">📧</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3">
                  Check your inbox
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed mb-6">
                  If an account with that email exists, {COMPANY_NAME} has sent a reset link. Check your inbox.
                </p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-6">
                  <p className="text-xs text-gray-500">
                    Didn't receive an email? Check your spam folder or try again with a different email.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                    setError(null);
                  }}
                  className="text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] transition-colors font-medium"
                >
                  Try another email
                </button>
              </div>
            )}

            {/* Back to Login */}
            <div className="mt-8 text-center">
              <Link
                to="/login"
                className="text-sm text-gray-400 hover:text-[var(--brand-primary)] transition-colors"
              >
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
