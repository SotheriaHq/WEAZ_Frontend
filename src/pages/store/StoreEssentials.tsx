import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, Sparkles, Store, CheckCircle2, Circle } from 'lucide-react';
import type { RootState } from '@/store';
import { getStoreWizardPrefill, updateStoreProfile } from '@/api/StoreApi';
import Input from '@/components/ui/Input';
import { readStoreProgressLocally, saveStoreProgressLocally } from '@/utils/storeSetup';
import StoreSetupProgress from '@/components/store/StoreSetupProgress';

const MAX_SPECIALIZATIONS = 4;
const MAX_DESCRIPTION = 500;
const BRAND_SPECIALIZATION_OPTIONS = [
  { value: 'womenswear', label: 'Womenswear' },
  { value: 'menswear', label: 'Menswear' },
  { value: 'unisex', label: 'Unisex' },
  { value: 'kidswear', label: 'Kidswear' },
  { value: 'bespoke-made-to-measure', label: 'Bespoke / Made-to-measure' },
  { value: 'couture', label: 'Couture' },
  { value: 'ready-to-wear', label: 'Ready-to-wear' },
  { value: 'bridal', label: 'Bridal' },
  { value: 'traditional-cultural-wear', label: 'Traditional / Cultural wear' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'corporate-formalwear', label: 'Corporate / Formalwear' },
  { value: 'modest-fashion', label: 'Modest fashion' },
];

const normalizeToken = (value: string): string => value.trim().replace(/^#/, '').toLowerCase();

const MAX_TAGLINE = 60;

const firstSentence = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return (trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed).trim();
};

const resolveSuggestedTagline = (options: {
  savedTagline?: string;
  apiTagline?: string;
  description?: string;
  userBrandDescription?: string | null;
  tags?: string[];
}): string => {
  const saved = options.savedTagline?.trim();
  if (saved) return saved.slice(0, MAX_TAGLINE);

  const api = options.apiTagline?.trim();
  if (api) return api.slice(0, MAX_TAGLINE);

  const fromDescription = firstSentence(options.description || '');
  if (fromDescription) return fromDescription.slice(0, MAX_TAGLINE);

  const fromUserDescription = firstSentence(options.userBrandDescription || '');
  if (fromUserDescription) return fromUserDescription.slice(0, MAX_TAGLINE);

  const fromTags = (options.tags || []).slice(0, 3).join(' • ');
  return fromTags.slice(0, MAX_TAGLINE);
};

const normalizeSpecializationSelection = (
  values: string[],
  options: Array<{ value: string; label: string }>
): string[] => {
  if (!values.length) return [];

  const byKey = new Map<string, string>();

  options.forEach((option) => {
    const normalizedValue = normalizeToken(option.value);
    const normalizedLabel = normalizeToken(option.label);
    byKey.set(normalizedValue, option.value);
    byKey.set(normalizedLabel, option.value);
  });

  const result: string[] = [];
  for (const entry of values) {
    const normalizedEntry = normalizeToken(entry);
    const matched = byKey.get(normalizedEntry);
    if (!matched) continue;
    if (result.includes(matched)) continue;
    result.push(matched);
    if (result.length >= MAX_SPECIALIZATIONS) break;
  }

  return result;
};

type StoreEssentialsProgress = {
  categories?: unknown;
  tagline?: unknown;
  description?: unknown;
  essentialsComplete?: unknown;
  setupWizardVersion?: unknown;
};

