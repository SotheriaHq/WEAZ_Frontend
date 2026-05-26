import React, { memo } from 'react';
import type { ThreadMessage } from '@/api/MessagingApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import ImageWithFallback from '@/components/ImageWithFallback';

interface MessageBubbleProps {
  message: ThreadMessage & { _optimistic?: 'sending' | 'failed' };
  isOwn: boolean;
  /** When true, hidden/redacted messages are shown with a visual indicator (admin view). */
  showModerated?: boolean;
  /** Called when user clicks retry on a failed optimistic message */
  onRetry?: () => void;
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

const senderName = (msg: ThreadMessage) => {
  if (msg.sender?.firstName) return msg.sender.firstName;
  if (msg.sender?.username) return msg.sender.username;
  switch (msg.senderRole) {
    case 'BUYER': return 'Buyer';
    case 'BRAND_OWNER': return 'Brand';
    case 'ADMIN': return 'Admin';
    case 'SYSTEM': return 'System';
    default: return msg.senderRole;
  }
};

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

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isOwn, showModerated = false, onRetry }) => {
  const isSystem = message.kind === 'SYSTEM' || message.kind === 'MODERATION_NOTICE';
  const isHidden = message.visibilityState === 'HIDDEN';
  const isRedacted = message.visibilityState === 'REDACTED';

  // Non-admin views: strictly hide hidden messages, show placeholder for redacted
  if (isHidden && !showModerated) return null;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/50 dark:border-transparent px-4 py-2 text-center">
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

  // Determine tick display for own messages
  const renderTicks = () => {
    if (!isOwn) return null;

    // Optimistic sending state
    if (optimistic === 'sending') {
      return (
        <span className="inline-flex items-center" title="Sending...">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" className="animate-spin text-white/50">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
        </span>
      );
    }

    // Failed state
    if (optimistic === 'failed') {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
          className="inline-flex items-center gap-0.5 text-red-300 hover:text-red-100 font-semibold"
          title="Failed to send. Tap to retry."
        >
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          <span className="text-[10px]">Retry</span>
        </button>
      );
    }

    // Delivered states from server
    if (deliveryStatus === 'READ') {
      return (
        <span className="inline-flex items-center" title="Read">
          <DoubleTick className="text-sky-300" />
        </span>
      );
    }

    if (deliveryStatus === 'DELIVERED') {
      return (
        <span className="inline-flex items-center" title="Delivered">
          <DoubleTick className="text-white/60" />
        </span>
      );
    }

    // SENT - single tick
    return (
      <span className="inline-flex items-center" title="Sent">
        <SingleTick className="text-white/60" />
      </span>
    );
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group ${isModerated && showModerated ? 'opacity-60' : ''}`}>
      <div className={`max-w-[75%] min-w-[80px] ${isOwn ? 'order-1' : 'order-1'}`}>
        {!isOwn && (
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 ml-3 mb-0.5 block">
            {senderName(message)}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 ${
            isModerated && showModerated
              ? 'bg-red-50/80 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 text-gray-900 dark:text-gray-100 rounded-bl-md'
              : isOwn
                ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white rounded-br-md'
                : 'bg-white/80 dark:bg-white/8 border border-gray-200/60 dark:border-transparent text-gray-900 dark:text-gray-100 rounded-bl-md'
          }`}
        >
          {isRedacted && !showModerated ? (
            <p className="text-sm italic opacity-60">This message has been removed</p>
          ) : (
            <>
              {message.metadataJson?.contextDesignTitle && (
                <div className={`mb-2 rounded-lg overflow-hidden border ${isOwn ? 'border-white/20 bg-white/10' : 'border-purple-200/60 dark:border-purple-500/20 bg-purple-50/60 dark:bg-purple-500/5'}`}>
                  {message.metadataJson.contextDesignCoverFileId && (
                    <ImageWithFallback
                      fileId={message.metadataJson.contextDesignCoverFileId as string}
                      alt={String(message.metadataJson.contextDesignTitle)}
                      fit="cover"
                      rounded="none"
                      containerClassName="w-full h-14"
                      maxHeightClassName=""
                    />
                  )}
                  <div className={`px-2 py-1.5 text-[11px] font-semibold truncate ${isOwn ? 'text-white/80' : 'text-purple-700 dark:text-purple-300'}`}>
                    {String(message.metadataJson.contextDesignTitle)}
                  </div>
                </div>
              )}
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
