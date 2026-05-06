import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { messagingApi, type InboxItem, type ThreadMessage, type ThreadOrderItem } from '@/api/MessagingApi';
import { customOrdersBuyerApi, customOrdersBrandApi, type CustomOrderDetail } from '@/api/CustomOrderApi';
import { getStoreStatus } from '@/api/StoreApi';
import { useRealtime } from '@/realtime/RealtimeProvider';
import ImageWithFallback from '@/components/ImageWithFallback';
import MessageBubble, { formatDate } from '@/components/messaging/MessageBubble';
import ComposeArea from '@/components/messaging/ComposeArea';
import ChatContactSidebar from '@/components/messaging/ChatContactSidebar';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';
import { hasActiveBrandMembership } from '@/lib/brandAccess';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ConversationContext = 'DIRECT' | 'INQUIRY' | 'STANDARD_ORDER' | 'CUSTOM_ORDER';
type Surface = 'BRAND' | 'BUYER';
type ActiveAction = null | 'extension-request' | 'dispute';

type ConversationItem = {
  id: string;
  threadId: string;
  contextType: ConversationContext;
  contextId?: string;
  orderId?: string | null;
  customOrderId?: string | null;
  targetUrl?: string | null;
  /** Canonical order-detail page URL — use this for the "View Order" action. */
  orderDetailUrl?: string | null;
  title: string;
  subtitle: string;
  participantName: string;
  participantId?: string | null;
  participantImage?: string | null;
  participantUsername?: string | null;
  status?: string | null;
  createdAt: string;
  lastMessageAt?: string | null;
  unreadCount: number;
  hasUnread: boolean;
  mutedUntil?: string | null;
  archivedAt?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Orders', value: 'orders' },
  { label: 'Custom', value: 'custom' },
  { label: 'Inquiries', value: 'inquiry' },
  { label: 'Archived', value: 'archived' },
] as const;

const DISPUTE_ISSUE_TYPES = [
  { label: 'Wrong Item', value: 'WRONG_ITEM' },
  { label: 'Material Defect', value: 'MATERIAL_DEFECT' },
  { label: 'Measurement Issue', value: 'MEASUREMENT_NON_COMPLIANCE' },
  { label: 'Unfinished Work', value: 'UNFINISHED_WORK' },
  { label: 'Non Delivery', value: 'NON_DELIVERY' },
  { label: 'Unreasonable Delay', value: 'UNREASONABLE_DELAY' },
  { label: 'Other', value: 'OTHER' },
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatRelative = (value?: string | null) => {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const mapInboxItem = (item: InboxItem): ConversationItem => ({
  id: item.threadId,
  threadId: item.threadId,
  contextType: item.contextType,
  contextId:
    item.contextType === 'STANDARD_ORDER'
      ? item.orderId || item.threadId
      : item.contextType === 'CUSTOM_ORDER'
        ? item.customOrderId || item.threadId
        : item.threadId,
  orderId: item.orderId ?? null,
  customOrderId: item.customOrderId ?? null,
  targetUrl: item.targetUrl ?? null,
  orderDetailUrl: item.orderDetailUrl ?? null,
  title: item.title,
  subtitle: item.subtitle,
  participantName:
    item.participant?.firstName || item.participant?.username || item.participant?.lastName || 'Participant',
  participantId: item.participant?.id || null,
  participantImage: item.participant?.profileImage || null,
  participantUsername: item.participant?.username || null,
  createdAt: item.createdAt,
  lastMessageAt: item.lastMessageAt ?? null,
  unreadCount: Number(item.unreadCount ?? 0),
  hasUnread: Boolean(item.hasUnread),
  mutedUntil: item.mutedUntil ?? null,
  archivedAt: item.archivedAt ?? null,
});

const nextClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

/* ------------------------------------------------------------------ */
/*  Inline Action Panels (bot-pattern cards)                           */
/* ------------------------------------------------------------------ */

const ExtensionRequestPanel: React.FC<{
  onSubmit: (days: number, reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ onSubmit, onCancel, loading }) => {
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState('');

  return (
    <div className="mx-3 mb-2 rounded-xl border border-orange-200/60 dark:border-orange-500/20 bg-orange-50/80 dark:bg-orange-500/5 p-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" role="img" aria-label="clock">⏳</span>
        <span className="text-[11px] font-semibold text-orange-800 dark:text-orange-300">Request Extra Time</span>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-20 shrink-0">
          <label className="text-[10px] font-medium text-theme-secondary">Days</label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-0.5 w-full rounded-lg border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-400/50"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-medium text-theme-secondary">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief reason..."
            className="mt-0.5 w-full rounded-lg border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-orange-400/50"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
        <button
          type="button"
          onClick={() => {
            if (days < 1) { toast.error('Days must be at least 1'); return; }
            if (!reason.trim()) { toast.error('Reason is required'); return; }
            onSubmit(days, reason.trim());
          }}
          disabled={loading}
          className="rounded-lg bg-orange-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  );
};

const ExtensionResponsePanel: React.FC<{
  requestedDays: number;
  onRespond: (response: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', counterDays?: number) => void;
  loading: boolean;
}> = ({ requestedDays, onRespond, loading }) => {
  const [showCounter, setShowCounter] = useState(false);
  const [counterDays, setCounterDays] = useState(Math.max(1, requestedDays - 1));

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-blue-200/60 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-500/5 p-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 dark:bg-blue-500/20">
          <span aria-hidden="true" className="text-sm text-blue-600 dark:text-blue-400">⏳</span>
        </div>
        <div>
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Extension Request</span>
          <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70">Brand requested +{requestedDays} extra days</p>
        </div>
      </div>

      {showCounter ? (
        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-medium text-theme-secondary">Counter with days</label>
            <input
              type="number"
              min={1}
              max={30}
              value={counterDays}
              onChange={(e) => setCounterDays(Number(e.target.value))}
              className="mt-0.5 w-full rounded-lg border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-400/50"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowCounter(false)} disabled={loading} className="rounded-lg px-3 py-1.5 text-xs font-medium text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5">
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (counterDays < 1) { toast.error('Counter days must be at least 1'); return; }
                onRespond('COUNTERED', counterDays);
              }}
              disabled={loading}
              className="rounded-lg bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Counter'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRespond('ACCEPTED')}
            disabled={loading}
            className="flex-1 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => onRespond('REJECTED')}
            disabled={loading}
            className="flex-1 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setShowCounter(true)}
            disabled={loading}
            className="flex-1 rounded-lg border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            Counter
          </button>
        </div>
      )}
    </div>
  );
};

