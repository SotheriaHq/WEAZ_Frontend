type RetainQueue = { lane: string | null; canRetain: boolean; retainOpensAt: string | null; retainClosesAt: string | null };
export function formatQueueCountdown(deadline: string | null | undefined, now: number): string | null {
  const expiry = deadline ? Date.parse(deadline) : NaN;
  if (!Number.isFinite(expiry) || !Number.isFinite(now)) return null;
  const remaining = expiry - now;
  if (remaining <= 0) return 'Cancellation due - refreshing from WIEZ';
  const minutes = Math.ceil(remaining / 60000);
  if (remaining >= 48 * 3600000) return `Cancels in ${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  return `Cancels in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function canRetainQueue(queue: RetainQueue | null | undefined, now: number): boolean {
  if (!queue?.canRetain || !queue.lane || !['PENDING', 'UP_NEXT'].includes(queue.lane)) return false;
  const opens = queue.retainOpensAt ? Date.parse(queue.retainOpensAt) : NaN;
  const closes = queue.retainClosesAt ? Date.parse(queue.retainClosesAt) : NaN;
  return Number.isFinite(now) && Number.isFinite(opens) && Number.isFinite(closes) && now >= opens && now <= closes;
}
