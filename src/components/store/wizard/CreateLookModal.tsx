import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Upload,
  Image,
  Wand2,
  MousePointer,
  Plus,
  Save,
} from 'lucide-react';
import type { WizardProduct, WizardLook } from '@/types/storeWizard';
import MediaRenderer from '@/components/media/MediaRenderer';

interface CreateLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (look: WizardLook) => void;
  availableProducts: WizardProduct[];
}

interface Hotspot {
  id: string;
  x: number;
  y: number;
  productId: string;
}

/**
 * Create Look Modal (Screen 1.8)
 * Modal for creating styled "looks" with product hotspots
 */
const CreateLookModal: React.FC<CreateLookModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableProducts,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [styledBy, setStyledBy] = useState('Threadly Official');
  const [lookImage, setLookImage] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [featured, setFeatured] = useState(true);
  const [allowSizeSwap, setAllowSizeSwap] = useState(true);
  const [discount] = useState(10);

  // Get tagged products from hotspots
  const taggedProducts = useMemo(() => {
    return hotspots
      .map((h) => availableProducts.find((p) => p.id === h.productId))
      .filter(Boolean) as WizardProduct[];
  }, [hotspots, availableProducts]);

  // Calculate pricing
  const subtotal = useMemo(() => {
    return taggedProducts.reduce((sum, p) => sum + p.price, 0);
  }, [taggedProducts]);

  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  // Handle image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setLookImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  // Handle click on image to add hotspot
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (availableProducts.length === 0) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // For now, add first available product as default
      const newHotspot: Hotspot = {
        id: `hotspot-${Date.now()}`,
        x,
        y,
        productId: availableProducts[0].id,
      };

      setHotspots((prev) => [...prev, newHotspot]);
    },
    [availableProducts]
  );

  // Remove tagged product
  const handleRemoveProduct = useCallback((productId: string) => {
    setHotspots((prev) => prev.filter((h) => h.productId !== productId));
  }, []);

  // Form validation
  const isValid = name.trim() && lookImage && taggedProducts.length > 0;

  // Handle save
  const handleSave = useCallback(() => {
    if (!isValid) return;

    const newLook: WizardLook = {
      id: `look-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      image: lookImage || '',
      styledBy,
      productIds: taggedProducts.map((p) => p.id),
      hotspots: hotspots.map((h) => ({ x: h.x, y: h.y, productId: h.productId })),
      featured,
      allowSizeSwap,
      discount,
    };

    onSave(newLook);
    onClose();
  }, [
    isValid,
    name,
    description,
    lookImage,
    styledBy,
    taggedProducts,
    hotspots,
    featured,
    allowSizeSwap,
    discount,
    onSave,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT: Image Editor */}
        <div className="w-full lg:w-5/12 bg-gray-100 dark:bg-slate-950/50 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/10 p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Look Media
          </h2>

          {/* Image Area */}
          <div
            onClick={lookImage ? handleImageClick : undefined}
            className="relative w-fit max-w-full max-h-[60vh] overflow-y-auto bg-gray-200 dark:bg-slate-800 rounded-xl border border-gray-300 dark:border-white/5 shadow-inner cursor-crosshair group"
          >
            {lookImage ? (
              <>
                <MediaRenderer
                  kind="image"
                  src={lookImage}
                  alt="Look"
                  maxHeightClassName="max-h-[60vh]"
                  className="rounded-xl"
                  mediaClassName="rounded-xl"
                />
                {/* Hotspots */}
                {hotspots.map((hotspot) => {
                  const product = availableProducts.find(
                    (p) => p.id === hotspot.productId
                  );
                  return (
                    <div
                      key={hotspot.id}
                      className="absolute group/spot z-10"
                      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                    >
                      <div className="w-4 h-4 bg-purple-600 rounded-full border-2 border-white cursor-pointer animate-pulse" />
                      {product && (
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-gray-900/90 dark:bg-slate-900/90 backdrop-blur text-xs px-3 py-1.5 rounded-md border border-white/10 whitespace-nowrap opacity-0 group-hover/spot:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl text-white">
                          {product.name}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Instruction */}
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                  <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/10 inline-flex items-center gap-1">
                    <MousePointer className="w-3 h-3" />
                    Click to add product hotspot
                  </span>
                </div>
              </>
            ) : (
              <div
                onClick={() => document.getElementById('look-upload')?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 dark:text-slate-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Click to upload look image
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  3:4 aspect ratio recommended
                </p>
              </div>
            )}
            <input
              id="look-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          {/* Controls */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => document.getElementById('look-upload')?.click()}
              className="flex-1 py-2.5 px-4 rounded-lg bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 text-sm font-medium transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-white"
            >
              <Upload className="w-4 h-4" />
              Replace Image
            </button>
            <button className="flex-1 py-2.5 px-4 rounded-lg bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 text-sm font-medium transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-white">
              <Wand2 className="w-4 h-4" />
              Auto-Detect
            </button>
          </div>
        </div>

        {/* RIGHT: Details & Products */}
        <div className="w-full lg:w-7/12 p-6 lg:p-8 flex flex-col h-full max-h-[80vh] lg:max-h-none">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create New Look
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
              Draft
            </span>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 space-y-8 overflow-y-auto pr-2 -mr-2 pb-6">
            {/* Basic Info */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Look Name <span className="text-purple-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Urban Minimalist Fall Edit"
                    className="w-full bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Styled By
                  </label>
                  <div className="relative">
                    <select
                      value={styledBy}
                      onChange={(e) => setStyledBy(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all appearance-none cursor-pointer text-gray-900 dark:text-white"
                    >
                      <option>Threadly Official</option>
                      <option>Brand Owner</option>
                      <option>Guest Stylist</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the vibe, occasion, or styling tips..."
                  className="w-full bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600"
                />
              </div>
            </div>

            {/* Tagged Products */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Tagged Products ({taggedProducts.length})
                </label>
                <button className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-white transition-colors font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Add Product Manually
                </button>
              </div>

              {taggedProducts.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-slate-500 text-sm">
                  Click on the image to add product hotspots
                </div>
              ) : (
                <div className="space-y-3">
                  {taggedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all"
                    >
                      <div className="max-h-12 max-w-12 rounded-lg overflow-y-auto flex-shrink-0">
                        <MediaRenderer
                          kind="image"
                          src={product.image}
                          alt={product.name}
                          maxHeightClassName="max-h-12"
                          maxWidthClassName="max-w-12"
                          className="rounded-lg"
                          mediaClassName="rounded-lg"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {product.name}
                          </h4>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ₦{product.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            Default • Size M
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            In Stock
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            {taggedProducts.length > 0 && (
              <div className="bg-gray-50 dark:bg-slate-950/30 rounded-xl p-4 border border-gray-200/50 dark:border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    Subtotal ({taggedProducts.length} items)
                  </span>
                  <span className="text-sm text-gray-600 dark:text-slate-300">
                    ₦{subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    Look Discount ({discount}%)
                  </span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">
                    - ₦{discountAmount.toLocaleString()}
                  </span>
                </div>
                <div className="h-px bg-gray-200 dark:bg-white/10 my-3" />
                <div className="flex justify-between items-center">
                  <div>
                    <span className="block text-base font-bold text-gray-900 dark:text-white">
                      Total Look Price
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-500">
                      All sizes available for shipping
                    </span>
                  </div>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    ₦{total.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Visibility Settings */}
            <div className="space-y-4 pt-2">
              <label className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Visibility & Settings
              </label>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    Featured Look
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    Promote this look on the homepage feed
                  </p>
                </div>
                <button
                  onClick={() => setFeatured(!featured)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    featured ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                      featured ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    Allow Size Swapping
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    Suggest similar items if sizes are out of stock
                  </p>
                </div>
                <button
                  onClick={() => setAllowSizeSwap(!allowSizeSwap)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    allowSizeSwap
                      ? 'bg-purple-600'
                      : 'bg-gray-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                      allowSizeSwap ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 mt-auto flex items-center justify-end gap-4 border-t border-gray-200 dark:border-white/10">
            <button
              onClick={onClose}
              className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className={`text-sm font-semibold py-2.5 px-6 rounded-lg transition-all inline-flex items-center gap-2 ${
                isValid
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
                  : 'bg-gray-300 dark:bg-slate-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Save Look
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLookModal;
