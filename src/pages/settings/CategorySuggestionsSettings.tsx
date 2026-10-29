import React from 'react';
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions';
import Button from '@/components/ui/Button';
import { CategorySuggestionForm } from '@/components/categories/CategorySuggestionForm';

const CategorySuggestionsSettings: React.FC = () => {
  const query = useCategorySuggestions();
  const requests = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="space-y-6 text-gray-900 dark:text-white">
      <div>
        <h1 className="text-2xl font-semibold">Category requests</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Request a missing garment category and garment type. Design approval and category approval are separate.
          A pending category does not appear in public category search or filters. Category approval never publishes your drafts.
        </p>
      </div>
      <CategorySuggestionForm onSubmitted={() => void query.refetch()} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your requests</h2>
        <Button type="button" variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh requests</Button>
      </div>
      {query.isPending ? <p role="status">Loading category requests…</p> : null}
      {query.isError ? <p role="alert">Your requests could not be loaded. Use Refresh requests to try again.</p> : null}
      {!query.isPending && !query.isError && requests.length === 0 ? <p>No category requests yet.</p> : null}
      <ul className="space-y-4">
        {requests.map((request) => (
          <li key={request.id} className="rounded-2xl p-4 shadow-sm break-words">
            <h3 className="font-semibold">{request.name}</h3>
            {request.garmentTypeName ? <p className="mt-1 text-sm">Garment type: {request.garmentTypeName}</p> : null}
            <p className="mt-1 text-sm">{request.status === 'PENDING' ? '⏳ Awaiting category approval' : request.status === 'APPROVED' ? '✅ Approved category' : '📝 Not approved'}</p>
            {request.description ? <p className="mt-2 text-sm">{request.description}</p> : null}
            {request.rejectionReason ? <p className="mt-2 text-sm">Review feedback: {request.rejectionReason}</p> : null}
          </li>
        ))}
      </ul>
      {query.hasNextPage ? <Button type="button" variant="secondary" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>
        {query.isFetchingNextPage ? 'Loading more requests…' : 'Load more requests'}</Button> : null}
    </section>
  );
};
export default CategorySuggestionsSettings;
