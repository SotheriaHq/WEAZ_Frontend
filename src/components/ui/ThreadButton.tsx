import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import {
  optimisticToggle,
  reconcile,
  setThreadState,
  wsApplied,
  adjustAggregatedCollectionThreads,
} from '@/features/engagementSlice';
import { ReactionsApi } from '@/api/ReactionsApi';
import { useRealtime } from '@/realtime';
import ThreadListModal from '@/components/engagement/ThreadListModal';
import { OfflineThreads } from '@/lib/offlineThreads';
import { toast } from 'sonner';
import ThreadActivityIndicator, { type ThreadActivityIndicatorState } from './ThreadActivityIndicator';
import { useThreadedStatusQuery } from '@/query/queries';

import './ThreadButton.css';

type ContentType = 'COLLECTION' | 'COLLECTION_MEDIA';

type ThreadVisualState =
  | 'idle_unthreaded'
  | 'idle_threaded'
  | 'animating_add'
  | 'animating_remove'
  | 'pending_server_ack'
  | 'revert_error';

type Props = {
  contentType: ContentType;
  contentId: string;
  initialCount?: number;
  initialThreaded?: boolean;
  className?: string;
  size?: number;
  ownerId?: string;
  parentCollectionId?: string;
};

const ThreadButton: React.FC<Props> = ({
  contentType,
  contentId,
  initialCount = 0,
  initialThreaded,
  className,
  size = 20,
  ownerId,
  parentCollectionId,
}) => {
  const dispatch = useDispatch();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const me = useSelector((s: RootState) => s.user.profile?.id);
  const realtime = useRealtime();

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [activityState, setActivityState] = React.useState<ThreadActivityIndicatorState>('idle');
  const [visualState, setVisualState] = React.useState<ThreadVisualState>(
    initialThreaded ? 'idle_threaded' : 'idle_unthreaded',
  );
  const [countAnimClass, setCountAnimClass] = React.useState('');
  const [revertNudge, setRevertNudge] = React.useState(false);

  const k = `${contentType}:${contentId}`;
  const stateItem = useSelector((s: RootState) => s.engagement.items?.[k]);

  const item = useMemo(() => {
    if (stateItem) {
      return {
        threadedByMe: stateItem.threadedByMe ?? !!initialThreaded,
        threadCount: stateItem.threadCount ?? initialCount,
      };
    }
    return {
      threadedByMe: !!initialThreaded,
      threadCount: initialCount,
    };
  }, [stateItem, initialThreaded, initialCount]);
  const shouldFetchInitialThreadState = initialThreaded === undefined && isAuth && Boolean(contentId);
  const threadStatusQuery = useThreadedStatusQuery(contentType, contentId, {
    enabled: shouldFetchInitialThreadState,
  });

  const currentThreadedRef = useRef(item.threadedByMe);
  const queuedDesiredRef = useRef<boolean | null>(null);
  const animationTimersRef = useRef<number[]>([]);

  const clearAnimationTimers = useCallback(() => {
    animationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    animationTimersRef.current = [];
  }, []);

  const queueTimer = useCallback((timerId: number) => {
    animationTimersRef.current.push(timerId);
  }, []);

  const playThreadAnimation = useCallback(
    (nextThreaded: boolean) => {
      clearAnimationTimers();

      if (prefersReducedMotion) {
        setActivityState('reduced');
        setCountAnimClass('thread-count-reduced');
        setVisualState(nextThreaded ? 'animating_add' : 'animating_remove');

        queueTimer(
          window.setTimeout(() => {
            setCountAnimClass('');
            setActivityState('pending');
            setVisualState('pending_server_ack');
          }, 150),
        );
        return;
      }

      if (nextThreaded) {
        setActivityState('adding');
        setCountAnimClass('');
        setVisualState('animating_add');

        queueTimer(
          window.setTimeout(() => {
            setCountAnimClass('thread-count-up');
          }, 520),
        );
        queueTimer(
          window.setTimeout(() => {
            setCountAnimClass('');
            setActivityState('pending');
            setVisualState('pending_server_ack');
          }, 680),
        );
        return;
      }

      setActivityState('removing');
      setCountAnimClass('');
      setVisualState('animating_remove');

      queueTimer(
        window.setTimeout(() => {
          setCountAnimClass('thread-count-down');
        }, 80),
      );
      queueTimer(
        window.setTimeout(() => {
          setCountAnimClass('');
          setActivityState('pending');
          setVisualState('pending_server_ack');
        }, 260),
      );
    },
    [clearAnimationTimers, prefersReducedMotion, queueTimer],
  );

  const triggerRevert = useCallback(() => {
    setVisualState('revert_error');
    setRevertNudge(true);
    setActivityState('revert');

    const nudgeTimer = window.setTimeout(() => {
      setRevertNudge(false);
      setActivityState('idle');
      setVisualState(currentThreadedRef.current ? 'idle_threaded' : 'idle_unthreaded');
    }, 180);

    queueTimer(nudgeTimer);
  }, [queueTimer]);

  useEffect(() => {
    currentThreadedRef.current = item.threadedByMe;
    if (!busy && visualState !== 'revert_error' && !visualState.startsWith('animating')) {
      setActivityState('idle');
      setVisualState(item.threadedByMe ? 'idle_threaded' : 'idle_unthreaded');
    }
  }, [busy, item.threadedByMe, visualState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updatePreference = () => {
      setPrefersReducedMotion(Boolean(mediaQuery.matches));
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => {
        mediaQuery.removeEventListener('change', updatePreference);
      };
    }

    mediaQuery.addListener(updatePreference);
    return () => {
      mediaQuery.removeListener(updatePreference);
    };
  }, []);

  useEffect(() => {
    const { joinCollection, joinCollectionMedia, onThread } = realtime;
    if (contentType === 'COLLECTION') joinCollection(contentId);
    else if (contentType === 'COLLECTION_MEDIA') joinCollectionMedia(contentId);

    if (initialThreaded !== undefined) {
      dispatch(
        setThreadState({
          contentType,
          contentId,
          threadedByMe: initialThreaded,
          threadCount: initialCount,
        }),
      );
      setInitializing(false);
    } else if (isAuth) {
      if (threadStatusQuery.data) {
        dispatch(
          setThreadState({
            contentType,
            contentId,
            threadedByMe: !!threadStatusQuery.data.threaded,
            threadCount: initialCount,
          }),
        );
        setInitializing(false);
      } else if (threadStatusQuery.error) {
        dispatch(
          setThreadState({
            contentType,
            contentId,
            threadedByMe: false,
            threadCount: initialCount,
          }),
        );
        setInitializing(false);
      } else {
        setInitializing(threadStatusQuery.isLoading);
      }
    } else {
      dispatch(
        setThreadState({
          contentType,
          contentId,
          threadedByMe: false,
          threadCount: initialCount,
        }),
      );
      setInitializing(false);
    }

    const unsub = onThread(contentType, contentId, (p: any) => {
      if (p.contentType === contentType && p.contentId === contentId) {
        dispatch(wsApplied({ contentType, contentId, threadCount: p.threadCount }));
        if (p.userId && me && ownerId && ownerId === me && p.userId !== me && p.threadCount > item.threadCount) {
          toast.info('Someone threaded your content!');
        }
      }
    });

    return () => {
      unsub();
      clearAnimationTimers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contentType,
    contentId,
    dispatch,
    isAuth,
    initialCount,
    initialThreaded,
    ownerId,
    threadStatusQuery.data?.threaded,
    threadStatusQuery.error,
    threadStatusQuery.isLoading,
  ]);

  const runToggle = useCallback(
    async (desiredThreaded: boolean) => {
      if (initializing) return;

      if (!isAuth) {
        toast.info('Please sign in to thread items.');
        return;
      }

      if (busy) {
        queuedDesiredRef.current = desiredThreaded;
        return;
      }

      const previousThreaded = currentThreadedRef.current;
      if (desiredThreaded === previousThreaded) {
        return;
      }

      const previousThreadCount = item.threadCount;

      setBusy(true);
      dispatch(
        optimisticToggle({
          contentType,
          contentId,
          nextThreaded: desiredThreaded,
        }),
      );

      if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
        dispatch(
          adjustAggregatedCollectionThreads({
            collectionId: parentCollectionId,
            delta: desiredThreaded ? 1 : -1,
          }),
        );
      }

      playThreadAnimation(desiredThreaded);

      try {
        const res =
          contentType === 'COLLECTION'
            ? await ReactionsApi.toggleCollectionThread(contentId)
            : await ReactionsApi.toggleCollectionMediaThread(contentId);

        dispatch(
          reconcile({
            contentType,
            contentId,
            threadCount: res.threads,
            threadedByMe: desiredThreaded,
          }),
        );

        if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
          const delta = res.threads - previousThreadCount;
          const optimisticDelta = desiredThreaded ? 1 : -1;
          const correction = delta - optimisticDelta;
          if (correction !== 0) {
            dispatch(
              adjustAggregatedCollectionThreads({
                collectionId: parentCollectionId,
                delta: correction,
              }),
            );
          }
        }
      } catch {
        if (!navigator.onLine) {
          if (contentType === 'COLLECTION') {
            OfflineThreads.enqueueCollectionToggle(contentId);
          } else if (contentType === 'COLLECTION_MEDIA') {
            OfflineThreads.enqueueCollectionMediaToggle(contentId);
          }
        } else {
          dispatch(
            optimisticToggle({
              contentType,
              contentId,
              nextThreaded: previousThreaded,
            }),
          );

          if (contentType === 'COLLECTION_MEDIA' && parentCollectionId) {
            dispatch(
              adjustAggregatedCollectionThreads({
                collectionId: parentCollectionId,
                delta: desiredThreaded ? -1 : 1,
              }),
            );
          }

          triggerRevert();
        }
      } finally {
        setBusy(false);

        const queuedDesired = queuedDesiredRef.current;
        queuedDesiredRef.current = null;

        const latestThreaded = currentThreadedRef.current;
        if (typeof queuedDesired === 'boolean' && queuedDesired !== latestThreaded) {
          void runToggle(queuedDesired);
        }
      }
    },
    [
      busy,
      contentId,
      contentType,
      dispatch,
      initializing,
      isAuth,
      item.threadCount,
      parentCollectionId,
      playThreadAnimation,
      triggerRevert,
    ],
  );

  const handleToggleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const desiredThreaded = !currentThreadedRef.current;
      if (busy) {
        queuedDesiredRef.current = desiredThreaded;
        return;
      }
      void runToggle(desiredThreaded);
    },
    [busy, runToggle],
  );

  const rootClassNames = ['thread-button-root', className ?? ''].filter(Boolean).join(' ');

  const buttonClassNames = [
    'thread-toggle-btn',
    busy ? 'thread-toggle-btn-pending' : '',
    revertNudge ? 'thread-toggle-btn-revert' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const countClassNames = ['thread-count-btn', countAnimClass].filter(Boolean).join(' ');

  return (
    <div className={rootClassNames}>
      <button
        type="button"
        onClick={handleToggleClick}
        disabled={initializing}
        aria-label={item.threadedByMe ? 'Unthread' : 'Thread'}
        aria-busy={busy}
        data-threaded={item.threadedByMe ? 'true' : 'false'}
        data-thread-state={visualState}
        className={buttonClassNames}
      >
        <ThreadActivityIndicator active={item.threadedByMe} size={size} state={activityState} />
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={countClassNames}
        aria-label={`View ${item.threadCount ?? 0} threads`}
      >
        {item.threadCount ?? 0}
      </button>

      <ThreadListModal
        open={open}
        onClose={() => setOpen(false)}
        contentId={contentId}
        contentType={contentType}
      />
    </div>
  );
};

export default ThreadButton;
