import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, Sparkles, Store, CheckCircle2, Circle } from 'lucide-react';
import type { RootState } from '@/store';
import { getStoreWizardPrefill, updateStoreProfile } from '@/api/StoreApi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
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
         * Chips come pre-selected ONLY from choices made in this flow, never
         * from `brand.tags`.
         *
         * Reading the server copy assumed `brand.tags` could only have been
         * written by this screen's own `persistAndContinue`. It cannot: the
         * native brand-profile editor writes the same `Brand.tags` column from
         * a much larger vocabulary (`threadly-mobile/src/data/brandTags.ts`),
         * and `Bridal` and `Womenswear` are spelled identically in both lists.
         * So picking them as profile hashtags silently pre-ticked them as store
         * specialisations — choices the brand never made here, arriving already
         * made, on the first screen of setup.
         *
         * That is exactly the failure the original "localStorage only" rule
         * existed to prevent; it came back through a different door once the
         * native editor started writing that column. The cost is that a
         * returning brand re-picks their chips — a visible, correctable tap,
         * unlike a selection made on their behalf that they have to notice
         * before they can undo it.
         */
        if (localCategories.length > 0) {
          setSelected(localCategories);
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
            // Suggestion input only — it shapes proposed copy, it never ticks
            // a chip, so this one may still read the brand's own tags.
            tags: localCategories,
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-4 shadow-lg shadow-purple-500/25">
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
            <p className="text-[color:var(--text-secondary)] text-sm">Just a few quick details to jumpstart your store</p>
          </div>

          {/* Progress Rail */}
          <StoreSetupProgress current="essentials" className="mb-6" />

          {/* Main Card - Elevated Frosted Glass with dual-theme surface, no harsh parent border */}
          <div className="rounded-3xl p-6 sm:p-10 backdrop-blur-2xl bg-white/85 dark:bg-[#13101f]/85 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-300">
            {/* Step Badge */}
            <div className="flex items-center justify-between mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>STEP 1 OF 3 • STORE ESSENTIALS</span>
              </div>
              <span className="text-xs font-medium text-[color:var(--text-muted)]">Core Identity</span>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Brand Specialization */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
                    What best describes your brand? <span className="text-purple-500 ml-1">*</span>
                  </label>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300">
                    {selected.length}/{MAX_SPECIALIZATIONS} selected
                  </span>
                </div>
                <p className="mb-4 text-xs text-[color:var(--text-muted)]">
                  Select up to {MAX_SPECIALIZATIONS} fashion niches to help shoppers discover your designs.
                </p>

                {/* 2-column mobile, 4-column desktop responsive grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`cat-skeleton-${index}`}
                        className="h-[64px] rounded-2xl bg-[color:var(--surface-muted)] animate-pulse"
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
                          aria-pressed={isSelected}
                          className={
                            'group relative rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 text-center ' +
                            (isSelected
                              ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white shadow-[0_4px_16px_rgba(168,85,247,0.38),inset_0_1px_0_rgba(255,255,255,0.45)] scale-[1.02] active:scale-[0.98]'
                              : isDisabled
                                ? 'bg-black/[0.02] dark:bg-white/[0.02] text-[color:var(--text-muted)] opacity-40 cursor-not-allowed border border-transparent'
                                : 'bg-white dark:bg-[#1a1727] text-[color:var(--text-primary)] shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] border border-black/[0.03] dark:border-white/[0.04] hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.5)] active:scale-[0.98]')
                          }
                        >
                          <span className="leading-tight block">{cat.label}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Tagline */}
              <div>
                <Input
                  label="Store Tagline"
                  helperText="A punchy one-liner displayed beneath your store name"
                  maxLength={100}
                  value={tagline}
                  disabled={isLoading}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Modern African luxury and bespoke tailoring"
                  charCount={tagline.length}
                  maxCharCount={100}
                />
              </div>

              {/* Description */}
              <div>
                <Textarea
                  label="Store Description"
                  required
                  helperText="Tell shoppers your design philosophy, materials, and brand story."
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  maxLength={MAX_DESCRIPTION}
                  disabled={isLoading}
                  rows={4}
                  placeholder="Tell shoppers what your brand is about..."
                  charCount={description.length}
                  maxCharCount={MAX_DESCRIPTION}
                />
              </div>
            </div>

            {/* Live Store Preview */}
            <div className="mt-8 p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">Live Store Preview</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300">Shopper View</span>
              </div>
              <div className="bg-white dark:bg-[#181524] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] border border-black/[0.03] dark:border-white/[0.06] overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/20" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[color:var(--text-primary)]">{brandName}</h3>
                      <p className="text-sm text-[color:var(--text-secondary)] mt-1 min-h-[20px]">{tagline.trim() || 'Your tagline will appear here'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedLabels.length > 0 ? (
                      selectedLabels.map((label) => (
                        <span
                          key={label}
                          className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-300 text-xs font-semibold rounded-full border border-purple-500/20"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[color:var(--text-muted)] italic">Select niches above to preview tags</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Readiness Checklist */}
            <div className="mt-6 p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-[color:var(--text-primary)]">Brand Name</span>
                </div>
                <div className="flex items-center gap-2.5">
                  {canContinue ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />
                  )}
                  <span className={`text-xs font-semibold ${canContinue ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'}`}>
                    Brand focus (at least 1 required)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {taglineValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />
                  )}
                  <span className={`text-xs font-semibold ${taglineValid ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'}`}>
                    Tagline {taglineValid ? '' : '(optional)'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {descriptionValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />
                  )}
                  <span className={`text-xs font-semibold ${descriptionValid ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'}`}>
                    Description
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                <p className={`text-xs font-bold ${canContinue ? 'text-emerald-600 dark:text-emerald-400' : 'text-[color:var(--text-secondary)]'}`}>
                  {canContinue ? '✓ Ready to continue!' : 'Select at least 1 brand focus and add a description'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-row items-center gap-3 sm:gap-4">
              <button
                type="button"
                disabled={!canContinue || isLoading || isSubmitting}
                onClick={() => void persistAndContinue(false)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 px-6 py-4 text-sm font-bold text-white shadow-[0_4px_18px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-200 hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
              >
                {isSubmitting ? 'Saving...' : 'Continue to Store Setup'}
                {!isSubmitting ? <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" /> : null}
              </button>
              <button
                type="button"
                disabled={isLoading || !canSkip || isSubmitting}
                onClick={() => void persistAndContinue(true)}
                className="shrink-0 px-4 py-4 text-xs font-semibold text-[color:var(--text-secondary)] transition-colors duration-200 hover:text-[color:var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-2xl disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
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
