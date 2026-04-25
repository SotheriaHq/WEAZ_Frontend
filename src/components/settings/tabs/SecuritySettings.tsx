import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { RootState } from '@/store';
import { AuthApi } from '@/api/AuthApi';
import { NotificationsApi } from '@/api/NotificationsApi';
import { useAuth } from '@/context/AuthContext';
import {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordPolicyErrorMessage,
} from '@/lib/passwordPolicy';

type TrustedDevice = {
  id: string;
  deviceLabel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUserAgent: string | null;
  isTrusted: boolean;
  revokedAt: string | null;
};

const SecuritySettings: React.FC = () => {
  const { profile } = useSelector((state: RootState) => state.user);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = React.useState(false);

  const [devices, setDevices] = React.useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = React.useState(true);

  const requiresForcedReset = Boolean(profile?.mustResetPassword);

  const newPasswordLength = React.useMemo(() => getPasswordLength(newPassword), [newPassword]);
  const isPasswordLengthValid = newPasswordLength >= PASSWORD_POLICY_MIN_LENGTH;
  const doesPasswordMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  React.useEffect(() => {
    const loadDevices = async () => {
      try {
        const result = await NotificationsApi.listTrustedDevices();
        setDevices(Array.isArray(result) ? (result as TrustedDevice[]) : []);
      } catch (error) {
        console.error('Failed to load trusted devices', error);
        toast.error('Failed to load recognized devices');
      } finally {
        setLoadingDevices(false);
      }
    };

    void loadDevices();
  }, []);

  if (!profile) return null;

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requiresForcedReset && !currentPassword) {
      toast.error('Current password is required.');
      return;
    }

    if (!isPasswordLengthValid) {
      toast.error(getPasswordPolicyErrorMessage('New password'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await AuthApi.changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });

      toast.success('Password changed. Please sign in again.');

      logout();
      navigate('/login', { replace: true });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        'Unable to update password right now.';
      toast.error(message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const result = await NotificationsApi.revokeTrustedDevice(deviceId);
      if (result?.success) {
        setDevices((prev) =>
          prev.map((device) =>
            device.id === deviceId
              ? { ...device, revokedAt: new Date().toISOString(), isTrusted: false }
              : device,
          ),
        );
        toast.success('Device access revoked');
      } else {
        toast.error('Unable to revoke device');
      }
    } catch (error) {
      console.error('Failed to revoke device', error);
      toast.error('Failed to revoke device');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Security and Login
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Change your password and manage recognized devices.
        </p>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <span aria-hidden="true">🔐</span>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Password</h2>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          {PASSWORD_POLICY_HINT}
        </p>

        {requiresForcedReset ? (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-200">
            🛡️ This account is in forced-reset mode. You can set a new password without entering the current one.
          </div>
        ) : null}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          {!requiresForcedReset ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={PASSWORD_POLICY_MIN_LENGTH}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500">
                Minimum {PASSWORD_POLICY_MIN_LENGTH} characters.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={PASSWORD_POLICY_MIN_LENGTH}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {confirmPassword.length > 0 && !doesPasswordMatch ? (
            <p className="text-sm text-red-500">Passwords do not match.</p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                isSubmittingPassword ||
                !isPasswordLengthValid ||
                !doesPasswordMatch
              }
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Recognized Devices */}
      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🧾</span>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recognized Devices</h2>
        </div>

        {loadingDevices ? (
          <p className="text-sm text-gray-500">Loading devices...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">No recognized devices found.</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const revoked = !!device.revokedAt;
              const userAgent = device.lastUserAgent || 'Unknown device';
              return (
                <div
                  key={device.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {device.deviceLabel || userAgent.slice(0, 80)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last seen: {new Date(device.lastSeenAt).toLocaleString()} {revoked ? '• Revoked' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revoked}
                    onClick={() => void handleRevokeDevice(device.id)}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecuritySettings;
