export function formatCooldownLabel(nextAllowedAt?: string): string {
  if (!nextAllowedAt) return 'later';
  const next = new Date(nextAllowedAt);
  if (String(next) === 'Invalid Date') return 'later';
  const now = new Date();
  const sameDay = next.toDateString() === now.toDateString();
  return sameDay
    ? next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : next.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
