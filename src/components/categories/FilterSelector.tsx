import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiX } from "react-icons/fi";
import { brandApi, type FilterDimensionOption } from "@/api/BrandApi";
import InfoTooltip from "@/components/ui/InfoTooltip";
import {
  CREATOR_FILTER_DIMENSION_ORDER,
  CREATOR_METADATA_HELP,
  LEGACY_DISCOVERY_DIMENSION_SLUGS,
  getDiscoveryDimensionHelp,
  getDiscoveryDimensionLabel,
} from "@/utils/creatorMetadata";
import { FILTER_TAG_SUGGESTIONS } from "./filterTagSuggestions";

export interface FilterSelection {
  /** Map of dimensionId to selected FilterValue IDs. */
  [dimensionId: string]: string[];
}

interface FilterSelectorProps {
  value: FilterSelection;
  onChange: (selection: FilterSelection) => void;
  entityType?: "DESIGN" | "COLLECTION" | "PRODUCT";
  disabled?: boolean;
  onTagSuggestions?: (tags: string[]) => void;
}

const appliesToEntity = (
  dimension: FilterDimensionOption,
  entityType: NonNullable<FilterSelectorProps["entityType"]>,
) => {
  const appliesTo = Array.isArray(dimension.appliesTo) ? dimension.appliesTo : [];
  return (
    appliesTo.includes(entityType) ||
    (entityType === "DESIGN" && appliesTo.includes("COLLECTION"))
  );
};

const sortDimensions = (dimensions: FilterDimensionOption[]) => {
  const preferredOrder = new Map<string, number>(
    CREATOR_FILTER_DIMENSION_ORDER.map((slug, index) => [slug, index]),
  );

  return [...dimensions].sort((left, right) => {
    const leftOrder =
      preferredOrder.get(String(left.slug ?? "").toLowerCase()) ?? 999;
    const rightOrder =
      preferredOrder.get(String(right.slug ?? "").toLowerCase()) ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
};

const FilterSelector: React.FC<FilterSelectorProps> = ({
  value,
  onChange,
  entityType = "COLLECTION",
  disabled = false,
  onTagSuggestions,
}) => {
  const [dimensions, setDimensions] = useState<FilterDimensionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedDimensionId, setExpandedDimensionId] = useState<string | null>(
    null,
  );
  const [searchByDimension, setSearchByDimension] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadError(false);
        const fetched = await brandApi.getFilterDimensions();
        if (!mounted) return;

        const applicable = fetched.filter((dimension) => {
          const slug = String(dimension.slug ?? "").trim().toLowerCase();
          return (
            appliesToEntity(dimension, entityType) &&
            !LEGACY_DISCOVERY_DIMENSION_SLUGS.has(slug)
          );
        });

        setDimensions(sortDimensions(applicable));
      } catch (error) {
        console.error("Failed to load filter dimensions", error);
        if (mounted) {
          setDimensions([]);
          setLoadError(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [entityType]);

  useEffect(() => {
    if (!onTagSuggestions) return;

    const suggestions = new Set<string>();
    for (const dim of dimensions) {
      const selectedIds = value[dim.id] ?? [];
      for (const val of dim.values) {
        if (selectedIds.includes(val.id)) {
          const tags = FILTER_TAG_SUGGESTIONS[val.slug];
          if (tags) tags.forEach((tag: string) => suggestions.add(tag));
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
    const next = current.includes(valueId)
      ? current.filter((id) => id !== valueId)
      : isMulti
        ? [...current, valueId]
        : [valueId];

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

  const renderNonBlockingState = (message: string) => (
    <div className="rounded-lg border border-dashed border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-theme-secondary dark:border-white/10 dark:bg-white/[0.03]">
      {message}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-10 rounded-lg bg-gray-200/50 dark:bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return renderNonBlockingState(
      "Style details could not load. You can save a draft, but choose at least one before going live.",
    );
  }

  if (dimensions.length === 0) {
    return renderNonBlockingState(
      "No active style details are available right now. You can save a draft and try again before going live.",
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
          Style details
          <InfoTooltip text={CREATOR_METADATA_HELP.style} />
        </label>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200/60 bg-white/50 divide-y divide-gray-200/70 dark:border-white/10 dark:bg-white/[0.03] dark:divide-white/10">
        {dimensions.map((dim) => {
          const isExpanded = expandedDimensionId === dim.id;
          const selectedValues = value[dim.id] ?? [];
          const hasSelection = selectedValues.length > 0;
          const label = getDiscoveryDimensionLabel(dim.slug, dim.name);
          const helpText = getDiscoveryDimensionHelp(dim.slug);
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
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleDimension(dim.id)}
                  disabled={disabled}
                  className="flex flex-1 items-center justify-between gap-3 text-left disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {label}
                      </span>
                      {helpText && <InfoTooltip text={helpText} />}
                      {!dim.isMulti && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:bg-white/10 dark:text-gray-500">
                          Single
                        </span>
                      )}
                      {hasSelection && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
                          {selectedValues.length}
                        </span>
                      )}
                    </div>
                    {hasSelection && (
                      <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                        {selectedLabels.slice(0, 2).join(", ")}
                        {selectedLabels.length > 2
                          ? ` +${selectedLabels.length - 2}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <FiChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {hasSelection && (
                  <button
                    type="button"
                    onClick={() => clearDimension(dim.id)}
                    disabled={disabled}
                    className="rounded-full p-1.5 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:hover:bg-white/20"
                    title="Clear selection"
                    aria-label={`Clear ${label}`}
                  >
                    <FiX className="h-3.5 w-3.5 text-gray-500" />
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
                    <div className="border-t border-gray-200/60 bg-gray-50/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                      {dim.values.length > 8 && (
                        <input
                          type="text"
                          value={searchByDimension[dim.id] ?? ""}
                          onChange={(event) =>
                            setSearchByDimension((prev) => ({
                              ...prev,
                              [dim.id]: event.target.value,
                            }))
                          }
                          placeholder={`Search ${label.toLowerCase()}...`}
                          className="mb-2 w-full rounded-lg border border-gray-300/60 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-gray-200"
                        />
                      )}
                      <div className="max-h-44 overflow-y-auto pr-1 scrollbar-threadly-strong">
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
                                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isSelected
                                    ? "border-purple-400/70 bg-purple-50 text-purple-700 dark:border-purple-400/60 dark:bg-purple-500/10 dark:text-purple-300"
                                    : "border-gray-200/70 bg-white text-gray-700 hover:border-purple-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-purple-500/40"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? "border-purple-500 bg-purple-500 text-white dark:border-purple-400"
                                      : "border-gray-300 text-transparent dark:border-white/30"
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  ) : null}
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