const StoreEssentials: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selected, setSelected] = useState<string[]>([]);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');

  const brandName = useMemo(() => {
    const fromUser = user?.brandFullName?.trim();
    if (fromUser) return fromUser;
    const fallback = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return fallback || 'Your Brand';
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoading(true);
      try {
        const prefill = await getStoreWizardPrefill();
        if (cancelled) return;

        if (prefill.flags?.hasLiveStore) {
          navigate('/studio/store', { replace: true });
          return;
        }

        /**
         * Store setup STARTS at the start. This page never skips itself.
         *
         * It used to auto-forward to the wizard whenever it judged essentials
         * "already done", and every version of that judgement was wrong for
         * somebody:
         *
         *  - Reading the localStorage flag meant the mobile WebView, whose
         *    storage is not the brand's, jumped straight to the Social step for
         *    brands who had never filled essentials at all.
         *  - Reading the server was accurate but no kinder. A brand whose
         *    description and tags happen to be populated still expects the
         *    first screen of setup to be the first screen of setup.
         *  - Worst of all, the wizard's Back button lands here, so ANY forward
         *    bounced the user straight back to Social. The start of setup was
         *    unreachable and Back looked broken.
         *
         * The cost of not forwarding is one extra tap on Continue for a brand
         * who has already filled this in — and the fields below are prefilled
         * from the server, so there is nothing to redo. That is a far better
         * trade than a flow that can trap someone.
         */

        // Best-effort prefill for quick-start
        const localProgress = readStoreProgressLocally<StoreEssentialsProgress>(
          user?.id,
        );
        const localCategories = Array.isArray(localProgress?.categories)
          ? normalizeSpecializationSelection(
              localProgress.categories.filter(
                (entry): entry is string => typeof entry === 'string',
              ),
              BRAND_SPECIALIZATION_OPTIONS,
            )
          : [];

        /**
         * Chips come pre-selected only from choices made in THIS flow.
         *
         * The original rule was "localStorage only", because brand-profile
         * hashtags had once been mapped onto these chips and users had to
         * unselect choices they never made. That concern stands — but
         * `brand.tags` is not those hashtags: `persistAndContinue` below writes
         * `tags: selected` from this very screen, so the server copy IS the
         * saved essentials selection.
         *
         * It has to be read, too. Now that this page no longer skips itself, a
         * returning brand lands here with their selection intact instead of
         * empty chips they must re-pick to get past `canContinue`. localStorage
         * still wins when present — it is the more recent of the two.
         */
        const serverCategories = normalizeSpecializationSelection(
          Array.isArray(prefill.brand?.tags) ? prefill.brand.tags : [],
          BRAND_SPECIALIZATION_OPTIONS,
        );
        const resolvedCategories = localCategories.length > 0 ? localCategories : serverCategories;

        if (resolvedCategories.length > 0) {
          setSelected(resolvedCategories);
        }

        const resolvedDescription =
          typeof localProgress?.description === 'string' && localProgress.description.trim()
            ? localProgress.description
            : (prefill.brand?.description || user?.brandDescription || '');

        if (typeof localProgress?.description === 'string' && localProgress.description.trim()) {
          setDescription(localProgress.description);
        } else if (prefill.brand?.description) {
          setDescription(prefill.brand.description);
        } else if (user?.brandDescription) {
          setDescription(user.brandDescription);
        }

        setTagline(
          resolveSuggestedTagline({
            savedTagline:
              typeof localProgress?.tagline === 'string' ? localProgress.tagline : undefined,
            apiTagline: prefill.brand?.tagline,
            description: resolvedDescription,
            userBrandDescription: user?.brandDescription,
            tags: resolvedCategories,
          }),
        );
      } catch (error) {
        // If this fails, still render the static brand-positioning options.
        console.error('Failed to load store essentials prefill', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, [navigate, user?.brandDescription, user?.id]);

  useEffect(() => {
    /**
     * Confetti marks STARTING store setup, once.
     *
     * It fired on every mount of this page, and this page is where the wizard's
     * Back button lands — so walking back from Social threw confetti again, and
     * again on every lap. A celebration that repeats on backward navigation
     * stops reading as a celebration and starts reading as a bug.
     *
     * Keyed per brand in sessionStorage: it re-arms for a genuinely new visit
     * (new tab, or after the browser session ends) but never for movement
     * inside the flow. Session rather than local storage so a brand who comes
     * back another day is still greeted.
     */
    if (!user?.id) return;
    const seenKey = `wiez.storeSetup.welcomed:${user.id}`;
    try {
      if (window.sessionStorage.getItem(seenKey)) return;
      window.sessionStorage.setItem(seenKey, '1');
    } catch {
      // Storage unavailable (private mode, restricted WebView). Fall through and
      // celebrate — a duplicate confetti is a smaller failure than none at all.
    }

    const fire = async () => {
      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    };

    void fire();
  }, [user?.id]);

  const specializationOptions = useMemo(() => BRAND_SPECIALIZATION_OPTIONS, []);

  useEffect(() => {
    if (!specializationOptions.length) return;

    setSelected((prev) => {
      const normalized = normalizeSpecializationSelection(prev, specializationOptions);
      const unchanged = normalized.length === prev.length && normalized.every((value, index) => value === prev[index]);
      return unchanged ? prev : normalized;
    });
  }, [specializationOptions]);

  const toggleCategory = useCallback(
    (value: string) => {
      setSelected((prev) => {
        if (prev.includes(value)) return prev.filter((v) => v !== value);
        if (prev.length >= MAX_SPECIALIZATIONS) return prev;
        return [...prev, value];
      });
    },
    []
  );

  const taglineValid = tagline.trim().length > 0;
  const descriptionValid = description.trim().length > 0;
  const canContinue = selected.length > 0 && descriptionValid;
  const canSkip = descriptionValid;

  const persistAndContinue = useCallback(
    async (skipSpecializations: boolean) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      const payload = {
        tags: skipSpecializations ? [] : selected,
        tagline: tagline.trim(),
        description: description.trim(),
      };
      const localProgress = {
        categories: skipSpecializations ? [] : selected,
        tagline: tagline.trim(),
        description: description.trim(),
        step: 1,
        setupWizardVersion: 2,
        essentialsComplete: true,
      };

      try {
        try {
          saveStoreProgressLocally(localProgress, user?.id);
        } catch {
          // ignore storage errors; onboarding can still continue
        }

        try {
          await updateStoreProfile(payload);
        } catch (error) {
          console.error('Failed to save store essentials', error);
          // Don’t block onboarding on transient failures.
        }

        navigate('/studio/store/setup', { replace: true });
      } finally {
        setIsSubmitting(false);
      }
    },
    [description, isSubmitting, navigate, selected, tagline, user?.id]
  );

  const selectedLabels = useMemo(() => {
    const map = new Map(specializationOptions.map((c) => [c.value, c.label]));
    return selected.map((slug) => map.get(slug) ?? slug);
  }, [specializationOptions, selected]);

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)]">
      <main className="min-h-screen flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-4 shadow-lg">
              <Store className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[color:var(--text-primary)] mb-2">
              Welcome,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                {brandName}
              </span>
              !
            </h1>
            <h2 className="text-xl sm:text-2xl font-semibold text-[color:var(--text-primary)] mb-2">
              Let&apos;s Get Your Store Ready
            </h2>
            <p className="text-[color:var(--text-secondary)]">Just a few quick details to jumpstart your store</p>
          </div>

          {/* Same rail the wizard shows — setup is one flow across two pages. */}
          <StoreSetupProgress current="essentials" className="mb-6" />

          {/* Main card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[color:var(--border-default)]">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-lg font-semibold text-[color:var(--text-primary)]">Store Essentials</span>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Brand specialization */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-primary)] mb-2">
                  What best describes your brand?{' '}
                  <span className="text-[color:var(--text-secondary)] font-normal">(Select up to {MAX_SPECIALIZATIONS})</span>
                </label>
                <p className="mb-3 text-xs text-[color:var(--text-secondary)]">
                  Choose up to {MAX_SPECIALIZATIONS}. This helps customers understand your store focus.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`cat-skeleton-${index}`}
                        className="h-[68px] rounded-xl bg-[color:var(--surface-muted)] border border-[color:var(--border-default)] animate-pulse"
                      />
                    ))
                  ) : (
                    specializationOptions.map((cat) => {
                      const isSelected = selected.includes(cat.value);
                      const isDisabled = !isSelected && selected.length >= MAX_SPECIALIZATIONS;

                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => toggleCategory(cat.value)}
                          disabled={isDisabled || isLoading}
                          className={
                            'rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 border-2 ' +
                            (isSelected
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 shadow-lg'
                              : isDisabled
                                ? 'bg-[color:var(--surface-secondary)] text-[color:var(--text-muted)] border-[color:var(--border-default)] cursor-not-allowed opacity-70'
                                : 'bg-[color:var(--surface-secondary)] backdrop-blur-sm border-[color:var(--border-default)] text-[color:var(--text-primary)] hover:border-purple-400 hover:bg-purple-500/10')
                          }
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-center leading-tight">{cat.label}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <p className="text-sm text-[color:var(--text-secondary)]">{selected.length} of {MAX_SPECIALIZATIONS} selected</p>
              </div>

              {/* Tagline */}
              <div>
                <div className="relative">
                  <Input
                    label="Store Tagline"
                    helperText="This appears below your store name"
                    maxLength={100}
                    value={tagline}
                    disabled={isLoading}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Your brand in one line..."
                    charCount={tagline.length}
                    maxCharCount={100}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-[color:var(--text-primary)] mb-2">
                  Store Description <span className="text-purple-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  maxLength={MAX_DESCRIPTION}
                  disabled={isLoading}
                  rows={4}
                  placeholder="Tell shoppers what your brand is about..."
                  className="w-full rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-secondary)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] shadow-sm transition-all duration-200 placeholder:text-[color:var(--text-muted)] focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
                  <span>Required to publish your store.</span>
                  <span>{description.length}/{MAX_DESCRIPTION}</span>
                </div>
              </div>

            </div>

            {/* Live Preview */}
            <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
              <p className="text-xs text-[color:var(--text-secondary)] mb-3 text-center">This is how your store will appear</p>
              <div className="bg-[color:var(--surface-secondary)] border border-[color:var(--border-default)] rounded-xl shadow-lg overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400" />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[color:var(--text-primary)]">{brandName}</h3>
                      <p className="text-sm text-[color:var(--text-secondary)] mt-1 min-h-[20px]">{tagline.trim() || ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedLabels.map((label) => (
                      <span
                        key={label}
                        className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Readiness */}
            <div className="mt-6 p-4 bg-transparent rounded-xl border border-[color:var(--border-default)]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-[color:var(--text-primary)]">Brand Name</span>
                </div>
                <div className="flex items-center gap-2">
                  {canContinue ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)]" />
                  )}
                  <span className={"text-sm " + (canContinue ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]')}>
                    Brand focus (at least 1 required)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {taglineValid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)]" />
                  )}
                  <span className={`text-sm ${taglineValid ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'}`}>
                    Tagline {taglineValid ? '' : '(optional)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {descriptionValid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)]" />
                  )}
                  <span className={"text-sm " + (descriptionValid ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]')}>
                    Description
                  </span>
                </div>
              </div>

              <p className={"text-sm font-semibold mt-3 " + (canContinue ? 'text-green-600 dark:text-green-400' : 'text-[color:var(--text-secondary)]')}>
                {canContinue ? 'Ready to continue!' : 'Add a description and select at least 1 brand focus'}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-row items-center gap-2 sm:gap-4">
              <button
                type="button"
                disabled={!canContinue || isLoading || isSubmitting}
                onClick={() => void persistAndContinue(false)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-4 sm:text-base"
              >
                {isSubmitting ? 'Saving...' : 'Continue to Store Setup'}
                {!isSubmitting ? <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" /> : null}
              </button>
              <button
                type="button"
                disabled={isLoading || !canSkip || isSubmitting}
                onClick={() => void persistAndContinue(true)}
                className="shrink-0 px-3 py-3 text-xs font-medium text-[color:var(--text-secondary)] transition-colors duration-200 hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-4 sm:text-base"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StoreEssentials;
