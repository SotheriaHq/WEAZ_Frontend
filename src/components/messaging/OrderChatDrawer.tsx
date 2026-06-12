import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { messagingApi, type ThreadMessage } from '@/api/MessagingApi';
import { customOrdersBuyerApi, customOrdersBrandApi, type CustomOrderDetail } from '@/api/CustomOrderApi';
import { useRealtime } from '@/realtime/RealtimeProvider';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import MessageBubble, { formatDate } from './MessageBubble';
import ComposeArea from './ComposeArea';
import VLoader from '@/components/loaders/VLoader';

type ContextType = 'CUSTOM_ORDER' | 'STANDARD_ORDER';

interface OrderChatDrawerProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  contextType: ContextType;
  brandId?: string | null;
  actorSurface?: 'BUYER' | 'BRAND' | 'ADMIN';
  customerName?: string;
  readOnly?: boolean;
  highlightMessageId?: string | null;
}

const OrderChatDrawer: React.FC<OrderChatDrawerProps> = memo(({
  open,
  onClose,
  orderId,
  contextType,
  brandId,
  actorSurface = 'BRAND',
  customerName,
  readOnly = false,
  highlightMessageId,
}) => {
  const profile = useSelector((s: RootState) => s.user.profile);
  const myId = profile?.id;
  const { onNotification, onMessageEvent } = useRealtime();

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customOrderDetail, setCustomOrderDetail] = useState<CustomOrderDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const loadSequenceRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!orderId) return;
    if (actorSurface === 'BRAND' && !brandId) {
      setMessages([]);
      return;
    }
    try {
      const response =
        actorSurface === 'ADMIN'
          ? contextType === 'CUSTOM_ORDER'
            ? await messagingApi.listAdminCustomOrderMessages(orderId, { limit: 50 })
            : await messagingApi.listAdminOrderMessages(orderId, { limit: 50 })
          : contextType === 'CUSTOM_ORDER'
            ? actorSurface === 'BRAND' && brandId
              ? await messagingApi.listCustomOrderMessagesForBrand(brandId, orderId, { limit: 50 })
              : await messagingApi.listCustomOrderMessages(orderId, { limit: 50 })
            : actorSurface === 'BRAND' && brandId
              ? await messagingApi.listOrderMessagesForBrand(brandId, orderId, { limit: 50 })
              : await messagingApi.listOrderMessages(orderId, { limit: 50 });

      const sorted = [...response.items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(sorted);

      // Mark as read
      if (actorSurface !== 'ADMIN') {
        const lastId = sorted.at(-1)?.id;
        if (lastId) {
          if (contextType === 'CUSTOM_ORDER') {
            if (actorSurface === 'BRAND' && brandId) {
              await messagingApi.markCustomOrderReadForBrand(brandId, orderId, lastId);
            } else {
              await messagingApi.markCustomOrderRead(orderId, lastId);
            }
          } else {
            if (actorSurface === 'BRAND' && brandId) {
              await messagingApi.markOrderReadForBrand(brandId, orderId, lastId);
            } else {
              await messagingApi.markOrderRead(orderId, lastId);
            }
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load messages');
    }
  }, [actorSurface, brandId, contextType, orderId]);

  const fetchCustomOrderDetail = useCallback(async () => {
    if (contextType !== 'CUSTOM_ORDER') {
      setCustomOrderDetail(null);
      return;
    }

    if (actorSurface === 'BRAND' && !brandId) {
      setCustomOrderDetail(null);
      return;
    }

    try {
      const detail = actorSurface === 'BRAND' && brandId
        ? await customOrdersBrandApi.getById(brandId, orderId)
        : await customOrdersBuyerApi.getById(orderId);
      setCustomOrderDetail(detail);
    } catch {
      setCustomOrderDetail(null);
    }
  }, [actorSurface, brandId, contextType, orderId]);

  // Load messages when opened
  useEffect(() => {
    if (!open) return;
    const loadId = ++loadSequenceRef.current;
    setLoading(true);
    Promise.all([fetchMessages(), fetchCustomOrderDetail()]).finally(() => {
      if (loadSequenceRef.current !== loadId) return;
      setLoading(false);
      scrollToBottom();
    });
  }, [open, fetchCustomOrderDetail, fetchMessages, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Real-time subscription
  useEffect(() => {
    if (!open || !orderId) return;
    const unsubNotif = onNotification((payload: any) => {
      const type = String(payload?.type ?? '');
      if (type !== 'MESSAGE_RECEIVED' && type !== 'MESSAGE_MODERATED') return;
      const pOrderId = String(payload?.payload?.customOrderId ?? payload?.payload?.orderId ?? '');
      if (pOrderId !== orderId) return;
      void fetchMessages().then(scrollToBottom);
    });
    // Listen for direct message.read and thread.updated WebSocket events to update tick status
    const unsubRead = onMessageEvent('message.read', (payload: any) => {
      const pOrderId = String(payload?.customOrderId ?? payload?.orderId ?? '');
      if (pOrderId !== orderId) return;
      void fetchMessages();
    });
    const unsubThread = onMessageEvent('thread.updated', (payload: any) => {
      const pOrderId = String(payload?.customOrderId ?? payload?.orderId ?? '');
      if (pOrderId !== orderId) return;
      void fetchMessages();
    });
    return () => { unsubNotif(); unsubRead(); unsubThread(); };
  }, [open, orderId, onNotification, onMessageEvent, fetchMessages, scrollToBottom]);

  const handleRequestExtension = useCallback(async () => {
    if (actorSurface !== 'BRAND' || !brandId) return;

    const dayInput = window.prompt('How many extra days do you need?', '3');
    if (!dayInput) return;
    const requestedExtraDays = Number(dayInput);
    if (!Number.isFinite(requestedExtraDays) || requestedExtraDays < 1) {
      toast.error('Extra days must be a valid number greater than 0.');
      return;
    }

    const reason = window.prompt('Brief reason for this extension request', 'Additional finishing and quality checks');
    if (!reason || !reason.trim()) {
      toast.error('Reason is required.');
      return;
    }

    setActionLoading(true);
    try {
      if (contextType === 'CUSTOM_ORDER') {
        await messagingApi.requestCustomOrderExtensionForBrand(brandId, orderId, {
          targetType: 'PRODUCTION',
          requestedExtraDays,
          reason: reason.trim(),
        });
      } else {
        await messagingApi.requestOrderExtensionForBrand(brandId, orderId, {
          requestedExtraDays,
          reason: reason.trim(),
        });
      }
      toast.success('Extension request sent to buyer.');
      await Promise.all([fetchMessages(), fetchCustomOrderDetail()]);
      scrollToBottom();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to send extension request.');
    } finally {
      setActionLoading(false);
    }
  }, [actorSurface, brandId, contextType, fetchCustomOrderDetail, fetchMessages, orderId, scrollToBottom]);

  const latestOpenExtensionRequest = useMemo(() => {
    if (contextType === 'CUSTOM_ORDER') {
      if (!customOrderDetail?.extensionRequests?.length) return null;
      const openRequests = customOrderDetail.extensionRequests
        .filter((request) => request.buyerResponseStatus === 'OPEN')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const first = openRequests[0] || null;
      return first ? { id: first.id, requestedExtraDays: first.requestedExtraDays } : null;
    }

    const extensionRequestMessage = [...messages]
      .reverse()
      .find((message) => {
        const meta = (message as any)?.metadataJson as Record<string, unknown> | undefined;
        return String(meta?.eventType || '') === 'STANDARD_ORDER_EXTENSION_REQUESTED';
      });

    if (!extensionRequestMessage) return null;
    const messageMeta = ((extensionRequestMessage as any)?.metadataJson || {}) as Record<string, unknown>;
    const requestedExtraDays = Number(messageMeta.requestedExtraDays || 0);
    return {
      id: extensionRequestMessage.id,
      requestedExtraDays: Number.isFinite(requestedExtraDays) ? requestedExtraDays : 0,
    };
  }, [contextType, customOrderDetail?.extensionRequests, messages]);

  const respondToExtension = useCallback(async (response: 'ACCEPTED' | 'REJECTED' | 'COUNTERED') => {
    if (!latestOpenExtensionRequest || actorSurface !== 'BUYER') return;

    let counterDays: number | undefined;
    if (response === 'COUNTERED') {
      const counterInput = window.prompt('Counter with how many extra days?', '2');
      if (!counterInput) return;
      const parsed = Number(counterInput);
      if (!Number.isFinite(parsed) || parsed < 1) {
        toast.error('Counter days must be greater than 0.');
        return;
      }
      counterDays = parsed;
    }

    setActionLoading(true);
    try {
      if (contextType === 'CUSTOM_ORDER') {
        await messagingApi.respondToCustomOrderExtension(orderId, latestOpenExtensionRequest.id, {
          response,
          counterDays,
        });
      } else {
        await messagingApi.respondToOrderExtension(orderId, latestOpenExtensionRequest.id, {
          response,
          counterDays,
        });
      }
      toast.success('Extension response submitted.');
      await Promise.all([fetchMessages(), fetchCustomOrderDetail()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to respond to extension request.');
    } finally {
      setActionLoading(false);
    }
  }, [actorSurface, contextType, fetchCustomOrderDetail, fetchMessages, latestOpenExtensionRequest, orderId]);

  const handleOpenDispute = useCallback(async () => {
    if (actorSurface !== 'BUYER' && actorSurface !== 'BRAND') return;

    const description = window.prompt('Describe the issue for this dispute', 'Order quality issue and delayed delivery');
    if (!description || !description.trim()) {
      toast.error('Issue description is required.');
      return;
    }

    setActionLoading(true);
    try {
      if (contextType === 'CUSTOM_ORDER') {
        if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.openCustomOrderDisputeForBrand(brandId, orderId, {
            issueType: 'OTHER',
            description: description.trim(),
          });
        } else {
          await messagingApi.openCustomOrderDispute(orderId, {
            issueType: 'OTHER',
            description: description.trim(),
          });
        }
      } else if (actorSurface === 'BRAND' && brandId) {
        await messagingApi.openOrderDisputeForBrand(brandId, orderId, {
          description: description.trim(),
        });
      } else {
        await messagingApi.openOrderDispute(orderId, {
          description: description.trim(),
        });
      }
      toast.success('Dispute process initiated. The order team has been notified.');
      await Promise.all([fetchMessages(), fetchCustomOrderDetail()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to initiate dispute.');
    } finally {
      setActionLoading(false);
    }
  }, [actorSurface, brandId, contextType, fetchCustomOrderDetail, fetchMessages, orderId]);

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

  const handleSend = useCallback(async (bodyText: string, attachmentFileIds: string[]) => {
    const clientMessageId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      bodyText: bodyText || undefined,
      clientMessageId,
      attachmentFileIds,
    };

    // Optimistic: add message to local list immediately
    const optimisticMsg: ThreadMessage & { _optimistic?: 'sending' | 'failed' } = {
      id: clientMessageId,
      threadId: '',
      senderUserId: myId ?? null,
      senderRole: actorSurface === 'BRAND' ? 'BRAND_OWNER' : actorSurface === 'ADMIN' ? 'ADMIN' : 'BUYER',
      kind: 'USER',
      visibilityState: 'VISIBLE',
      bodyText: bodyText || null,
      createdAt: new Date().toISOString(),
      sender: profile ? { id: profile.id, username: profile.username ?? null, firstName: profile.firstName ?? null, lastName: profile.lastName ?? null, profileImage: profile.profileImage ?? null } : null,
      attachments: [],
      _optimistic: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      if (contextType === 'CUSTOM_ORDER') {
        if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.sendCustomOrderMessageForBrand(brandId, orderId, payload);
        } else {
          await messagingApi.sendCustomOrderMessage(orderId, payload);
        }
      } else {
        if (actorSurface === 'BRAND' && brandId) {
          await messagingApi.sendOrderMessageForBrand(brandId, orderId, payload);
        } else {
          await messagingApi.sendOrderMessage(orderId, payload);
        }
      }

      // Replace optimistic message with real data
      await fetchMessages();
      scrollToBottom();
    } catch {
      // Mark the optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === clientMessageId ? { ...m, _optimistic: 'failed' } : m,
        ),
      );
    }
  }, [actorSurface, brandId, contextType, orderId, fetchMessages, scrollToBottom, myId, profile]);

  if (!open) return null;

  // Group messages by date
  const groupedMessages: { date: string; msgs: ThreadMessage[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [msg] });
      lastDate = d;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-layer-drawer bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-layer-drawer flex h-dvh max-h-dvh w-full max-w-md min-h-0 flex-col overflow-hidden border-l border-gray-200/50 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out dark:border-white/10 dark:bg-zinc-900/95">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200/50 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              💬 {customerName ? `Chat with ${customerName}` : 'Order Chat'}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {contextType === 'CUSTOM_ORDER' ? 'Custom' : 'Standard'} Order · {orderId.slice(0, 8)}…
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {actorSurface !== 'ADMIN' && !readOnly ? (
          <div className="shrink-0 border-b border-gray-200/50 px-4 py-2.5 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {actorSurface === 'BRAND' ? (
                <button
                  type="button"
                  onClick={() => void handleRequestExtension()}
                  disabled={actionLoading}
                  className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-700 disabled:opacity-60 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"
                >
                  ⏳ Request extra time
                </button>
              ) : null}

              {actorSurface === 'BUYER' && latestOpenExtensionRequest ? (
                <>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Extension request: +{latestOpenExtensionRequest.requestedExtraDays} days
                  </span>
                  <button
                    type="button"
                    onClick={() => void respondToExtension('ACCEPTED')}
                    disabled={actionLoading}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    ✅ Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToExtension('REJECTED')}
                    disabled={actionLoading}
                    className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    ❌ Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToExtension('COUNTERED')}
                    disabled={actionLoading}
                    className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                  >
                    ↔️ Counter
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => void handleOpenDispute()}
                disabled={actionLoading}
                className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-60 dark:border-white/20 dark:bg-white/5 dark:text-slate-200"
              >
                ⚠️ Open dispute
              </button>
            </div>
          </div>
        ) : null}

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-6 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <VLoader size={24} phase="loading" showLabel={false} />
                <span>Loading thread…</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start a conversation about this order</p>
            </div>
          ) : (
            groupedMessages.map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/10" />
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/10" />
                </div>
                {group.msgs.map(msg => (
                  <div key={msg.id} ref={(node) => { messageNodeRefs.current[msg.id] = node; }}>
                    <MessageBubble message={msg} isOwn={!!myId && msg.senderUserId === myId} />
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        {!readOnly && actorSurface !== 'ADMIN' && (
          <ComposeArea
            onSend={handleSend}
            disabled={loading}
            placeholder="Type a message…"
          />
        )}
      </div>
    </>
  );
});

OrderChatDrawer.displayName = 'OrderChatDrawer';
export default OrderChatDrawer;
