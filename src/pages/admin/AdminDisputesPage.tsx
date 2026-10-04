/**
 * The dispute queue.
 *
 * This page used to read only the generic `Dispute` table — the one an admin
 * populates by hand — while every dispute the PLATFORM raises lands in
 * `CustomOrderDispute`. A shopper rejecting a request for more time opened a
 * dispute, flipped the order to DISPUTED, and raised an admin intervention,
 * and none of it appeared here. The page was not broken; it was reading the
 * wrong half of the system.
 *
 * It now shows both, worst-first, with the claim state on the row. Ownership is
 * the point: a dispute nobody holds is a dispute nobody answers for, and the
 * queue exists to make that visible before a SuperAdmin has to be told about it.
 */
import React, { useMemo, useState } from 'react';

import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import type { AdminDispute } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { CreateDisputeModal, DisputeDetailModal } from './modals/DisputeModals';
import DisputeQueueDetailDrawer from './disputes/DisputeQueueDetailDrawer';
import DisputeOwnershipTabs from './disputes/DisputeOwnershipTabs';
import {
  useUnifiedDisputeQueue,
  type DisputeQueueFilters,
  type UnifiedDisputeRow,
} from './disputes/useUnifiedDisputeQueue';

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  ASSIGNED: '📌',
  IN_PROGRESS: '🔵',
  ADMIN_REVIEW: '🔵',
  BRAND_RESPONDED: '🟣',
  AWAITING_PARTY_CONSENT: '⏳',
  RESOLVED: '🟢',
  CLOSED: '⚪',
  REOPENED: '🟠',
};

const KIND_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'ORDER', label: 'Custom orders' },
  { value: 'GENERAL', label: 'Reported by hand' },
];

function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function relativeAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AdminDisputesPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGeneric, setSelectedGeneric] = useState<AdminDispute | null>(null);
  const [selectedOrderDisputeId, setSelectedOrderDisputeId] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState<DisputeQueueFilters>({
    ownership: '',
    kind: '',
    search: '',
  });

  const { rows, counts, loading, error, reload } = useUnifiedDisputeQueue(filters);

  const ownershipChips = useMemo(
    () =>
      [
        { value: '' as const, label: 'Everything', count: null },
        { value: 'overdue' as const, label: '🔴 Overdue', count: counts.overdue },
        { value: 'unclaimed' as const, label: 'Unclaimed', count: counts.unclaimed },
        { value: 'mine' as const, label: 'Mine', count: counts.mine },
        { value: 'others' as const, label: 'Other admins', count: null },
      ],
    [counts],
  );

  const openRow = (row: UnifiedDisputeRow) => {
    if (row.kind === 'ORDER') setSelectedOrderDisputeId(row.id);
    else if (row.generic) setSelectedGeneric(row.generic);
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Disputes' }]} />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚖️ Disputes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every dispute, from custom orders and from manual reports. One admin
            owns a dispute at a time, and ownership can only be handed on.
          </p>
        </div>
        {hasPermission('DISPUTES_RESOLVE') && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary/90"
          >
            Create dispute
          </button>
        )}
      </div>

      {/* Triage first. An admin opening this page is asking "what needs me?",
          not "show me everything in creation order". */}
      <DisputeOwnershipTabs
        tabs={ownershipChips}
        value={filters.ownership}
        onChange={(ownership) => setFilters((prev) => ({ ...prev, ownership }))}
      />

      <div className="flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:w-56">
          <UniversalSelect
            label="Source"
            value={filters.kind}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, kind: value as DisputeQueueFilters['kind'] }))
            }
            options={KIND_OPTIONS}
            placeholder="All sources"
          />
        </div>
        <div className="w-full md:w-80">
          <label
            htmlFor="dispute-search"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Search
          </label>
          <input
            id="dispute-search"
            type="search"
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, search: event.target.value }))
            }
            placeholder="Order, brand or shopper"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">What &amp; who</th>
                <th className="px-3 py-3">Reason</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Opened</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={`border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50 ${
                    row.overdue ? 'bg-red-50/60 dark:bg-red-500/[0.07]' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {STATUS_EMOJI[row.status] ?? '⚪'} {humanizeStatus(row.status)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {row.kind === 'ORDER' ? '📦 Custom order' : '✍️ Reported'}
                  </td>
                  <td className="max-w-xs px-3 py-2.5">
                    <div className="truncate font-medium text-gray-900 dark:text-white">
                      {row.title}
                    </div>
                    {row.subtitle ? (
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {row.subtitle}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-600 dark:text-gray-400">
                    {row.reason}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.overdue ? (
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        🔴 Unclaimed — overdue
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {row.ownerLabel}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                    {relativeAge(row.openedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => openRow(row)}
                      className="text-xs text-primary hover:underline"
                    >
                      {row.kind === 'ORDER' ? 'Open' : 'Manage'}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Nothing here. Try a different filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateDisputeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          void reload();
        }}
      />
      <DisputeDetailModal
        dispute={selectedGeneric}
        open={!!selectedGeneric}
        onClose={() => setSelectedGeneric(null)}
        onUpdated={() => {
          setSelectedGeneric(null);
          void reload();
        }}
      />
      <DisputeQueueDetailDrawer
        disputeId={selectedOrderDisputeId}
        onClose={() => setSelectedOrderDisputeId(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
};

export default AdminDisputesPage;
