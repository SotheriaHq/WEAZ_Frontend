import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { brandApi, type FilterDimensionOption } from '@/api/BrandApi';
import { FILTER_TAG_SUGGESTIONS } from './filterTagSuggestions';

// =====================
// Types
// =====================

export interface FilterSelection {
  /** Map of dimensionId → array of selected FilterValue IDs */
  [dimensionId: string]: string[];
}

interface FilterSelectorProps {
  /** Currently selected filter values: { dimensionId: valueId[] } */
  value: FilterSelection;
  /** Called when selections change */
  onChange: (selection: FilterSelection) => void;
  /** Entity type context (used to filter which dimensions apply) */
  entityType?: 'COLLECTION' | 'PRODUCT';
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional callback with suggested tags based on selected filters */
  onTagSuggestions?: (tags: string[]) => void;
}

// =====================
// Component
// =====================

const FilterSelector: React.FC<FilterSelectorProps> = ({
  value,
  onChange,
  entityType = 'COLLECTION',
  disabled = false,
  onTagSuggestions,
}) => {
  const [dimensions, setDimensions] = useState<FilterDimensionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  // Fetch filter dimensions on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const fetched = await brandApi.getFilterDimensions();
        if (!mounted) return;
        // Only show dimensions that apply to this entity type
        const applicable = fetched.filter((d) =>
          d.appliesTo.includes(entityType),
        );
        setDimensions(applicable);
        // Auto-expand first 3 dimensions for better UX
        const initialExpanded = new Set(
          applicable.slice(0, 3).map((d) => d.id),
        );
        setExpandedDimensions(initialExpanded);
      } catch (error) {
        console.error('Failed to load filter dimensions', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [entityType]);

  // Generate tag suggestions when filter values change
  useEffect(() => {
    if (!onTagSuggestions) return;

    const suggestions = new Set<string>();
    for (const dim of dimensions) {
      const selectedIds = value[dim.id] ?? [];
      for (const val of dim.values) {
        if (selectedIds.includes(val.id)) {
          const tags = FILTER_TAG_SUGGESTIONS[val.slug];
          if (tags) tags.forEach((t: string) => suggestions.add(t));
        }
      }
    }
    onTagSuggestions(Array.from(suggestions));
  }, [value, dimensions, onTagSuggestions]);

  const toggleDimension = (dimensionId: string) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(dimensionId)) next.delete(dimensionId);
      else next.add(dimensionId);
      return next;
    });
  };

  const toggleValue = (dimensionId: string, valueId: string, isMulti: boolean) => {
    const current = value[dimensionId] ?? [];
    let next: string[];

    if (current.includes(valueId)) {
      // Deselect
      next = current.filter((id) => id !== valueId);
    } else if (isMulti) {
      // Multi-select: add
      next = [...current, valueId];
    } else {
      // Single-select: replace
      next = [valueId];
    }

    onChange({ ...value, [dimensionId]: next });
  };

  const clearDimension = (dimensionId: string) => {
    const next = { ...value };
    delete next[dimensionId];
    onChange(next);
  };

  const selectedCount = Object.values(value).reduce(
    (sum, ids) => sum + ids.length,
    0,
  );

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 rounded-xl bg-gray-200/50 dark:bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (dimensions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          🎨 Filters & Attributes
        </label>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Dimensions accordion */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden divide-y divide-gray-200 dark:divide-white/10">
        {dimensions.map((dim) => {
          const isExpanded = expandedDimensions.has(dim.id);
          const selectedValues = value[dim.id] ?? [];
          const hasSelection = selectedValues.length > 0;

          return (
            <div key={dim.id}>
              {/* Dimension header */}
              <button
                type="button"
                onClick={() => toggleDimension(dim.id)}
                disabled={disabled}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {dim.name}
                  </span>
                  {!dim.isMulti && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10">
                      Pick one
                    </span>
                  )}
                  {hasSelection && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                      {selectedValues.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {hasSelection && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDimension(dim.id);
                      }}
                      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                      title="Clear selection"
                    >
                      <FiX className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                  <FiChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Dimension values */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
                      <div className="flex flex-wrap gap-2">
                        {dim.values.map((val) => {
                          const isSelected = selectedValues.includes(val.id);
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={() => toggleValue(dim.id, val.id, dim.isMulti)}
                              disabled={disabled}
                              className={`
                                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                                ${isSelected
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                                  : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/50 hover:text-purple-700 dark:hover:text-purple-300'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                              `}
                            >
                              {val.name}
                            </button>
                          );
                        })}
                      </div>
                      {dim.description && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {dim.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FilterSelector;