const DisputePanel: React.FC<{
  contextType: ConversationContext;
  onSubmit: (issueType: string, description: string) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ contextType, onSubmit, onCancel, loading }) => {
  const [issueType, setIssueType] = useState('OTHER');
  const [description, setDescription] = useState('');

  return (
    <div className="mx-3 mb-2 rounded-xl border border-red-200/60 dark:border-red-500/20 bg-red-50/80 dark:bg-red-500/5 p-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm" role="img" aria-label="warning">⚠️</span>
        <span className="text-[11px] font-semibold text-red-800 dark:text-red-300">Open Dispute</span>
      </div>
      <div className="space-y-2">
        {contextType === 'CUSTOM_ORDER' && (
          <div>
            <label className="text-[11px] font-medium text-theme-secondary">Issue Type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-gray-200/60 dark:border-transparent bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-400/50"
            >
              {DISPUTE_ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-[11px] font-medium text-theme-secondary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Describe the issue..."
            className="mt-0.5 w-full resize-none rounded-lg border border-gray-200/60 dark:border-transparent bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-400/50"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!description.trim()) { toast.error('Description is required'); return; }
              onSubmit(issueType, description.trim());
            }}
            disabled={loading}
            className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const MessagingManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';
  const [params, setParams] = useSearchParams();
  const profile = useSelector((state: RootState) => state.user.profile);
  const surface: Surface = hasActiveBrandMembership(profile) ? 'BRAND' : 'BUYER';
  const [brandId, setBrandId] = useState<string | null>(null);
  const actorId = profile?.id;
  const { onNotification } = useRealtime();

  /* ---- Conversation state ---- */
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'orders' | 'custom' | 'inquiry' | 'archived'>('all');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const highlightedMessageId = params.get('messageId');

  /* ---- Message state ---- */
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const sending = false;
  const [customOrderDetail, setCustomOrderDetail] = useState<CustomOrderDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'closed' | 'cancelled' | 'disputed'>('all');
  const [threadOrders, setThreadOrders] = useState<ThreadOrderItem[]>([]);
  const [selectedOrderKey, setSelectedOrderKey] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadBrandScope = async () => {
      if (surface !== 'BRAND') {
        setBrandId(null);
        return;
      }

      try {
        const status = await getStoreStatus();
        if (!cancelled) {
          setBrandId(status.brandId);
        }
      } catch {
        if (!cancelled) {
          setBrandId(null);
        }
      }
    };

    void loadBrandScope();

    return () => {
      cancelled = true;
    };
  }, [surface]);

  /* ---- Refs ---- */
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ---- Derived ---- */
  const activeConversation = conversations.find((item) => item.id === activeId) || null;
  const activeAvatarSource = resolveAvatarMediaSource(activeConversation?.participantImage);
  const contactSidebarProps = activeConversation
    ? {
        participant: activeConversation.participantId
          ? {
              id: activeConversation.participantId,
              name: activeConversation.participantName,
              username: activeConversation.participantUsername,
              profileImage: activeConversation.participantImage,
            }
          : null,
        contextType: activeConversation.contextType,
        orderId: activeConversation.orderId,
        customOrderId: activeConversation.customOrderId,
        targetUrl: activeConversation.targetUrl,
        orderDetailUrl: activeConversation.orderDetailUrl,
        status: activeConversation.status,
        mutedUntil: activeConversation.mutedUntil,
        archivedAt: activeConversation.archivedAt,
        messages,
        isInquiry: activeConversation.contextType === 'INQUIRY',
        onMarkRead: () => void updateThreadPrefs(activeConversation, { markRead: true }),
        onToggleMute: () =>
          void updateThreadPrefs(activeConversation, activeConversation.mutedUntil ? { unmute: true } : { muteForHours: 24 }),
        onToggleArchive: () => void updateThreadPrefs(activeConversation, { archived: !activeConversation.archivedAt }),
      }
    : null;

  useEffect(() => {
    setShowContactDetails(false);
  }, [activeId]);

  const getContextId = useCallback((item: ConversationItem) => {
    if (item.contextType === 'STANDARD_ORDER') return item.orderId || item.contextId || item.threadId;
    if (item.contextType === 'CUSTOM_ORDER') return item.customOrderId || item.contextId || item.threadId;
    return item.threadId;
  }, []);

  const openRoute = useCallback(
    (path: string) => {
      if (isEmbeddedMobile) {
        postStudioNativeEvent({ type: 'OPEN_NATIVE_ROUTE', path });
        return;
      }

      navigate(path);
    },
    [isEmbeddedMobile, navigate],
  );

  const useThreadTransport = Boolean(activeConversation?.threadId);
  const selectedOrder = useMemo(
    () => threadOrders.find((order) => `${order.type}:${order.id}` === selectedOrderKey) ?? null,
    [selectedOrderKey, threadOrders],
  );
  const showOrderActions = threadOrders.length > 0 && Boolean(selectedOrder);

  const visibleConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = conversations.filter((item) => {
      if (filter === 'archived') return Boolean(item.archivedAt);
      if (item.archivedAt) return false;
      if (filter === 'unread' && !item.hasUnread && item.unreadCount <= 0) return false;
      if (filter === 'orders' && item.contextType !== 'STANDARD_ORDER') return false;
      if (filter === 'custom' && item.contextType !== 'CUSTOM_ORDER') return false;
      if (filter === 'inquiry' && item.contextType !== 'INQUIRY') return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.participantName.toLowerCase().includes(q)
      );
    });

    rows.sort((a, b) => {
      // Unread first
      if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1;
      const aTs = new Date(a.lastMessageAt || a.createdAt).getTime();
      const bTs = new Date(b.lastMessageAt || b.createdAt).getTime();
      return bTs - aTs;
    });

    return rows;
  }, [conversations, filter, query]);

  /* ---- Scroll helpers ---- */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  /* ---- Load conversations ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const inbox = await messagingApi.getInbox({ limit: 100, contextType: 'all', filter: 'all' });
        if (!cancelled) setConversations((inbox.items || []).map(mapInboxItem));
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.response?.data?.message || 'Unable to load conversations');
          setConversations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [brandId, surface]);

  /* ---- Auto-select from URL params ---- */
  useEffect(() => {
    if (conversations.length === 0) { setActiveId(''); return; }

    const queryOrderId = params.get('orderId');
    const queryCustomOrderId = params.get('customOrderId');

    if (queryOrderId) {
      const t = conversations.find((i) => i.contextType === 'STANDARD_ORDER' && i.orderId === queryOrderId);
      if (t) { setActiveId(t.id); return; }
    }
    if (queryCustomOrderId) {
      const t = conversations.find((i) => i.contextType === 'CUSTOM_ORDER' && i.customOrderId === queryCustomOrderId);
      if (t) { setActiveId(t.id); return; }
    }

    const queryThreadId = params.get('threadId') || params.get('thread');
    if (queryThreadId) {
      if (conversations.some((i) => i.id === queryThreadId)) { setActiveId(queryThreadId); return; }
      void messagingApi.resolveThreadRoute(queryThreadId).then((resolved) => {
        const next = new URLSearchParams(params);
        next.set('threadId', resolved.threadId);
        if (resolved.orderId) next.set('orderId', resolved.orderId);
        if (resolved.customOrderId) next.set('customOrderId', resolved.customOrderId);
        setParams(next, { replace: true });
      }).catch(() => {});
    }

    if (!activeId || !conversations.some((i) => i.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations, params, setParams]);

  /* ---- Load messages when active conversation changes ---- */
  const fetchMessages = useCallback(async () => {
    if (!activeConversation) return;
    const contextId = getContextId(activeConversation);
    const threadId = activeConversation.threadId;
    const requiresBrandScope =
      surface === 'BRAND' &&
      activeConversation.contextType !== 'INQUIRY' &&
      !useThreadTransport;

    if (requiresBrandScope && !brandId) {
      setMessages([]);
      return;
    }

    if (useThreadTransport && threadId) {
      const response = await messagingApi.listThreadMessages(threadId, { limit: 50 });
      const sorted = [...response.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(sorted);
      const lastId = sorted.at(-1)?.id;
      if (lastId) await messagingApi.markThreadReadById(threadId, lastId);
      return;
    }

    const ct = activeConversation.contextType;
    const response =
      ct === 'INQUIRY'
        ? await messagingApi.listThreadMessages(contextId, { limit: 50 })
        : ct === 'CUSTOM_ORDER'
          ? surface === 'BRAND' && brandId
            ? await messagingApi.listCustomOrderMessagesForBrand(brandId, contextId, { limit: 50 })
            : await messagingApi.listCustomOrderMessages(contextId, { limit: 50 })
          : surface === 'BRAND' && brandId
            ? await messagingApi.listOrderMessagesForBrand(brandId, contextId, { limit: 50 })
            : await messagingApi.listOrderMessages(contextId, { limit: 50 });

    const sorted = [...response.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setMessages(sorted);

    const lastId = sorted.at(-1)?.id;
    if (lastId) {
      if (ct === 'INQUIRY') {
        await messagingApi.markThreadReadById(contextId, lastId);
      } else if (ct === 'CUSTOM_ORDER') {
        if (surface === 'BRAND' && brandId) await messagingApi.markCustomOrderReadForBrand(brandId, contextId, lastId);
        else await messagingApi.markCustomOrderRead(contextId, lastId);
      } else {
        if (surface === 'BRAND' && brandId) await messagingApi.markOrderReadForBrand(brandId, contextId, lastId);
        else await messagingApi.markOrderRead(contextId, lastId);
      }
    }
  }, [activeConversation, brandId, getContextId, surface, useThreadTransport]);

  const fetchCustomOrderDetail = useCallback(async () => {
    if (!activeConversation || activeConversation.contextType !== 'CUSTOM_ORDER') {
      setCustomOrderDetail(null);
      return;
    }
    const contextId = getContextId(activeConversation);
    if (surface === 'BRAND' && !brandId) {
      setCustomOrderDetail(null);
      return;
    }
    try {
      const detail = surface === 'BRAND' && brandId
        ? await customOrdersBrandApi.getById(brandId, contextId)
        : await customOrdersBuyerApi.getById(contextId);
      setCustomOrderDetail(detail);
    } catch {
      setCustomOrderDetail(null);
    }
  }, [activeConversation, brandId, getContextId, surface]);

  const fetchThreadOrders = useCallback(async () => {
    if (!activeConversation?.threadId) {
      setThreadOrders([]);
      setSelectedOrderKey('');
      return;
    }

    try {
      const response = await messagingApi.listThreadOrders(activeConversation.threadId, { filter: orderFilter });
      const nextOrders = response.items || [];
      setThreadOrders(nextOrders);
      setSelectedOrderKey((current) => {
        if (current && nextOrders.some((order) => `${order.type}:${order.id}` === current)) {
          return current;
        }
        return nextOrders.length === 1 ? `${nextOrders[0].type}:${nextOrders[0].id}` : '';
      });
    } catch {
      setThreadOrders([]);
      setSelectedOrderKey('');
    }
  }, [activeConversation?.threadId, orderFilter]);

  const refresh = useCallback(async () => {
    if (
      activeConversation &&
      surface === 'BRAND' &&
      activeConversation.contextType !== 'INQUIRY' &&
      !useThreadTransport &&
      !brandId
    ) {
      return;
    }
    setMessagesLoading(true);
    try {
      await Promise.all([fetchMessages(), fetchCustomOrderDetail(), fetchThreadOrders()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load messages');
    } finally {
      setMessagesLoading(false);
      scrollToBottom();
    }
  }, [fetchMessages, fetchCustomOrderDetail, fetchThreadOrders, scrollToBottom]);

  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    setActiveAction(null);
    setOrderFilter('all');
    setSelectedOrderKey('');
    void refresh();
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeConversation) return;
    void fetchThreadOrders();
  }, [orderFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Polling ---- */
  useEffect(() => {
    if (!activeConversation) return;
    let intervalId: number | null = null;
    const setup = () => {
      if (intervalId) window.clearInterval(intervalId);
      if (document.visibilityState === 'visible') {
        intervalId = window.setInterval(() => void refresh(), 25000);
      }
    };
    setup();
    const onVis = () => { setup(); if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (intervalId) window.clearInterval(intervalId); };
  }, [activeConversation, refresh]);

  /* ---- Real-time ---- */
  useEffect(() => {
    if (!activeConversation) return;
    const contextId = getContextId(activeConversation);
    const threadId = activeConversation.threadId;

    const unsubscribe = onNotification((payload: any) => {
      const type = String(payload?.type ?? '');
      if (type !== 'MESSAGE_RECEIVED' && type !== 'MESSAGE_MODERATED' && type !== 'MESSAGE_UNREAD_REMINDER' && type !== 'MESSAGE_THREAD_REOPENED') return;
      const pId = String(payload?.payload?.threadId ?? payload?.payload?.customOrderId ?? payload?.payload?.orderId ?? '');
      if (pId !== contextId && pId !== threadId) return;
      void refresh();
    });
    return unsubscribe;
  }, [activeConversation, getContextId, onNotification, refresh]);

  /* ---- Highlight message ---- */
  useEffect(() => {
    if (!highlightedMessageId) return;
    const node = messageNodeRefs.current[highlightedMessageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ring-2', 'ring-orange-400');
    const t = window.setTimeout(() => node.classList.remove('ring-2', 'ring-orange-400'), 1800);
    return () => window.clearTimeout(t);
  }, [highlightedMessageId, messages]);

  /* ---- Scroll on new messages ---- */
  useEffect(() => { if (messages.length > 0) scrollToBottom(); }, [messages.length, scrollToBottom]);

  /* ---- Extension request detection ---- */
  const latestOpenExtensionRequest = useMemo(() => {
    if (!activeConversation) return null;
    if (activeConversation.contextType === 'CUSTOM_ORDER') {
      if (!customOrderDetail?.extensionRequests?.length) return null;
      const open = customOrderDetail.extensionRequests
        .filter((r: any) => r.buyerResponseStatus === 'OPEN')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const first = open[0];
      return first ? { id: first.id, requestedExtraDays: first.requestedExtraDays } : null;
    }
    const extMsg = [...messages].reverse().find((m) => {
      const meta = (m as any)?.metadataJson as Record<string, unknown> | undefined;
      return String(meta?.eventType || '') === 'STANDARD_ORDER_EXTENSION_REQUESTED';
    });
    if (!extMsg) return null;
    const meta = ((extMsg as any)?.metadataJson || {}) as Record<string, unknown>;
    const days = Number(meta.requestedExtraDays || 0);
    return { id: extMsg.id, requestedExtraDays: Number.isFinite(days) ? days : 0 };
  }, [activeConversation, customOrderDetail, messages]);

  /* ---- Handlers ---- */

  const selectConversation = (item: ConversationItem) => {
    setActiveId(item.id);
    const next = new URLSearchParams();
    next.set('threadId', item.threadId);
    if (item.contextType === 'STANDARD_ORDER' && item.orderId) next.set('orderId', item.orderId);
    else if (item.contextType === 'CUSTOM_ORDER' && item.customOrderId) next.set('customOrderId', item.customOrderId);
    setParams(next, { replace: true });
  };

  const updateThreadPrefs = async (
    item: ConversationItem,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) => {
    if (surface === 'BRAND' && !brandId) return;
    const contextId = getContextId(item);

    if (item.contextType === 'INQUIRY') {
      if (payload.markRead) await messagingApi.markThreadReadById(item.threadId);
    } else if (item.contextType === 'STANDARD_ORDER') {
      if (surface === 'BRAND') await messagingApi.updateOrderThreadPreferencesForBrand(brandId as string, contextId, payload);
      else await messagingApi.updateOrderThreadPreferences(contextId, payload);
    } else if (surface === 'BRAND') {
      await messagingApi.updateCustomOrderThreadPreferencesForBrand(brandId as string, contextId, payload);
    } else {
      await messagingApi.updateCustomOrderThreadPreferences(contextId, payload);
    }

    setConversations((prev) => prev.map((entry) => {
      if (entry.id !== item.id) return entry;
      return {
        ...entry,
        mutedUntil: payload.unmute ? null : payload.muteForHours ? new Date(Date.now() + payload.muteForHours * 3600000).toISOString() : entry.mutedUntil ?? null,
        archivedAt: payload.archived === undefined ? entry.archivedAt ?? null : payload.archived ? new Date().toISOString() : null,
        unreadCount: payload.markRead ? 0 : entry.unreadCount,
        hasUnread: payload.markRead ? false : entry.hasUnread,
      };
    }));
  };

  const handleSend = useCallback(async (bodyText: string, attachmentFileIds: string[]) => {
    if (!activeConversation) return;
    const contextId = getContextId(activeConversation);
    const threadId = activeConversation.threadId;
    const ct = activeConversation.contextType;
    const payload = { bodyText: bodyText || undefined, clientMessageId: nextClientMessageId(), attachmentFileIds };

    if ((ct === 'INQUIRY' || useThreadTransport) && threadId) {
      await messagingApi.sendThreadMessage(threadId, payload);
    } else if (ct === 'INQUIRY') {
      await messagingApi.sendThreadMessage(contextId, payload);
    } else if (ct === 'CUSTOM_ORDER') {
      if (surface === 'BRAND' && brandId) await messagingApi.sendCustomOrderMessageForBrand(brandId, contextId, payload);
      else await messagingApi.sendCustomOrderMessage(contextId, payload);
    } else {
      if (surface === 'BRAND' && brandId) await messagingApi.sendOrderMessageForBrand(brandId, contextId, payload);
      else await messagingApi.sendOrderMessage(contextId, payload);
    }

    await refresh();

    // Update conversation list card with latest message preview
    setConversations((prev) => prev.map((c) =>
      c.id !== activeId ? c : {
        ...c,
        subtitle: bodyText || (attachmentFileIds.length > 0 ? '📎 Attachment' : c.subtitle),
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        hasUnread: false,
      }
    ));
  }, [activeConversation, activeId, brandId, getContextId, refresh, surface, useThreadTransport]);

  const handleRequestExtension = useCallback(async (days: number, reason: string) => {
    if (!activeConversation || !selectedOrder || surface !== 'BRAND' || !brandId) return;
    const contextId = selectedOrder.id;
    setActionLoading(true);
    try {
      if (selectedOrder.type === 'CUSTOM_ORDER') {
        await messagingApi.requestCustomOrderExtensionForBrand(brandId, contextId, { targetType: 'PRODUCTION', requestedExtraDays: days, reason });
      } else {
        await messagingApi.requestOrderExtensionForBrand(brandId, contextId, { requestedExtraDays: days, reason });
      }
      toast.success('Extension request sent.');
      setActiveAction(null);
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to send extension request.');
    } finally {
      setActionLoading(false);
    }
  }, [activeConversation, brandId, refresh, selectedOrder, surface]);

  const handleRespondToExtension = useCallback(async (response: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', counterDays?: number) => {
    if (!activeConversation || !latestOpenExtensionRequest || surface !== 'BUYER') return;
    const contextId = getContextId(activeConversation);
    setActionLoading(true);
    try {
      if (activeConversation.contextType === 'CUSTOM_ORDER') {
        await messagingApi.respondToCustomOrderExtension(contextId, latestOpenExtensionRequest.id, { response, counterDays });
      } else {
        await messagingApi.respondToOrderExtension(contextId, latestOpenExtensionRequest.id, { response, counterDays });
      }
      toast.success('Extension response submitted.');
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to respond.');
    } finally {
      setActionLoading(false);
    }
  }, [activeConversation, getContextId, latestOpenExtensionRequest, refresh, surface]);

  const handleOpenDispute = useCallback(async (issueType: string, description: string) => {
    if (!activeConversation || !selectedOrder) return;
    const contextId = selectedOrder.id;
    setActionLoading(true);
    try {
      if (selectedOrder.type === 'CUSTOM_ORDER') {
        if (surface === 'BRAND' && brandId) {
          await messagingApi.openCustomOrderDisputeForBrand(brandId, contextId, { issueType: issueType as any, description });
        } else {
          await messagingApi.openCustomOrderDispute(contextId, { issueType: issueType as any, description });
        }
      } else if (surface === 'BRAND' && brandId) {
        await messagingApi.openOrderDisputeForBrand(brandId, contextId, { description });
      } else {
        await messagingApi.openOrderDispute(contextId, { description });
      }
      toast.success('Dispute submitted.');
      setActiveAction(null);
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to open dispute.');
    } finally {
      setActionLoading(false);
    }
  }, [activeConversation, brandId, refresh, selectedOrder, surface]);

  /* ---- Message grouping by date ---- */
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: ThreadMessage[] }[] = [];
    let lastDate = '';
    for (const msg of messages) {
      const d = formatDate(msg.createdAt);
      if (d !== lastDate) {
        groups.push({ date: d, msgs: [msg] });
        lastDate = d;
      } else {
        groups[groups.length - 1].msgs.push(msg);
      }
    }
    return groups;
  }, [messages]);

  /* ---- Context badge color ---- */
  const contextDotColor = (ct: ConversationContext) => {
    switch (ct) {
      case 'DIRECT': return 'bg-emerald-500';
      case 'STANDARD_ORDER': return 'bg-blue-500';
      case 'CUSTOM_ORDER': return 'bg-purple-500';
      case 'INQUIRY': return 'bg-amber-500';
    }
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-gray-200/60 dark:border-transparent bg-white/50 dark:bg-black/20 backdrop-blur-sm shadow-sm">

      {/* ============================================================ */}
      {/*  LEFT PANEL — Conversation List                               */}
      {/* ============================================================ */}
      <div className={`w-80 shrink-0 flex-col border-r border-gray-200/60 dark:border-white/[0.04] bg-white/70 dark:bg-white/[0.02] ${activeId ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3">
          <h1 className="text-base font-semibold text-theme">Messages</h1>
          <p className="text-[11px] text-theme-secondary mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Search */}
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <span aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-gray-200/60 dark:border-transparent bg-gray-50 dark:bg-white/5 pl-8 pr-3 py-2 text-xs outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/20 transition-all"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="shrink-0 px-3 pb-2 flex flex-wrap gap-1">
          {FILTERS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                filter === tab.value
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                  : 'surface-control-muted text-theme-secondary hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="space-y-1.5 py-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`message-thread-skeleton-${index}`}
                  className="h-14 animate-pulse rounded-xl bg-gray-200/80 dark:bg-white/[0.08]"
                />
              ))}
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span aria-hidden="true" className="mb-2 text-3xl text-gray-300 dark:text-gray-600">💬</span>
              <p className="text-xs text-theme-secondary">No conversations found</p>
            </div>
          ) : (
            visibleConversations.map((item) => {
              const isActive = activeId === item.id;
              const avatarSource = resolveAvatarMediaSource(item.participantImage);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectConversation(item)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all mb-0.5 ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-500/10 border-l-2 border-purple-500'
                      : 'hover:bg-gray-50 dark:hover:bg-white/[0.03] border-l-2 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-2xl overflow-hidden">
                      {item.participantImage ? (
                        <ImageWithFallback
                          src={avatarSource.src}
                          fileId={avatarSource.fileId}
                          alt={item.participantName}
                          fit="cover"
                          className="h-10 w-10"
                          rounded="xl"
                          fallbackName={item.participantName}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-sm font-bold text-white">
                          {item.participantName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Context dot */}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-transparent ${contextDotColor(item.contextType)}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`truncate text-[13px] ${isActive ? 'font-semibold text-purple-900 dark:text-purple-200' : item.hasUnread ? 'font-semibold text-theme' : 'font-medium text-theme-secondary'}`}>
                        {item.participantName}
                      </span>
                      <span className="shrink-0 text-[10px] text-theme-secondary">
                        {formatRelative(item.lastMessageAt || item.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="truncate text-[11px] text-theme-secondary">{item.subtitle || item.title}</p>
                      {item.unreadCount > 0 && (
                        <span className="shrink-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] font-bold text-white">
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  CENTER PANEL — Active Chat                                   */}
      {/* ============================================================ */}
      <div className={`flex flex-1 flex-col min-w-0 ${!activeId ? 'hidden lg:flex' : 'flex'}`}>
        {!activeConversation ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <span aria-hidden="true" className="mx-auto mb-3 block text-5xl text-gray-300 dark:text-gray-700">💬</span>
              <p className="text-sm text-theme-secondary">Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-gray-200/60 dark:border-white/[0.04] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back button */}
                <button
                  type="button"
                  onClick={() => setActiveId('')}
                  className="lg:hidden shrink-0 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  <span aria-hidden="true" className="text-base">←</span>
                </button>

                <div className="h-9 w-9 rounded-2xl overflow-hidden shrink-0">
                  {activeConversation.participantImage ? (
                    <ImageWithFallback
                      src={activeAvatarSource.src}
                      fileId={activeAvatarSource.fileId}
                      alt={activeConversation.participantName}
                      fit="cover"
                      className="h-9 w-9"
                      rounded="xl"
                      fallbackName={activeConversation.participantName}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-fuchsia-500 text-sm font-bold text-white">
                      {activeConversation.participantName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-theme truncate">{activeConversation.participantName}</h2>
                  <p className="text-[11px] text-theme-secondary truncate">{activeConversation.title}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {threadOrders.length > 0 && (
                  <>
                    <select
                      value={orderFilter}
                      onChange={(event) => setOrderFilter(event.target.value as typeof orderFilter)}
                      className="hidden sm:block rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700 outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                      aria-label="Filter orders"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="disputed">Disputed</option>
                    </select>
                    <select
                      value={selectedOrderKey}
                      onChange={(event) => setSelectedOrderKey(event.target.value)}
                      className="max-w-[180px] rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700 outline-none dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                      aria-label="Select order"
                    >
                      <option value="">Select order</option>
                      {threadOrders.map((order) => (
                        <option key={`${order.type}:${order.id}`} value={`${order.type}:${order.id}`}>
                          {order.title}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {/* Extension request (brand) */}
                {surface === 'BRAND' && showOrderActions && selectedOrder?.state === 'active' && (
                  <button
                    type="button"
                    onClick={() => setActiveAction(activeAction === 'extension-request' ? null : 'extension-request')}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      activeAction === 'extension-request'
                        ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                        : 'text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    title="Request extension"
                  >
                    <span aria-hidden="true" className="text-base">⏳</span>
                  </button>
                )}

                {/* Dispute (brand or buyer, not inquiry) */}
                {showOrderActions && selectedOrder?.canDispute && (
                  <button
                    type="button"
                    onClick={() => setActiveAction(activeAction === 'dispute' ? null : 'dispute')}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      activeAction === 'dispute'
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                        : 'text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    title="Open dispute"
                  >
                    <span className="text-base" role="img" aria-label="dispute">⚠️</span>
                  </button>
                )}

                {/* View Order (not inquiry) — uses orderDetailUrl for canonical order page */}
                {showOrderActions && selectedOrder?.orderDetailUrl && (
                  <button
                    type="button"
                    onClick={() => openRoute(selectedOrder.orderDetailUrl as string)}
                    className="rounded-lg px-2.5 py-1.5 text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    title="View Order"
                  >
                    <span className="text-base" role="img" aria-label="order">📦</span>
                  </button>
                )}

                {/* Refresh */}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-lg px-2.5 py-1.5 text-theme-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  title="Refresh"
                >
                  <span aria-hidden="true" className="text-base">↺</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactDetails(true)}
                  className="rounded-lg px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 xl:hidden"
                  title="Conversation details"
                >
                  <span aria-hidden="true" className="text-base">☰</span>
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {messagesLoading && messages.length === 0 ? (
                <div className="space-y-3 py-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`message-bubble-skeleton-${index}`}
                      className={`h-12 animate-pulse rounded-2xl bg-gray-200/80 dark:bg-white/[0.08] ${
                        index % 2 === 0 ? 'mr-14' : 'ml-14'
                      }`}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span aria-hidden="true" className="mb-2 text-4xl text-gray-300 dark:text-gray-700">💬</span>
                  <p className="text-sm text-theme-secondary">No messages yet</p>
                  <p className="text-xs text-theme-secondary mt-1">Start the conversation</p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/8" />
                      <span className="text-[10px] font-medium text-theme-secondary uppercase tracking-wider">{group.date}</span>
                      <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/8" />
                    </div>
                    {group.msgs.map((msg) => (
                      <div key={msg.id} ref={(node) => { messageNodeRefs.current[msg.id] = node; }}>
                        <MessageBubble message={msg} isOwn={!!actorId && msg.senderUserId === actorId} />
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Extension response panel (buyer side, when pending request) */}
            {surface === 'BUYER' && latestOpenExtensionRequest && (
              <ExtensionResponsePanel
                requestedDays={latestOpenExtensionRequest.requestedExtraDays}
                onRespond={handleRespondToExtension}
                loading={actionLoading}
              />
            )}

            {/* Inline action panels */}
            {activeAction === 'extension-request' && (
              <ExtensionRequestPanel
                onSubmit={handleRequestExtension}
                onCancel={() => setActiveAction(null)}
                loading={actionLoading}
              />
            )}
            {activeAction === 'dispute' && (
              <DisputePanel
                contextType={activeConversation.contextType}
                onSubmit={handleOpenDispute}
                onCancel={() => setActiveAction(null)}
                loading={actionLoading}
              />
            )}

            {/* Compose area */}
            <ComposeArea
              onSend={handleSend}
              disabled={messagesLoading || sending}
              placeholder="Type a message..."
            />
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Contact Sidebar                                */}
      {/* ============================================================ */}
      {activeConversation && (
        <div className="hidden xl:flex w-72 shrink-0 flex-col border-l border-gray-200/60 dark:border-white/[0.04] bg-white/70 dark:bg-white/[0.02]">
          {contactSidebarProps ? <ChatContactSidebar {...contactSidebarProps} /> : null}
        </div>
      )}
      {activeConversation && showContactDetails && contactSidebarProps ? (
        <div className="fixed inset-0 z-layer-modal xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setShowContactDetails(false)}
            aria-label="Close conversation details"
          />
          <div className="absolute inset-y-0 right-0 w-[min(88vw,360px)] border-l border-gray-200/60 bg-white shadow-2xl dark:border-white/[0.04] dark:bg-[#111017]">
            <div className="flex items-center justify-between border-b border-gray-200/60 px-4 py-3 dark:border-white/[0.04]">
              <div className="text-sm font-semibold text-theme">Conversation details</div>
              <button
                type="button"
                onClick={() => setShowContactDetails(false)}
                className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                ×
              </button>
            </div>
            <div className="h-[calc(100%-57px)]">
              <ChatContactSidebar {...contactSidebarProps} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MessagingManagementPage;
