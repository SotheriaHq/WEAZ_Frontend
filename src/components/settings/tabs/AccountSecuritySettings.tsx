import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';

import type { RootState } from '@/store';
import { AuthApi } from '@/api/AuthApi';
import { NotificationsApi } from '@/api/NotificationsApi';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import { adminEmailChangeApi } from '@/api/AdminApi';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useAuth } from '@/context/AuthContext';

type EmailSettings = {
  scenarios: Record<string, boolean>;
};

type SecuritySession = {
  id: string;
  userAgent: string | null;
  ipAddressMasked: string | null;
  location: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
};

const SECURITY_ALERT_KEYS = [
  {
    key: 'auth.signin.new_device',
    label: 'Email me when a new device logs into my account',
  },
  {
    key: 'auth.password.changed',
    label: 'Email me when my password is changed',
  },
  {
    key: 'auth.email.changed',
    label: 'Email me when my email address is changed',
  },
  {
    key: 'auth.two_factor.disabled',
    label: 'Email me when 2FA is disabled',
  },
] as const;

const ADMIN_NOTIFICATION_KEYS = [
  {
    key: 'admin.email_change.otp',
    label: 'Receive the email verification code for admin email change requests',
  },
  {
    key: 'admin.email_change.approved',
    label: 'Notify me when a Super Admin approves my email change',
  },
  {
    key: 'admin.email_change.rejected',
    label: 'Notify me when a Super Admin rejects my email change',
  },
] as const;

