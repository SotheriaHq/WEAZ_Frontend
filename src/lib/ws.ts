import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = (import.meta as any).env?.VITE_WS_URL ?? window.location.origin;
    socket = io(url, { withCredentials: true });
  }
  return socket;
}

export function joinContentRoom(contentType: string, contentId: string) {
  const s = getSocket();
  s.emit('join', { room: `${contentType}:${contentId}` });
}

