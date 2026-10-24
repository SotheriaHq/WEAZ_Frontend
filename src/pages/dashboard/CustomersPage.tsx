import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '@/store';
import { getActiveBrandId } from '@/lib/brandAccess';
import { brandCustomersApi } from '@/api/BrandCustomersApi';
import SearchField from '@/components/SearchField';
import { useBrandCommerceAccess } from '@/hooks/useBrandCommerceAccess';

export default function CustomersPage() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const brandId = getActiveBrandId(profile);
  const commerce = useBrandCommerceAccess();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setSearch(''); setDebouncedSearch(''); setPage(1); }, [brandId, profile?.id]);
  const customers = useQuery({
    queryKey: ['brand-customers', profile?.id, brandId, page, debouncedSearch],
    queryFn: ({ signal }) => brandCustomersApi.list(brandId!, { page, search: debouncedSearch }, signal),
    enabled: Boolean(brandId),
    staleTime: 15_000,
    refetchOnMount: true,
  });
  const criteriaExpired = commerce.entitlementExpired;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-theme">Customers</h1>
        <p className="mt-1 text-sm text-theme-secondary">Shoppers with paid orders from your brand. Cancelled and fully refunded orders do not count.</p></div>
      {commerce.canManage ? <Link className="inline-flex min-h-11 items-center rounded-2xl bg-purple-100 px-4 font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-200" to="/settings?tab=store-customers">Customer settings</Link> : null}
    </div>
    <SearchField value={search} onChange={value => { setSearch(value); setPage(1); }} collapsible={false} ariaLabel="Search customers by name or username" placeholder="Search customers…" />
    {customers.isLoading ? <p role="status">Loading customers…</p> : null}
    {customers.isError ? <div role="alert"><p>Customers could not be loaded.</p><button type="button" className="min-h-11 rounded-2xl bg-purple-600 px-4 text-white" onClick={() => void customers.refetch()}>Try again</button></div> : null}
    {criteriaExpired && customers.isFetching ? <p role="status">Updating customer criteria…</p> : null}
    {customers.data ? <>
      <p className="text-sm text-theme-secondary">{customers.data.total} shoppers · {customers.data.settings.effectiveMinimumOrders}+ paid orders</p>
      {customers.data.items.length ? <div className="max-h-[65dvh] overflow-auto">
        <table className="w-full text-left text-sm"><caption className="sr-only">Customers with qualifying paid orders</caption>
          <thead><tr className="text-theme-secondary"><th scope="col" className="p-3">Shopper</th><th scope="col" className="p-3">Orders</th><th scope="col" className="p-3">Last order</th></tr></thead>
          <tbody>{customers.data.items.map(customer => <tr key={customer.id} className="odd:bg-gray-50 dark:odd:bg-zinc-900">
            <td className="break-words rounded-l-2xl p-3 [overflow-wrap:anywhere]"><span className="font-semibold text-theme">{customer.name}</span>{customer.username ? <div className="text-theme-secondary">@{customer.username}</div> : null}</td>
            <td className="p-3 tabular-nums">{customer.orderCount}</td><td className="rounded-r-2xl p-3">{new Date(customer.lastOrderAt).toLocaleDateString()}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="py-10 text-center text-theme-secondary">{debouncedSearch ? 'No shoppers match your search.' : 'No shoppers meet the current purchase threshold yet.'}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={page === 1 || customers.isFetching || search.trim() !== debouncedSearch} onClick={() => setPage(p => p - 1)} className="min-h-11 rounded-2xl bg-gray-100 px-4 disabled:opacity-40 dark:bg-zinc-800">Previous</button>
        <span>Page {page}</span>
        <button type="button" disabled={!customers.data.hasNextPage || customers.isFetching || search.trim() !== debouncedSearch} onClick={() => setPage(p => p + 1)} className="min-h-11 rounded-2xl bg-gray-100 px-4 disabled:opacity-40 dark:bg-zinc-800">Next</button>
      </div>
    </> : null}
  </section>;
}
