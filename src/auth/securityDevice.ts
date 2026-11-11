const KEY = 'wiez.security-device.v1';
let device: string | null = null;

/** Browser-profile hint for the owner's session list; never grants trust. */
export function getSecurityDeviceId(): string | null {
  if (device) return device;
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return (device = saved);
  } catch { /* Private mode may disable persistent storage. */ }
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;
  device = crypto.randomUUID();
  try { window.localStorage.setItem(KEY, device); } catch { /* Keep a per-document hint. */ }
  return device;
}
