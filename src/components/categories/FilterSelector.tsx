import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiX } from "react-icons/fi";
import { brandApi, type FilterDimensionOption } from "@/api/BrandApi";
import { FILTER_TAG_SUGGESTIONS } from "./filterTagSuggestions";

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
  entityType?: "COLLECTION" | "PRODUCT";
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
  entityType = "COLLECTION",
  disabled = false,
  onTagSuggestions,
}) => {
  const [dimensions, setDimensions] = useState<FilterDimensionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDimensionId, setExpandedDimensionId] = useState<string | null>(
    null,
  );
  const [searchByDimension, setSearchByDimension] = useState<
    Record<string, string>
  >({});

  // Fetch filter dimensions on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const fetched = await brandApi.getFilterDimensions();
        if (!mounted) return;
        // Only show dimensions that apply to this entity type
        const applicable = fetched.filter(
          (d) =>
            d.appliesTo.includes(entityType) &&
            d.name !== "Designer Location" &&
            d.name !== "Price Range"
        );
        setDimensions(applicable);
      } catch (error) {
        console.error("Failed to load filter dimensions", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
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
    setExpandedDimensionId((prev) =>
      prev === dimensionId ? null : dimensionId,
    );
  };

  const toggleValue = (
    dimensionId: string,
    valueId: string,
    isMulti: boolean,
  ) => {
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
    <div className="space-y-2.5">
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

      {/* Compact dimensions list */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden divide-y divide-gray-200 dark:divide-white/10">
        {dimensions.map((dim) => {
          const isExpanded = expandedDimensionId === dim.id;
          const selectedValues = value[dim.id] ?? [];
          const hasSelection = selectedValues.length > 0;
          const selectedLabels = dim.values
            .filter((val) => selectedValues.includes(val.id))
            .map((val) => val.name);
          const search = (searchByDimension[dim.id] ?? "").trim().toLowerCase();
          const filteredValues = search
            ? dim.values.filter((val) =>
                val.name.toLowerCase().includes(search),
              )
            : dim.values;

          return (
            <div key={dim.id}>
              <div className="flex items-center gap-2 bg-white/80 dark:bg-white/5 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleDimension(dim.id)}
                  disabled={disabled}
                  className="flex flex-1 items-center justify-between gap-3 text-left disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {dim.name}
                      </span>
                      {!dim.isMulti && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10">
                          Single
                        </span>
                      )}
                      {hasSelection && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold px-1">
                          {selectedValues.length}
                        </span>
                      )}
                    </div>
                    {hasSelection && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                        {selectedLabels.slice(0, 2).join(", ")}
                        {selectedLabels.length > 2
                          ? ` +${selectedLabels.length - 2}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <FiChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {hasSelection && (
                  <button
                    type="button"
                    onClick={() => clearDimension(dim.id)}
                    disabled={disabled}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                    title="Clear selection"
                    aria-label={`Clear ${dim.name}`}
                  >
                    <FiX className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] px-3 py-3">
                      {dim.values.length > 8 && (
                        <input
                          type="text"
                          value={searchByDimension[dim.id] ?? ""}
                          onChange={(e) =>
                            setSearchByDimension((prev) => ({
                              ...prev,
                              [dim.id]: e.target.value,
                            }))
                          }
                          placeholder={`Search ${dim.name.toLowerCase()}...`}
                          className="mb-2.5 w-full rounded-lg border border-gray-300/80 dark:border-white/15 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none"
                        />
                      )}
                      <div className="max-h-44 overflow-y-auto scrollbar-threadly-strong pr-1">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {filteredValues.map((val) => {
                            const isSelected = selectedValues.includes(val.id);
                            return (
                              <button
                                key={val.id}
                                type="button"
                                onClick={() =>
                                  toggleValue(dim.id, val.id, dim.isMulti)
                                }
                                disabled={disabled}
                                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors
                                  ${
                                    isSelected
                                      ? "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400/60 dark:bg-purple-500/10 dark:text-purple-300"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-purple-500/40"
                                  }
                                  disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <span
                                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold
                                    ${
                                      isSelected
                                        ? "border-purple-500 bg-purple-500 text-white dark:border-purple-400"
                                        : "border-gray-300 text-transparent dark:border-white/30"
                                    }`}
                                >
                                  v
                                </span>
                                <span className="truncate">{val.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {dim.description && (
                        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
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
