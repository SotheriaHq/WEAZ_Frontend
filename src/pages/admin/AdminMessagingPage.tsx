import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import MessageBubble, { formatDate } from '@/components/messaging/MessageBubble';
import { messagingApi, type ThreadMessage } from '@/api/MessagingApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import VLoader from '@/components/loaders/VLoader';
import ImageWithFallback from '@/components/ImageWithFallback';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ContextFilter = 'all' | 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';

interface AdminInboxItem {
  threadId: string;
  contextType: string;
  orderId?: string | null;
  customOrderId?: string | null;
  status: string;
  title: string;
  subtitle: string;
  participants: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role: string;
  }[];
  lastMessageAt?: string | null;
  createdAt: string;
}

const CONTEXT_EMOJI: Record<string, string> = {
  STANDARD_ORDER: '📦',
  CUSTOM_ORDER: '🎨',
  INQUIRY: '💬',
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  READ_ONLY: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ARCHIVED: 'bg-gray-500/10 text-gray-500',
  BLOCKED: 'bg-red-500/10 text-red-600',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AdminMessagingPage: React.FC = () => {
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const canModerate = isSuperAdmin || hasPermission('MESSAGING_MODERATE');
  const [params, setParams] = useSearchParams();

  /* ---- Inbox state ---- */
  const [inbox, setInbox] = useState<AdminInboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState<{ cursorLastMessageAt: string; cursorThreadId: string } | null>(null);

  /* ---- Active thread state ---- */
  const [activeThreadId, setActiveThreadId] = useState<string | null>(params.get('threadId'));
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadInfo, setThreadInfo] = useState<any>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  /* ---- Moderation state ---- */
  const [moderateTarget, setModerateTarget] = useState<string | null>(null);
  const [moderateAction, setModerateAction] = useState<'hide' | 'redact' | null>(null);
  const [moderateReason, setModerateReason] = useState('');
  const [moderating, setModerating] = useState(false);
  const [systemMsg, setSystemMsg] = useState('');
  const [sendingSystem, setSendingSystem] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  /* ---- Fetch inbox ---- */
  const fetchInbox = useCallback(async (append = false) => {
    setInboxLoading(true);
    try {
      const result = await messagingApi.getAdminInbox({
        limit: 25,
        contextType: contextFilter,
        q: searchQ.trim() || undefined,
        ...(append && endCursor ? endCursor : {}),
      });
      const items = result?.items ?? [];
      setInbox((prev) => (append ? [...prev, ...items] : items));
      setHasMore(result?.hasNextPage ?? false);
      setEndCursor(result?.endCursor ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load inbox');
    } finally {
      setInboxLoading(false);
    }
  }, [contextFilter, endCursor, searchQ]);

  useEffect(() => {
    void fetchInbox(false);
  }, [contextFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Fetch thread messages ---- */
  const loadThread = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId);
    setMessagesLoading(true);
    setMessages([]);
    setModerateTarget(null);
    setModerateAction(null);
    try {
      const [thread, msgs] = await Promise.all([
        messagingApi.getAdminThread(threadId),
        messagingApi.getAdminThreadMessages(threadId, { limit: 50 }),
      ]);
      setThreadInfo(thread);
      const sorted = [...msgs.items].sort(
        (a: ThreadMessage, b: ThreadMessage) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(sorted);
      setParams({ threadId }, { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load thread');
      setThreadInfo(null);
    } finally {
      setMessagesLoading(false);
      scrollToBottom();
    }
  }, [scrollToBottom, setParams]);

  /* Auto-load from URL param on mount */
  useEffect(() => {
    const tid = params.get('threadId');
    if (tid) void loadThread(tid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ---- Moderation handlers ---- */
  const handleModerate = async () => {
    if (!moderateTarget || !moderateAction || !moderateReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setModerating(true);
    try {
      if (moderateAction === 'hide') {
        await messagingApi.adminHideMessage(moderateTarget, moderateReason.trim());
        toast.success('Message hidden');
      } else {
        await messagingApi.adminRedactMessage(moderateTarget, moderateReason.trim());
        toast.success('Message redacted');
      }
      setModerateTarget(null);
      setModerateAction(null);
      setModerateReason('');
      if (activeThreadId) await loadThread(activeThreadId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Moderation failed');
    } finally {
      setModerating(false);
    }
  };

  const handleReopen = async () => {
    if (!activeThreadId) return;
    try {
      await messagingApi.adminReopenThread(activeThreadId);
      toast.success('Thread reopened');
      await loadThread(activeThreadId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reopen thread');
    }
  };

  const handleSendSystem = async () => {
    if (!activeThreadId) return;
    if (!systemMsg.trim()) { toast.error('Message required'); return; }
    setSendingSystem(true);
    try {
      await messagingApi.adminSendSystemMessage(activeThreadId, { bodyText: systemMsg.trim() });
      toast.success('System message sent');
      setSystemMsg('');
      await loadThread(activeThreadId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send system message');
    } finally {
      setSendingSystem(false);
    }
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-4">
      <AdminBreadcrumb segments={[{ label: 'Chat Management' }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💬 Chat Management</h1>

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* ---- Left panel: Browsable inbox ---- */}
        <div className="w-80 shrink-0 flex flex-col rounded-xl bg-white/60 dark:bg-white/[0.02] overflow-hidden">
          {/* Search */}
          <div className="p-3 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void fetchInbox(false); }}
                placeholder="Search conversations..."
                className="w-full rounded-lg bg-gray-100/80 dark:bg-white/5 px-3 py-2 pl-8 text-xs outline-none focus:ring-1 focus:ring-purple-400/50 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'STANDARD_ORDER', 'CUSTOM_ORDER', 'INQUIRY'] as ContextFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setContextFilter(f)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    contextFilter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'STANDARD_ORDER' ? '📦 Orders' : f === 'CUSTOM_ORDER' ? '🎨 Custom' : '💬 Inquiry'}
                </button>
              ))}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {inboxLoading && inbox.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <VLoader size={24} phase="loading" />
              </div>
            ) : inbox.length === 0 ? (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">No conversations found</p>
            ) : (
              <>
                {inbox.map((item) => {
                  const isActive = activeThreadId === item.threadId;
                  const displayName = item.participants
                    .map((p) => p.firstName || p.username || 'Unknown')
                    .join(', ');
                  const avatarParticipant = item.participants[0];

                  return (
                    <button
                      key={item.threadId}
                      type="button"
                      onClick={() => void loadThread(item.threadId)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="h-9 w-9 rounded-full overflow-hidden">
                          {avatarParticipant?.profileImage ? (
                            <ImageWithFallback
                              fileId={avatarParticipant.profileImage}
                              alt={displayName}
                              fit="cover"
                              className="h-9 w-9"
                              rounded="full"
                              fallbackName={displayName}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-fuchsia-500 text-xs font-bold text-white">
                              {displayName.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">
                          {CONTEXT_EMOJI[item.contextType] || '💬'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 shrink-0 ml-1">
                            {item.lastMessageAt
                              ? new Date(item.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{item.title}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.subtitle}</p>
                        <span className={`inline-block mt-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${STATUS_BADGE[item.status] || 'bg-gray-100 text-gray-500'}`}>
                          {item.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => void fetchInbox(true)}
                    disabled={inboxLoading}
                    className="w-full py-2 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                  >
                    {inboxLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ---- Right panel: Thread viewer ---- */}
        <div className="flex-1 flex flex-col rounded-xl bg-white/60 dark:bg-white/[0.02] overflow-hidden">
          {!activeThreadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <span className="text-5xl mb-3">💬</span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Select a conversation</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose a thread from the list to view messages and manage</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              {threadInfo && (
                <div className="px-4 py-3 bg-white/40 dark:bg-white/[0.02] shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Thread <span className="font-mono text-purple-600 dark:text-purple-400">#{threadInfo.id?.slice(0, 12)}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Status: {threadInfo.status || 'N/A'} · {messages.length} messages
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canModerate && (
                        <button
                          type="button"
                          onClick={handleReopen}
                          className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                        >
                          🔓 Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void loadThread(activeThreadId)}
                        className="rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <VLoader size={32} phase="loading" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <span className="text-3xl mb-2">📭</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No messages</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-gray-200/40 dark:bg-white/5" />
                        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{group.date}</span>
                        <div className="flex-1 h-px bg-gray-200/40 dark:bg-white/5" />
                      </div>
                      {group.msgs.map((msg) => (
                        <div key={msg.id} className="group relative">
                          <MessageBubble message={msg} isOwn={false} />
                          {canModerate && msg.visibilityState === 'VISIBLE' && msg.kind === 'USER' && (
                            <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => { setModerateTarget(msg.id); setModerateAction('hide'); setModerateReason(''); }}
                                className="rounded bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300"
                                title="Hide"
                              >
                                🙈 Hide
                              </button>
                              <button
                                type="button"
                                onClick={() => { setModerateTarget(msg.id); setModerateAction('redact'); setModerateReason(''); }}
                                className="rounded bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 dark:text-rose-300"
                                title="Redact"
                              >
                                ✂️ Redact
                              </button>
                            </div>
                          )}
                          {msg.visibilityState !== 'VISIBLE' && (
                            <span className="ml-2 text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase">
                              [{msg.visibilityState}]
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Moderation action bar */}
              {moderateTarget && moderateAction && (
                <div className="px-4 py-3 bg-red-50/50 dark:bg-red-500/5 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-red-800 dark:text-red-300">
                      {moderateAction === 'hide' ? '🙈 Hide' : '✂️ Redact'} message #{moderateTarget.slice(0, 8)}
                    </span>
                    <button type="button" onClick={() => { setModerateTarget(null); setModerateAction(null); }} className="text-[10px] text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={moderateReason}
                      onChange={(e) => setModerateReason(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleModerate(); }}
                      placeholder="Moderation reason..."
                      className="flex-1 rounded-lg bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-red-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => void handleModerate()}
                      disabled={moderating || !moderateReason.trim()}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {moderating ? '...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {/* System message composer */}
              {canModerate && activeThreadId && messages.length > 0 && (
                <div className="px-4 py-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0">📢</span>
                    <input
                      type="text"
                      value={systemMsg}
                      onChange={(e) => setSystemMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleSendSystem(); }}
                      placeholder="Send system message..."
                      className="flex-1 rounded-lg bg-gray-100/80 dark:bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendSystem()}
                      disabled={sendingSystem || !systemMsg.trim()}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {sendingSystem ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessagingPage;
