import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthApi } from '@/api/AuthApi';
import {
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
} from '@/lib/passwordPolicy';
import BrandWordmark from '@/components/brand/BrandWordmark';
import {
  PasswordMatchFeedback,
  PasswordPolicyFeedback,
} from '@/components/auth/PasswordPolicyFeedback';
import { PRODUCT_NAME } from '@/brand/identity';
import '../styles/auth.css';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordLength = useMemo(() => getPasswordLength(newPassword), [newPassword]);
  const passwordValid = useMemo(
    () => passwordLength >= PASSWORD_POLICY_MIN_LENGTH,
    [passwordLength],
  );
  const passwordsMatch = useMemo(
    () => newPassword === confirmPassword && confirmPassword.length > 0,
    [newPassword, confirmPassword],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (passwordLength < PASSWORD_POLICY_MIN_LENGTH) {
      setError(getPasswordPolicyErrorMessage());
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await AuthApi.confirmPasswordReset({
        token,
        newPassword,
      });
      setSuccess(true);
      window.history.replaceState({}, document.title, '/reset-password');
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'Failed to reset password. The link may be expired or invalid.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // No token state
  if (!token) {
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
        </div>

        <div className="flex flex-col min-h-screen items-center justify-center px-6 relative z-10">
          <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 group">
            <BrandWordmark
              logoSize={32}
              logoClassName="drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]"
              textClassName="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
            />
          </Link>

          <div className="w-full max-w-md">
            <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold auth-heading mb-3">
                Invalid Reset Link
              </h1>
              <p className="text-sm auth-muted mb-6">
                This password reset link is missing a valid token. Please request a new reset link.
              </p>
              <Link
                to="/forgot-password"
                className="auth-btn-primary inline-block px-6 py-3 rounded-xl text-sm font-medium tracking-wide"
              >
                Request New Link
              </Link>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="text-sm auth-muted hover:text-[var(--brand-accent)] transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        {/* Logo */}
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 group">
          <BrandWordmark
            logoSize={32}
            logoClassName="drop-shadow-[0_0_12px_rgba(212,175,55,0.45)] group-hover:drop-shadow-[0_0_18px_rgba(212,175,55,0.6)] transition-[filter]"
            textClassName="text-xl font-serif font-bold tracking-wide text-[var(--text-primary)] dark:text-white group-hover:text-[var(--brand-accent)] transition-colors"
          />
        </Link>

        <div className="w-full max-w-md">
          <div className="auth-glass-panel rounded-2xl p-8 sm:p-10 w-full relative overflow-hidden">
            {/* Top Gradient Accent */}
            <div className="auth-top-gradient" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '1rem 1rem 0 0' }} />

            {!success ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-full bg-[var(--brand-accent)]/15 flex items-center justify-center mx-auto mb-5">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold auth-heading mb-2">
                    Set your new password
                  </h1>
                  <p className="text-sm auth-muted">
                    Choose a strong password to secure your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium auth-label uppercase tracking-wider ml-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="Enter new password"
                        required
                        minLength={PASSWORD_POLICY_MIN_LENGTH}
                        className="auth-input w-full rounded-xl py-3.5 px-4 pr-16 text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="auth-field-toggle absolute inset-y-0 right-0 my-1 mr-1 px-3 flex items-center text-xs font-semibold"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    <PasswordPolicyFeedback password={newPassword} />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium auth-label uppercase tracking-wider ml-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="Confirm new password"
                        required
                        minLength={PASSWORD_POLICY_MIN_LENGTH}
                        className={`auth-input w-full rounded-xl py-3.5 px-4 pr-16 text-sm ${
                          confirmPassword.length > 0
                            ? passwordsMatch
                              ? 'success'
                              : 'error'
                            : ''
                        }`}
                      />
                      <button
                        type="button"
                        className="auth-field-toggle absolute inset-y-0 right-0 my-1 mr-1 px-3 flex items-center text-xs font-semibold"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-pressed={showConfirmPassword}
                        aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <PasswordMatchFeedback
                      password={newPassword}
                      confirmPassword={confirmPassword}
                     
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                      <p className="text-xs auth-error-text">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading || !passwordValid || !passwordsMatch}
                    className="auth-btn-primary w-full py-3.5 rounded-xl text-sm font-medium tracking-wide"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Resetting...
                      </span>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl">✅</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold auth-heading mb-3">
                  Password reset successfully!
                </h2>
                <p className="text-sm auth-muted leading-relaxed mb-8">
                  Your password has been updated. You can now sign in to {PRODUCT_NAME} with your new password.
                </p>
                <Link
                  to="/login"
                  className="auth-btn-primary inline-block px-8 py-3.5 rounded-xl text-sm font-medium tracking-wide"
                >
                  Sign In
                </Link>
              </div>
            )}

            {/* Back to Login (only on form, not success) */}
            {!success && (
              <div className="mt-8 text-center">
                <Link
                  to="/login"
                  className="text-sm auth-muted hover:text-[var(--brand-accent)] transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
