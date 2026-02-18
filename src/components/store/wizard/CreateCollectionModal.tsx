import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  X,
  Upload,
  Layers,
  Calendar,
  Gem,
  Box,
  Rocket,
  Search,
  Check,
  GripVertical,
  Eye,
} from 'lucide-react';
import type { WizardProduct, WizardCollection } from '@/types/storeWizard';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collection: WizardCollection) => void;
  availableProducts: WizardProduct[];
}

// Collection types
const COLLECTION_TYPES = [
  { id: 'standard', label: 'Standard Collection', icon: Layers },
  { id: 'seasonal', label: 'Seasonal Drop', icon: Calendar },
  { id: 'limited', label: 'Limited Edition', icon: Gem },
  { id: 'capsule', label: 'Capsule Collection', icon: Box },
] as const;

/**
 * Create Collection Modal (Screen 1.7)
 * Modal for creating a new collection with products
 */
const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableProducts,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [, setCoverFile] = useState<File | null>(null);
  const [collectionType, setCollectionType] = useState<'standard' | 'seasonal' | 'limited' | 'capsule'>('standard');
  const [launchDate, setLaunchDate] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [quantityCap, setQuantityCap] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<WizardProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return availableProducts;
    return availableProducts.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableProducts, searchQuery]);

  // Toggle product selection
  const toggleProduct = useCallback((product: WizardProduct) => {
    setSelectedProducts((prev) => {
      const index = prev.findIndex((p) => p.id === product.id);
      if (index > -1) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  }, []);

  // Check if product is selected
  const isSelected = useCallback(
    (productId: string) => selectedProducts.some((p) => p.id === productId),
    [selectedProducts]
  );

  // Remove product from selection
  const removeProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  // Handle cover image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setCoverFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
          setCoverImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  // Form validation
  const isValid = name.trim() && coverImage;

  // Handle save
  const handleSave = useCallback(() => {
    if (!isValid) return;

    const newCollection: WizardCollection = {
      id: `collection-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      coverImage: coverImage || '',
      type: collectionType,
      productIds: selectedProducts.map((p) => p.id),
      featured,
      status,
      launchDate: collectionType === 'seasonal' ? launchDate : undefined,
      quantityCap: collectionType === 'limited' && quantityCap ? Number(quantityCap) : undefined,
    };

    onSave(newCollection);
    onClose();
  }, [
    isValid,
    name,
    description,
    coverImage,
    collectionType,
    selectedProducts,
    featured,
    status,
    launchDate,
    quantityCap,
    onSave,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="Create collection">
        {/* Backdrop */}
        <div
          className="absolute inset-0 z-layer-overlay bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div ref={dialogRef} tabIndex={-1} className="relative w-full max-w-2xl bg-white dark:bg-zinc-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Collection
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] px-6 py-6 space-y-6">
          {/* Collection Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Collection Name <span className="text-purple-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Essentials 2024"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Description{' '}
              <span className="text-gray-400 dark:text-zinc-500 text-xs">
                (Optional)
              </span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your collection..."
              className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Cover Image <span className="text-purple-500">*</span>
            </label>
            <div
              onClick={() => document.getElementById('cover-upload')?.click()}
              className={`relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all group ${
                coverImage
                  ? 'border-gray-200 dark:border-zinc-700'
                  : 'border-gray-300 dark:border-zinc-700/50'
              } ${coverImage ? '' : 'min-h-40'}`}
            >
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {!coverImage ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-zinc-800/30 group-hover:bg-gray-100/50 dark:group-hover:bg-zinc-800/50 transition-colors">
                  <Upload className="w-10 h-10 text-gray-400 dark:text-zinc-600 mb-3 group-hover:text-purple-500 transition-colors" />
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                    Click to upload cover image
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-600">
                    Recommended: 1200x600px
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <MediaRenderer
                    kind="image"
                    src={coverImage}
                    alt="Cover preview"
                    maxHeightClassName="max-h-48"
                    className="mx-auto"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      Change Image
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {COLLECTION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() =>
                    setCollectionType(
                      type.id as 'standard' | 'seasonal' | 'limited' | 'capsule'
                    )
                  }
                  className={`px-4 py-3 border rounded-xl transition-all text-sm font-medium flex items-center gap-2 ${
                    collectionType === type.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seasonal Drop Settings */}
          {collectionType === 'seasonal' && (
            <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-700/50 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Rocket className="w-4 h-4 text-purple-500" />
                Drop Settings
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-zinc-300 mb-2">
                  Launch Date
                </label>
                <input
                  type="datetime-local"
                  value={launchDate}
                  onChange={(e) => setLaunchDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Show countdown on store
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    Display countdown timer to customers
                  </p>
                </div>
                <button
                  onClick={() => setShowCountdown(!showCountdown)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    showCountdown ? 'bg-purple-600' : 'bg-gray-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      showCountdown ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Notify patchers
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    Send notification when drop goes live
                  </p>
                </div>
                <button
                  onClick={() => setNotifyFollowers(!notifyFollowers)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifyFollowers ? 'bg-purple-600' : 'bg-gray-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      notifyFollowers ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Limited Edition Settings */}
          {collectionType === 'limited' && (
            <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Gem className="w-4 h-4 text-purple-500" />
                Limited Edition Settings
              </h3>
              <label className="block text-sm font-medium text-gray-600 dark:text-zinc-300 mb-2">
                Quantity Cap
              </label>
              <input
                type="number"
                value={quantityCap}
                onChange={(e) => setQuantityCap(e.target.value)}
                placeholder="e.g., 100"
                className="w-full px-4 py-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              />
            </div>
          )}

          {/* Product Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Add Products
            </h3>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="threadly-search-input pl-11"
              />
            </div>

            {/* Product Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product)}
                    className={`relative rounded-xl overflow-hidden cursor-pointer transition-all group ${
                      isSelected(product.id)
                        ? 'ring-2 ring-purple-500 bg-gray-100 dark:bg-zinc-800/50'
                        : 'bg-gray-50 dark:bg-zinc-800/30 hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <MediaRenderer
                      kind="image"
                      src={product.image}
                      alt={product.name}
                      maxHeightClassName="max-h-32"
                      className="mx-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                      <p className="text-xs font-medium text-white truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-300">
                        ₦{product.price.toLocaleString()}
                      </p>
                    </div>
                    {isSelected(product.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-zinc-500">
                <p>No products available</p>
                <p className="text-sm">Add products to your catalog first</p>
              </div>
            )}

            {/* Selected Products List */}
            {selectedProducts.length > 0 && (
              <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Selected Products ({selectedProducts.length})
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    Drag to reorder
                  </p>
                </div>
                <div className="space-y-2">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 bg-white dark:bg-zinc-800/50 rounded-lg p-3 cursor-move hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 dark:text-zinc-600" />
                      <MediaRenderer
                        kind="image"
                        src={product.image}
                        alt={product.name}
                        maxHeightClassName="max-h-10"
                        maxWidthClassName="max-w-10"
                        className="rounded-lg"
                        mediaClassName="rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">
                          ₦{product.price.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProduct(product.id);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visibility Settings */}
          <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-700/50 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-500" />
              Visibility
            </h3>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Featured on store homepage
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                  Show this collection prominently
                </p>
              </div>
              <button
                onClick={() => setFeatured(!featured)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  featured ? 'bg-purple-600' : 'bg-gray-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    featured ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
                Status
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setStatus('active')}
                  className={`flex-1 px-4 py-3 border rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                    status === 'active'
                      ? 'bg-green-600/20 border-green-500 text-green-600 dark:text-green-400'
                      : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Active
                </button>
                <button
                  onClick={() => setStatus('inactive')}
                  className={`flex-1 px-4 py-3 border rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                    status === 'inactive'
                      ? 'bg-gray-600/20 border-gray-500 text-gray-600 dark:text-zinc-300'
                      : 'bg-gray-50 dark:bg-zinc-800/30 border-gray-200 dark:border-zinc-700/50 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <X className="w-4 h-4" />
                  Inactive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-zinc-800/50 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-lg inline-flex items-center gap-2 ${
              isValid
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-purple-500/25 hover:shadow-purple-500/40'
                : 'bg-gray-300 dark:bg-zinc-700 text-gray-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Layers className="w-4 h-4" />
            Create Collection
          </button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
};

export default CreateCollectionModal;
