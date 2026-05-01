import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageWithFallback from '@/components/ImageWithFallback';
import type { ThreadMessage } from '@/api/MessagingApi';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

type ConversationContext = 'DIRECT' | 'INQUIRY' | 'STANDARD_ORDER' | 'CUSTOM_ORDER';

interface ChatContactSidebarProps {
  participant: {
    id: string;
    name: string;
    username?: string | null;
    profileImage?: string | null;
  } | null;
  contextType: ConversationContext;
  orderId?: string | null;
  customOrderId?: string | null;
  targetUrl?: string | null;
  /** Canonical order-detail page URL for the "View Order" action. */
  orderDetailUrl?: string | null;
  status?: string | null;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  messages: ThreadMessage[];
  isInquiry: boolean;
  onMarkRead: () => void;
  onToggleMute: () => void;
  onToggleArchive: () => void;
}

const contextLabel = (ct: ConversationContext) => {
  switch (ct) {
    case 'DIRECT': return 'Direct';
    case 'STANDARD_ORDER': return 'Standard Order';
    case 'CUSTOM_ORDER': return 'Custom Order';
    case 'INQUIRY': return 'Inquiry';
  }
};

const contextColor = (ct: ConversationContext) => {
  switch (ct) {
    case 'DIRECT': return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
    case 'STANDARD_ORDER': return 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400';
    case 'CUSTOM_ORDER': return 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400';
    case 'INQUIRY': return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400';
  }
};

const isLikelyFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

const resolveAvatarMediaSource = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { fileId: undefined, src: undefined };
  }

  if (isLikelyFileId(raw)) {
    return { fileId: raw, src: undefined };
  }

  return { fileId: undefined, src: raw };
};

const ChatContactSidebar: React.FC<ChatContactSidebarProps> = ({
  participant,
  contextType,
  orderId,
  customOrderId,
  orderDetailUrl,
  status,
  mutedUntil,
  archivedAt,
  messages,
  isInquiry,
  onMarkRead,
  onToggleMute,
  onToggleArchive,
}) => {
  const navigate = useNavigate();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';
  // orderDetailUrl is the canonical order page (e.g. /custom-orders/{id}).
  // targetUrl is the notification deep-link (messaging surface). We use
  // orderDetailUrl for the "View Order" button so the user lands on the order,
  // not on the messages page they are already viewing.
  const orderUrl = useMemo(() => orderDetailUrl ?? null, [orderDetailUrl]);

  const sharedMedia = useMemo(() => {
    const images: { id: string; url: string; name: string }[] = [];
    for (const msg of messages) {
      if (!msg.attachments?.length) continue;
      for (const att of msg.attachments) {
        if (att.kind === 'IMAGE') {
          images.push({ id: att.id, url: att.file.s3Url, name: att.file.originalName || 'Image' });
        }
      }
    }
    return images;
  }, [messages]);

  const sharedDocs = useMemo(() => {
    const docs: { id: string; url: string; name: string; size?: number | null }[] = [];
    for (const msg of messages) {
      if (!msg.attachments?.length) continue;
      for (const att of msg.attachments) {
        if (att.kind === 'DOCUMENT') {
          docs.push({ id: att.id, url: att.file.s3Url, name: att.file.originalName || 'Document', size: att.file.size });
        }
      }
    }
    return docs;
  }, [messages]);

  const referenceId = orderId || customOrderId;
  const participantAvatarSource = resolveAvatarMediaSource(participant?.profileImage);
  const openRoute = (path: string) => {
    if (isEmbeddedMobile) {
      postStudioNativeEvent({ type: 'OPEN_NATIVE_ROUTE', path });
      return;
    }

    navigate(path);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Profile section */}
      <div className="flex flex-col items-center px-5 pt-6 pb-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-[1.5rem] overflow-hidden ring-2 ring-gray-200/60 dark:ring-white/10">
            {participant?.profileImage ? (
              <ImageWithFallback
                src={participantAvatarSource.src}
                fileId={participantAvatarSource.fileId}
                alt={participant.name}
                fit="cover"
                className="h-20 w-20"
                rounded="xl"
                fallbackName={participant.name}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-fuchsia-500 text-2xl font-bold text-white">
                {participant?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          {/* Online indicator */}
            <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-transparent bg-emerald-400" />
        </div>

        <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white text-center">
          {participant?.name || 'Unknown'}
        </h3>
        {participant?.username && (
          <p className="text-xs text-gray-500 dark:text-gray-400">@{participant.username}</p>
        )}

        {/* Context badge */}
        <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${contextColor(contextType)}`}>
          {contextLabel(contextType)}
        </span>

        {/* Status */}
        {status && (
          <span className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {status}
          </span>
        )}

        {/* Reference ID */}
        {referenceId && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            #{referenceId.slice(0, 12)}...
          </p>
        )}
      </div>

      <div className="mx-4 h-px bg-gray-200/60 dark:bg-white/8" />

      {/* Quick actions */}
      <div className="px-4 py-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
          Actions
        </p>

        {participant?.id && (
          <button
            type="button"
            onClick={() => openRoute(`/profile/${participant.id}`)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <span aria-hidden="true">👤</span>
            View Profile
          </button>
        )}

        {/* View Order — only for order-based contexts */}
        {orderUrl && (
          <button
            type="button"
            onClick={() => openRoute(orderUrl)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <span className="text-sm" role="img" aria-label="order">📦</span>
            View Order
          </button>
        )}

        <button
          type="button"
          onClick={onMarkRead}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <span aria-hidden="true">✓</span>
          Mark as Read
        </button>

        {!isInquiry && (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <span aria-hidden="true">{mutedUntil ? '🔊' : '🔕'}</span>
              {mutedUntil ? 'Unmute' : 'Mute 24h'}
            </button>

            <button
              type="button"
              onClick={onToggleArchive}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <span aria-hidden="true">🗃️</span>
              {archivedAt ? 'Unarchive' : 'Archive'}
            </button>
          </>
        )}

        {!isEmbeddedMobile ? (
          <button
            type="button"
            onClick={() => navigate('/settings?tab=notifications')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <span aria-hidden="true">⚙️</span>
            Notification Settings
          </button>
        ) : null}
      </div>

      {/* Shared Media */}
      {sharedMedia.length > 0 && (
        <>
          <div className="mx-4 h-px bg-gray-200/60 dark:bg-white/8" />
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Shared Media ({sharedMedia.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {sharedMedia.slice(0, 9).map((img) => (
                <a
                  key={img.id}
                  href={img.url}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 hover:opacity-80 transition-opacity"
                >
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" loading="eager" />
                </a>
              ))}
            </div>
            {sharedMedia.length > 9 && (
              <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 text-center">
                +{sharedMedia.length - 9} more
              </p>
            )}
          </div>
        </>
      )}

      {/* Shared Documents */}
      {sharedDocs.length > 0 && (
        <>
          <div className="mx-4 h-px bg-gray-200/60 dark:bg-white/8" />
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Shared Files ({sharedDocs.length})
            </p>
            <div className="space-y-1.5">
              {sharedDocs.slice(0, 5).map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
                >
                  <span aria-hidden="true" className="shrink-0">📄</span>
                  <span className="truncate">{doc.name}</span>
                  {doc.size ? (
                    <span className="shrink-0 text-[10px] text-gray-400">{(doc.size / 1024).toFixed(0)}KB</span>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatContactSidebar;
