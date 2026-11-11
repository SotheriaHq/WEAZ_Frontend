import { getStoredAccessToken, getApiSecurityIdentity, subscribeAccessToken, refreshAccessToken } from '@/api/httpClient';
import { bindSessionSocket } from './sessionSocket';

export function bindWebSessionSocket(socket: Parameters<typeof bindSessionSocket>[0]): () => void {
  return bindSessionSocket(socket, { current: () => {
    const token = getStoredAccessToken(), identity = getApiSecurityIdentity();
    return token && identity ? { token, identity } : null;
  }, refresh: refreshAccessToken, subscribe: subscribeAccessToken,
  subscribeAvailable: listener => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
    const visible = () => { if (document.visibilityState === 'visible') listener(); };
    window.addEventListener('online', listener); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', listener); document.removeEventListener('visibilitychange', visible); };
  } });
}
