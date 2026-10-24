import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { QueuePresenter } from '@/api/CustomOrderQueueApi';
import { queueServerNow } from '@/features/orders/queueClock';
import { nextQueueClockDelay } from '@/features/orders/customOrderQueuePresentation';

const listeners = new Set<() => void>();
let clock = performance.now();
let timer: ReturnType<typeof setTimeout> | undefined;
const boundaries = new Map<symbol, number[]>();
function schedule() {
  clearTimeout(timer);
  timer = undefined;
  if (!listeners.size || document.visibilityState === 'hidden') return;
  timer = setTimeout(
    tick,
    nextQueueClockDelay(performance.now(), [...boundaries.values()].flat()),
  );
}
function tick() {
  clock = performance.now();
  listeners.forEach((listener) => listener());
  schedule();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    }
  };
}
const subscribeIdle = () => () => undefined;
export function useQueueTick(active = true, queue?: QueuePresenter | null) {
  const boundaryKey = useRef(Symbol('visible-queue'));
  useEffect(() => {
    if (!active || !queue) return;
    const monotonic = performance.now();
    const serverNow = queueServerNow(queue, monotonic);
    if (serverNow == null) return;
    const key = boundaryKey.current;
    boundaries.set(
      key,
      [queue.queueExpiresAt, queue.retainOpensAt, queue.retainClosesAt].map(
        (value, index) =>
          value
            ? monotonic + Date.parse(value) - serverNow + (index === 2 ? 1 : 0)
            : NaN,
      ),
    );
    schedule();
    return () => {
      boundaries.delete(key);
      schedule();
    };
  }, [active, queue]);
  return useSyncExternalStore(
    active ? subscribe : subscribeIdle,
    () => clock,
    () => 0,
  );
}
