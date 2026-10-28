import React, { useState } from 'react';
import type { CategorySuggestionDto } from '@/api/CategoriesSuggestionsApi';
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions';
import Button from '@/components/ui/Button';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { CategorySuggestionForm } from './CategorySuggestionForm';

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
  return <div className="space-y-3">
    {value ? <div className="space-y-2 text-sm leading-6">
      <p role={value.status === 'REJECTED' ? 'alert' : 'status'}>
        {value.status === 'REJECTED' ? '📝 Request not approved' : '⏳ Category review'}: {value.name} · {value.garmentTypeName}
      </p>
      <p>Your design has its own review. This category stays out of public category search until taxonomy approval.</p>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => onChange(null)}>Choose an approved category instead</Button>
    </div> : null}
    <Button type="button" variant="secondary" aria-expanded={open} disabled={disabled} onClick={() => setOpen(previous => !previous)}>
      {open ? 'Close category requests' : 'Missing a category or garment type?'}
    </Button>
    {open ? <div className="space-y-4">
      {query.isPending ? <p role="status">Loading your category requests…</p> : null}
      {query.isError ? <div role="alert"><p>Your requests could not be loaded.</p><Button type="button" variant="secondary" onClick={() => void query.refetch()}>Retry requests</Button></div> : null}
      {selectable.length ? <UniversalSelect label="Use a pending category and garment type" value={value?.id ?? ''}
        onChange={id => { const request = selectable.find(item => item.id === id); if (request) onChange(request); }}
        options={selectable.map(request => ({ value: request.id, label: `${request.name} · ${request.garmentTypeName}` }))}
        disabled={disabled} optionAllowWrap selectedAllowWrap /> : null}
      {query.hasNextPage ? <Button type="button" variant="secondary" disabled={disabled || query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}>Load more requests</Button> : null}
      {disabled ? null : <CategorySuggestionForm onSubmitted={request => { onChange(request); void query.refetch(); setOpen(false); }} />}
    </div> : null}
  </div>;
};
