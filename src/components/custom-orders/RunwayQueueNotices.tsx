import { useQueueTick } from './useQueueTick';
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
  return <aside aria-label="Brand subscription notices" className={placement === 'reels' ? 'fixed inset-x-3 top-28 z-30 max-h-[35vh] space-y-2 overflow-y-auto rounded-lg bg-white px-4 py-2 dark:bg-black' : 'space-y-2 border-y border-slate-200 py-2 dark:border-slate-800'}>
    {query.isError ? <div className="text-sm text-slate-700 dark:text-slate-200">Brand announcements are unavailable. <button className="queue-button" onClick={() => void query.refetch()}>Retry</button></div> : notices.map((notice) => <section key={notice.id} className="text-slate-800 dark:text-slate-100"><div className="flex items-start justify-between gap-3"><details className="min-w-0 flex-1"><summary className="min-h-11 cursor-pointer break-words py-3 text-sm font-semibold">📣 {notice.title}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{notice.body}</p>{notice.kind === 'FREE_ORDER_PERIOD' ? <p className="mt-2 text-xs">This notice is informational. Any benefit applies only where it is separately configured and shown at checkout.</p> : null}</details><button className="queue-button min-w-11" aria-label={`Dismiss ${notice.title}`} onClick={() => setDismissed((items) => [...items, notice.id])}>✕</button></div></section>)}
  </aside>;
}
