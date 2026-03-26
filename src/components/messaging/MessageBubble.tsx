import React, { memo } from 'react';
import type { ThreadMessage } from '@/api/MessagingApi';

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
                        <img
                          src={att.file.s3Url}
                          alt={att.file.originalName || 'Attachment'}
                          className="w-full h-auto rounded-lg"
                          loading="lazy"
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
                        📎 {att.file.originalName || 'Document'}
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
            {isOwn && (message as any)._optimistic === 'sending' && (
              <span className="text-[10px] animate-pulse" title="Sending">○</span>
            )}
            {isOwn && (message as any)._optimistic === 'failed' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
                className="text-[10px] text-red-300 hover:text-red-100 font-semibold"
                title="Failed to send. Tap to retry."
              >
                ⚠ Failed
              </button>
            )}
            {isOwn && !(message as any)._optimistic && (
              <span className="text-[10px]" title="Delivered">✓</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export { MessageBubble, formatDate };
export default MessageBubble;
