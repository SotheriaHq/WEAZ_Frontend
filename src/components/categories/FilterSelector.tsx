import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiX } from "react-icons/fi";
import { type FilterDimensionOption } from "@/api/BrandApi";
import { useQuery } from '@tanstack/react-query';
import { creatorFiltersOptions, EMPTY_CREATOR_FILTERS } from '@/query/creatorMetadataQueries';
import InfoTooltip from "@/components/ui/InfoTooltip";
import Button from "@/components/ui/Button";
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
  const { data: allDimensions = EMPTY_CREATOR_FILTERS, isLoading: loading, isError: refreshFailed, refetch } = useQuery(creatorFiltersOptions);
  const loadError = refreshFailed && allDimensions.length === 0;
  const dimensions = useMemo(() => sortDimensions(allDimensions.filter((dimension) =>
    appliesToEntity(dimension, entityType) &&
    !LEGACY_DISCOVERY_DIMENSION_SLUGS.has(String(dimension.slug ?? '').trim().toLowerCase()),
  )), [allDimensions, entityType]);
  const [expandedDimensionId, setExpandedDimensionId] = useState<string | null>(
    null,
  );
  const [searchByDimension, setSearchByDimension] = useState<
    Record<string, string>
  >({});

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
    <div className="rounded-lg border border-dashed border-[color:var(--wiez-border-subtle)] bg-[color:var(--wiez-surface-subtle)] px-3 py-2 text-xs text-[color:var(--wiez-text-secondary)]">
      {message}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-10 rounded-lg bg-[color:var(--wiez-surface-subtle)]"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return <div className="space-y-2">
      {renderNonBlockingState("Style details could not load. You can save a draft, but choose at least one before going live.")}
      <Button variant="brand" size="sm" onClick={() => void refetch()}>Retry style details</Button>
    </div>;
  }

  if (dimensions.length === 0) {
    return renderNonBlockingState(
      "No active style details are available right now. You can save a draft and try again before going live.",
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center text-sm font-medium text-[color:var(--wiez-text-primary)]">
          Style details
          <InfoTooltip text={CREATOR_METADATA_HELP.style} />
        </label>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-[color:var(--wiez-action-brand)]">
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="overflow-hidden neu-recessed-card divide-y divide-[color:var(--wiez-border-subtle)]">
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
                      <span className="text-sm font-medium text-[color:var(--wiez-text-primary)]">
                        {label}
                      </span>
                      {helpText && <InfoTooltip text={helpText} />}
                      {!dim.isMulti && (
                        <span className="rounded bg-[color:var(--wiez-surface-subtle)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--wiez-text-tertiary)]">
                          Single
                        </span>
                      )}
                      {hasSelection && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--wiez-action-brand)] px-1 text-[10px] font-bold text-white">
                          {selectedValues.length}
                        </span>
                      )}
                    </div>
                    {hasSelection && (
                      <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-4 text-[color:var(--wiez-text-secondary)]">
                        {selectedLabels.slice(0, 2).join(", ")}
                        {selectedLabels.length > 2
                          ? ` +${selectedLabels.length - 2}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <FiChevronDown
                    className={`h-4 w-4 text-[color:var(--wiez-text-tertiary)] transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {hasSelection && (
                  <button
                    type="button"
                    onClick={() => clearDimension(dim.id)}
                    disabled={disabled}
                    className="rounded-full p-1.5 transition-colors hover:bg-[color:var(--wiez-surface-subtle)] disabled:opacity-50"
                    title="Clear selection"
                    aria-label={`Clear ${label}`}
                  >
                    <FiX className="h-3.5 w-3.5 text-[color:var(--wiez-text-tertiary)]" />
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
                    <div className="border-t border-[color:var(--wiez-border-subtle)] bg-[color:var(--wiez-surface-subtle)] px-3 py-2.5">
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
                          className="mb-2 w-full rounded-lg border border-[color:var(--wiez-border-default)] bg-[color:var(--wiez-surface-page)] px-2.5 py-1.5 text-xs text-[color:var(--wiez-text-primary)] placeholder:text-[color:var(--wiez-text-placeholder)] focus:border-[color:var(--wiez-border-focus)] focus:outline-none"
                        />
                      )}
                      <div className="max-h-44 overflow-y-auto pr-1 scrollbar-wiez-strong">
                        <div className="grid grid-cols-2 gap-1.5">
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
                                    ? "neu-inset-chip selected border-[color:var(--neu-border)] bg-[color:var(--wiez-action-brand-subtle,rgba(147,51,234,0.1))] text-[color:var(--wiez-action-brand,#9333ea)]"
                                    : "neu-pressed-button text-[color:var(--wiez-text-primary)]"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? "border-[color:var(--wiez-action-brand)] bg-[color:var(--wiez-action-brand)] text-white"
                                      : "border-[color:var(--wiez-border-default)] text-transparent"
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  ) : null}
                                </span>
                                <span className="whitespace-normal break-words leading-tight text-left">{val.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {dim.description && (
                        <p className="mt-2 text-[11px] text-[color:var(--wiez-text-secondary)]">
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
