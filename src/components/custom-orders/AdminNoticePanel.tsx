/**
 * Notes from WIEZ about one order, read-only.
 *
 * The brand has had this since admin reminders shipped: ADMIN-authored timeline
 * events shown in a panel with an acknowledge control and no reply box. The
 * shopper had no equivalent, so the only way an admin could reach them was the
 * thread they share with the brand — which is the wrong place for "we are looking
 * into your complaint about this maker".
 *
 * One-way is the point, not a limitation. Mediation needs a different sentence
 * for each side, and a reply box here would quietly become a second support
 * inbox nobody is staffed to read.
 */
import React from 'react';
import type { CustomOrderTimelineEvent } from '@/api/CustomOrderApi';
import { humanizeCustomOrderToken } from './customOrderFormatting';

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The admin-authored events a shopper is meant to read, newest first. */
export function selectBuyerAdminNotices(
  events: CustomOrderTimelineEvent[] | undefined,
): Array<{ id: string; createdAt: string; title: string; body: string | null }> {
  if (!Array.isArray(events)) return [];

  return events
    .filter((event) => {
      if (String(event.actorType).toUpperCase() !== 'ADMIN') return false;
      const type = String(event.eventType).toUpperCase();
      if (type === 'ADMIN_NOTICE_SENT') {
        // A note written to the brand alone is not the shopper's to read.
        const payload = isRecord(event.payloadJson) ? event.payloadJson : {};
        const audience = String(payload.audience ?? '').toUpperCase();
        return audience === 'BUYER' || audience === 'BOTH';
      }
      return type === 'ADMIN_INTERVENTION_RESOLVED';
    })
    .map((event) => {
      const payload = isRecord(event.payloadJson) ? event.payloadJson : {};
      const note = typeof payload.note === 'string' ? payload.note.trim() : '';
      const type = String(event.eventType).toUpperCase();
      return {
        id: event.id,
        createdAt: event.createdAt,
        title:
          type === 'ADMIN_INTERVENTION_RESOLVED'
            ? '✅ WIEZ closed its review'
            : '📣 A note from WIEZ',
        body: note.length > 0 ? note : null,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export const AdminNoticePanel: React.FC<{
  notices: ReturnType<typeof selectBuyerAdminNotices>;
  hasUnread?: boolean;
  busy?: boolean;
  /** Admin is actively steering the order; shown even with no notes yet. */
  interventionReason?: string | null;
  interventionOpen?: boolean;
  onAcknowledge: () => void;
}> = ({
  notices,
  hasUnread = false,
  busy = false,
  interventionReason,
  interventionOpen = false,
  onAcknowledge,
}) => {
  if (notices.length === 0 && !interventionOpen) return null;

  return (
    <section className="rounded-[28px] border border-amber-300/70 bg-amber-50/80 p-5 dark:border-amber-500/30 dark:bg-amber-500/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-amber-950 dark:text-amber-50">
            {interventionOpen ? 'WIEZ is reviewing this order' : 'Notes from WIEZ'}
          </h3>
          <p className="mt-1 text-[13px] text-amber-900/80 dark:text-amber-100/80">
            {interventionOpen
              ? 'Someone at WIEZ is working on this with the maker. You will hear from us here.'
              : 'Updates from WIEZ about this order. You do not need to reply.'}
            {interventionReason
              ? ` Reason: ${humanizeCustomOrderToken(interventionReason).toLowerCase()}.`
              : ''}
          </p>
        </div>
        {hasUnread ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAcknowledge}
            className="rounded-full bg-amber-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-amber-100 dark:text-amber-950"
          >
            {busy ? 'Saving…' : 'Mark as read'}
          </button>
        ) : null}
      </div>

      {notices.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className="rounded-2xl bg-white/70 px-4 py-3 dark:bg-white/[0.06]"
            >
              <div className="text-[13px] font-semibold text-amber-950 dark:text-amber-50">
                {notice.title}
              </div>
              {notice.body ? (
                <p className="mt-1 break-words text-[13px] text-amber-900/90 dark:text-amber-100/90">
                  {notice.body}
                </p>
              ) : null}
              <div className="mt-1 text-[11px] text-amber-900/60 dark:text-amber-100/60">
                {formatDateTime(notice.createdAt)}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
};

export default AdminNoticePanel;
