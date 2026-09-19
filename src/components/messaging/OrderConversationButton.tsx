import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagingApi, type OrderConversationRef } from '@/api/MessagingApi';
import { useCachedResource } from '@/hooks/useCachedResource';
import { queryClient } from '@/query/queryClient';

type OrderConversationStatus = { exists: boolean; threadId: string | null };

/**
 * Sized to stand level with the controls beside it, not above them. `md` is
 * `BackLink`'s pill geometry to the pixel (`px-4 py-2 text-sm`) so the order
 * header reads as one row of peers; `sm` is the same shape one step down for
 * the inline "Conversation and extension" header.
 */
const SIZE_CLASSES = {
  sm: 'gap-1.5 px-3 py-1.5 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
} as const;

/**
 * The order screen's way into the conversation with that order's brand.
 *
 * The label tells the truth about what a press will do: "Go to conversation"
 * when a window with the brand already exists, "Open conversation" when the
 * press will start one. Either way it lands in the SAME buyer<->brand thread —
 * the messages page opens it through `openOrderConversation`, which reuses the
 * pair thread and links this order into it, never a second window.
 *
 * Styled as the row's primary pill, not as a slab. It previously carried a dark
 * gradient, an inset highlight, a circular icon chip, a drop shadow, a hover
 * lift and two Lucide glyphs — none of which appear anywhere else on the order
 * screen, so it read as imported from another product. It now borrows the
 * system's own solid-primary chip (`bg-purple-600`, the messages filter tabs)
 * at `BackLink`'s pill size, and marks itself with emoji per Rule 5. The trailing
 * arrow mirrors BackLink's leading one: back points left, onward points right.
 */
export function OrderConversationButton({
  order,
  brandName,
  size = 'md',
  className = '',
}: {
  order: OrderConversationRef;
  brandName?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const navigate = useNavigate();
  const param = order.customOrderId ? 'customOrderId' : 'orderId';
  const id = (order.customOrderId ?? order.orderId) as string;
  const queryKey = useMemo(() => ['messaging', 'orderConversation', param, id] as const, [param, id]);

  const { data, loading } = useCachedResource<OrderConversationStatus>({
    queryKey,
    queryFn: ({ signal }) =>
      messagingApi.findOrderConversation(
        param === 'customOrderId' ? { customOrderId: id } : { orderId: id },
        signal,
      ),
    // Short: a press here creates the window, and coming back should say so.
    staleTime: 15_000,
  });

  const exists = data?.exists === true;
  const pending = loading && !data;
  // The label is the whole state signal — a separate "already exists" dot said
  // the same thing a second time, which is one accessory too many in a row that
  // already carries a back pill and an order tag.
  const label = exists ? 'Go to conversation' : 'Open conversation';

  const handleClick = () => {
    // The press opens (or creates) the window, so the next visit to this order
    // must already read "Go to conversation" without waiting on a refetch.
    queryClient.setQueryData<OrderConversationStatus>(queryKey, {
      exists: true,
      threadId: data?.threadId ?? null,
    });
    navigate(`/messages?${param}=${encodeURIComponent(id)}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-busy={pending || undefined}
      aria-label={brandName ? `${label} with ${brandName}` : undefined}
      className={`inline-flex items-center rounded-full bg-purple-600 font-semibold text-white shadow-sm shadow-purple-500/20 transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${SIZE_CLASSES[size]} ${className}`}
    >
      <span aria-hidden>💬</span>
      <span className={pending ? 'animate-pulse opacity-70' : undefined}>{pending ? 'Conversation' : label}</span>
      <span aria-hidden className="opacity-80">→</span>
    </button>
  );
}

/** The "this is a custom order" marker, designed to read as a label, not stray text. */
export function CustomOrderTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200/80 bg-gradient-to-r from-fuchsia-50 to-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-700 shadow-sm dark:border-fuchsia-400/20 dark:from-fuchsia-500/10 dark:to-violet-500/10 dark:text-fuchsia-300 ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500" />
      Custom order
    </span>
  );
}
