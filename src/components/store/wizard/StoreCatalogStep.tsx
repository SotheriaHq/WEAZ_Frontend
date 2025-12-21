import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Layers,
  Star,
  Sparkles,
  Flame,
  ChevronDown,
  X,
  Palette,
  FolderPlus,
  Check,
} from 'lucide-react';
import type { StoreWizardData, WizardProduct, WizardCollection } from '@/types/storeWizard';

interface StoreCatalogStepProps {
  data: StoreWizardData;
  onChange: (updates: Partial<StoreWizardData>) => void;
  onBack: () => void;
  onContinue: () => void;
  onOpenCreateCollection: () => void;
  onOpenAddProduct: () => void;
  isSaving?: boolean;
}

// Minimum requirements
const MIN_PRODUCTS = 3;
const MIN_COLLECTIONS = 1;

// Quick templates
const QUICK_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic Collection',
    description: 'Timeless pieces for everyday wear',
    icon: Star,
  },
  {
    id: 'new-arrivals',
    name: 'New Arrivals',
    description: 'Latest additions to your store',
    icon: Sparkles,
  },
  {
    id: 'best-sellers',
    name: 'Best Sellers',
    description: 'Your most popular products',
    icon: Flame,
  },
];

/**
 * Store Catalog Step (Screen 1.5/1.6)
 * Step 4 of 6: Add products and create collections
 */
