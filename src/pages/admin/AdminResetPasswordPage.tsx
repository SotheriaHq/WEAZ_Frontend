import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthApi } from '@/api/AuthApi';
import {
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
} from '@/lib/passwordPolicy';
import {
  PasswordMatchFeedback,
  PasswordPolicyFeedback,
} from '@/components/auth/PasswordPolicyFeedback';

const AdminResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenFromQuery = searchParams.get('token')?.trim() ?? '';

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestCompleted, setRequestCompleted] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualTokenEntry, setManualTokenEntry] = useState(Boolean(tokenFromQuery));

  const hasToken = useMemo(() => token.trim().length > 0, [token]);
  const canConfirmReset = hasToken || manualTokenEntry;
  const showRequestForm = !canConfirmReset && !requestCompleted;
  const showCheckEmailState = requestCompleted && !canConfirmReset && !resetCompleted;
  const showSuccessState = resetCompleted;

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const result = await AuthApi.requestAdminPasswordReset(normalizedEmail);
      setRequestCompleted(true);
      setManualTokenEntry(false);
      setMessage(
        result.message || 'If the account exists, a reset link has been generated.',
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to request reset');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setError('Reset token is required.');
      return;
    }

    if (getPasswordLength(newPassword) < PASSWORD_POLICY_MIN_LENGTH) {
      setError(getPasswordPolicyErrorMessage('New password'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await AuthApi.confirmAdminPasswordReset({
        token: normalizedToken,
        newPassword,
      });

      setResetCompleted(true);
      setMessage('Password reset successful. You can now log in with your new password.');
      window.history.replaceState({}, document.title, '/admin/reset-password');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7]">
      <div className="w-full max-w-md p-6 rounded-2xl border border-purple-200/40 bg-white/90 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-900">🔑 Admin Reset Password</h1>

        {showRequestForm ? (
          <form onSubmit={requestReset} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Requesting...' : 'Request Reset Link'}
            </button>
          </form>
        ) : showCheckEmailState ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              📧
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
              <p className="text-sm text-gray-600">
                If that admin account exists, we sent a reset link to {email.trim()}.
              </p>
            </div>
            <p className="text-xs text-gray-500">{message}</p>
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Next steps
              </p>
              <p className="text-sm text-gray-600">Open the email link or paste the token here to finish the reset.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setManualTokenEntry(true)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Enter reset token manually
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestCompleted(false);
                  setManualTokenEntry(false);
                  setMessage(null);
                }}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Request another link
              </button>
            </div>
          </div>
        ) : showSuccessState ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
              ✅
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Password reset successful</h2>
              <p className="text-sm text-gray-600">
                Your admin password has been updated. You can now sign in with the new password.
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Recommended next step
              </p>
              <p className="text-sm text-gray-600">Return to the sign-in screen and use the new password immediately.</p>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={confirmReset} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reset Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                disabled={resetCompleted}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={PASSWORD_POLICY_MIN_LENGTH}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                disabled={resetCompleted}
              />
              <PasswordPolicyFeedback password={newPassword} tone="light" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={PASSWORD_POLICY_MIN_LENGTH}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                disabled={resetCompleted}
              />
            </div>
            <PasswordMatchFeedback
              password={newPassword}
              confirmPassword={confirmPassword}
              tone="light"
            />
            {!resetCompleted ? (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Resetting...' : 'Confirm Reset'}
              </button>
            ) : null}
          </form>
        )}

        {error && <div className="text-red-500 text-xs">{error}</div>}
        {message && <div className="text-green-600 text-xs">{message}</div>}

        <div className="pt-2">
          <Link to="/login" className="text-xs text-gray-600 hover:text-gray-900">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminResetPasswordPage;
