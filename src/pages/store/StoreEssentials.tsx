import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowRight, Sparkles, Store, CheckCircle2, Circle } from 'lucide-react';
import type { RootState } from '@/store';
import { getStoreWizardPrefill, updateStoreProfile } from '@/api/StoreApi';
import Input from '@/components/ui/Input';

const MAX_CATEGORIES = 3;
const MAX_DESCRIPTION = 500;
const LOCAL_PROGRESS_KEY = 'store-progress';

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const normalizeCategorySelection = (
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
    if (result.length >= MAX_CATEGORIES) break;
  }

  return result;
};

const getCategoryEmoji = (nameOrSlug: string): string | null => {
  const value = nameOrSlug.toLowerCase();
  if (value.includes('africa')) return '🌍';
  if (value.includes('street')) return '👟';
  if (value.includes('western')) return '🤠';
  if (value.includes('vintage')) return '🕰️';
  if (value.includes('lux')) return '💎';
  if (value.includes('sustain')) return '🌱';
  if (value.includes('plus')) return '👗';
  if (value.includes('modest')) return '🧕';
  return null;
};

const StoreEssentials: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [isLoading, setIsLoading] = useState(true);
  const [systemCategories, setSystemCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);

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

        setSystemCategories(prefill.system?.categories ?? []);

        // Best-effort prefill for quick-start
        if (prefill.brand?.tagline) setTagline(prefill.brand.tagline);
        if (prefill.brand?.description) setDescription(prefill.brand.description);
        if (prefill.brand?.tags?.length) {
          setSelected(prefill.brand.tags.slice(0, MAX_CATEGORIES));
        }
      } catch (error) {
        // If this fails, still render with empty lists; wizard will have fallback categories.
        console.error('Failed to load store essentials prefill', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    // Confetti once on mount (best-effort)
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
  }, []);

  const categories = useMemo(() => {
    if (systemCategories.length) {
      return systemCategories.map((c) => ({ value: c.slug, label: c.name }));
    }

    return [
      { value: 'african', label: 'African Fashion' },
      { value: 'streetwear', label: 'Streetwear' },
      { value: 'western', label: 'Western Fashion' },
      { value: 'vintage', label: 'Vintage' },
      { value: 'luxury', label: 'Luxury' },
      { value: 'sustainable', label: 'Sustainable' },
      { value: 'plus-size', label: 'Plus Size' },
      { value: 'modest', label: 'Modest Fashion' },
    ];
  }, [systemCategories]);

  useEffect(() => {
    if (!categories.length) return;

    setSelected((prev) => {
      const normalized = normalizeCategorySelection(prev, categories);
      const unchanged = normalized.length === prev.length && normalized.every((value, index) => value === prev[index]);
      return unchanged ? prev : normalized;
    });
  }, [categories]);

  const toggleCategory = useCallback(
    (value: string) => {
      setSelected((prev) => {
        if (prev.includes(value)) return prev.filter((v) => v !== value);
        if (prev.length >= MAX_CATEGORIES) return prev;
        return [...prev, value];
      });
    },
    []
  );

  const descriptionValid = description.trim().length > 0;
  const canContinue = selected.length > 0 && descriptionValid;
  const canSkip = descriptionValid;

  const persistAndContinue = useCallback(
    async (skipCategories: boolean) => {
      const payload = {
        tags: skipCategories ? [] : selected,
        tagline: tagline.trim(),
        description: description.trim(),
      };
      const localProgress = {
        categories: skipCategories ? [] : selected,
        tagline: tagline.trim(),
        description: description.trim(),
        step: 1,
        essentialsComplete: true,
      };

      try {
        localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(localProgress));
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
    },
    [description, navigate, selected, tagline]
  );

  const selectedLabels = useMemo(() => {
    const map = new Map(categories.map((c) => [c.value, c.label]));
    return selected.map((slug) => map.get(slug) ?? slug);
  }, [categories, selected]);

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)]">
      <main className="min-h-screen flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-4 shadow-lg">
              <Store className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Welcome,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                {brandName}
              </span>
              !
            </h1>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">
              Let&apos;s Get Your Store Ready
            </h2>
            <p className="text-gray-600">Just a few quick details to jumpstart your store</p>
          </div>

          {/* Main card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-white/10">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-lg font-semibold text-gray-800 dark:text-white">Store Essentials</span>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What best describes your brand?{' '}
                  <span className="text-gray-500 font-normal">(Select up to {MAX_CATEGORIES})</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`cat-skeleton-${index}`}
                        className="h-[68px] rounded-xl bg-white/60 border border-gray-200 animate-pulse"
                      />
                    ))
                  ) : (
                    categories.map((cat) => {
                      const isSelected = selected.includes(cat.value);
                      const isDisabled = !isSelected && selected.length >= MAX_CATEGORIES;
                      const emoji = getCategoryEmoji(cat.label) ?? getCategoryEmoji(cat.value);

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
                                ? 'bg-white/60 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white/60 backdrop-blur-sm border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50/50')
                          }
                        >
                          <div className="flex flex-col items-center gap-1">
                            {emoji ? <span className="text-xl">{emoji}</span> : null}
                            <span className="text-center leading-tight">{cat.label}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <p className="text-sm text-gray-500">{selected.length} of {MAX_CATEGORIES} selected</p>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Store Description <span className="text-purple-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  maxLength={MAX_DESCRIPTION}
                  disabled={isLoading}
                  rows={4}
                  placeholder="Tell shoppers what your brand is about..."
                  className="w-full rounded-xl border border-gray-300/80 bg-white/80 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-all duration-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Required to publish your store.</span>
                  <span>{description.length}/{MAX_DESCRIPTION}</span>
                </div>
              </div>

            </div>

            {/* Live Preview */}
            <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
              <p className="text-xs text-gray-600 mb-3 text-center">This is how your store will appear</p>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400" />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{brandName}</h3>
                      <p className="text-sm text-gray-600 mt-1 min-h-[20px]">{tagline.trim() || ''}</p>
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
            <div className="mt-6 p-4 bg-transparent rounded-xl border border-gray-200/70 dark:border-white/10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-700">Brand Name</span>
                </div>
                <div className="flex items-center gap-2">
                  {canContinue ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={"text-sm " + (canContinue ? 'text-gray-700' : 'text-gray-500')}>
                    Categories (at least 1 required)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-gray-300" />
                  <span className="text-sm text-gray-400">Tagline (optional)</span>
                </div>
                <div className="flex items-center gap-2">
                  {descriptionValid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={"text-sm " + (descriptionValid ? 'text-gray-700' : 'text-gray-500')}>
                    Description
                  </span>
                </div>
              </div>

              <p className={"text-sm font-semibold mt-3 " + (canContinue ? 'text-green-600' : 'text-gray-400')}>
                {canContinue ? 'Ready to continue!' : 'Add a description and select at least 1 category'}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                disabled={!canContinue || isLoading}
                onClick={() => void persistAndContinue(false)}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Continue to Store Setup
                <ArrowRight className="inline-block w-5 h-5 ml-2" />
              </button>
              <button
                type="button"
                disabled={isLoading || !canSkip}
                onClick={() => void persistAndContinue(true)}
                className="px-6 py-4 text-gray-600 font-medium hover:text-gray-800 transition-colors duration-200"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StoreEssentials;
