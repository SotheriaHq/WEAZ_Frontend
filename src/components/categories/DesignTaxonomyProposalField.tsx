import React, { useState } from 'react';
import type { CategorySuggestionDto } from '@/api/CategoriesSuggestionsApi';
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions';
import Button from '@/components/ui/Button';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { CategorySuggestionForm } from './CategorySuggestionForm';
import { HiOutlineSparkles } from 'react-icons/hi2';

export type SelectedTaxonomyProposal = Pick<CategorySuggestionDto, 'id' | 'name' | 'garmentTypeName' | 'status'>;

export const DesignTaxonomyProposalField: React.FC<{
  value: SelectedTaxonomyProposal | null;
  onChange: (value: SelectedTaxonomyProposal | null) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const query = useCategorySuggestions(open || Boolean(value));
  const requests = query.data?.pages.flatMap(page => page.items) ?? [];
  const selectable = requests.filter(request => request.status === 'PENDING' && request.garmentTypeName);

  return (
    <div className="rounded-2xl bg-[#170e28]/70 dark:bg-[#170e28]/70 p-4 border border-white/5 transition-all space-y-3">
      {/* Toggle Header */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setOpen((prev) => !prev);
          }
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-sm shadow-inner">
            <HiOutlineSparkles className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-white">Missing a category or garment type?</h5>
            <p className="text-[11px] text-[var(--text-muted)]">
              Suggest custom taxonomy to expand catalog classification
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className={`wiez-toggle-switch ${open ? 'on' : ''}`}>
          <div className="wiez-toggle-knob" />
        </div>
      </div>

      {/* Selected Proposal Active Banner */}
      {value ? (
        <div className="rounded-xl p-3 bg-purple-950/30 border border-purple-500/20 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-200 flex items-center gap-1.5">
              <span>{value.status === 'REJECTED' ? '📝' : '⏳'}</span>
              <span>{value.status === 'REJECTED' ? 'Suggestion not approved' : 'Category suggestion pending review'}</span>
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="neu-pressed-button text-[11px] py-1 px-2.5 text-purple-300"
            >
              Choose standard category
            </button>
          </div>
          <p className="text-white font-medium">
            {value.name} · {value.garmentTypeName}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Your design can still be created and saved. This custom category will be reviewed alongside your design drop.
          </p>
        </div>
      ) : null}

      {/* Expandable Proposal Form & Requests */}
      {open ? (
        <div className="pt-3 border-t border-white/5 space-y-4">
          {query.isPending ? (
            <p className="text-xs text-[var(--text-muted)]" role="status">
              Loading your previous suggestions…
            </p>
          ) : null}

          {query.isError ? (
            <div className="flex items-center justify-between text-xs text-rose-300 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              <span>Could not load suggestions at this time.</span>
              <button
                type="button"
                className="neu-pressed-button text-[11px] py-1 px-2.5"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {selectable.length > 0 ? (
            <UniversalSelect
              label="Use a previously submitted suggestion"
              value={value?.id ?? ''}
              onChange={(id) => {
                const request = selectable.find((item) => item.id === id);
                if (request) onChange(request);
              }}
              options={selectable.map((request) => ({
                value: request.id,
                label: `${request.name} · ${request.garmentTypeName}`,
              }))}
              disabled={disabled}
              optionAllowWrap
              selectedAllowWrap
            />
          ) : null}

          {query.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              className="text-xs py-1.5"
            >
              Load more suggestions
            </Button>
          ) : null}

          {disabled ? null : (
            <CategorySuggestionForm
              onSubmitted={(request) => {
                onChange(request);
                void query.refetch();
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
