import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { messagingApi, type OrderConversationRef } from '@/api/MessagingApi';
import { useCachedResource } from '@/hooks/useCachedResource';
import { queryClient } from '@/query/queryClient';

type OrderConversationStatus = { exists: boolean; threadId: string | null };

const SIZE_CLASSES = {
  sm: { button: 'gap-1.5 py-1.5 pl-1.5 pr-3 text-xs', chip: 'h-6 w-6', icon: 13 },
  md: { button: 'gap-2 py-1.5 pl-1.5 pr-4 text-sm', chip: 'h-7 w-7', icon: 15 },
} as const;

/**
 * The order screen's way into the conversation with that order's brand.
 *
 * The label tells the truth about what a press will do: "Go to conversation"
 * when a window with the brand already exists, "Open conversation" when the
 * press will start one. Either way it lands in the SAME buyer<->brand thread —
 * the messages page opens it through `openOrderConversation`, which reuses the
 * pair thread and links this order into it, never a second window.
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
  const label = exists ? 'Go to conversation' : 'Open conversation';
  const sizing = SIZE_CLASSES[size];

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
      className={`group inline-flex items-center rounded-full bg-gradient-to-b from-slate-800 to-slate-950 font-semibold text-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-black/10 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:from-white dark:to-slate-200 dark:text-slate-950 dark:ring-white/20 dark:focus-visible:ring-offset-slate-950 ${sizing.button} ${className}`}
    >
      <span
        className={`relative grid shrink-0 place-items-center rounded-full bg-white/15 dark:bg-slate-950/10 ${sizing.chip}`}
      >
        <MessageCircle size={sizing.icon} strokeWidth={2.25} aria-hidden="true" />
        {exists ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-900 dark:ring-slate-100"
          />
        ) : null}
      </span>
      <span className={pending ? 'animate-pulse opacity-70' : undefined}>{pending ? 'Conversation' : label}</span>
      <ArrowRight
        size={sizing.icon}
        strokeWidth={2.25}
        aria-hidden="true"
        className="-ml-0.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
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
