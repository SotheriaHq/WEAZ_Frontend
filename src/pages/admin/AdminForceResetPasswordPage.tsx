import React, { useState } from 'react';
import { apiClient } from '@/api/httpClient';
import { useNavigate } from 'react-router-dom';

const AdminForceResetPasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/auth/admin/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess('Password updated. Redirecting to admin dashboard...');
      setTimeout(() => navigate('/admin', { replace: true }), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#faf8ff] via-[#f5f0ff] to-[#ede9f7]">
      <form onSubmit={onSubmit} className="w-full max-w-md p-6 rounded-2xl border border-purple-200/40 bg-white/90 shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-900">🔐 Reset Your Password</h1>
        <p className="text-sm text-gray-600">Your admin account requires a password reset before continuing.</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Current Password (optional if forced)</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
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

        <div>
          <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>

        {error && <div className="text-red-500 text-xs">{error}</div>}
        {success && <div className="text-green-600 text-xs">{success}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default AdminForceResetPasswordPage;
