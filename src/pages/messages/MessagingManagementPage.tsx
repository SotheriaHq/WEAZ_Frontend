import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { messagingApi, type InboxItem } from '@/api/MessagingApi';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';
import VLoader from '@/components/loaders/VLoader';

type ConversationContext = 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';
type Surface = 'BRAND' | 'BUYER';

type ConversationItem = {
  id: string;
  threadId: string;
  contextType: ConversationContext;
  contextId?: string;
  orderId?: string | null;
  customOrderId?: string | null;
  title: string;
  subtitle: string;
  participantName: string;
  participantId?: string | null;
  status?: string | null;
  createdAt: string;
  lastMessageAt?: string | null;
  unreadCount: number;
  hasUnread: boolean;
  mutedUntil?: string | null;
  archivedAt?: string | null;
};

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Orders', value: 'orders' },
  { label: 'Custom Orders', value: 'custom' },
  { label: 'Inquiries', value: 'inquiry' },
  { label: 'Archived', value: 'archived' },
] as const;

const SORTERS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Unread first', value: 'unread' },
] as const;

const formatRelative = (value?: string | null) => {
  if (!value) return 'No messages yet';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'No messages yet';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
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
  title: item.title,
  subtitle: item.subtitle,
  participantName:
    item.participant?.firstName || item.participant?.username || item.participant?.lastName || 'Participant',
  participantId: item.participant?.id || null,
  createdAt: item.createdAt,
  lastMessageAt: item.lastMessageAt ?? null,
  unreadCount: Number(item.unreadCount ?? 0),
  hasUnread: Boolean(item.hasUnread),
  mutedUntil: item.mutedUntil ?? null,
  archivedAt: item.archivedAt ?? null,
});

const MessagingManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const profile = useSelector((state: RootState) => state.user.profile);
  const surface: Surface = profile?.type === 'BRAND' ? 'BRAND' : 'BUYER';
  const brandId = surface === 'BRAND' ? profile?.id ?? null : null;

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'orders' | 'custom' | 'inquiry' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'unread'>('newest');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const highlightedMessageId = params.get('messageId');

  const getContextId = (item: ConversationItem) => {
    if (item.contextType === 'STANDARD_ORDER') {
      return item.orderId || item.contextId || item.threadId;
    }
    if (item.contextType === 'CUSTOM_ORDER') {
      return item.customOrderId || item.contextId || item.threadId;
    }
    return item.threadId;
  };

  useEffect(() => {
    let cancelled = false;

    const loadConversations = async () => {
      setLoading(true);
      try {
        const inbox = await messagingApi.getInbox({
          limit: 100,
          contextType: 'all',
          filter: 'all',
        });
        const nextConversations = (inbox.items || []).map(mapInboxItem);

        if (!cancelled) {
          setConversations(nextConversations);
        }
      } catch (error: any) {
        console.error('[MessagingManagementPage] inbox load failed', {
          surface,
          brandId,
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message,
        });
        if (!cancelled) {
          toast.error(error?.response?.data?.message || 'Unable to load conversations');
          setConversations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [brandId, surface]);

  const visibleConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = conversations.filter((item) => {
      if (filter === 'archived') return Boolean(item.archivedAt);
      if (item.archivedAt) return false;
      if (filter === 'unread' && !item.hasUnread && item.unreadCount <= 0) return false;
      if (filter === 'orders' && item.contextType !== 'STANDARD_ORDER') return false;
      if (filter === 'custom' && item.contextType !== 'CUSTOM_ORDER') return false;
      if (filter === 'inquiry' && item.contextType !== 'INQUIRY') return false;
      if (!normalizedQuery) return true;
      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.subtitle.toLowerCase().includes(normalizedQuery) ||
        item.participantName.toLowerCase().includes(normalizedQuery) ||
        item.threadId.toLowerCase().includes(normalizedQuery) ||
        String(item.contextId || '').toLowerCase().includes(normalizedQuery)
      );
    });

    rows.sort((a, b) => {
      if (sortBy === 'unread') {
        if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
          return a.unreadCount > 0 ? -1 : 1;
        }
      }

      const aTs = new Date(a.lastMessageAt || a.createdAt).getTime();
      const bTs = new Date(b.lastMessageAt || b.createdAt).getTime();
      return sortBy === 'oldest' ? aTs - bTs : bTs - aTs;
    });

    return rows;
  }, [conversations, filter, query, sortBy]);

  useEffect(() => {
    if (conversations.length === 0) {
      setActiveId('');
      return;
    }

    const queryOrderId = params.get('orderId');
    const queryCustomOrderId = params.get('customOrderId');

    if (queryOrderId) {
      const targetId = conversations.find((item) => item.contextType === 'STANDARD_ORDER' && item.orderId === queryOrderId)?.id;
      if (targetId) {
        setActiveId(targetId);
        return;
      }
    }

    if (queryCustomOrderId) {
      const targetId = conversations.find((item) => item.contextType === 'CUSTOM_ORDER' && item.customOrderId === queryCustomOrderId)?.id;
      if (targetId) {
        setActiveId(targetId);
        return;
      }
    }

    const queryThreadId = params.get('threadId') || params.get('thread');
    if (queryThreadId) {
      const targetId = queryThreadId;
      if (conversations.some((item) => item.id === targetId)) {
        setActiveId(targetId);
        return;
      }

      void messagingApi.resolveThreadRoute(queryThreadId).then((resolved) => {
        const next = new URLSearchParams(params);
        next.set('threadId', resolved.threadId);
        if (resolved.orderId) next.set('orderId', resolved.orderId);
        if (resolved.customOrderId) next.set('customOrderId', resolved.customOrderId);
        setParams(next, { replace: true });
      }).catch((error: any) => {
        console.error('[MessagingManagementPage] thread resolve failed', {
          threadId: queryThreadId,
          surface,
          brandId,
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message,
        });
        // Keep UI usable if thread cannot be resolved (e.g. expired deep-link context)
      });
    }

    if (!activeId || !conversations.some((item) => item.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations, params, setParams]);

  const activeConversation = conversations.find((item) => item.id === activeId) || null;

  const updateThreadPrefs = async (
    item: ConversationItem,
    payload: { archived?: boolean; markRead?: boolean; muteForHours?: number; unmute?: boolean },
  ) => {
    if (surface === 'BRAND' && !brandId) return;

    if (item.contextType === 'INQUIRY') {
      if (payload.markRead) {
        await messagingApi.markThreadReadById(item.threadId);
      }
    } else if (item.contextType === 'STANDARD_ORDER') {
      const contextId = getContextId(item);
      if (surface === 'BRAND') {
        await messagingApi.updateOrderThreadPreferencesForBrand(brandId as string, contextId, payload);
      } else {
        await messagingApi.updateOrderThreadPreferences(contextId, payload);
      }
    } else if (surface === 'BRAND') {
      await messagingApi.updateCustomOrderThreadPreferencesForBrand(brandId as string, getContextId(item), payload);
    } else {
      await messagingApi.updateCustomOrderThreadPreferences(getContextId(item), payload);
    }

    setConversations((prev) => prev.map((entry) => {
      if (entry.id !== item.id) return entry;
      const nextMutedUntil = payload.unmute
        ? null
        : payload.muteForHours
          ? new Date(Date.now() + payload.muteForHours * 60 * 60 * 1000).toISOString()
          : entry.mutedUntil ?? null;
      const nextArchivedAt = payload.archived === undefined
        ? entry.archivedAt ?? null
        : payload.archived
          ? new Date().toISOString()
          : null;
      return {
        ...entry,
        mutedUntil: nextMutedUntil,
        archivedAt: nextArchivedAt,
        unreadCount: payload.markRead ? 0 : entry.unreadCount,
        hasUnread: payload.markRead ? false : entry.hasUnread,
      };
    }));
  };

  const selectConversation = (item: ConversationItem) => {
    setActiveId(item.id);
    const next = new URLSearchParams(params);
    next.delete('orderId');
    next.delete('customOrderId');
    next.delete('threadId');
    next.delete('thread');
    next.delete('messageId');
    next.delete('openChat');
    next.set('threadId', item.threadId);
    if (item.contextType === 'STANDARD_ORDER' && item.orderId) {
      next.set('orderId', item.orderId);
    } else if (item.contextType === 'CUSTOM_ORDER' && item.customOrderId) {
      next.set('customOrderId', item.customOrderId);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="grid min-h-[72vh] grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Message Management</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Manage conversations from system, buyers, brands, and admins in one place.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === tab.value
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user, order ID, or message"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-white/10 dark:bg-white/5"
          />
          <div className="flex gap-2">
            {SORTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSortBy(option.value)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                  sortBy === option.value
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center">
              <VLoader size={40} phase="loading" className="mx-auto" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
              No conversations found.
            </div>
          ) : (
            visibleConversations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectConversation(item)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  activeId === item.id
                    ? 'border-orange-400 bg-orange-50/80 dark:bg-orange-500/10'
                    : 'border-gray-200 bg-white hover:border-orange-300 dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.participantName}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.title}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">{item.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatRelative(item.lastMessageAt || item.createdAt)}</p>
                    {item.unreadCount > 0 ? (
                      <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        {!activeConversation ? (
          <div className="flex h-full min-h-[320px] items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
            Select a thread to read and reply.
          </div>
        ) : (
          <>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{activeConversation.title}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeConversation.participantName} · {activeConversation.status || 'Active'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateThreadPrefs(activeConversation, { markRead: true })}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                >
                  ✅ Mark read
                </button>
                {activeConversation.archivedAt ? (
                  <button
                    type="button"
                    onClick={() => updateThreadPrefs(activeConversation, { archived: false })}
                    disabled={activeConversation.contextType === 'INQUIRY'}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                  >
                    📥 Unarchive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateThreadPrefs(activeConversation, { archived: true })}
                    disabled={activeConversation.contextType === 'INQUIRY'}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                  >
                    📦 Archive
                  </button>
                )}
                {activeConversation.mutedUntil ? (
                  <button
                    type="button"
                    onClick={() => updateThreadPrefs(activeConversation, { unmute: true })}
                    disabled={activeConversation.contextType === 'INQUIRY'}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                  >
                    🔔 Unmute
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateThreadPrefs(activeConversation, { muteForHours: 24 })}
                    disabled={activeConversation.contextType === 'INQUIRY'}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                  >
                    🔕 Mute 24h
                  </button>
                )}
                {activeConversation.participantId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${activeConversation.participantId}`)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                  >
                    View profile
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate('/settings?tab=notifications')}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 dark:border-white/10 dark:text-gray-200"
                >
                  Notification settings
                </button>
              </div>
            </header>

            <OrderMessagesPanel
              contextType={activeConversation.contextType}
              orderId={activeConversation.contextType === 'INQUIRY' ? undefined : getContextId(activeConversation)}
              threadId={activeConversation.threadId}
              title={`${activeConversation.participantName} conversation`}
              actorSurface={surface}
              brandId={brandId}
              highlightMessageId={highlightedMessageId}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default MessagingManagementPage;
