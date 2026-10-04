/**
 * One queue over two tables.
 *
 * Disputes live in two unrelated models. `CustomOrderDispute` is where
 * everything the PLATFORM raises lands — a rejected extension, a reported
 * delay, a complaint about what arrived — and `Dispute` is the generic record
 * an admin creates by hand. The console only ever read the second one, so the
 * Disputes page was empty while real disputes piled up invisibly behind it.
 *
 * Merging them in the client rather than the API is deliberate: they are
 * genuinely different records with different actions, different permissions and
 * different lifecycles, and flattening them server-side would mean inventing a
 * lowest common denominator that fits neither. What an admin needs is one place
 * to LOOK; what the code needs is to keep the two kinds honest about what they
 * are. So: a shared row shape for the table, a `kind` discriminator for the
 * actions, and no pretence that a generic dispute can be claimed the way an
 * order dispute can.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { adminDisputesApi } from '@/api/AdminApi';
import { customOrdersAdminApi, type DisputeQueueRow } from '@/api/CustomOrderApi';
import type { AdminDispute } from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';

export type DisputeKind = 'ORDER' | 'GENERAL';

export interface UnifiedDisputeRow {
  key: string;
  kind: DisputeKind;
  id: string;
  /** What this is about, in one line. */
  title: string;
  subtitle: string | null;
  status: string;
  reason: string;
  openedAt: string;
  /** Null when nobody holds it. */
  ownerId: string | null;
  ownerLabel: string;
  /** Past its claim deadline and still unowned. Order disputes only. */
  overdue: boolean;
  /** The original, for whichever detail view handles this kind. */
  order?: DisputeQueueRow;
  generic?: AdminDispute;
}

function describeReason(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function mapOrderDispute(row: DisputeQueueRow): UnifiedDisputeRow {
  return {
    key: `order:${row.id}`,
    kind: 'ORDER',
    id: row.id,
    title: row.order?.title ?? 'Custom order',
    // The buyer's name was the single most-missed field on every admin screen:
    // without it an admin cannot tell whose problem they are looking at.
    subtitle: row.order
      ? [row.order.buyerName ?? row.order.buyerEmail, row.order.brandName]
          .filter(Boolean)
          .join(' · ')
      : null,
    status: row.status,
    reason: describeReason(row.reasonType),
    openedAt: row.openedAt,
    ownerId: row.claimedByAdminId,
    ownerLabel: row.claimedByAdminId ? 'Claimed' : 'Unclaimed',
    overdue: row.claimOverdue,
    order: row,
  };
}

function mapGenericDispute(row: AdminDispute): UnifiedDisputeRow {
  const reporter = row.reporter
    ? `${row.reporter.firstName} ${row.reporter.lastName}`.trim() || row.reporter.email
    : null;
  return {
    key: `general:${row.id}`,
    kind: 'GENERAL',
    id: row.id,
    title: row.description.slice(0, 80) || 'Dispute',
    subtitle: reporter ? `Reported by ${reporter}` : null,
    status: row.status,
    reason: describeReason(row.type),
    openedAt: row.createdAt,
    ownerId: row.assignedToId,
    ownerLabel: row.assignedToId ? 'Assigned' : 'Unassigned',
    // The generic model has no claim deadline, so it can never be "overdue"
    // in this sense. Showing a false negative beats inventing a SLA it has not
    // agreed to.
    overdue: false,
    generic: row,
  };
}

export interface DisputeQueueFilters {
  ownership: '' | 'unclaimed' | 'mine' | 'others' | 'overdue';
  kind: '' | DisputeKind;
  search: string;
}

export function useUnifiedDisputeQueue(filters: DisputeQueueFilters) {
  const [rows, setRows] = useState<UnifiedDisputeRow[]>([]);
  const [counts, setCounts] = useState({ unclaimed: 0, mine: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /*
        Both sources, settled independently.

        `Promise.all` would mean one failing endpoint empties the whole queue —
        and the generic list is the one that has always worked, so a new bug in
        the order queue would take the working half down with it.
      */
      const wantsOrders = filters.kind !== 'GENERAL';
      const wantsGeneric =
        filters.kind !== 'ORDER' &&
        // An ownership filter is a property of the claim model, which only
        // order disputes have. Applying it would silently include generic rows
        // that cannot answer the question being asked.
        !filters.ownership;

      const [orderResult, genericResult] = await Promise.allSettled([
        wantsOrders
          ? customOrdersAdminApi.getDisputeQueue({
              limit: 50,
              ...(filters.ownership ? { ownership: filters.ownership } : {}),
              ...(filters.search ? { search: filters.search } : {}),
            })
          : Promise.resolve(null),
        wantsGeneric ? adminDisputesApi.list({ limit: '50' }) : Promise.resolve(null),
      ]);

      const next: UnifiedDisputeRow[] = [];

      if (orderResult.status === 'fulfilled' && orderResult.value) {
        next.push(...orderResult.value.items.map(mapOrderDispute));
        setCounts(orderResult.value.counts);
      }

      if (genericResult.status === 'fulfilled' && genericResult.value) {
        const data = unwrapApiResponse<
          { items?: AdminDispute[] } | AdminDispute[]
        >(genericResult.value.data as never);
        const items = Array.isArray(data) ? data : (data.items ?? []);
        next.push(...items.map(mapGenericDispute));
      }

      if (
        orderResult.status === 'rejected' &&
        genericResult.status === 'rejected'
      ) {
        throw new Error('Disputes could not be loaded.');
      }

      // Worst first: anything past its deadline, then oldest. An admin working
      // a queue should not have to sort it themselves to find the breach.
      next.sort((left, right) => {
        if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
        return Date.parse(left.openedAt) - Date.parse(right.openedAt);
      });

      setRows(next);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Disputes could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters.kind, filters.ownership, filters.search]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return rows;
    const term = filters.search.trim().toLowerCase();
    // The order queue filters server-side; generic rows are filtered here so
    // one search box behaves the same way over both kinds.
    return rows.filter(
      (row) =>
        row.title.toLowerCase().includes(term) ||
        (row.subtitle ?? '').toLowerCase().includes(term),
    );
  }, [rows, filters.search]);

  return { rows: filtered, counts, loading, error, reload: load };
}
