import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Globe,
  Info,
  Share2,
  Shield,
  Zap,
  X,
} from 'lucide-react';
import type { StoreWizardData } from '@/pages/store/StoreCreationWizard';

interface StoreSocialStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

// Social platform configs
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

// Username validation patterns
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

/**
 * Store Social & Verification Step (Screen 1.3)
 * Step 2 of 6: Connect social profiles and verify domain
 */
const StoreSocialStep: React.FC<StoreSocialStepProps> = ({
  data,
  onChange,
  onBack,
  onSkip,
  onContinue,
  isSaving = false,
}) => {
  const [domainExpanded, setDomainExpanded] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Check if any social is connected
  const hasSocialConnected = Boolean(
    data.instagram || data.tiktok || data.twitter || data.website
  );

  // Handle social input change
  const handleSocialChange = useCallback(
    (platform: string, value: string) => {
      const cleanValue = value.startsWith('@') ? value.slice(1) : value;
      onChange({ [platform]: cleanValue } as Partial<StoreWizardData>);
    },
    [onChange]
  );

  // Copy verification token
  const handleCopyToken = useCallback(() => {
    const token = data.domainVerificationToken || 'threadly-verification=demo12345';
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }, [data.domainVerificationToken]);

  // Generate demo token if not present
  const verificationToken =
    data.domainVerificationToken || 'threadly-verification=demo12345';

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Main Content - Centered Card */}
      <div className="flex-1 flex items-start justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[700px]">
          {/* Glass Card Container */}
          <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 shadow-xl">
            {/* Step Progress Header */}
            <div className="px-8 pt-8 pb-4 border-b border-gray-200/50 dark:border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold border border-purple-500/30">
                    2
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">
                    Social & Verification
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Step 2 of 6
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-blue-500 w-1/3 rounded-full transition-all duration-500" />
              </div>
            </div>

            {/* Content Area */}
            <div className="p-8 space-y-8">
              {/* Header Text */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Connect Your Socials
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
                  Help customers find and trust your brand by linking your active
                  profiles.
                </p>
              </div>

              {/* Social Links Section */}
              <div className="space-y-4">
                {/* Social Platform Cards */}
                {SOCIAL_PLATFORMS.map((platform) => {
                  const value = data[platform.id as keyof StoreWizardData] as string;
                  const isConnected = Boolean(value);
                  const isValid = validateUsername(platform.id, value);

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
                                <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                                  Connected
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
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 border border-green-500/20">
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
                              onClick={() => {}}
                              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-white transition-colors"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Website Input */}
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
                          data.website && !validateWebsite(data.website)
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
                        <button className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-white transition-colors">
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Domain Verification Accordion */}
              <div className="rounded-xl border border-gray-200/50 dark:border-white/10 bg-gradient-to-b from-gray-50/50 dark:from-white/[0.05] to-transparent overflow-hidden transition-all duration-300">
                <button
                  onClick={() => setDomainExpanded(!domainExpanded)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-100/50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-gray-900 dark:text-white font-medium text-sm md:text-base">
                        Verify Your Domain
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Add a TXT record to earn a Verified Brand badge
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden md:inline-block px-2 py-1 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20">
                      {data.domainVerificationStatus === 'verified'
                        ? 'VERIFIED'
                        : data.domainVerificationStatus === 'pending'
                        ? 'PENDING'
                        : 'OPTIONAL'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                        domainExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {domainExpanded && (
                  <div className="border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-black/20">
                    <div className="p-5 space-y-4">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700 dark:text-blue-200/80">
                          Add the following TXT record to your DNS configuration
                          to verify ownership of{' '}
                          <span className="text-gray-900 dark:text-white font-medium">
                            {data.website
                              ? new URL(data.website).hostname
                              : 'your domain'}
                          </span>
                          .
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                            Type
                          </label>
                          <div className="bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                            TXT
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                            Host
                          </label>
                          <div className="bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                            @
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                          Value
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value={verificationToken}
                            className="w-full bg-white dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg p-3 pr-12 text-sm text-gray-700 dark:text-gray-300 font-mono"
                          />
                          <button
                            onClick={handleCopyToken}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Copy"
                          >
                            {copiedToken ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <button className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                          Verify Later
                        </button>
                        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-purple-500/20">
                          Check Status
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trust Badges Preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Potential Trust Badges
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Social Connected Badge */}
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

                  {/* Verified Domain Badge */}
                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-xl text-center gap-2 transition-all ${
                      data.domainVerificationStatus === 'verified'
                        ? 'bg-purple-600/5 border border-purple-500/20'
                        : 'bg-gray-100/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        data.domainVerificationStatus === 'verified'
                          ? 'bg-purple-600/20 text-purple-600 dark:text-purple-400'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Verified Domain
                    </span>
                  </div>

                  {/* Fast Responder Badge */}
                  <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-100/50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 text-center gap-2 opacity-60">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Fast Responder
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
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