const StoreCatalogStep: React.FC<StoreCatalogStepProps> = ({
  data,
  onChange,
  onBack,
  onContinue,
  onOpenCreateCollection,
  onOpenAddProduct,
  isSaving = false,
}) => {
  const [templatesExpanded, setTemplatesExpanded] = useState(true);

  // Calculate requirements progress
  const productsCount = data.products.length;
  const collectionsCount = data.collections.length;
  const productsComplete = productsCount >= MIN_PRODUCTS;
  const collectionsComplete = collectionsCount >= MIN_COLLECTIONS;
  const requirementsMet = productsComplete && collectionsComplete;

  // Calculate progress percentage
  const progress = useMemo(() => {
    let total = 0;
    // Products contribute 50%
    total += Math.min((productsCount / MIN_PRODUCTS) * 50, 50);
    // Collections contribute 50%
    total += Math.min((collectionsCount / MIN_COLLECTIONS) * 50, 50);
    return Math.round(total);
  }, [productsCount, collectionsCount]);

  // Handle tab change
  const handleTabChange = useCallback(
    (tab: 'collections' | 'looks') => {
      onChange({ catalogActiveTab: tab });
    },
    [onChange]
  );

  // Remove product
  const handleRemoveProduct = useCallback(
    (productId: string) => {
      onChange({
        products: data.products.filter((p) => p.id !== productId),
      });
    },
    [data.products, onChange]
  );

  // Apply template (creates a placeholder collection)
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      const template = QUICK_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;

      const newCollection: WizardCollection = {
        id: `temp-${Date.now()}`,
        name: template.name,
        description: template.description,
        coverImage: '',
        type: 'standard',
        productIds: [],
        featured: false,
        status: 'active',
      };

      onChange({
        collections: [...data.collections, newCollection],
      });
    },
    [data.collections, onChange]
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Build Your Catalog
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                Add your hero products and create your first collection
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Step 4 of 6</div>
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                Catalog Setup
              </div>
            </div>
          </div>

          {/* Requirements Banner */}
          <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 rounded-2xl p-6 sm:p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Requirements to Continue
                </h2>
                <div className="space-y-3">
                  {/* Products requirement */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        productsComplete
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500'
                      }`}
                    >
                      {productsComplete ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Add 3+ hero products
                    </span>
                    <span
                      className={`ml-auto font-semibold ${
                        productsComplete ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {productsCount}/{MIN_PRODUCTS}
                    </span>
                  </div>

                  {/* Collections requirement */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        collectionsComplete
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500'
                      }`}
                    >
                      {collectionsComplete ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Create 1 collection or look
                    </span>
                    <span
                      className={`ml-auto font-semibold ${
                        collectionsComplete ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {collectionsCount}/{MIN_COLLECTIONS}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Ring */}
              <div className="flex items-center justify-center">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg
                    className="transform -rotate-90 w-24 h-24 sm:w-32 sm:h-32"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200 dark:text-gray-800"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      stroke={progress === 100 ? '#22c55e' : '#ef4444'}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={276.46}
                      strokeDashoffset={276.46 - (276.46 * progress) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      {progress}%
                    </div>
                    <div className="text-xs text-gray-500">Complete</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Your Products
              </h2>
              <button
                onClick={onOpenAddProduct}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Existing Products */}
              {data.products.map((product) => (
                <div
                  key={product.id}
                  className="relative group bg-white dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/5 rounded-2xl overflow-hidden"
                >
                  <div className="aspect-square">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </h3>
                    <p className="text-purple-600 dark:text-purple-400 font-semibold">
                      ₦{product.price.toLocaleString()}
                    </p>
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveProduct(product.id)}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Empty Product Cards (show remaining slots) */}
              {Array.from({ length: Math.max(0, MIN_PRODUCTS - productsCount) }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    onClick={onOpenAddProduct}
                    className="bg-gray-50/50 dark:bg-white/[0.02] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[280px] hover:border-purple-500/50 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-all duration-200">
                      <Plus className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      Add Product
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Collections/Looks Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleTabChange('collections')}
                  className={`font-semibold pb-2 border-b-2 transition-colors ${
                    data.catalogActiveTab === 'collections'
                      ? 'text-gray-900 dark:text-white border-purple-600'
                      : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Collections
                </button>
                <button
                  onClick={() => handleTabChange('looks')}
                  className={`font-semibold pb-2 border-b-2 transition-colors ${
                    data.catalogActiveTab === 'looks'
                      ? 'text-gray-900 dark:text-white border-purple-600'
                      : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Looks
                </button>
              </div>
            </div>

            {/* Collections Grid or Empty State */}
            {data.collections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {data.collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="relative group bg-white dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/5 rounded-2xl overflow-hidden"
                  >
                    <div className="aspect-video bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                      {collection.coverImage ? (
                        <img
                          src={collection.coverImage}
                          alt={collection.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Layers className="w-12 h-12 text-purple-500/50" />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {collection.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {collection.productIds.length} products
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 rounded-2xl p-8 sm:p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Layers className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Start Building Your Catalog
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Organize your products into collections or create styled looks
                    to showcase your brand
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={onOpenAddProduct}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                    <button
                      onClick={onOpenCreateCollection}
                      className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Create Collection</span>
                    </button>
                    <button className="bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700">
                      <Palette className="w-4 h-4" />
                      <span>Style a Look</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Templates */}
          <div className="bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-gray-200/50 dark:border-purple-500/10 rounded-2xl p-6 sm:p-8">
            <button
              onClick={() => setTemplatesExpanded(!templatesExpanded)}
              className="w-full flex items-center justify-between mb-6 group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Use Starter Templates
                </h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  templatesExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {templatesExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {QUICK_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-all duration-200">
                      <template.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {template.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {template.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200/50 dark:border-white/5 bg-white/80 dark:bg-white/[0.02] backdrop-blur-xl p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="w-full sm:w-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden min-w-[200px]">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-700 rounded-full transition-all duration-300"
                    style={{ width: '67%' }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center sm:text-left">
                Step 4 of 6 - Catalog Setup
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {!requirementsMet && (
                <p className="text-sm text-red-500 text-center sm:text-right">
                  Complete requirements above to continue
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={onContinue}
                  disabled={!requirementsMet || isSaving}
                  className={`px-8 py-3 rounded-xl font-semibold transition-colors inline-flex items-center gap-2 ${
                    requirementsMet
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
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

export default StoreCatalogStep;
