import React, { useState, useCallback } from 'react';
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
import VLoader from '@/components/loaders/VLoader';

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

  const hasSocialConnected = Boolean(
    data.instagram || data.tiktok || data.twitter || data.website
  );
  const hasVerifiedHandle = Object.values(verificationStatus).some((state) => state.status === 'valid');

  const handleSocialChange = useCallback(
    (platform: string, value: string) => {
      const cleanValue = value.startsWith('@') ? value.slice(1) : value;
      onChange({ [platform]: cleanValue } as Partial<StoreWizardData>);
      setVerificationStatus((prev) => ({
        ...prev,
        [platform]: { status: 'idle' },
      }));
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

        onChange({ [platform]: cleanValue } as Partial<StoreWizardData>);
        setVerificationStatus((prev) => ({
          ...prev,
          [platform]: { status: 'valid' },
        }));
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex-1 flex items-start justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[720px]">
          <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 shadow-xl">
            <div className="p-8 space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Connect Your Socials
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
                  Help customers find and trust your brand by linking active profiles.
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

                  return (
                    <div
                      key={platform.id}
                      className="group rounded-xl border border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.04] p-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex items-center gap-4 min-w-[140px]">
                          <div
                            className={`w-10 h-10 rounded-lg ${platform.gradient} flex items-center justify-center text-white shadow-lg`}
                          >
                            {platform.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 dark:text-white font-medium flex items-center gap-2">
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
                              <span className="text-xs text-gray-500">
                                Connect to display on store
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                              {platform.prefix}
                            </span>
                            <input
                              type="text"
                              value={value || ''}
                              onChange={(e) =>
                                handleSocialChange(platform.id, e.target.value)
                              }
                              placeholder={platform.placeholder}
                              className={`w-full bg-white dark:bg-black/30 border ${
                                !isValid
                                  ? 'border-red-500'
                                  : 'border-gray-300 dark:border-white/10'
                              } rounded-lg py-2 pl-7 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all`}
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
                                className="text-xs text-gray-500 hover:text-red-500 transition-colors underline"
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
                              disabled={isChecking}
                              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-white transition-colors inline-flex items-center gap-2 disabled:opacity-60"
                            >
                              {isChecking && <VLoader size={16} phase="loading" showLabel={false} />}
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

                <div className="group rounded-xl border border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.04] p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-[140px]">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-white font-medium flex items-center gap-2">
                          Website
                          {data.website && (
                            <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                              Added
                            </span>
                          )}
                        </span>
                        {!data.website && (
                          <span className="text-xs text-gray-500">
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
                        className={`w-full bg-white dark:bg-black/30 border ${
                          data.website && !websiteIsValid
                            ? 'border-red-500'
                            : 'border-gray-300 dark:border-white/10'
                        } rounded-lg py-2 px-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all`}
                      />
                      {data.website ? (
                        <button
                          onClick={() => onChange({ website: '' })}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-white flex items-center">
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
                  <p>We verify handles using free public avatar lookups (unavatar.io) before marking them as connected.</p>
                  <p className="text-xs text-blue-700/80 dark:text-blue-200/70">No DNS/domain steps needed—just add active socials.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Potential Trust Badges
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      hasSocialConnected
                        ? 'bg-purple-600/5 border border-purple-500/20'
                        : 'bg-gray-100/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasSocialConnected
                          ? 'bg-purple-600/20 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <Share2 className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        hasSocialConnected
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Social Connected
                    </span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      hasVerifiedHandle
                        ? 'bg-emerald-500/5 border border-emerald-500/20'
                        : 'bg-gray-100/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        hasVerifiedHandle
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Handles Verified
                    </span>
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      data.website
                        ? 'bg-blue-500/5 border border-blue-500/20'
                        : 'bg-gray-100/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        data.website
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Website Added
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
              <button
                onClick={onSkip}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors px-4 py-2"
              >
                Skip for now
              </button>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={onBack}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={onContinue}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none px-8 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
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
