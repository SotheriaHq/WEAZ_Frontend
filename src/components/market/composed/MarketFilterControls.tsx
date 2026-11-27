import React, { useId, useState } from 'react';
import type { MarketFacetOption, MarketFacets } from '@/api/MarketV2Api';
import {
  canAddMarketFilterValue,
  toggleMarketDimensionValue,
  toggleMarketListValue,
  withMarketPriceRange,
  type MarketFilters,
  type MarketFulfilment,
  type MarketListFilterKey,
} from '@/features/market-v2/marketFilterState';
import { formatPriceRange, marketFulfilmentLabel } from '@/features/market-v2/appliedFilters';

const VISIBLE_CHIPS = 12;
const FULFILMENTS: MarketFulfilment[] = ['READY_TO_WEAR', 'MADE_TO_ORDER'];

interface ChipProps {
  label: string;
  count?: number | null;
  pressed: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
}

/** A filter chip: one value, pressed or not, with its count in a fixed-width slot. */
export function MarketFilterChip({ label, count, pressed, disabled = false, disabledReason, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onToggle}
      className={`inline-flex min-h-[32px] max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] disabled:cursor-not-allowed ${
        pressed
          ? 'wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-tone-brand-soft font-bold'
          : 'bg-black/[0.05] text-[color:var(--wiez-text-primary)] hover:bg-black/10 disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15'
      }`}
    >
      <span className="break-words">{label}</span>
      {typeof count === 'number' ? (
        <span className="min-w-[1.5rem] text-right tabular-nums text-[11px] font-bold text-[color:var(--wiez-text-secondary)]">
          {count.toLocaleString('en-NG')}
        </span>
      ) : null}
      {disabled && !pressed ? <span className="sr-only">, no items</span> : null}
    </button>
  );
}

/** One facet as a chip group; hidden when the facet has no values. */
export function MarketFacetChipGroup({
  legend,
  options,
  selected,
  canAdd,
  onToggle,
}: {
  legend: string;
  options: readonly MarketFacetOption[];
  selected: readonly string[];
  canAdd: boolean;
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (options.length === 0) return null;
  // Selected values stay visible even when they fall outside the first twelve.
  const visible = expanded
    ? options
    : options.filter((option, index) => index < VISIBLE_CHIPS || selected.includes(option.value));
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--wiez-text-secondary)]">{legend}</legend>
      <div id={listId} className="flex flex-wrap gap-2">
        {visible.map((option) => {
          const pressed = selected.includes(option.value);
          return (
            <MarketFilterChip
              key={option.value}
              label={option.label}
              count={option.count}
              pressed={pressed}
              disabled={!pressed && (option.disabled || !canAdd)}
              disabledReason={option.disabled ? 'No pieces match' : 'Up to 24 filters at once'}
              onToggle={() => onToggle(option.value)}
            />
          );
        })}
      </div>
      {options.length > VISIBLE_CHIPS ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-bold text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:text-purple-300"
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </button>
      ) : null}
    </fieldset>
  );
}

