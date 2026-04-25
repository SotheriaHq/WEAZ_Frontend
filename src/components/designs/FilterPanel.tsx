import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import FrostedButton from '../ui/FrostedButton';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
}

export interface FilterState {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

const FilterPanel: React.FC<FilterPanelProps> = ({ isOpen, onClose, onApply, initialFilters }) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  if (!isOpen) return null;

  const handleReset = () => {
    const resetState: FilterState = {
      minPrice: undefined,
      maxPrice: undefined,
      sort: 'newest',
    };
    setFilters(resetState);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Sort */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Sort By</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'newest', label: 'Newest Arrivals' },
                { id: 'popular', label: 'Most Popular' },
                { id: 'price_asc', label: 'Price: Low to High' },
                { id: 'price_desc', label: 'Price: High to Low' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setFilters(prev => ({ ...prev, sort: option.id as any }))}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                    filters.sort === option.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-gray-50 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* Price Range */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Price Range</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">Min Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.minPrice ?? ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full pl-7 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-transparent rounded-xl focus:bg-white dark:focus:bg-black focus:border-primary focus:ring-0 transition-all text-sm"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">Max Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Any"
                    value={filters.maxPrice ?? ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full pl-7 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-transparent rounded-xl focus:bg-white dark:focus:bg-black focus:border-primary focus:ring-0 transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <FrostedButton
            className="flex-1 justify-center"
            onClick={() => {
              onApply(filters);
              onClose();
            }}
          >
            Show Results
          </FrostedButton>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