const describeSessionDevice = (userAgent: string | null) => {
  const normalized = String(userAgent ?? '').toLowerCase();
  if (!normalized) {
    return 'Unknown device';
  }

  const browser = normalized.includes('chrome/')
    ? 'Chrome'
    : normalized.includes('edg/')
      ? 'Edge'
      : normalized.includes('safari/') && !normalized.includes('chrome/')
        ? 'Safari'
        : normalized.includes('firefox/')
          ? 'Firefox'
          : normalized.includes('okhttp/')
            ? 'Android app'
            : 'Device';

  const os = normalized.includes('windows')
    ? 'Windows'
    : normalized.includes('mac os') || normalized.includes('macintosh')
      ? 'macOS'
      : normalized.includes('android') || normalized.includes('okhttp/')
        ? 'Android'
        : normalized.includes('iphone') || normalized.includes('ipad')
          ? 'iPhone'
          : normalized.includes('linux')
            ? 'Linux'
            : '';

  return os ? `${browser} on ${os}` : browser;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${datePart} at ${timePart}`;
};

const passwordChecks = (password: string) => ({
  length: password.length >= 12,
  uppercase: /[A-Z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9]/.test(password),
});

const strengthLabel = (password: string) => {
  const checks = passwordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;
  if (password.length === 0) return { label: 'Weak', progress: 0 };
  if (!checks.length) return { label: 'Minimum length not met', progress: 25 };
  if (score <= 1) return { label: 'Weak', progress: 25 };
  if (score === 2) return { label: 'Fair', progress: 50 };
  if (score === 3) return { label: 'Strong', progress: 75 };
  return { label: 'Very Strong', progress: 100 };
};

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}> = ({ checked, disabled = false, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
      checked
        ? 'border-primary bg-primary'
        : 'border-gray-300 bg-gray-200 dark:border-white/10 dark:bg-white/10'
    } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// ── Admin Email Section ──────────────────────────────────────────────────────

type AdminEmailStep = 'request' | 'otp' | 'pending';

interface AdminEmailSectionProps {
  currentEmail: string;
}

const AdminEmailSection: React.FC<AdminEmailSectionProps> = ({ currentEmail }) => {
  const [step, setStep] = useState<AdminEmailStep>('request');
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null);
  const [, setRequestId] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void adminEmailChangeApi
      .getMyRequest()
      .then((res) => {
        if (!active) return;
        const data = res?.data ?? null;
        if (data && data.status === 'PENDING_VERIFICATION') {
          setStep('otp');
          setPendingNewEmail(data.newEmail);
          setRequestId(data.id);
          setOtpExpiresAt(data.otpExpiresAt ?? null);
        } else if (data && data.status === 'PENDING_APPROVAL') {
          setStep('pending');
          setPendingNewEmail(data.newEmail);
          setRequestId(data.id);
        } else {
          setStep('request');
        }
      })
      .catch(() => {
        if (active) setStep('request');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newEmail.trim().toLowerCase() !== confirmNewEmail.trim().toLowerCase()) {
      setError('Email addresses do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await adminEmailChangeApi.requestChange({
        newEmail: newEmail.trim(),
        currentPassword: password,
      });
      const data = res.data;
      setPendingNewEmail(data?.newEmail ?? newEmail.trim());
      toast.success(data?.message ?? 'Verification code sent');
      setNewEmail('');
      setConfirmNewEmail('');
      setPassword('');
      setStep('otp');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to initiate email change.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await adminEmailChangeApi.verifyOtp({ otp: otp.trim() });
      const data = res.data;
      toast.success(data?.message ?? 'Code verified — request submitted for approval');
      setOtp('');
      setStep('pending');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setCancelBusy(true);
    try {
      await adminEmailChangeApi.cancelMyRequest();
      toast.success('Email change request cancelled');
      setStep('request');
      setPendingNewEmail(null);
      setRequestId(null);
      setOtpExpiresAt(null);
      setError(null);
      setOtp('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Unable to cancel request');
    } finally {
      setCancelBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading email status...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-900 space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Current Email</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentEmail}</p>
      </div>

      {step === 'request' && (
        <form onSubmit={handleRequestChange} className="space-y-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            As an admin, email changes require OTP verification and Super Admin approval.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Email Address</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Email</span>
              <input
                type="email"
                value={confirmNewEmail}
                onChange={(e) => setConfirmNewEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
                required
              />
            </label>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending code...' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            A 6-digit code was sent to{' '}
            <strong className="text-gray-900 dark:text-white">{pendingNewEmail}</strong>.
            Enter it below to verify ownership.
          </p>
          {otpExpiresAt ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Code expires at {formatDateTime(otpExpiresAt)}.
            </p>
          ) : null}
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Code</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 font-mono text-xl tracking-widest outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelBusy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
            >
              {cancelBusy ? 'Cancelling...' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        </form>
      )}

      {step === 'pending' && (
        <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-white/10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Awaiting Super Admin Approval</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Your request to change your email to{' '}
              <strong>{pendingNewEmail}</strong> has been verified and is pending approval.
              You will be notified once a Super Admin reviews it.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelBusy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              {cancelBusy ? 'Cancelling...' : 'Cancel Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const AccountSecuritySettings: React.FC = () => {
  const { profile } = useSelector((state: RootState) => state.user);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = profile?.role === 'SuperAdmin' || profile?.role === 'Admin';

  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailPendingAddress, setEmailPendingAddress] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [visibleSessionCount, setVisibleSessionCount] = useState(10);
  const [logoutOthersBusy, setLogoutOthersBusy] = useState(false);

  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [emailSettingsBusyKey, setEmailSettingsBusyKey] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const passwordPolicy = useMemo(() => passwordChecks(nextPassword), [nextPassword]);
  const passwordStrength = useMemo(() => strengthLabel(nextPassword), [nextPassword]);
  const passwordMeetsAllRequirements = Object.values(passwordPolicy).every(Boolean);
  const passwordsMatch = nextPassword.length > 0 && nextPassword === confirmPassword;

  const visibleSessions = sessions.slice(0, visibleSessionCount);
  const hasMoreSessions = sessions.length > visibleSessionCount;

  useEffect(() => {
    let active = true;
    void customOrdersBuyerApi
      .getDisplayChartPreference()
      .then((preference) => {
        if (active) {
          setDisplayChartFamily(preference.displayChartFamily);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSessions = async () => {
      try {
        const result = await AuthApi.listSecuritySessions();
        if (active) {
          setSessions(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error('Failed to load sessions', error);
        if (active) {
          toast.error('Failed to load login activity');
        }
      } finally {
        if (active) {
          setSessionsLoading(false);
        }
      }
    };

    const loadEmailSettings = async () => {
      try {
        const result = await NotificationsApi.getEmailSettings();
        if (active) {
          setEmailSettings(result as EmailSettings);
        }
      } catch (error) {
        console.error('Failed to load email settings', error);
      }
    };

    void Promise.all([loadSessions(), loadEmailSettings()]);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    const rawToken = searchParams.get('emailChangeToken');
    const token = rawToken?.trim() ?? '';
    if (!token) {
      if (rawToken !== null) {
        const next = new URLSearchParams(searchParams);
        next.delete('emailChangeToken');
        setSearchParams(next, { replace: true });
      }
      return;
    }

    let cancelled = false;
    void AuthApi.confirmEmailChange(token)
      .then((result) => {
        if (cancelled) return;
        toast.success(result.message || 'Email updated successfully');
      })
      .catch((error: any) => {
        if (cancelled) return;
        toast.error(error?.response?.data?.message ?? 'Unable to confirm email change');
      })
      .finally(() => {
        if (cancelled) return;
        const next = new URLSearchParams(searchParams);
        next.delete('emailChangeToken');
        setSearchParams(next, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, isAdmin]);

  if (!profile) {
    return null;
  }

  const handleDisplayChartChange = (value: string) => {
    const next = value as CustomOrderChartFamily;
    setDisplayChartFamily(next);
    void customOrdersBuyerApi.updateDisplayChartPreference({
      displayChartFamily: next,
      updatedAtMs: Date.now(),
    });
  };

  const submitEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailError(null);

    if (newEmail.trim().toLowerCase() !== confirmNewEmail.trim().toLowerCase()) {
      setEmailError('Email addresses do not match.');
      return;
    }

    setEmailBusy(true);
    try {
      const result = await AuthApi.requestEmailChange({
        newEmail: newEmail.trim(),
        currentPassword: emailPassword,
      });
      setEmailPendingAddress(result.pendingEmail ?? newEmail.trim());
      setNewEmail('');
      setConfirmNewEmail('');
      setEmailPassword('');
      setShowEmailForm(false);
      toast.success(result.message);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Unable to request email change.';
      setEmailError(message === 'Incorrect password' ? 'Incorrect password.' : message);
    } finally {
      setEmailBusy(false);
    }
  };

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (!passwordsMatch) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (!passwordMeetsAllRequirements) {
      setPasswordError('Your new password does not meet the required policy.');
      return;
    }

    setPasswordBusy(true);
    try {
      await AuthApi.changePassword({
        currentPassword,
        newPassword: nextPassword,
      });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Unable to update password.';
      setPasswordError(
        message === 'Current password is incorrect'
          ? 'Current password is incorrect.'
          : message,
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setSessionBusyId(sessionId);
    try {
      const result = await AuthApi.revokeSecuritySession(sessionId);
      if (result.success) {
        setSessions((current) => current.filter((session) => session.id !== sessionId));
        toast.success('Session revoked');
      } else {
        toast.error('Unable to revoke session');
      }
    } catch (error) {
      console.error('Failed to revoke session', error);
      toast.error('Failed to revoke session');
    } finally {
      setSessionBusyId(null);
    }
  };

  const logoutOtherSessions = async () => {
    setLogoutOthersBusy(true);
    try {
      const result = await AuthApi.logoutOtherSessions();
      setSessions((current) => current.filter((session) => session.isCurrentSession));
      toast.success(
        result.revokedCount > 0
          ? 'All other sessions have been signed out.'
          : 'There were no other active sessions to revoke.',
      );
    } catch (error) {
      console.error('Failed to revoke other sessions', error);
      toast.error('Unable to sign out other sessions');
    } finally {
      setLogoutOthersBusy(false);
    }
  };

  const toggleSecurityAlert = async (scenarioKey: string, nextValue: boolean) => {
    if (!emailSettings) return;
    const previous = emailSettings.scenarios[scenarioKey];
    setEmailSettingsBusyKey(scenarioKey);
    setEmailSettings({
      ...emailSettings,
      scenarios: {
        ...emailSettings.scenarios,
        [scenarioKey]: nextValue,
      },
    });

    try {
      const updated = await NotificationsApi.updateEmailSettings({
        scenarios: { [scenarioKey]: nextValue },
      });
      setEmailSettings(updated as EmailSettings);
    } catch (error) {
      console.error('Failed to update security alert preference', error);
      setEmailSettings({
        ...emailSettings,
        scenarios: {
          ...emailSettings.scenarios,
          [scenarioKey]: previous,
        },
      });
      toast.error('Unable to update security alert preference');
    } finally {
      setEmailSettingsBusyKey(null);
    }
  };

  const submitDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeleteError(null);

    if (deleteWord.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }

    setDeleteBusy(true);
    try {
      const result = await AuthApi.deleteAccount({
        confirmationWord: deleteWord,
        currentPassword: deletePassword,
      });
      logout();
      toast.success(result.message);
      navigate('/', { replace: true });
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Unable to delete account.';
      setDeleteError(message === 'Incorrect password' ? 'Incorrect password.' : message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const alertKeys = isAdmin
    ? [...SECURITY_ALERT_KEYS, ...ADMIN_NOTIFICATION_KEYS]
    : SECURITY_ALERT_KEYS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">Account & Security</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your email, password, sessions, alerts, size chart, and account actions.
        </p>
      </div>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-gray-950">
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Email Address</h2>

          {isAdmin ? (
            <AdminEmailSection currentEmail={profile.email} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Current Email</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
                  {emailPendingAddress ? (
                    <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                      A confirmation link has been sent to {emailPendingAddress}. Your email will update once confirmed.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm((current) => !current);
                    setEmailError(null);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/5"
                >
                  {showEmailForm ? 'Cancel' : 'Change Email'}
                </button>
              </div>

              {showEmailForm ? (
                <form onSubmit={submitEmailChange} className="mt-4 grid gap-4 border-t border-gray-200 pt-4 dark:border-white/10">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Email Address</span>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Email Address</span>
                      <input
                        type="email"
                        value={confirmNewEmail}
                        onChange={(event) => setConfirmNewEmail(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
                        required
                      />
                    </label>
                  </div>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</span>
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(event) => setEmailPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 outline-none ring-0 transition focus:border-primary dark:border-white/10 dark:bg-black/20"
                      required
                    />
                  </label>
                  {emailError ? <p className="text-sm text-red-500">{emailError}</p> : null}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={emailBusy}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {emailBusy ? 'Updating...' : 'Update Email'}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Password</h2>
          <form onSubmit={submitPasswordChange} className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</span>
              <div className="flex rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                <input
                  type={passwordVisible.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full bg-transparent px-4 py-2.5 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((state) => ({ ...state, current: !state.current }))}
                  className="px-4 text-sm text-gray-500"
                >
                  {passwordVisible.current ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</span>
                <div className="flex rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                  <input
                    type={passwordVisible.next ? 'text' : 'password'}
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    className="w-full bg-transparent px-4 py-2.5 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((state) => ({ ...state, next: !state.next }))}
                    className="px-4 text-sm text-gray-500"
                  >
                    {passwordVisible.next ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${passwordStrength.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{passwordStrength.label}</p>
                </div>
                <div className="grid gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <p className={passwordPolicy.length ? 'text-emerald-600 dark:text-emerald-400' : ''}>At least 12 characters</p>
                  <p className={passwordPolicy.uppercase ? 'text-emerald-600 dark:text-emerald-400' : ''}>At least one uppercase letter</p>
                  <p className={passwordPolicy.number ? 'text-emerald-600 dark:text-emerald-400' : ''}>At least one number</p>
                  <p className={passwordPolicy.special ? 'text-emerald-600 dark:text-emerald-400' : ''}>At least one special character</p>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</span>
                <div className="flex rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                  <input
                    type={passwordVisible.confirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full bg-transparent px-4 py-2.5 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((state) => ({ ...state, confirm: !state.confirm }))}
                    className="px-4 text-sm text-gray-500"
                  >
                    {passwordVisible.confirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
            </div>

            {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordBusy || !passwordMeetsAllRequirements || !passwordsMatch}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordBusy ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Two-Factor Authentication (2FA)</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add a second verification step for sign-in.
              </p>
            </div>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
              Disabled
            </span>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
            2FA setup is not wired on the backend in this workspace yet, so enable, disable, QR, and backup-code actions stay unavailable for now.
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Login Activity</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your most recent account sessions.</p>
            </div>
            <button
              type="button"
              onClick={() => void logoutOtherSessions()}
              disabled={logoutOthersBusy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
            >
              {logoutOthersBusy ? 'Signing out...' : 'Sign out of all other sessions'}
            </button>
          </div>

          {sessionsLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading login activity...</p>
          ) : visibleSessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No login sessions found.</p>
          ) : (
            <div className="space-y-3">
              {visibleSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {describeSessionDevice(session.userAgent)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          session.isCurrentSession
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                        }`}
                      >
                        {session.isCurrentSession ? 'Current session' : 'Past session'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {session.ipAddressMasked ?? 'IP unavailable'}
                      {session.location ? ` • ${session.location}` : ''}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(session.lastUsedAt)}
                    </p>
                  </div>

                  {session.isCurrentSession ? (
                    <span className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:text-emerald-300">
                      This is you
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void revokeSession(session.id)}
                      disabled={sessionBusyId === session.id}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/30 dark:hover:bg-red-900/10"
                    >
                      {sessionBusyId === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}

              {hasMoreSessions ? (
                <button
                  type="button"
                  onClick={() => setVisibleSessionCount((count) => count + 10)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Show more
                </button>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Security Alerts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              These preferences save immediately when you toggle them.
            </p>
          </div>
          <div className="space-y-3">
            {alertKeys.map((item) => {
              const checked = emailSettings?.scenarios?.[item.key] ?? true;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-white/10"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <Toggle
                    checked={checked}
                    disabled={emailSettingsBusyKey === item.key}
                    onChange={(next) => void toggleSecurityAlert(item.key, next)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {!isAdmin && (
          <section className="space-y-4 border-t border-gray-200 pt-6 dark:border-white/10">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Preferred Size Chart</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This sets your preferred size chart labels used across custom-order composer and size-chart conversion views.
              </p>
            </div>
            <UniversalSelect
              label="Preferred chart"
              value={displayChartFamily}
              onChange={handleDisplayChartChange}
              options={[
                { value: 'UK', label: 'UK' },
                { value: 'US', label: 'US' },
                { value: 'NIGERIA', label: 'Nigeria' },
                { value: 'ASIA', label: 'Asia' },
              ]}
              className="max-w-sm"
            />
          </section>
        )}

        <section className="space-y-4 border-t border-red-200 pt-6 dark:border-red-900/20">
          <div>
            <h2 className="text-lg font-medium text-red-600 dark:text-red-400">Danger Zone</h2>
            <p className="text-sm text-red-500 dark:text-red-300">
              This action is irreversible from the account surface.
            </p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
            {!showDeleteConfirm ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">Delete Account</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Permanently delete your account and clear access.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeleteError(null);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <form onSubmit={submitDeleteAccount} className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-red-900 dark:text-red-200">Type DELETE to confirm</span>
                  <input
                    value={deleteWord}
                    onChange={(event) => setDeleteWord(event.target.value)}
                    className="w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 outline-none dark:border-red-900/30 dark:bg-black/20"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-red-900 dark:text-red-200">Current Password</span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    className="w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 outline-none dark:border-red-900/30 dark:bg-black/20"
                    required
                  />
                </label>
                {deleteError ? <p className="text-sm text-red-600 dark:text-red-300">{deleteError}</p> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteWord('');
                      setDeletePassword('');
                      setDeleteError(null);
                    }}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-900/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteBusy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteBusy ? 'Deleting...' : 'Permanently Delete My Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountSecuritySettings;
