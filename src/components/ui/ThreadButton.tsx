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
  const [visualState, setVisualState] = React.useState<ThreadVisualState>(
    initialThreaded ? 'idle_threaded' : 'idle_unthreaded',
  );
  const [iconAnimClass, setIconAnimClass] = React.useState('');
  const [countAnimClass, setCountAnimClass] = React.useState('');
  const [needleVisible, setNeedleVisible] = React.useState(false);
  const [trailVisible, setTrailVisible] = React.useState(false);
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
        setIconAnimClass('thread-icon-reduced');
        setCountAnimClass('thread-count-reduced');
        setNeedleVisible(false);
        setTrailVisible(false);
        setVisualState(nextThreaded ? 'animating_add' : 'animating_remove');

        queueTimer(
          window.setTimeout(() => {
            setIconAnimClass('');
            setCountAnimClass('');
            setVisualState('pending_server_ack');
          }, 150),
        );
        return;
      }

      if (nextThreaded) {
        setIconAnimClass('thread-icon-add');
        setCountAnimClass('');
        setNeedleVisible(true);
        setTrailVisible(true);
        setVisualState('animating_add');

        queueTimer(
          window.setTimeout(() => {
            setCountAnimClass('thread-count-up');
          }, 340),
        );
        queueTimer(
          window.setTimeout(() => {
            setNeedleVisible(false);
            setTrailVisible(false);
          }, 340),
        );
        queueTimer(
          window.setTimeout(() => {
            setIconAnimClass('');
            setCountAnimClass('');
            setVisualState('pending_server_ack');
          }, 560),
        );
        return;
      }

      setIconAnimClass('thread-icon-remove');
      setCountAnimClass('');
      setNeedleVisible(false);
      setTrailVisible(false);
      setVisualState('animating_remove');

      queueTimer(
        window.setTimeout(() => {
          setCountAnimClass('thread-count-down');
        }, 80),
      );
      queueTimer(
        window.setTimeout(() => {
          setIconAnimClass('');
          setCountAnimClass('');
          setVisualState('pending_server_ack');
        }, 260),
      );
    },
    [clearAnimationTimers, prefersReducedMotion, queueTimer],
  );

  const triggerRevert = useCallback(() => {
    setVisualState('revert_error');
    setRevertNudge(true);

    const nudgeTimer = window.setTimeout(() => {
      setRevertNudge(false);
      setVisualState(currentThreadedRef.current ? 'idle_threaded' : 'idle_unthreaded');
    }, 180);

    queueTimer(nudgeTimer);
  }, [queueTimer]);

  useEffect(() => {
    currentThreadedRef.current = item.threadedByMe;
    if (!busy && visualState !== 'revert_error') {
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
      setInitializing(true);
      const fetchApi =
        contentType === 'COLLECTION_MEDIA'
          ? ReactionsApi.getCollectionMediaIsThreaded
          : ReactionsApi.getCollectionIsThreaded;

      fetchApi(contentId)
        .then((threadStatus) => {
          dispatch(
            setThreadState({
              contentType,
              contentId,
              threadedByMe: !!threadStatus.threaded,
              threadCount: initialCount,
            }),
          );
        })
        .catch(() => {
          dispatch(
            setThreadState({
              contentType,
              contentId,
              threadedByMe: false,
              threadCount: initialCount,
            }),
          );
        })
        .finally(() => setInitializing(false));
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
  }, [contentType, contentId, dispatch, isAuth, initialCount, initialThreaded, ownerId]);

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
          return;
        }

        if (visualState !== 'revert_error') {
          setVisualState(latestThreaded ? 'idle_threaded' : 'idle_unthreaded');
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
      visualState,
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

  const iconClassNames = ['thread-emoji-wrap', iconAnimClass].filter(Boolean).join(' ');
  const countClassNames = ['thread-count-btn', countAnimClass].filter(Boolean).join(' ');
  const threadGlyphClassNames = [
    'thread-glyph',
    'thread-glyph-thread',
    item.threadedByMe ? 'thread-glyph-visible' : 'thread-glyph-hidden',
  ]
    .filter(Boolean)
    .join(' ');
  const needleGlyphClassNames = [
    'thread-glyph',
    'thread-glyph-needle',
    item.threadedByMe ? 'thread-glyph-hidden' : 'thread-glyph-visible',
  ]
    .filter(Boolean)
    .join(' ');

  const sizeStyle = {
    width: size,
    height: size,
    ['--thread-size' as '--thread-size']: `${size}px`,
  } as React.CSSProperties;

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
        <div style={sizeStyle} className={iconClassNames}>
          <span aria-hidden="true" className="thread-overlay-layer">
            {trailVisible ? <span className="thread-trail-pass" /> : null}
            {needleVisible ? <span className="thread-needle-pass">🪡</span> : null}
          </span>
          <span aria-hidden="true" className={threadGlyphClassNames}>
            🧵
          </span>
          <span aria-hidden="true" className={needleGlyphClassNames}>
            🪡
          </span>
        </div>
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
