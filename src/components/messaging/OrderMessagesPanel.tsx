import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { messagingApi, type ThreadMessage } from '@/api/MessagingApi';
import { useRealtime } from '@/realtime/RealtimeProvider';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

type ContextType = 'CUSTOM_ORDER' | 'STANDARD_ORDER';

interface OrderMessagesPanelProps {
  contextType: ContextType;
  orderId: string;
  title?: string;
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
  title = 'Order messages',
}) => {
  const profile = useSelector((state: RootState) => state.user.profile);
  const actorId = profile?.id;
  const { onNotification } = useRealtime();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [summaryUnread, setSummaryUnread] = useState<number>(0);
  const [input, setInput] = useState('');

  const listMessages = useCallback(async () => {
    if (!orderId) return;

    const response =
      contextType === 'CUSTOM_ORDER'
        ? await messagingApi.listCustomOrderMessages(orderId, { limit: 50 })
        : await messagingApi.listOrderMessages(orderId, { limit: 50 });

    const sorted = [...response.items].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    setMessages(sorted);

    const latestMessageId = sorted.at(-1)?.id;
    if (latestMessageId) {
      if (contextType === 'CUSTOM_ORDER') {
        await messagingApi.markCustomOrderRead(orderId, latestMessageId);
      } else {
        await messagingApi.markOrderRead(orderId, latestMessageId);
      }
    }
  }, [contextType, orderId]);

  const loadSummary = useCallback(async () => {
    if (!orderId) return;

    const summary =
      contextType === 'CUSTOM_ORDER'
        ? await messagingApi.getCustomOrderSummary(orderId, true)
        : await messagingApi.getOrderSummary(orderId, true);

    setSummaryUnread(Number(summary?.unreadCount ?? 0));
  }, [contextType, orderId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([listMessages(), loadSummary()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load order messages');
    } finally {
      setLoading(false);
    }
  }, [listMessages, loadSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
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

      const payloadOrderId =
        String(payload?.payload?.customOrderId ?? payload?.payload?.orderId ?? '');
      if (payloadOrderId !== String(orderId)) {
        return;
      }

      void refresh();
    });

    return unsubscribe;
  }, [onNotification, orderId, refresh]);

  const canSend = useMemo(
    () => Boolean(input.trim()) && !sending,
    [input, sending],
  );

  const handleSend = async () => {
    const bodyText = input.trim();
    if (!bodyText) return;

    setSending(true);
    try {
      const payload = { bodyText, clientMessageId: nextClientMessageId() };
      if (contextType === 'CUSTOM_ORDER') {
        await messagingApi.sendCustomOrderMessage(orderId, payload);
      } else {
        await messagingApi.sendOrderMessage(orderId, payload);
      }

      setInput('');
      await refresh();
    } catch (error: any) {
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

      <div className="mt-4 space-y-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Type a message for this order"
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
        />
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
    </section>
  );
};

export default OrderMessagesPanel;
