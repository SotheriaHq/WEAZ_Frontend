import React, { memo, useRef, useState } from 'react';
import type { ThreadMessage } from '@/api/MessagingApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import ImageWithFallback from '@/components/ImageWithFallback';
import { resolveParticipantDisplayName } from '@/utils/participantDisplayName';

interface MessageBubbleProps {
  /**
   * Open the design this message refers to. Omitted where there is nowhere
   * sensible to go, in which case the reference stays a static card.
   */
  onOpenDesignContext?: (designId: string) => void;
  /**
   * Open the product this message refers to. Same contract as
   * `onOpenDesignContext`; omitted where there is nowhere sensible to go.
   */
  onOpenProductContext?: (productId: string) => void;
  message: ThreadMessage & { _optimistic?: 'sending' | 'failed' };
  isOwn: boolean;
  /** When true, hidden/redacted messages are shown with a visual indicator (admin view). */
  showModerated?: boolean;
  /** Called when user clicks retry on a failed optimistic message */
  onRetry?: () => void;
  /** Discard a message that never sent. Only offered on a failed bubble. */
  onDiscard?: () => void;
  /** Called when the user swipes to initiate a reply to this message */
  onReply?: (message: ThreadMessage) => void;
}

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

const roleLabel = (role: ThreadMessage['senderRole']) => {
  switch (role) {
    case 'BUYER': return 'Buyer';
    case 'BRAND_OWNER': return 'Brand';
    case 'ADMIN': return 'Admin';
    case 'SYSTEM': return 'System';
    default: return role;
  }
};

const senderName = (msg: ThreadMessage) =>
  resolveParticipantDisplayName(msg.sender, roleLabel(msg.senderRole));

/** True when value looks like a UUID file ID rather than a URL */
const isFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

