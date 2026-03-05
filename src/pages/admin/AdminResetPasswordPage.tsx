import React, { useState } from 'react';
import { apiClient } from '@/api/httpClient';

const AdminResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient.post('/auth/admin/reset-password/request', { email });
      const body = res.data as any;
      setMessage('Reset token generated. Use the token below to confirm reset.');
      if (body?.resetToken) {
        setToken(body.resetToken);
      }
      setStep('confirm');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to request reset');
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiClient.post('/auth/admin/reset-password/confirm', { token, newPassword });
      setMessage('Password reset successful. You can now log in with your new password.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7]">
      <div className="w-full max-w-md p-6 rounded-2xl border border-purple-200/40 bg-white/90 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-900">🔑 Admin Reset Password</h1>

        {step === 'request' ? (
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
            <button type="submit" className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium">
              Request Reset Token
            </button>
          </form>
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
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>
            <button type="submit" className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium">
              Confirm Reset
            </button>
          </form>
        )}

        {error && <div className="text-red-500 text-xs">{error}</div>}
        {message && <div className="text-green-600 text-xs">{message}</div>}
      </div>
    </div>
  );
};

export default AdminResetPasswordPage;
