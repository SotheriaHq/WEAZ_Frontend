import React from 'react';
import { Store, Tag, Info } from 'lucide-react';
import type { StoreWizardData } from '@/types/storeWizard';

interface StoreLivePreviewProps {
  data: StoreWizardData;
}

const CATEGORY_LABELS: Record<string, string> = {
  african: 'African Fashion',
  western: 'Western Fashion',
  streetwear: 'Streetwear',
  vintage: 'Vintage',
  luxury: 'Luxury',
  sustainable: 'Sustainable',
  'plus-size': 'Plus Size',
  modest: 'Modest Fashion',
};

/**
 * Live Preview component for Store Creation
 * Shows real-time preview of store as user fills the form
 */
const StoreLivePreview: React.FC<StoreLivePreviewProps> = ({ data }) => {
  const hasName = Boolean(data.name.trim());
  const hasTagline = Boolean(data.tagline.trim());
  const hasDescription = Boolean(data.description.trim());
  const hasCategories = data.categories && data.categories.length > 0;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Live Preview</h2>
        <p className="text-sm text-gray-500">How customers will see your store</p>
      </div>

      {/* Preview Card */}
      <div className="rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10">
        {/* Banner - Will use brand's existing banner */}
        <div className="h-40 bg-gradient-to-r from-purple-500/20 to-purple-700/20 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-gray-200/50 dark:bg-white/10 flex items-center justify-center">
              <Store className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400 ml-2">Brand banner will be used</p>
          </div>
        </div>

        {/* Store Info */}
        <div className="p-6 relative">
          {/* Logo - Will use brand's existing profile image */}
          <div className="w-24 h-24 rounded-full bg-white dark:bg-[#0f0f0f] border-4 border-gray-100 dark:border-[#1a1a1a] absolute -top-12 left-6 flex items-center justify-center overflow-hidden shadow-lg">
            <Store className="w-8 h-8 text-gray-400" />
          </div>

          <div className="mt-14">
            <h3 className={`text-2xl font-bold mb-1 ${hasName ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
              {data.name || 'Your Store Name'}
            </h3>
            <p className={`text-sm mb-3 ${hasTagline ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
              {data.tagline || 'Your tagline will appear here'}
            </p>
            <p className={`text-sm leading-relaxed ${hasDescription ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'}`}>
              {data.description || 'Your store description will appear here. Tell customers what makes your brand unique.'}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                {hasCategories ? (
                  data.categories.map(cat => (
                    <span
                      key={cat}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-500/30"
                    >
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">Select categories</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Info */}
      <div className="mt-6 rounded-lg p-4 bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-gray-900 dark:text-white mb-1">Preview Updates in Real-Time</p>
            <p className="text-gray-500">Changes you make to the form will instantly reflect in this preview.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreLivePreview;
