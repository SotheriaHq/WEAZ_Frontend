import { useQueueTick } from './CustomOrderQueue';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { customOrderQueueApi } from '@/api/CustomOrderQueueApi';
import type { RootState } from '@/store';

const clockSession = Math.random().toString(36);

export default function RunwayQueueNotices({ placement = 'inline' }: { placement?: 'inline' | 'reels' }) {
  const profile = useSelector((state: RootState) => state.user.profile);
  const enabled = profile?.type === 'BRAND';
  const [dismissed, setDismissed] = useState<string[]>([]);
  const query = useQuery({ queryKey: ['brand-runway-queue-notices', profile?.id], queryFn: async () => ({ ...await customOrderQueueApi.notices(), receivedAt: performance.now(), clockSession }), enabled, staleTime: 0, refetchOnMount: 'always', refetchInterval: 30000, refetchOnWindowFocus: true });
  const tick = useQueueTick(enabled && Boolean(query.data?.notices.length));
  const current = query.data?.clockSession === clockSession && query.data.serverNow ? Date.parse(query.data.serverNow) + Math.max(0, tick - query.data.receivedAt) : null;
  const notices = current == null ? [] : query.data?.notices.filter((notice) => !dismissed.includes(notice.id) && !notice.endedAt && Date.parse(notice.startsAt) <= current && (!notice.endsAt || Date.parse(notice.endsAt) > current)) ?? [];
  if (!enabled || (!query.isError && notices.length === 0)) return null;
  return <aside aria-label="Brand subscription notices" className={placement === 'reels' ? 'fixed inset-x-3 top-28 z-30 max-h-[35vh] space-y-2 overflow-y-auto rounded-2xl' : 'space-y-2'}>
    {query.isError ? <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-950 dark:bg-violet-950 dark:text-violet-100">Brand announcements are unavailable. <button className="queue-button" onClick={() => void query.refetch()}>Retry</button></div> : notices.map((notice) => <section key={notice.id} className="rounded-2xl border border-violet-300 bg-violet-50 p-3 text-violet-950 shadow-sm dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100"><div className="flex items-start justify-between gap-3"><details className="min-w-0 flex-1"><summary className="cursor-pointer break-words text-sm font-semibold">📣 {notice.title}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{notice.body}</p>{notice.kind === 'FREE_ORDER_PERIOD' ? <p className="mt-2 text-xs">This notice is informational. Any benefit applies only where it is separately configured and shown at checkout.</p> : null}</details><button className="min-h-11 min-w-11 rounded-xl border border-violet-300 p-2 text-sm dark:border-violet-700" aria-label={`Dismiss ${notice.title}`} onClick={() => setDismissed((items) => [...items, notice.id])}>✕</button></div></section>)}
  </aside>;
}