/** Price bands (when the facets have them) and a min/max range form. */
export function MarketPriceGroup({ filters, facets, onChange }: { filters: MarketFilters; facets: MarketFacets | null; onChange: (next: MarketFilters) => void }) {
  const [min, setMin] = useState(filters.priceMin === null ? '' : String(filters.priceMin));
  const [max, setMax] = useState(filters.priceMax === null ? '' : String(filters.priceMax));
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const bands = facets?.price?.bands ?? [];
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = withMarketPriceRange(filters, min, max);
    setInvalid(next === null);
    if (next) onChange(next);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--wiez-text-secondary)]">Price</legend>
      {bands.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {bands.map((band) => {
            const pressed = filters.priceMin === band.min && filters.priceMax === band.max;
            return (
              <MarketFilterChip
                key={`${band.min}-${band.max}`}
                label={formatPriceRange(band.min, band.max)}
                count={band.count}
                pressed={pressed}
                disabled={!pressed && band.count === 0}
                disabledReason="No pieces match"
                onToggle={() => {
                  const next = pressed
                    ? { ...filters, priceMin: null, priceMax: null }
                    : { ...filters, priceMin: band.min, priceMax: band.max };
                  setMin(next.priceMin === null ? '' : String(next.priceMin));
                  setMax(next.priceMax === null ? '' : String(next.priceMax));
                  onChange(next);
                }}
              />
            );
          })}
        </div>
      ) : null}
      <form className="flex flex-wrap items-end gap-2" onSubmit={apply} noValidate>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-[color:var(--wiez-text-secondary)]">
          Min ₦
          <input
            inputMode="decimal"
            value={min}
            onChange={(event) => setMin(event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className="wiez-field-input w-28 rounded-xl px-3 py-2 text-sm font-semibold"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-[color:var(--wiez-text-secondary)]">
          Max ₦
          <input
            inputMode="decimal"
            value={max}
            onChange={(event) => setMax(event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className="wiez-field-input w-28 rounded-xl px-3 py-2 text-sm font-semibold"
          />
        </label>
        <button
          type="submit"
          className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-interactive min-h-[38px] rounded-xl px-3 text-xs font-bold"
        >
          Apply price
        </button>
      </form>
      {invalid ? (
        <p id={errorId} role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          Enter amounts in naira, with the minimum no higher than the maximum.
        </p>
      ) : null}
    </fieldset>
  );
}

export interface MarketFilterControlsProps {
  filters: MarketFilters;
  facets: MarketFacets | null;
  onChange: (next: MarketFilters) => void;
  /** Audience lives in the page header on Market home. */
  showAudience?: boolean;
}

/**
 * Every server facet as filter chips, in one place for the side panel and the
 * phone sheet. Values with no pieces stay visible but disabled, so the list
 * does not shift as filters change; limits the server enforces are enforced
 * here before a request is built.
 */
export function MarketFilterControls({ filters, facets, onChange, showAudience = false }: MarketFilterControlsProps) {
  const canAdd = canAddMarketFilterValue(filters);
  const list = (key: MarketListFilterKey) => (value: string) => onChange(toggleMarketListValue(filters, key, value));
  const fulfilmentOptions: MarketFacetOption[] = FULFILMENTS.map((value) => {
    const facet = facets?.fulfilment.find((option) => option.value === value);
    return {
      value,
      label: marketFulfilmentLabel(value),
      count: facet?.count ?? 0,
      disabled: facets ? !facet || facet.disabled : false,
      categoryId: null,
    };
  });
  const types = facets?.categoryTypes.filter(
    (option) => filters.category.length === 0 || !option.categoryId || filters.category.includes(option.categoryId),
  );
  const onSaleCount = facets?.onSale[0]?.count;
  const inStockCount = facets?.inStockOnly[0]?.count;

  return (
    <div className="space-y-6">
      {showAudience ? (
        <MarketFacetChipGroup legend="Audience" options={facets?.audience ?? []} selected={filters.audience} canAdd={canAdd} onToggle={list('audience')} />
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--wiez-text-secondary)]">How it is made</legend>
        <div className="flex flex-wrap gap-2">
          {fulfilmentOptions.map((option) => {
            const pressed = filters.fulfilment === option.value;
            return (
              <MarketFilterChip
                key={option.value}
                label={option.label}
                count={facets ? option.count : null}
                pressed={pressed}
                disabled={!pressed && (option.disabled || (!canAdd && filters.fulfilment === null))}
                disabledReason={option.disabled ? 'No pieces match' : 'Up to 24 filters at once'}
                onToggle={() =>
                  onChange({ ...filters, fulfilment: pressed ? null : (option.value as MarketFulfilment) })
                }
              />
            );
          })}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--wiez-text-secondary)]">Deals and stock</legend>
        <div className="flex flex-wrap gap-2">
          <MarketFilterChip
            label="On sale"
            count={onSaleCount ?? null}
            pressed={filters.onSale}
            disabled={!filters.onSale && (!canAdd || onSaleCount === 0)}
            disabledReason={onSaleCount === 0 ? 'No pieces match' : 'Up to 24 filters at once'}
            onToggle={() => onChange({ ...filters, onSale: !filters.onSale })}
          />
          <MarketFilterChip
            label="In stock"
            count={inStockCount ?? null}
            pressed={filters.inStockOnly}
            disabled={!filters.inStockOnly && (!canAdd || inStockCount === 0)}
            disabledReason={inStockCount === 0 ? 'No pieces match' : 'Up to 24 filters at once'}
            onToggle={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
          />
        </div>
      </fieldset>
      <MarketPriceGroup key={`${filters.priceMin}-${filters.priceMax}`} filters={filters} facets={facets} onChange={onChange} />
      <MarketFacetChipGroup legend="Category" options={facets?.categories ?? []} selected={filters.category} canAdd={canAdd} onToggle={list('category')} />
      <MarketFacetChipGroup legend="Garment type" options={types ?? []} selected={filters.type} canAdd={canAdd} onToggle={list('type')} />
      <MarketFacetChipGroup legend="Brand" options={facets?.brands ?? []} selected={filters.brand} canAdd={canAdd} onToggle={list('brand')} />
      <MarketFacetChipGroup legend="Colour" options={facets?.colors ?? []} selected={filters.color} canAdd={canAdd} onToggle={list('color')} />
      <MarketFacetChipGroup legend="Size" options={facets?.sizes ?? []} selected={filters.size} canAdd={canAdd} onToggle={list('size')} />
      <MarketFacetChipGroup legend="Tag" options={facets?.tags ?? []} selected={filters.tag} canAdd={canAdd} onToggle={list('tag')} />
      {(facets?.dimensions ?? []).map((dimension) => (
        <MarketFacetChipGroup
          key={dimension.key}
          legend={dimension.name}
          options={dimension.values}
          selected={filters.dimensions[dimension.key] ?? []}
          canAdd={canAdd || (!dimension.isMulti && (filters.dimensions[dimension.key]?.length ?? 0) > 0)}
          onToggle={(value) => onChange(toggleMarketDimensionValue(filters, dimension.key, value, dimension.isMulti))}
        />
      ))}
    </div>
  );
}

export default MarketFilterControls;
