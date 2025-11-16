import { useEffect, useMemo, useState } from 'react';

// Simple countdown hook returning a formatted string and expired flag
// Pass ISO date string or timestamp (ms). Returns { label, expired }
export function useCountdown(expiry?: string | number | Date | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiry]);

  const { label, expired } = useMemo(() => {
    if (!expiry) return { label: '', expired: true };
    const end = new Date(expiry).getTime();
    const diff = end - now;
    if (!Number.isFinite(end) || diff <= 0) return { label: 'Ended', expired: true };

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days > 0) return { label: `${days}d ${hours}h`, expired: false };
    // Show HH:MM:SS when under 24h
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return { label: `${hh}:${mm}:${ss}`, expired: false };
  }, [expiry, now]);

  return { label, expired };
}

export default useCountdown;
