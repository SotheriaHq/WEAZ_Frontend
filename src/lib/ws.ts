import { io, Socket } from 'socket.io-client';
import { getApiSecurityIdentity, subscribeAccessToken } from '@/api/httpClient';
import { bindWebSessionSocket } from '@/realtime/webSessionSocket';

let socket: Socket | null = null;
let unbindSession: (() => void) | null = null;
let unsubscribeTokens: (() => void) | null = null;
let boundIdentity: string | null = null;

export function getSocket(): Socket {
  const identity = getApiSecurityIdentity();
  if (socket && boundIdentity && identity && identity !== boundIdentity) disconnectSocket();
  if (!socket) {
    const url = (import.meta as any).env?.VITE_WS_URL ?? window.location.origin;
    socket = io(url, { withCredentials: true, autoConnect: false });
    const start = () => {
      if (!socket || unbindSession || !getApiSecurityIdentity()) return;
      boundIdentity = getApiSecurityIdentity();
      unbindSession = bindWebSessionSocket(socket);
      socket.connect();
    };
    unsubscribeTokens = subscribeAccessToken(start); start();
  }
  return socket;
}

export function disconnectSocket(): void {
  unsubscribeTokens?.(); unsubscribeTokens = null;
  unbindSession?.(); unbindSession = null; boundIdentity = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinContentRoom(contentType: string, contentId: string) {
  const s = getSocket();
  s.emit('join', { room: `${contentType}:${contentId}` });
}
