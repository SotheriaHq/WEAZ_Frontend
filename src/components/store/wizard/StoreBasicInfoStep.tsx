import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import type { StoreWizardData } from '@/pages/store/StoreCreationWizard';
import StoreLivePreview from './StoreLivePreview';

interface StoreBasicInfoStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onSaveDraft: () => Promise<void> | void;
  onContinue: () => Promise<void> | void;
  isSavingDraft: boolean;
  isLoadingDraft: boolean;
}

const CATEGORIES = [
  { value: 'african', label: 'African Fashion' },
  { value: 'western', label: 'Western Fashion' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'sustainable', label: 'Sustainable' },
  { value: 'plus-size', label: 'Plus Size' },
  { value: 'modest', label: 'Modest Fashion' },
];

const MAX_CATEGORIES = 3;

type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable';

/**
 * Store Basic Info Step (Screen 1.2)
 * Step 1 of 6: Basic store information with live preview
 * Features: Real-time preview, slug availability check, media uploads
 */
const StoreBasicInfoStep: React.FC<StoreBasicInfoStepProps> = ({
  data,
  onChange,
  onBack,
  onSaveDraft,
  onContinue,
  isSavingDraft,
  isLoadingDraft,
}) => {
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugCheckTimeout, setSlugCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Auto-generate slug when name changes
  const handleNameChange = (value: string) => {
    onChange({ name: value, slug: generateSlug(value) });
  };

  // Check slug availability (simulated for now - always available in demo)
  const checkSlugAvailability = useCallback((slug: string) => {
    if (!slug) {
      setSlugStatus('idle');
      return;
    }

    setSlugStatus('checking');

    // Clear previous timeout
    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout);
    }

    // Simulate API call with debounce - always available for demo
    const timeout = setTimeout(() => {
      // TODO: Replace with actual API call when backend is ready
      setSlugStatus('available');
    }, 800);

    setSlugCheckTimeout(timeout);
  }, [slugCheckTimeout]);

  // Check slug when it changes
  useEffect(() => {
    if (data.slug) {
      checkSlugAvailability(data.slug);
    }
    return () => {
      if (slugCheckTimeout) clearTimeout(slugCheckTimeout);
    };
  }, [data.slug]);

  // Toggle category selection
  const toggleCategory = (value: string) => {
    if (data.categories.includes(value)) {
      onChange({ categories: data.categories.filter(c => c !== value) });
    } else if (data.categories.length < MAX_CATEGORIES) {
      onChange({ categories: [...data.categories, value] });
    }
  };

  // Form validation
  const isValid =
    data.name.trim() &&
    data.slug.trim() &&
    data.categories.length > 0 &&
    data.tagline.trim() &&
    data.description.length >= 100 &&
    data.description.length <= 500 &&
    slugStatus === 'available';

  const handleSaveDraftClick = async () => {
    await onSaveDraft();
  };

  const handleContinueClick = async () => {
    await onContinue();
  };

  const isBusy = isSavingDraft || isLoadingDraft;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
      {/* Left Side - Form Section (60%) */}
      <div className="w-full lg:w-[60%] p-6 lg:p-12 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Slim Step Indicator Bar - Rounded edges, thin */}
          <div className="mb-8 p-3 bg-white/60 dark:bg-white/5 backdrop-blur-lg rounded-full border border-purple-200/30 dark:border-purple-500/20 shadow-sm inline-flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center text-white text-sm font-bold shadow-lg">
              1
            </div>
            <div className="pr-4">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Basic Information</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">• Step 1 of 6</span>
            </div>
          </div>
          
          {/* Header with sharper text */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">
              Create Your Store
            </h1>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Tell us about your brand. This information will be visible to shoppers.</p>
          </div>

          {/* Form Container */}
          <div className="rounded-2xl p-6 lg:p-8 mb-6 bg-gray-50/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10">
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Store Name */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={data.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter your store name"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-gray-500">{data.name.length}/50</span>
                </div>
              </div>

              {/* Store Slug */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                  Store Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                  <span className="px-4 text-gray-500 text-sm">threadly.com/store/</span>
                  <input
                    type="text"
                    value={data.slug}
                    onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="flex-1 bg-transparent py-3 pr-12 text-gray-900 dark:text-white focus:outline-none"
                    placeholder="your-store"
                  />
                  <div className="pr-4">
                    {slugStatus === 'checking' && <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />}
                    {slugStatus === 'available' && <Check className="w-5 h-5 text-green-500" />}
                    {slugStatus === 'unavailable' && <X className="w-5 h-5 text-red-500" />}
                  </div>
                </div>
              </div>

              {/* Categories - Multi-select chips (max 3) */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-white">
                  Categories <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Select up to {MAX_CATEGORIES})</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = data.categories.includes(cat.value);
                    const isDisabled = !isSelected && data.categories.length >= MAX_CATEGORIES;
                    
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => toggleCategory(cat.value)}
                        disabled={isDisabled}
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 backdrop-blur-sm
                          ${isSelected
                            ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10'
                            : isDisabled
                              ? 'bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-600 border border-gray-200/50 dark:border-gray-700/50 cursor-not-allowed'
                              : 'bg-white/60 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-white/10 hover:border-purple-400/50 dark:hover:border-purple-500/30 hover:bg-purple-50/50 dark:hover:bg-purple-500/10'
                          }
                        `}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1.5 -ml-1" />}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                {data.categories.length > 0 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {data.categories.length} of {MAX_CATEGORIES} selected
                  </p>
                )}
              </div>

              {/* Tagline */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                  Tagline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={data.tagline}
                  onChange={(e) => onChange({ tagline: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Your brand in one line"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Your brand in one line</span>
                  <span className="text-xs text-gray-500">{data.tagline.length}/100</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  minLength={100}
                  maxLength={500}
                  value={data.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  placeholder="Tell customers about your store..."
                />
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${data.description.length < 100 ? 'text-amber-500' : 'text-gray-500'}`}>
                    Minimum 100 characters
                  </span>
                  <span className="text-xs text-gray-500">{data.description.length}/500</span>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="rounded-2xl p-6 bg-gray-50/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Progress</span>
                <span className="text-purple-600 font-medium">Step 1 of 6</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-purple-700 h-full rounded-full transition-all duration-300"
                  style={{ width: '16.66%' }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={onBack}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleSaveDraftClick}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium inline-flex items-center gap-2"
                  disabled={isBusy}
                >
                  {isSavingDraft && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleContinueClick}
                  disabled={!isValid || isLoadingDraft}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Live Preview (40%) - Transparent to inherit Layout gradient */}
      <div className="w-full lg:w-[40%] p-6 lg:p-12 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] overflow-y-auto border-l border-gray-200/30 dark:border-white/5">
        <StoreLivePreview data={data} />
      </div>
    </div>
  );
};

export default StoreBasicInfoStep;
