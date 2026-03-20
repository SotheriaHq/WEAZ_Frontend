import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { messagingApi, type ThreadMessage } from '@/api/MessagingApi';
import { useRealtime } from '@/realtime/RealtimeProvider';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

type ContextType = 'CUSTOM_ORDER' | 'STANDARD_ORDER' | 'INQUIRY';
type ActorSurface = 'BUYER' | 'BRAND' | 'ADMIN';

interface OrderMessagesPanelProps {
  contextType: ContextType;
  orderId?: string;
  threadId?: string;
  title?: string;
  actorSurface?: ActorSurface;
  brandId?: string | null;
  readOnly?: boolean;
  highlightMessageId?: string | null;
}

interface PendingAttachment {
  fileId: string;
  fileName: string;
  previewUrl: string | null;
}

const formatTimestamp = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const roleLabel = (role: ThreadMessage['senderRole']) => {
  switch (role) {
    case 'BUYER':
      return 'You';
    case 'BRAND_OWNER':
      return 'Brand';
    case 'ADMIN':
      return 'Admin';
    case 'SYSTEM':
      return 'System';
    default:
      return role;
  }
};

const nextClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const OrderMessagesPanel: React.FC<OrderMessagesPanelProps> = ({
  contextType,
  orderId,
  threadId,
  title = 'Order messages',
  actorSurface = 'BUYER',
  brandId,
  readOnly = false,
  highlightMessageId,
}) => {
  const profile = useSelector((state: RootState) => state.user.profile);
  const actorId = profile?.id;
  const { onNotification } = useRealtime();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [summaryUnread, setSummaryUnread] = useState<number>(0);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const messageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contextId = useMemo(() => orderId || threadId || '', [orderId, threadId]);
  const useThreadTransport = actorSurface === 'BRAND' && Boolean(threadId);

  useEffect(() => {
    attachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    };
  }, []);

  const listMessages = useCallback(async () => {
    if (!contextId) return;

    if (useThreadTransport && threadId) {
      const response = await messagingApi.listThreadMessages(threadId, { limit: 50 });
      const sorted = [...response.items].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );

      setMessages(sorted);

      const latestMessageId = sorted.at(-1)?.id;
      if (latestMessageId) {
        await messagingApi.markThreadReadById(threadId, latestMessageId);
      }

      return;
    }

    const response =
      contextType === 'INQUIRY'
        ? await messagingApi.listThreadMessages(contextId, { limit: 50 })
        : actorSurface === 'ADMIN'
        ? contextType === 'CUSTOM_ORDER'
          ? await messagingApi.listAdminCustomOrderMessages(contextId, { limit: 50 })
          : await messagingApi.listAdminOrderMessages(contextId, { limit: 50 })
        : contextType === 'CUSTOM_ORDER'
          ? actorSurface === 'BRAND' && brandId
            ? await messagingApi.listCustomOrderMessagesForBrand(brandId, contextId, { limit: 50 })
            : await messagingApi.listCustomOrderMessages(contextId, { limit: 50 })
          : actorSurface === 'BRAND' && brandId
            ? await messagingApi.listOrderMessagesForBrand(brandId, contextId, { limit: 50 })
            : await messagingApi.listOrderMessages(contextId, { limit: 50 });

    const sorted = [...response.items].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    setMessages(sorted);

    if (actorSurface !== 'ADMIN') {
      const latestMessageId = sorted.at(-1)?.id;
      if (latestMessageId) {
        if (contextType === 'INQUIRY') {
          await messagingApi.markThreadReadById(contextId, latestMessageId);
        } else if (contextType === 'CUSTOM_ORDER') {
          if (actorSurface === 'BRAND' && brandId) {
            await messagingApi.markCustomOrderReadForBrand(brandId, contextId, latestMessageId);
          } else {
            await messagingApi.markCustomOrderRead(contextId, latestMessageId);
          }
        } else if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.markOrderReadForBrand(brandId, contextId, latestMessageId);
        } else {
          await messagingApi.markOrderRead(contextId, latestMessageId);
        }
      }
    }
  }, [actorSurface, brandId, contextId, contextType, threadId, useThreadTransport]);

  const loadSummary = useCallback(async () => {
    if (!contextId) return;

    if (actorSurface === 'ADMIN') {
      setSummaryUnread(0);
      return;
    }

    if (contextType === 'INQUIRY' || (useThreadTransport && threadId)) {
      const inbox = await messagingApi.getInbox({
        limit: 1,
        q: threadId || contextId,
      });
      const matching = (inbox.items || []).find((item) => item.threadId === (threadId || contextId));
      setSummaryUnread(Number(matching?.unreadCount ?? 0));
      return;
    }

    const summary =
      contextType === 'CUSTOM_ORDER'
        ? actorSurface === 'BRAND' && brandId
          ? await messagingApi.getCustomOrderSummaryForBrand(brandId, contextId, true)
          : await messagingApi.getCustomOrderSummary(contextId, true)
        : actorSurface === 'BRAND' && brandId
          ? await messagingApi.getOrderSummaryForBrand(brandId, contextId, true)
          : await messagingApi.getOrderSummary(contextId, true);

    setSummaryUnread(Number(summary?.unreadCount ?? 0));
  }, [actorSurface, brandId, contextId, contextType, threadId, useThreadTransport]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([listMessages(), loadSummary()]);
    } catch (error: any) {
      console.error('[OrderMessagesPanel] refresh failed', {
        contextType,
        actorSurface,
        brandId,
        orderId,
        threadId,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
      toast.error(error?.response?.data?.message || 'Unable to load order messages');
    } finally {
      setLoading(false);
    }
  }, [listMessages, loadSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!contextId) return;

    let intervalId: number | null = null;
    const setupPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      if (document.visibilityState === 'visible') {
        intervalId = window.setInterval(() => {
          void refresh();
        }, 25000);
      }
    };

    setupPolling();
    const onVisibilityChange = () => {
      setupPolling();
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [contextId, refresh]);

  useEffect(() => {
    if (!contextId) return;

    const unsubscribe = onNotification((payload) => {
      const type = String(payload?.type ?? '');
      const isMessageEvent =
        type === 'MESSAGE_RECEIVED' ||
        type === 'MESSAGE_UNREAD_REMINDER' ||
        type === 'MESSAGE_THREAD_REOPENED' ||
        type === 'MESSAGE_MODERATED';

      if (!isMessageEvent) {
        return;
      }

      const payloadContextId = String(
        payload?.payload?.threadId ?? payload?.payload?.customOrderId ?? payload?.payload?.orderId ?? '',
      );
      if (payloadContextId !== String(contextId)) {
        return;
      }

      void refresh();
    });

    return unsubscribe;
  }, [contextId, onNotification, refresh]);

  const handleComposerKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (canSend) {
      void handleSend();
    }
  };

  useEffect(() => {
    if (!highlightMessageId) return;
    const targetNode = messageNodeRefs.current[highlightMessageId];
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetNode.classList.add('ring-2', 'ring-orange-400');
    const timer = window.setTimeout(() => {
      targetNode.classList.remove('ring-2', 'ring-orange-400');
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [highlightMessageId, messages]);

  const canSend = useMemo(() => {
    const hasBody = Boolean(input.trim());
    const hasAttachments = pendingAttachments.length > 0;
    return !readOnly && actorSurface !== 'ADMIN' && (hasBody || hasAttachments) && !sending && !uploading;
  }, [actorSurface, input, pendingAttachments.length, readOnly, sending, uploading]);

  const onPickAttachments: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    if (pendingAttachments.length + files.length > 5) {
      toast.error('A maximum of 5 attachments is allowed');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploaded: PendingAttachment[] = [];
      for (const file of files) {
        const response = await messagingApi.uploadMessageAttachment(file);
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        uploaded.push({
          fileId: response.id,
          fileName: response.originalName || response.fileName || file.name,
          previewUrl,
        });
      }

      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to upload one or more attachments');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (fileId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.fileId === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.fileId !== fileId);
    });
  };

  const handleSend = async () => {
    const bodyText = input.trim();
    const attachmentFileIds = pendingAttachments.map((attachment) => attachment.fileId);
    if (!bodyText && attachmentFileIds.length === 0) return;

    setSending(true);
    try {
      const payload = {
        bodyText: bodyText || undefined,
        clientMessageId: nextClientMessageId(),
        attachmentFileIds,
      };
      if (!contextId) return;
      if ((contextType === 'INQUIRY' || useThreadTransport) && threadId) {
        await messagingApi.sendThreadMessage(threadId, payload);
      } else if (contextType === 'INQUIRY') {
        await messagingApi.sendThreadMessage(contextId, payload);
      } else if (contextType === 'CUSTOM_ORDER') {
        if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.sendCustomOrderMessageForBrand(brandId, contextId, payload);
        } else {
          await messagingApi.sendCustomOrderMessage(contextId, payload);
        }
      } else {
        if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.sendOrderMessageForBrand(brandId, contextId, payload);
        } else {
          await messagingApi.sendOrderMessage(contextId, payload);
        }
      }

      setInput('');
      for (const attachment of pendingAttachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
      setPendingAttachments([]);
      await refresh();
    } catch (error: any) {
      console.error('[OrderMessagesPanel] send failed', {
        contextType,
        actorSurface,
        brandId,
        orderId,
        threadId,
        hasBodyText: Boolean(bodyText),
        attachmentCount: attachmentFileIds.length,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
      toast.error(error?.response?.data?.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">💬 {title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summaryUnread > 0 ? `${summaryUnread} unread` : 'No unread messages'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/20 dark:text-slate-100"
        >
          Refresh
        </button>
      </div>

      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">No messages yet for this order.</div>
        ) : (
          messages.map((message) => {
            const mine = actorId && message.senderUserId === actorId;
            const sender =
              message.sender?.firstName || message.sender?.username || roleLabel(message.senderRole);

            return (
              <div
                key={message.id}
                ref={(node) => {
                  messageNodeRefs.current[message.id] = node;
                }}
                className={`rounded-2xl border px-3 py-2 ${
                  mine
                    ? 'border-emerald-300/50 bg-emerald-50/70 dark:border-emerald-600/30 dark:bg-emerald-500/10'
                    : 'border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/20'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">{sender}</span>
                  <span>{formatTimestamp(message.createdAt)}</span>
                </div>
                {message.bodyText ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{message.bodyText}</p>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">(No text body)</p>
                )}
                {message.attachments?.length ? (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.file.s3Url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-semibold text-sky-700 underline dark:text-sky-300"
                      >
                        📎 {attachment.file.originalName || attachment.file.id}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {readOnly || actorSurface === 'ADMIN' ? null : (
      <div className="mt-4 space-y-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          rows={3}
          maxLength={4000}
          placeholder="Type a message for this order"
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
        />
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/20 dark:text-slate-100">
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={onPickAttachments} disabled={uploading || sending} />
              {uploading ? 'Uploading...' : 'Attach files'}
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Up to 5 files, max 25MB total, PDF or image</span>
          </div>
          {pendingAttachments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.fileId} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2 text-xs dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-2">
                    <span>📎</span>
                    <span className="truncate">{attachment.fileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.fileId)}
                    className="rounded-full border border-black/15 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/20 dark:text-slate-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{input.length}/4000</span>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void handleSend()}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {sending ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </div>
      )}
    </section>
  );
};

export default OrderMessagesPanel;
