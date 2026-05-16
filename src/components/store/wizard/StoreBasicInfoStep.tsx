import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreWizardData } from '@/types/storeWizard';
import VLoader from '@/components/loaders/VLoader';


interface StoreBasicInfoStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  availableCategories?: Array<{ id: string; slug: string; name: string }>;
  onBack: () => void;
  onContinue: () => Promise<void> | void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  isLoadingDraft: boolean;
}

const FALLBACK_CATEGORIES = [
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
  { value: 'luxury', label: 'Luxury' },
  { value: 'modest-fashion', label: 'Modest fashion' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'bags', label: 'Bags' },
  { value: 'jewelry', label: 'Jewelry' },
];

/**
 * Store Basic Info Step (Screen 1.2)
 * Step 1 of 4: Basic store information with live preview
 * Features: Real-time preview, slug availability check, media uploads
 */
const StoreBasicInfoStep: React.FC<StoreBasicInfoStepProps> = ({
  data,
  onBack,
  onContinue,
  saveState,
  isLoadingDraft,
}) => {
  const categories = FALLBACK_CATEGORIES;
  const categoryLabelMap = new Map(categories.map((cat) => [cat.value, cat.label]));
  const selectedCategoryLabels = data.categories.map((cat) => categoryLabelMap.get(cat) ?? cat);

  // Validation check with detailed feedback
  const nameValid = data.name.trim().length > 0;
  const slugValid = data.slug.trim().length > 0;
  const categoriesValid = data.categories.length > 0;
  const descriptionValid = data.description.trim().length > 0;
  const isValid = nameValid && slugValid && categoriesValid && descriptionValid;
  const taglineDisplay = data.tagline.trim();
  const descriptionDisplay = data.description.trim();

  const handleContinueClick = async () => {
    if (!isValid) {
      // Show what's missing
      const missing: string[] = [];
      if (!nameValid) missing.push('Store Name');
      if (!slugValid) missing.push('Store Slug');
      if (!categoriesValid) missing.push('At least 1 brand focus (from Essentials)');
      if (!descriptionValid) missing.push('Description (from Essentials)');
      toast.error(`Please complete: ${missing.join(', ')}`);
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
                  <VLoader size={14} phase="loading" showLabel={false} />
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
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">• Step 1 of 4</span>
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

            {/* Essentials Summary */}
            <div className="rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Essentials summary</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    These come from the essentials step. Edit them there if needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-purple-400/50 hover:text-purple-600 transition-colors"
                >
                  Edit essentials
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Brand focus</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCategoryLabels.length > 0 ? (
                      selectedCategoryLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-purple-200/60 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-200"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-amber-600">No brand focus selected yet.</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Tagline</div>
                  <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                    {taglineDisplay || 'Not set yet.'}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Description</div>
                  <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                    {descriptionDisplay || 'Not set yet.'}
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Footer Actions - No container */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Progress</span>
                <span className="text-purple-600 font-medium">Step 1 of 4</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-purple-700 h-full rounded-full transition-all duration-300"
                  style={{ width: '25%' }}
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
                  disabled={isLoadingDraft}
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
