import React from 'react';
import {
  PASSWORD_POLICY_MIN_LENGTH,
  getPasswordLength,
  getPasswordStrength,
  isPasswordLengthValid,
  type PasswordStrength,
} from '@/lib/passwordPolicy';

type FeedbackTone = 'dark' | 'light';

type PasswordPolicyFeedbackProps = {
  password: string;
  id?: string;
  className?: string;
  tone?: FeedbackTone;
};

type PasswordMatchFeedbackProps = {
  password: string;
  confirmPassword: string;
  className?: string;
  tone?: FeedbackTone;
};

const toneClasses: Record<
  FeedbackTone,
  {
    muted: string;
    danger: string;
    success: string;
    track: string;
    fill: string;
  }
> = {
  dark: {
    muted: 'text-gray-400',
    danger: 'text-red-300',
    success: 'text-emerald-300',
    track: 'bg-white/10',
    fill: 'bg-amber-400',
  },
  light: {
    muted: 'text-gray-600',
    danger: 'text-red-600',
    success: 'text-emerald-700',
    track: 'bg-gray-200',
    fill: 'bg-amber-500',
  },
};

const strengthMeta: Record<
  PasswordStrength,
  {
    label: string;
    progress: number;
    fillClass: string;
  }
> = {
  weak: {
    label: 'Weak',
    progress: 35,
    fillClass: 'bg-red-500',
  },
  fair: {
    label: 'Fair',
    progress: 55,
    fillClass: 'bg-amber-500',
  },
  strong: {
    label: 'Strong',
    progress: 78,
    fillClass: 'bg-emerald-500',
  },
  'very-strong': {
    label: 'Very strong',
    progress: 100,
    fillClass: 'bg-emerald-600',
  },
};

export const PasswordPolicyFeedback: React.FC<PasswordPolicyFeedbackProps> = ({
  password,
  id,
  className = '',
  tone = 'dark',
}) => {
  const length = getPasswordLength(password);
  const meetsLength = isPasswordLengthValid(password);
  const strength = getPasswordStrength(password);
  const meta = strengthMeta[strength];
  const styles = toneClasses[tone];
  const progress = length === 0
    ? 0
    : meetsLength
      ? meta.progress
      : Math.max(12, Math.min(45, (length / PASSWORD_POLICY_MIN_LENGTH) * 45));
  const label = length === 0
    ? `At least ${PASSWORD_POLICY_MIN_LENGTH} characters required.`
    : meetsLength
      ? `${length} characters. Strength: ${meta.label}.`
      : `${length}/${PASSWORD_POLICY_MIN_LENGTH} characters. Minimum length not met.`;
  const statusClass = meetsLength ? styles.success : length > 0 ? styles.danger : styles.muted;
  const fillClass = meetsLength ? meta.fillClass : styles.fill;

  return (
    <div id={id} className={`space-y-1.5 ${className}`}>
      <div
        className={`h-1.5 overflow-hidden rounded-full ${styles.track}`}
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] ${fillClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`text-xs ${statusClass}`}>{label}</p>
      <p className={`text-xs ${styles.muted}`}>
        Use at least {PASSWORD_POLICY_MIN_LENGTH} characters. Longer passphrases are better.
      </p>
    </div>
  );
};

export const PasswordMatchFeedback: React.FC<PasswordMatchFeedbackProps> = ({
  password,
  confirmPassword,
  className = '',
  tone = 'dark',
}) => {
  const styles = toneClasses[tone];

  if (!confirmPassword) {
    return (
      <p className={`text-xs ${styles.muted} ${className}`}>
        Retype the same password to confirm.
      </p>
    );
  }

  if (password === confirmPassword) {
    return (
      <p className={`text-xs ${styles.success} ${className}`}>
        Passwords match.
      </p>
    );
  }

  return (
    <p className={`text-xs ${styles.danger} ${className}`}>
      Passwords do not match.
    </p>
  );
};
