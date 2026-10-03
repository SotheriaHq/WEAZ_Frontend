import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';

/**
 * What the conversation is about, pinned where the conversation is.
 *
 * An order thread used to identify its subject as `Custom Order · 22f7ea82…` —
 * eight characters of a UUID, in the header, above a blank message list. That
 * is enough to tell two threads apart and nothing else: not which piece, not
 * what state it is in, and no way to go and look. A brand writing "we're
 * starting on yours tomorrow" and a shopper with three orders open are then
 * talking about different things.
 *
 * So the reference is the same shape the Runway and Market use when a message
 * is composed from a card: cover, title, and a way through to the thing itself.
 * The difference is that this one is pinned rather than attached to a single
 * message — every message in an order thread is about the same order, so
 * repeating it per bubble would be noise.
 */
export type OrderChatReference = {
  /** The piece the order is for — what a person actually calls it. */
  title: string;
  /** Human order code (`formatCustomOrderCode`), not a raw id. */
  code: string;
  coverUrl?: string | null;
  /** Current lifecycle state, already humanised. */
  statusLabel?: string | null;
  /** Total, buyer name, or whatever identifies this order among its siblings. */
  meta?: string | null;
  /** Opens the order. Omitted where the reader has nowhere to go. */
  onOpen?: () => void;
};

type OrderReferenceCardProps = {
  reference: OrderChatReference;
  className?: string;
};

const OrderReferenceCard: React.FC<OrderReferenceCardProps> = ({
  reference,
  className = '',
}) => {
  const { title, code, coverUrl, statusLabel, meta, onOpen } = reference;

  /*
    A button only when it does something.

    `onOpen` is absent on surfaces with no order page to reach (the admin
    read-only view), and a card that looks pressable but is not is worse than a
    plain one — so the element itself changes rather than just the handler.
  */
  const Element = onOpen ? 'button' : 'div';

  return (
    <Element
      {...(onOpen
        ? { type: 'button' as const, onClick: onOpen, 'aria-label': `Open order ${code}` }
        : {})}
      className={`flex w-full items-center gap-3 rounded-2xl border border-purple-200/70 bg-gradient-to-r from-purple-50/90 to-fuchsia-50/60 px-3 py-2.5 text-left transition dark:border-purple-400/20 dark:from-purple-500/10 dark:to-fuchsia-500/5 ${
        onOpen
          ? 'touch-manipulation [-webkit-tap-highlight-color:transparent] motion-safe:active:scale-[0.99] [@media(hover:hover)]:hover:border-purple-300 [@media(hover:hover)]:hover:shadow-sm'
          : ''
      } ${className}`}
    >
      {coverUrl ? (
        <ImageWithFallback
          src={coverUrl}
          alt={title}
          fallbackName={title}
          fit="cover"
          rounded="xl"
          containerClassName="h-11 w-11 shrink-0 overflow-hidden"
          className="h-11 w-11"
          maxHeightClassName="max-h-11"
        />
      ) : (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg text-white dark:bg-white/10"
          aria-hidden="true"
        >
          🧵
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-purple-600 dark:text-purple-300">
            {code}
          </span>
          {statusLabel ? (
            <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-slate-600 dark:bg-white/10 dark:text-slate-200">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
          {title}
        </p>
        {meta ? (
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{meta}</p>
        ) : null}
      </div>

      {onOpen ? (
        <span
          className="shrink-0 rounded-full border border-purple-300/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:border-purple-400/30 dark:text-purple-200"
          aria-hidden="true"
        >
          View
        </span>
      ) : null}
    </Element>
  );
};

export default OrderReferenceCard;
