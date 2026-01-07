import React from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { StoreWizardData } from '@/types/storeWizard';


interface StoreBasicInfoStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  availableCategories?: Array<{ id: string; slug: string; name: string }>;
  onBack: () => void;
  onContinue: () => Promise<void> | void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  isLoadingDraft: boolean;
}

const MAX_CATEGORIES = 3;

const FALLBACK_CATEGORIES = [
  { value: 'african', label: 'African Fashion' },
  { value: 'western', label: 'Western Fashion' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'sustainable', label: 'Sustainable' },
  { value: 'plus-size', label: 'Plus Size' },
  { value: 'modest', label: 'Modest Fashion' },
];

/**
 * Store Basic Info Step (Screen 1.2)
 * Step 1 of 6: Basic store information with live preview
 * Features: Real-time preview, slug availability check, media uploads
 */
const StoreBasicInfoStep: React.FC<StoreBasicInfoStepProps> = ({
  data,
  onChange,
  availableCategories,
  onBack,
  onContinue,
  saveState,
  isLoadingDraft,
}) => {
  const categories = availableCategories?.length
    ? availableCategories.map((c) => ({ value: c.slug, label: c.name }))
    : FALLBACK_CATEGORIES;

  // Toggle category selection
  const toggleCategory = (value: string) => {
    if (data.categories.includes(value)) {
      onChange({ categories: data.categories.filter(c => c !== value) });
    } else if (data.categories.length < MAX_CATEGORIES) {
      onChange({ categories: [...data.categories, value] });
    }
  };

  // Validation check with detailed feedback
  const nameValid = data.name.trim().length > 0;
  const slugValid = data.slug.trim().length > 0;
  const categoriesValid = data.categories.length > 0;
  const taglineValid = data.tagline.trim().length > 0;
  const descriptionValid = data.description.length >= 100 && data.description.length <= 500;

  const isValid = nameValid && slugValid && categoriesValid && taglineValid && descriptionValid;

  const handleContinueClick = async () => {
    if (!isValid) {
      // Show what's missing
      const missing: string[] = [];
      if (!nameValid) missing.push('Store Name');
      if (!slugValid) missing.push('Store Slug');
      if (!categoriesValid) missing.push('At least 1 category');
      if (!taglineValid) missing.push('Tagline');
      if (!descriptionValid) missing.push('Description (100-500 chars)');
      console.warn('Form invalid. Missing:', missing.join(', '));
      return;
    }
    await onContinue();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Main Form Container */}
      <div className="mx-auto w-full max-w-4xl p-6 lg:p-12">
        <div className="mx-auto max-w-2xl">
          {/* Auto-save indicator */}
          <div className="flex justify-end mb-4">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span>Saved</span>
                </>
              ) : saveState === 'error' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Save issue</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Updates automatically</span>
                </>
              )}
            </div>
          </div>

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
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">
              Create Your Store
            </h1>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Tell us about your brand. This information will be visible to shoppers.</p>
          </div>

          {/* Form Fields - No container, spread across page */}
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6 mb-8">
            {/* Store Name - Locked */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={50}
                value={data.name}
                disabled
                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                placeholder="Pulled from your profile"
              />
              <p className="text-xs text-gray-400 mt-1">Locked from your profile</p>
            </div>

            {/* Store Slug - Locked */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-white">
                Store Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <span className="px-4 text-gray-500 text-sm">threadly.com/store/</span>
                <input
                  type="text"
                  value={data.slug}
                  disabled
                  className="flex-1 bg-transparent py-3 pr-4 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                  placeholder="username"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Locked from your username</p>
            </div>

            {/* Categories */}
            <div>
                <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-white">
                  Categories <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Select up to {MAX_CATEGORIES})</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
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
            <div>
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
            <div>
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

          {/* Footer Actions - No container */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            {/* Progress Bar */}
            <div className="mb-4">
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
    </div>
  );
};

export default StoreBasicInfoStep;
