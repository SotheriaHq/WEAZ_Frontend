import React, { useState, useEffect } from 'react';
import { X, Filter, RotateCcw, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface FilterState {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  onSale: boolean;
  sortBy: string;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  categories: ProductCategory[];
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters: initialFilters,
  onApply,
  categories,
}) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(initialFilters);

  // Reset local state when drawer opens with new props
  useEffect(() => {
    if (isOpen) {
      setLocalFilters(initialFilters);
    }
  }, [isOpen, initialFilters]);

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    const cleared: FilterState = {
      minPrice: undefined,
      maxPrice: undefined,
      category: 'ALL',
      onSale: false,
      sortBy: 'newest',
    };
    setLocalFilters(cleared);
  };

  // Animation variants
  const drawerVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring' as const, damping: 30, stiffness: 300 }
    },
    exit: { 
      x: '100%', 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-layer-overlay bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Drawer Panel */}
            <motion.div
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed right-0 top-0 bottom-0 z-layer-drawer w-full max-w-sm flex flex-col pointer-events-auto"
            >
              <div className="h-full bg-white dark:bg-zinc-950 shadow-2xl border-l border-gray-100 dark:border-white/10 flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 px-6 border-b border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Category Section */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                         type="button"
                         onClick={() => setLocalFilters(prev => ({ ...prev, category: 'ALL' }))}
                         className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                           localFilters.category === 'ALL' || !localFilters.category
                             ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/25'
                             : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                         }`}
                      >
                        All
                      </button>
                      {categories.map((cat) => {
                        const isSelected = localFilters.category === cat.slug;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setLocalFilters(prev => ({ ...prev, category: isSelected ? 'ALL' : cat.slug }))}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/25'
                                : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Price Range */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Price Range</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase text-gray-500 font-medium mb-1.5 block">Min Price</label>
                        <input
                          type="number"
                          value={localFilters.minPrice ?? ''}
                          onChange={(e) => setLocalFilters(prev => ({ ...prev, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder="0"
                          className="threadly-search-input px-3 py-2.5 text-sm"
                        />
                      </div>
                      <div className="text-gray-400 mt-5">-</div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase text-gray-500 font-medium mb-1.5 block">Max Price</label>
                        <input
                          type="number"
                          value={localFilters.maxPrice ?? ''}
                          onChange={(e) => setLocalFilters(prev => ({ ...prev, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder="Any"
                          className="threadly-search-input px-3 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Status / Sort */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Status</h3>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${localFilters.onSale ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-white/20'}`}>
                        {localFilters.onSale && <Check size={12} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={localFilters.onSale} 
                        onChange={(e) => setLocalFilters(prev => ({ ...prev, onSale: e.target.checked }))}
                        className="hidden" 
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">On Sale Only</span>
                    </label>
                  </section>
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleClear}
                      className="px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </button>
                    <button
                      onClick={handleApply}
                      className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 hover:bg-purple-700 active:scale-[0.98] transition-all"
                    >
                      Show Results
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};
