import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Info,
  Share2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StoreWizardData } from '@/types/storeWizard';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import { sanitizeSingleSocialLink } from '@/utils/storeSetup';

const SOCIAL_FIELD_IDS = ['instagram', 'tiktok', 'twitter'] as const;

interface StoreSocialStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

const SOCIAL_PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    gradient: 'bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500',
    placeholder: 'username',
    prefix: '@',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
    gradient: 'bg-black border border-gray-700',
    placeholder: 'username',
    prefix: '@',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    gradient: 'bg-black border border-gray-700',
    placeholder: 'username',
    prefix: '@',
  },
];

const validateUsername = (platform: string, value: string): boolean => {
  if (!value) return true;
  const cleanValue = value.startsWith('@') ? value.slice(1) : value;
  const patterns: Record<string, RegExp> = {
    instagram: /^[a-zA-Z0-9._]{1,30}$/,
    tiktok: /^[a-zA-Z0-9._]{1,24}$/,
    twitter: /^[a-zA-Z0-9_]{1,15}$/,
  };
  return patterns[platform]?.test(cleanValue) ?? true;
};

const validateWebsite = (url: string): boolean => {
  if (!url) return true;
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

const StoreSocialStep: React.FC<StoreSocialStepProps> = ({
  data,
  onChange,
  onBack,
  onSkip,
  onContinue,
  isSaving = false,
}) => {
  const [verificationStatus, setVerificationStatus] = useState<Record<string, { status: 'idle' | 'checking' | 'valid' | 'error'; message?: string }>>({
    instagram: { status: 'idle' },
    tiktok: { status: 'idle' },
    twitter: { status: 'idle' },
  });

  const connectedSocialPlatform = useMemo(
    () => SOCIAL_PLATFORMS.find((platform) => Boolean(data[platform.id as keyof StoreWizardData])),
    [data],
  );
  const hasSocialConnected = Boolean(connectedSocialPlatform || data.website);
  const hasVerifiedHandle = Object.values(verificationStatus).some((state) => state.status === 'valid');

  useEffect(() => {
    const sanitized = sanitizeSingleSocialLink({
      instagram: data.instagram,
      tiktok: data.tiktok,
      twitter: data.twitter,
    });
    const changed = SOCIAL_FIELD_IDS.some(
      (field) => sanitized[field] !== String(data[field] ?? '').trim(),
    );
    if (changed) {
      onChange(sanitized);
    }
  }, [data.instagram, data.tiktok, data.twitter, onChange]);

  const handleSocialChange = useCallback(
    (platform: string, value: string) => {
      const cleanValue = value.startsWith('@') ? value.slice(1) : value;
      const updates: Partial<StoreWizardData> = {
        [platform]: cleanValue,
      } as Partial<StoreWizardData>;

      if (cleanValue) {
        for (const field of SOCIAL_FIELD_IDS) {
          if (field !== platform) {
            updates[field] = '';
          }
        }
      }

      onChange(updates);
      setVerificationStatus((prev) => {
        const next = { ...prev, [platform]: { status: 'idle' as const } };
        if (cleanValue) {
          for (const field of SOCIAL_FIELD_IDS) {
            if (field !== platform) {
              next[field] = { status: 'idle' };
            }
          }
        }
        return next;
      });
    },
    [onChange]
  );

  const verifySocialHandle = useCallback(
    async (platform: 'instagram' | 'tiktok' | 'twitter', label: string) => {
      const rawValue = (data[platform] as string) || '';
      const cleanValue = rawValue.startsWith('@') ? rawValue.slice(1) : rawValue;

      if (!cleanValue) {
        setVerificationStatus((prev) => ({
          ...prev,
          [platform]: { status: 'error', message: 'Add a handle to verify.' },
        }));
        toast.warning(`Add your ${label} handle to verify`);
        return;
      }

      if (!validateUsername(platform, cleanValue)) {
        setVerificationStatus((prev) => ({
          ...prev,
          [platform]: { status: 'error', message: 'Handle format looks off.' },
        }));
        return;
      }

      setVerificationStatus((prev) => ({
        ...prev,
        [platform]: { status: 'checking' },
      }));

      try {
        const provider = platform === 'twitter' ? 'twitter' : platform;
        const response = await fetch(`https://unavatar.io/${provider}/${cleanValue}`, {
          method: 'HEAD',
        });

        if (!response.ok) {
          throw new Error('not-found');
        }

        onChange(
          sanitizeSingleSocialLink({
            instagram: platform === 'instagram' ? cleanValue : '',
            tiktok: platform === 'tiktok' ? cleanValue : '',
            twitter: platform === 'twitter' ? cleanValue : '',
          }),
        );
        setVerificationStatus((prev) => {
          const next = { ...prev, [platform]: { status: 'valid' as const } };
          for (const field of SOCIAL_FIELD_IDS) {
            if (field !== platform) {
              next[field] = { status: 'idle' };
            }
          }
          return next;
        });
        toast.success(`${label} connected`);
      } catch {
        setVerificationStatus((prev) => ({
          ...prev,
          [platform]: {
            status: 'error',
            message: 'Handle could not be verified. Check spelling or try again.',
          },
        }));
        toast.warning(`We could not verify ${label}. Please confirm the handle.`);
      }
    },
    [data, onChange]
  );

  const websiteIsValid = validateWebsite(data.website);
  const isCheckingAny = Object.values(verificationStatus).some((state) => state.status === 'checking');
  const canContinue = !isSaving && !isCheckingAny;

  const handleContinue = useCallback(() => {
    const updates: Partial<StoreWizardData> = {};

    for (const platform of SOCIAL_PLATFORMS) {
      const value = data[platform.id as keyof StoreWizardData] as string;
      if (value && !validateUsername(platform.id, value)) {
        updates[platform.id as keyof StoreWizardData] = '' as never;
      }
    }

    if (data.website && !websiteIsValid) {
      updates.website = '';
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }

    onContinue();
  }, [data, onChange, onContinue, websiteIsValid]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex-1 flex items-start justify-center p-3 sm:p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[720px]">
          <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-[color:var(--border-default)]/50 dark:border-purple-500/10 shadow-xl">
            <div className="origin-top scale-[0.92] space-y-5 p-4 sm:scale-100 sm:space-y-8 sm:p-8">
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold text-[color:var(--text-primary)] dark:text-white tracking-tight">
                  Connect Your Socials
                </h1>
                <p className="text-[color:var(--text-secondary)] dark:text-gray-400 text-sm md:text-base">
                  Optionally connect one social profile or your website. You can also skip this step entirely.
                </p>
              </div>

              <div className="space-y-4">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const value = data[platform.id as keyof StoreWizardData] as string;
                  const status = verificationStatus[platform.id] || { status: 'idle' };
                  const isConnected = Boolean(value);
                  const isValid = validateUsername(platform.id, value);
                  const isChecking = status.status === 'checking';
                  const isVerified = status.status === 'valid';
                  const isBlocked =
                    Boolean(connectedSocialPlatform) &&
                    connectedSocialPlatform?.id !== platform.id;

                  return (
                    <div
                      key={platform.id}
                      className={`group rounded-xl border border-[color:var(--border-default)]/50 dark:border-white/5 bg-[color:var(--surface-secondary)]/50 dark:bg-white/[0.02] transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.04] p-4 ${
                        isBlocked ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-4 min-w-[140px]">
                          <div
                            className={`w-10 h-10 rounded-lg ${platform.gradient} flex items-center justify-center text-white shadow-lg`}
                          >
                            {platform.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[color:var(--text-primary)] dark:text-white font-medium flex items-center gap-2">
                              {platform.name}
                              {isConnected && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    isVerified
                                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                      : 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20'
                                  }`}
                                >
                                  {isVerified ? 'Verified' : 'Connected'}
                                </span>
                              )}
                            </span>
                            {!isConnected && (
                              <span className="text-xs text-[color:var(--text-secondary)]">
                                {isBlocked
                                  ? `Disconnect ${connectedSocialPlatform?.name} first`
                                  : 'Connect to display on store'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] text-sm">
                              {platform.prefix}
                            </span>
                            <input
                              type="text"
                              value={value || ''}
                              disabled={isBlocked}
                              onChange={(e) =>
                                handleSocialChange(platform.id, e.target.value)
                              }
                              placeholder={platform.placeholder}
                              className={`w-full bg-[color:var(--surface-secondary)] dark:bg-black/30 border ${
                                !isValid
                                  ? 'border-red-500'
                                  : 'border-[color:var(--field-border)] dark:border-white/10'
                              } rounded-lg py-2 pl-7 pr-4 text-sm text-[color:var(--text-primary)] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all`}
                            />
                          </div>
                          {isConnected ? (
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                                  isVerified
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                                }`}
                              >
                                <Check className="w-4 h-4" />
                              </div>
                              <button
                                onClick={() => handleSocialChange(platform.id, '')}
                                className="text-xs text-[color:var(--text-secondary)] hover:text-red-500 transition-colors underline"
                              >
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                verifySocialHandle(
                                  platform.id as 'instagram' | 'tiktok' | 'twitter',
                                  platform.name
                                )
                              }
                              disabled={isChecking || isBlocked}
                              className="px-4 py-2 rounded-lg bg-[color:var(--surface-muted)] dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-[color:var(--border-default)] dark:border-white/10 text-sm font-medium text-[color:var(--text-primary)] dark:text-white transition-colors inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              {isChecking && <MuseLoader size={16} />}
                              {isChecking ? 'Checking' : 'Connect'}
                            </button>
                          )}
                        </div>
                        {(!isValid || status.status === 'error') && (
                          <p className="text-xs text-red-500 mt-1">
                            {!isValid
                              ? 'Handle format is not allowed for this platform.'
                              : status.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="group rounded-xl border border-[color:var(--border-default)]/50 dark:border-white/5 bg-[color:var(--surface-secondary)]/50 dark:bg-white/[0.02] transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.04] p-4">
                  <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-4">
                    <div className="flex min-w-[120px] items-center gap-3 sm:min-w-[140px] sm:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[color:var(--text-primary)] dark:text-white font-medium flex items-center gap-2">
                          Website
                          {data.website && (
                            <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                              Added
                            </span>
                          )}
                        </span>
                        {!data.website && (
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            Your brand website
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="url"
                        value={data.website || ''}
                        onChange={(e) => onChange({ website: e.target.value })}
                        placeholder="https://yourstore.com"
                        className={`w-full bg-[color:var(--surface-secondary)] dark:bg-black/30 border ${
                          data.website && !websiteIsValid
                            ? 'border-red-500'
                            : 'border-[color:var(--field-border)] dark:border-white/10'
                        } rounded-lg py-2 px-4 text-sm text-[color:var(--text-primary)] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all`}
                      />
                      {data.website ? (
                        <button
                          onClick={() => onChange({ website: '' })}
                          className="p-2 rounded-lg text-[color:var(--text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-lg bg-[color:var(--surface-muted)] dark:bg-white/5 border border-[color:var(--border-default)] dark:border-white/10 text-sm font-medium text-[color:var(--text-primary)] dark:text-white flex items-center">
                          Optional
                        </div>
                      )}
                    </div>
                  </div>
                  {data.website && !websiteIsValid && (
                    <p className="text-xs text-red-500 mt-2">Enter a valid URL that starts with http:// or https://</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 p-4 flex gap-3 items-start">
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-sm text-blue-900 dark:text-blue-100/80">
                  <p>Connect one social profile at a time (optional). Disconnect to switch platforms.</p>
                  <p className="text-xs text-blue-700/80 dark:text-blue-200/70">
                    Handles are checked with public avatar lookups before they are marked connected.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-wider">
                  Potential Trust Badges
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      hasSocialConnected
                        ? 'bg-purple-600/5 border border-purple-500/20'
                        : 'bg-[color:var(--surface-muted)]/50 dark:bg-white/[0.02] border border-[color:var(--border-default)]/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasSocialConnected
                          ? 'bg-purple-600/20 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-[color:var(--text-muted)] dark:text-gray-500'
                      }`}
                    >
                      <Share2 className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        hasSocialConnected
                          ? 'text-[color:var(--text-primary)] dark:text-white'
                          : 'text-[color:var(--text-secondary)] dark:text-gray-400'
                      }`}
                    >
                      Social Connected
                    </span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      hasVerifiedHandle
                        ? 'bg-emerald-500/5 border border-emerald-500/20'
                        : 'bg-[color:var(--surface-muted)]/50 dark:bg-white/[0.02] border border-[color:var(--border-default)]/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasVerifiedHandle
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-[color:var(--text-muted)] dark:text-gray-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-[color:var(--text-secondary)] dark:text-gray-400">
                      Handles Verified
                    </span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      data.website
                        ? 'bg-blue-500/5 border border-blue-500/20'
                        : 'bg-[color:var(--surface-muted)]/50 dark:bg-white/[0.02] border border-[color:var(--border-default)]/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        data.website
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-[color:var(--text-muted)] dark:text-gray-500'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-[color:var(--text-secondary)] dark:text-gray-400">
                      Website Added
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-row items-center justify-between gap-2 border-t border-[color:var(--border-default)]/50 bg-[color:var(--surface-secondary)]/50 p-4 dark:border-white/5 dark:bg-black/20 sm:gap-4 sm:p-6">
              <button
                type="button"
                onClick={onSkip}
                disabled={isSaving}
                className="shrink-0 px-2 py-2 text-xs font-medium text-[color:var(--text-secondary)] transition-colors hover:text-gray-900 disabled:opacity-50 dark:hover:text-white sm:px-4 sm:text-sm"
              >
                Skip
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={isSaving}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border-default)] px-3 py-2 text-xs font-medium text-[color:var(--text-primary)] transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5 sm:gap-2 sm:px-6 sm:py-2.5 sm:text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-8 sm:py-2.5 sm:text-sm"
                >
                  {isSaving ? <MuseLoader size={16} /> : null}
                  {isSaving ? 'Saving...' : 'Continue'}
                  {!isSaving ? <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreSocialStep;