/** SVG tick icons matching WhatsApp style */
const SingleTick: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 16 12" fill="none" className={className} width="16" height="12">
    <path d="M1.5 6.5L5.5 10.5L14.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleTick: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 22 12" fill="none" className={className} width="20" height="12">
    <path d="M1.5 6.5L5.5 10.5L14.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 6.5L11.5 10.5L20.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SWIPE_THRESHOLD = 52; // px required to trigger reply

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isOwn, showModerated = false, onRetry, onDiscard, onReply, onOpenDesignContext, onOpenProductContext }) => {
  const isSystem = message.kind === 'SYSTEM' || message.kind === 'MODERATION_NOTICE';
  const isHidden = message.visibilityState === 'HIDDEN';
  const isRedacted = message.visibilityState === 'REDACTED';

  // Swipe gesture state
  const startXRef = useRef<number | null>(null);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onReply) return;
    startXRef.current = e.clientX;
    setSwiping(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swiping || startXRef.current === null || !onReply) return;
    const delta = e.clientX - startXRef.current;
    // Only allow rightward swipe for both own and other messages (WhatsApp style)
    const clamped = Math.max(0, Math.min(delta, 80));
    setSwipeDelta(clamped);
  };

  const handlePointerUp = () => {
    if (!swiping) return;
    if (swipeDelta >= SWIPE_THRESHOLD && onReply) {
      onReply(message);
    }
    setSwipeDelta(0);
    setSwiping(false);
    startXRef.current = null;
  };

  // Non-admin views: strictly hide hidden messages, show placeholder for redacted
  if (isHidden && !showModerated) return null;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] rounded-xl bg-gray-100/80 dark:bg-white/5 px-4 py-2 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            {message.bodyText || 'System message'}
          </p>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  const isModerated = isHidden || isRedacted;
  const optimistic = (message as any)._optimistic as 'sending' | 'failed' | undefined;
  const deliveryStatus = message.deliveryStatus ?? 'SENT';

  /*
    The content this message is about — a Runway design OR a Market product.

    Only the design half was read here, so a message sent from a product (which
    the native app now does) arrived on the web with its reference invisible:
    the brand saw a question about "this" with nothing attached, which is the
    exact failure the reference exists to prevent. Product wins when both are
    present, because a message is composed from one screen.
  */
  const productContextId = message.metadataJson?.contextProductId as string | undefined;
  const isProductContext = Boolean(
    productContextId || message.metadataJson?.contextProductTitle,
  );
  const contextTitle = (isProductContext
    ? message.metadataJson?.contextProductTitle
    : message.metadataJson?.contextDesignTitle) as string | undefined;
  const contextCoverUrl = (isProductContext
    ? message.metadataJson?.contextProductCoverUrl
    : message.metadataJson?.contextDesignCoverUrl) as string | undefined;
  const contextCoverFileId = (isProductContext
    ? message.metadataJson?.contextProductCoverFileId
    : message.metadataJson?.contextDesignCoverFileId) as string | undefined;
  // Prefer direct URL; fall back to fileId resolution
  const coverSrc = contextCoverUrl || (!isFileId(contextCoverFileId) ? contextCoverFileId : undefined);
  const coverFileId = !coverSrc && isFileId(contextCoverFileId) ? contextCoverFileId : undefined;
  const designContextId = isProductContext
    ? productContextId
    : (message.metadataJson?.contextDesignId as string | undefined);
  const hasDesignCard = Boolean(contextTitle);
  // Only an addressable reference is actionable. Older messages carry a title
  // and cover but no id; those stay as they are rather than becoming a button
  // that goes nowhere.
  const canOpenDesignContext = Boolean(
    designContextId && (isProductContext ? onOpenProductContext : onOpenDesignContext),
  );
  const openContext = () => {
    if (!designContextId) return;
    if (isProductContext) onOpenProductContext?.(String(designContextId));
    else onOpenDesignContext?.(String(designContextId));
  };

  const renderTicks = () => {
    if (!isOwn) return null;
    if (optimistic === 'sending') {
      return (
        <span className="inline-flex items-center" title="Sending...">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" className="animate-spin text-white/50">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
        </span>
      );
    }
    if (optimistic === 'failed') {
      /*
        Both ways out, offered together.

        A failed message previously had only Retry, which is the wrong single
        option: a send can fail for a reason retrying will never fix, and the
        bubble then sits in the thread permanently with no way to clear it
        short of reloading. "Resend" and "Delete message" are the two things
        anyone actually wants, so both are here.
      */
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5 text-red-300" title="Not sent">
            <svg viewBox="0 0 16 16" fill="none" width="12" height="12" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
            </svg>
            <span className="text-[10px]">Not sent</span>
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
            className="text-[10px] font-semibold text-white/80 underline underline-offset-2 hover:text-white"
          >
            Resend
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDiscard?.(); }}
            className="text-[10px] font-semibold text-red-300 underline underline-offset-2 hover:text-red-100"
          >
            Delete
          </button>
        </span>
      );
    }
    if (deliveryStatus === 'READ') {
      return <span className="inline-flex items-center" title="Read"><DoubleTick className="text-sky-300" /></span>;
    }
    if (deliveryStatus === 'DELIVERED') {
      return <span className="inline-flex items-center" title="Delivered"><DoubleTick className="text-white/60" /></span>;
    }
    return <span className="inline-flex items-center" title="Sent"><SingleTick className="text-white/60" /></span>;
  };

  // Reply indicator: appears when swiping right
  const replyIconOpacity = Math.min(swipeDelta / SWIPE_THRESHOLD, 1);

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group relative select-none ${isModerated && showModerated ? 'opacity-60' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Reply swipe indicator — appears on left for own msgs, right for others */}
      {onReply && (
        <div
          aria-hidden="true"
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 transition-none pointer-events-none ${isOwn ? 'left-0' : 'right-0'}`}
          style={{ opacity: replyIconOpacity }}
        >
          <span className="text-base">↩️</span>
        </div>
      )}

      <div
        className="max-w-[75%] min-w-[80px] flex flex-col"
        style={{ transform: `translateX(${swipeDelta}px)`, transition: swipeDelta === 0 && !swiping ? 'transform 0.2s ease' : 'none' }}
      >
        {!isOwn && (
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 ml-3 mb-0.5 block">
            {senderName(message)}
          </span>
        )}

        {/*
          Design context card — sits ABOVE the bubble, no background fill.

          The reference is what the message is ABOUT, so it has to be a way to
          get to the thing. Rendering it as inert decoration left the recipient
          reading "did you make this in red?" next to a picture they could not
          open, with no way to answer without hunting the catalogue by hand.
        */}
        {hasDesignCard && !isRedacted && (
          <div
            {...(canOpenDesignContext
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  onClick: openContext,
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    openContext();
                  },
                  'aria-label': `Open ${String(contextTitle)}`,
                }
              : {})}
            /* No outline: the cover image is its own edge, and the frosted
               caption below already reads as attached to it. */
            className={`mb-1 overflow-hidden rounded-xl bg-transparent ${
              canOpenDesignContext
                ? 'cursor-pointer transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400'
                : ''
            }`}
          >
            {(coverSrc || coverFileId) && (
              <div className="w-full h-[120px] bg-gray-100 dark:bg-white/5">
                <ImageWithFallback
                  src={coverSrc}
                  fileId={coverFileId}
                  alt={String(contextTitle)}
                  fit="cover"
                  rounded="none"
                  containerClassName="w-full h-[120px]"
                  maxHeightClassName=""
                />
              </div>
            )}
            <div className="px-2.5 py-1.5 bg-white/80 dark:bg-black/30 backdrop-blur-sm">
              <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 truncate leading-snug">
                {isProductContext ? '🛍️' : '🎨'} {String(contextTitle)}
                {canOpenDesignContext ? (
                  <span className="ml-1 font-normal text-purple-600 dark:text-purple-300">
                    · View
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        )}

        {/* Quoted message (reply reference) */}
        {message.quotedMessage && !isRedacted && (
          <div className={`mb-1 rounded-xl overflow-hidden border-l-4 ${isOwn ? 'border-white/40' : 'border-purple-400 dark:border-purple-500'} ${isOwn ? 'bg-white/15' : 'bg-purple-50/70 dark:bg-purple-500/10'} px-2.5 py-1.5`}>
            <p className={`text-[10px] font-semibold mb-0.5 ${isOwn ? 'text-white/70' : 'text-purple-700 dark:text-purple-300'}`}>
              {message.quotedMessage.senderName || message.quotedMessage.senderRole}
            </p>
            <p className={`text-[11px] line-clamp-2 leading-snug ${isOwn ? 'text-white/60' : 'text-gray-600 dark:text-gray-400'}`}>
              {message.quotedMessage.bodyText || '📎 Attachment'}
            </p>
          </div>
        )}

        {/*
          Main bubble — text + ticks only.

          The received bubble is an OPAQUE surface in each theme, not a
          translucent white. `dark:bg-white/8` never compiled (Tailwind's bare
          opacity modifier only accepts its 5-step scale, so `/8` produced no
          rule at all), which left the light-mode `bg-white/80` in force on dark
          — a near-white bubble carrying `dark:text-gray-100` text. That is the
          "impossible to read" report, and it could only ever have looked right
          in one theme.

          Solid colours rather than a tint over the shell: a translucent bubble
          takes its contrast from whatever happens to be behind it, which on a
          message list is the previous bubble as often as the background.

          No border either. The fill already separates the bubble from the
          surface, so an outline on top of it is a second separator doing the
          same job.
        */}
        <div
          className={`rounded-2xl px-3.5 py-2 ${
            isModerated && showModerated
              ? 'bg-red-50/80 dark:bg-red-950/40 text-gray-900 dark:text-red-100 rounded-bl-md'
              : isOwn
                ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-900 dark:bg-[#252732] dark:text-gray-50 rounded-bl-md'
          }`}
        >
          {isRedacted && !showModerated ? (
            <p className="text-sm italic opacity-60">This message has been removed</p>
          ) : (
            <>
              {message.bodyText && (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.bodyText}</p>
              )}
              {message.attachments?.length > 0 && (
                <div className={`mt-1.5 space-y-1 ${message.bodyText ? 'pt-1 border-t border-white/15' : ''}`}>
                  {message.attachments.map((att) => {
                    const isImage = att.kind === 'IMAGE';
                    return isImage ? (
                      <a
                        key={att.id}
                        href={att.file.s3Url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg overflow-hidden max-w-[200px]"
                      >
                        <MediaRenderer
                          kind="image"
                          src={att.file.s3Url}
                          alt={att.file.originalName || 'Attachment'}
                          className="w-full rounded-lg"
                          mediaClassName="h-auto w-full rounded-lg"
                          maxHeightClassName=""
                          loading="eager"
                        />
                      </a>
                    ) : (
                      <a
                        key={att.id}
                        href={att.file.s3Url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-2 text-xs font-medium ${
                          isOwn ? 'text-white/90 hover:text-white' : 'text-purple-600 dark:text-purple-400 hover:underline'
                        }`}
                      >
                        <span>📎 {att.file.originalName || 'Document'}</span>
                        {att.file.size ? ` (${(att.file.size / 1024).toFixed(0)}KB)` : ''}
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOwn ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
            <span className="text-[10px]">{formatTime(message.createdAt)}</span>
            {renderTicks()}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export { MessageBubble, formatDate };
export default MessageBubble;
