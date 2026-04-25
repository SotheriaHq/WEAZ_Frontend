import React, { useState, useCallback } from 'react';
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
} from 'lucide-react';
import type { StoreWizardData, WizardCollection } from '@/types/storeWizard';
import MediaRenderer from '@/components/media/MediaRenderer';

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
  // Check if requirements are met (for informational purposes only)
  const requirementsMet = productsComplete && collectionsComplete;

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

          {/* Optional Progress Banner - Compact */}
          {(productsCount > 0 || collectionsCount > 0) && (
            <div className="bg-purple-50/50 dark:bg-purple-500/5 border border-purple-200/50 dark:border-purple-500/10 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Products:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{productsCount}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300 dark:bg-gray-700" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Collections:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{collectionsCount}</span>
                  </div>
                </div>
                {requirementsMet && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                    ✓ Ready
                  </span>
                )}
              </div>
            </div>
          )}

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
                  <MediaRenderer
                    kind="image"
                    src={product.image}
                    alt={product.name}
                    maxHeightClassName="max-h-64"
                    className="mx-auto"
                  />
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

              {/* Empty state - show only when no products */}
              {productsCount === 0 && (
                <div
                  onClick={onOpenAddProduct}
                  className="col-span-full bg-gray-50/50 dark:bg-white/[0.02] border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-all">
                    <Plus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium mb-1">No products yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Click to add your first product</p>
                </div>
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
                    <div className="relative overflow-y-auto bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center">
                      {collection.coverImage ? (
                        <MediaRenderer
                          kind="image"
                          src={collection.coverImage}
                          alt={collection.name}
                          maxHeightClassName="max-h-40"
                          className="mx-auto"
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
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center sm:text-right">
                  You can add products later from your dashboard
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
                  disabled={isSaving}
                  className="px-8 py-3 rounded-xl font-semibold transition-colors inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {requirementsMet ? 'Continue' : 'Skip for Now'}
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
